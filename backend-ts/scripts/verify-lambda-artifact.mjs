import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function scalar(template, key) {
  const match = template.match(new RegExp(`^\\s+${key}:\\s*(\\S+)\\s*$`, 'm'));
  assert.ok(match, `${key} is missing from the built SAM template`);
  return match[1].replace(/^['"]|['"]$/g, '');
}

function handlerToFilePath(handler) {
  const separator = handler.lastIndexOf('.');
  assert.ok(separator > 0 && separator < handler.length - 1, `invalid Lambda handler: ${handler}`);

  const module = handler.slice(0, separator);
  assert.ok(!path.isAbsolute(module), 'Lambda handler must be relative');
  assert.ok(!module.split(/[/\\]/).includes('..'), 'Lambda handler must not escape the artifact');
  const extension = path.extname(module);
  return extension ? module : `${module}.js`;
}

async function walk(root, relative = '') {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Unexpected non-file artifact entry: ${child}`);
    }
    if (entry.isDirectory()) {
      const insideNodeModules = relative === 'node_modules' ||
        relative.startsWith(`node_modules${path.sep}`) ||
        child === 'node_modules';
      if (!insideNodeModules) {
        files.push(...await walk(path.join(root, entry.name), child));
      } else {
        await walk(path.join(root, entry.name), child);
      }
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unexpected non-file artifact entry: ${child}`);
    }
    files.push(child);
  }
  return files.sort();
}

async function readSourceMap(sourceMapPath) {
  const sourceMap = JSON.parse(await readFile(sourceMapPath, 'utf8'));
  assert.equal(sourceMap.version, 3, 'Lambda source map must use version 3');
}

export async function verifyArtifact(artifactRoot) {
  const root = path.resolve(artifactRoot);
  const rootStats = await stat(root);
  assert.ok(rootStats.isDirectory(), `artifact root is not a directory: ${root}`);

  const templatePath = path.join(root, 'template.yaml');
  const template = await readFile(templatePath, 'utf8');
  const codeUri = scalar(template, 'CodeUri');
  const handler = scalar(template, 'Handler');
  const codeRoot = path.resolve(root, codeUri);
  const handlerRelative = handlerToFilePath(handler);
  const handlerPath = path.resolve(codeRoot, handlerRelative);
  const sourceMapPath = `${handlerPath}.map`;

  await stat(handlerPath).catch(() => {
    throw new Error(`Lambda handler artifact was not found: ${handlerRelative}`);
  });
  await stat(sourceMapPath).catch(() => {
    throw new Error(`Lambda source map was not found: ${handlerRelative}.map`);
  });
  await readSourceMap(sourceMapPath);

  const deployableFiles = await walk(codeRoot);
  const allowedFiles = new Set([
    handlerRelative,
    `${handlerRelative}.map`,
    'openapi.json',
    'package.json',
    'package-lock.json',
    'README.md',
  ].map((entry) => path.normalize(entry)));
  for (const file of deployableFiles) {
    if (!allowedFiles.has(file)) {
      throw new Error(`Unexpected deployable file: ${file}`);
    }
  }

  const artifactRequire = createRequire(pathToFileURL(handlerPath).href);
  const exported = artifactRequire(handlerPath);
  assert.equal(typeof exported.handler, 'function', 'Lambda artifact does not export handler');

  const savedEnvironment = Object.fromEntries(
    ['TABLE_NAME', 'JWT_SECRET', 'NODE_ENV', 'DYNAMODB_ENDPOINT']
      .map((name) => [name, process.env[name]]),
  );
  process.env.TABLE_NAME = 'artifact-smoke-table';
  process.env.JWT_SECRET = 'artifact-secret-value-that-is-deliberately-long-enough';
  process.env.NODE_ENV = 'production';
  process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:1';

  try {
    const response = await exported.handler({
      httpMethod: 'GET',
      path: '/api/health/',
      headers: {},
      queryStringParameters: null,
      body: null,
      isBase64Encoded: false,
    });
    assert.equal(response.statusCode, 503);
    assert.equal(JSON.parse(response.body).status, 'unhealthy');
  } finally {
    for (const [name, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }

  return {
    codeUri,
    handler,
    files: deployableFiles.length,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  verifyArtifact(process.argv[2] ?? '.tmp/sam-build')
    .then((result) => {
      console.log(
        `Verified Lambda artifact ${result.codeUri} (${result.files} packaged files); ` +
        `handler ${result.handler} returned an expected health fallback.`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
