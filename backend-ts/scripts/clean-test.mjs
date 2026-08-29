import { rmSync } from 'node:fs';

rmSync('.tmp/ts-build', { recursive: true, force: true });
