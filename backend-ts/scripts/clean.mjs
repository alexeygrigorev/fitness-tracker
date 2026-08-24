import { rmSync } from 'node:fs';

for (const path of ['dist', 'frontend', '.tmp/ts-build']) {
  rmSync(path, { recursive: true, force: true });
}
