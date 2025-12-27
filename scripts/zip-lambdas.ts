/**
 * Zip Lambda function bundles for deployment
 */

import { readFileSync, createWriteStream, existsSync, mkdirSync } from 'fs';
import archiver from 'archiver';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lambdaFunctions = [
  'parseWorkout',
  'parseFood',
  'generateAdvice',
  'transcribeVoice',
  'analyzeFoodPhoto',
];

async function zipFunction(name: string): Promise<void> {
  const srcPath = join(__dirname, `../amplify/backend/function/${name}/dist/index.js`);
  const zipPath = join(__dirname, `../amplify/backend/function/${name}/dist/bundle.zip`);
  const distDir = join(__dirname, `../amplify/backend/function/${name}/dist`);

  if (!existsSync(srcPath)) {
    console.log(`Skipping ${name} - source file not found`);
    return;
  }

  // Ensure dist directory exists
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  const code = readFileSync(srcPath, 'utf-8');

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`Zipped ${name}: ${archive.pointer()} bytes`);
    resolve();
  });

  archive.on('error', (err) => {
    reject(err);
  });

  archive.pipe(output);
  archive.append(code, { name: 'index.js' });
  archive.finalize();
  });
}

async function main() {
  console.log('Zipping Lambda functions...\n');

  for (const fn of lambdaFunctions) {
    await zipFunction(fn);
  }

  console.log('\n✅ All Lambda functions zipped!');
}

main().catch(console.error);
