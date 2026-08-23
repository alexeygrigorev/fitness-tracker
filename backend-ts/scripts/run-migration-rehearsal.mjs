#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiledPath = (relativePath) =>
  pathToFileURL(join(backendRoot, '.tmp/ts-build', relativePath)).href;
const snapshotPath = resolve(
  process.argv[2] ?? join(backendRoot, '.tmp/migration-snapshot.json'),
);

const rawSnapshot = await readFile(snapshotPath, 'utf8');
const parsedSnapshot = JSON.parse(rawSnapshot);
const { buildMigrationItems } = await import(
  compiledPath('src/migration/snapshot.js')
);
const { loadMigrationItems } = await import(
  compiledPath('src/migration/load.js')
);
const { startTestApi } = await import(compiledPath('tests/helpers.js'));

const builtItems = buildMigrationItems(parsedSnapshot);
const api = await startTestApi({ exerciseIds: [] });
try {
  const result = await loadMigrationItems(
    { documentClient: api.documentClient, tableName: api.tableName },
    builtItems.allItems,
  );

  console.log(JSON.stringify({
    snapshotPath,
    snapshotSha256: createHash('sha256').update(rawSnapshot).digest('hex'),
    sourceRowCount: builtItems.sourceRowCount,
    domainItemCount: builtItems.domainItems.length,
    counterItemCount: builtItems.counterItems.length,
    ...result,
  }, null, 2));
} finally {
  api.stop();
}
