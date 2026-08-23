import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ApiResponse, NormalizedRequest } from './types.js';

const mimeTypes: Record<string, string> = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function textResponse(
  status: number,
  message: string,
  cors: Record<string, string>,
): ApiResponse {
  return {
    statusCode: status,
    headers: { ...cors, 'content-type': 'text/plain; charset=utf-8' },
    body: message,
    isBase64Encoded: false,
  };
}

async function fileResponse(
  filePath: string,
  cors: Record<string, string>,
  cacheControl: string,
): Promise<ApiResponse> {
  const extension = path.extname(filePath).toLowerCase();
  const body = await readFile(filePath);
  const isText = extension === '.html' ||
    extension === '.svg' ||
    mimeTypes[extension]?.startsWith('text/') ||
    mimeTypes[extension] === 'application/json' ||
    mimeTypes[extension] === 'application/manifest+json';

  return {
    statusCode: 200,
    headers: {
      ...cors,
      'cache-control': cacheControl,
      'content-type': mimeTypes[extension] ?? 'application/octet-stream',
    },
    body: isText ? body.toString('utf8') : body.toString('base64'),
    isBase64Encoded: !isText,
  };
}

export async function serveSpa(
  request: NormalizedRequest,
  frontendBuild: string | undefined,
  cors: Record<string, string>,
): Promise<ApiResponse> {
  if (!frontendBuild) {
    return textResponse(500, 'Frontend path not configured.', cors);
  }

  const frontendRoot = path.resolve(frontendBuild);
  try {
    if (!(await stat(frontendRoot)).isDirectory()) {
      throw new Error('Frontend build path is not a directory');
    }
  } catch {
    return textResponse(503, `Frontend build not found at ${frontendRoot}`, cors);
  }

  let relativePath = '';
  try {
    relativePath = decodeURIComponent(request.path)
      .replace(/^\/+/, '')
      .split('?')[0];
    if (relativePath.includes('\0')) {
      throw new Error('Invalid path');
    }
  } catch {
    return textResponse(403, 'Access denied.', cors);
  }

  let filePath = '';
  try {
    filePath = path.resolve(frontendRoot, relativePath);
    if (filePath !== frontendRoot && !filePath.startsWith(`${frontendRoot}${path.sep}`)) {
      throw new Error('Path escapes the frontend root');
    }
    const stats = await stat(filePath);
    if (stats.isFile()) {
      const cacheControl = filePath.split(path.sep).at(-2) === 'assets'
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      return await fileResponse(filePath, cors, cacheControl);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EISDIR') {
      return textResponse(403, 'Access denied.', cors);
    }
  }

  try {
    return await fileResponse(
      path.join(frontendRoot, 'index.html'),
      cors,
      'no-store, must-revalidate',
    );
  } catch {
    return textResponse(
      503,
      'Frontend build incomplete - index.html missing.',
      cors,
    );
  }
}
