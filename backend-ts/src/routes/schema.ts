import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
import type { RouteContext, RouteDefinition } from '../router.js';

export function registerSchemaRoutes(
  addRoute: (route: RouteDefinition) => void,
): void {
  addRoute({
    method: 'GET',
    pattern: '/api/schema',
    handle: async ({ cors }: RouteContext) => {
      try {
        const document = JSON.parse(
          await readFile(path.resolve(process.cwd(), 'openapi.json'), 'utf8'),
        );
        return jsonResponse(200, document, cors);
      } catch {
        throw new HttpError(503, { detail: 'OpenAPI schema is unavailable.' });
      }
    },
  });
}
