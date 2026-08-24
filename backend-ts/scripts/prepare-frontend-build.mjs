#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(backendRoot, '../web');
const webDist = join(webRoot, 'dist');
const frontendArtifact = join(backendRoot, 'frontend');

const build = spawnSync('npm', ['run', 'build:only'], {
  cwd: webRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_URL: '',
  },
});

if (build.status !== 0) {
  process.exitCode = build.status ?? 1;
} else if (!existsSync(join(webDist, 'index.html'))) {
  console.error('Vite completed without producing index.html.');
  process.exitCode = 1;
} else {
  cpSync(webDist, frontendArtifact, { recursive: true });
}
