import { rmSync } from 'node:fs';

for (const path of ['dist', '.tmp/ts-build']) {
  rmSync(path, { recursive: true, force: true });
}
