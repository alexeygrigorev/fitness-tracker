import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

interface ArtifactVerificationResult {
  codeUri: string;
  handler: string;
  files: number;
}

const { verifyArtifact } = createRequire(import.meta.url)(
  path.resolve(process.cwd(), 'scripts/verify-lambda-artifact.mjs'),
) as {
  verifyArtifact: (artifactRoot: string) => Promise<ArtifactVerificationResult>;
};

let artifactRoot: string | undefined;

async function createArtifact(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'fitness-artifact-'));
  await mkdir(path.join(root, 'Api', 'dist'), { recursive: true });
  await mkdir(path.join(root, 'Api', 'src'), { recursive: true });
  await mkdir(path.join(root, 'Api', 'frontend', 'assets'), { recursive: true });
  await writeFile(
    path.join(root, 'Api', 'dist', 'lambda.cjs'),
    [
      'exports.handler = async () => ({',
      "  statusCode: 503,",
      "  headers: { 'content-type': 'application/json' },",
      "  body: JSON.stringify({ status: 'unhealthy' }),",
      '  isBase64Encoded: false,',
      '});',
    ].join('\n'),
  );
  await writeFile(
    path.join(root, 'Api', 'dist', 'lambda.cjs.map'),
    JSON.stringify({ version: 3, sources: ['lambda.ts'], mappings: '' }),
  );
  await writeFile(
    path.join(root, 'Api', 'package.json'),
    JSON.stringify({ name: 'artifact', type: 'module' }),
  );
  await writeFile(
    path.join(root, 'Api', 'openapi.json'),
    JSON.stringify({ openapi: '3.0.0' }),
  );
  await writeFile(
    path.join(root, 'Api', 'frontend', 'index.html'),
    '<!doctype html><title>Fitness</title>\n',
  );
  await writeFile(
    path.join(root, 'Api', 'frontend', 'vite.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" />\n',
  );
  await writeFile(
    path.join(root, 'Api', 'frontend', 'assets', 'app.test.js'),
    'window.test = true;\n',
  );
  await writeFile(path.join(root, 'template.yaml'), [
    'Resources:',
    '  Api:',
    '    Type: AWS::Serverless::Function',
    '    Properties:',
    '      CodeUri: Api',
    '      Handler: dist/lambda.cjs.handler',
    '',
  ].join('\n'));
  return root;
}

describe('LambdaArtifactGateTests', () => {
  afterEach(async () => {
    if (artifactRoot) {
      await rm(artifactRoot, { recursive: true, force: true });
      artifactRoot = undefined;
    }
  });

  it('verifies the handler, inventory, and health fallback', async () => {
    artifactRoot = await createArtifact();
    const result = await verifyArtifact(artifactRoot);
    assert.equal(result.codeUri, 'Api');
    assert.equal(result.handler, 'dist/lambda.cjs.handler');
    assert.equal(result.files, 7);
  });

  it('fails when SAM packaged a handlerless artifact', async () => {
    artifactRoot = await createArtifact();
    const { unlink } = await import('node:fs/promises');
    await unlink(path.join(artifactRoot, 'Api', 'dist', 'lambda.cjs'));
    await assert.rejects(
      () => verifyArtifact(artifactRoot!),
      /Lambda handler artifact was not found/,
    );
  });

  it('fails when source files leak into the deployable artifact', async () => {
    artifactRoot = await createArtifact();
    await writeFile(path.join(artifactRoot, 'Api', 'src', 'secret.ts'), 'export {};\n');
    await assert.rejects(
      () => verifyArtifact(artifactRoot!),
      /Unexpected deployable file: src[/\\]secret\.ts/,
    );
  });
});
