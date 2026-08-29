import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError, type ApiResponse } from '../types.js';
import { jsonResponse } from '../http.js';
import type { RouteContext, RouteDefinition } from '../router.js';

function htmlResponse(html: string, cors: Record<string, string>): ApiResponse {
  return {
    statusCode: 200,
    headers: { ...cors, 'content-type': 'text/html; charset=utf-8' },
    body: html,
    isBase64Encoded: false,
  };
}

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/schema',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`;

const REDOC_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>ReDoc</title>
</head>
<body>
  <redoc spec-url="/api/schema"></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"></script>
</body>
</html>`;

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

  // Static HTML shells that load the viewer bundle from a CDN and point it at
  // the OpenAPI document served above.
  addRoute({
    method: 'GET',
    pattern: '/api/docs/',
    handle: async ({ cors }: RouteContext) => htmlResponse(SWAGGER_UI_HTML, cors),
  });

  addRoute({
    method: 'GET',
    pattern: '/api/redoc/',
    handle: async ({ cors }: RouteContext) => htmlResponse(REDOC_HTML, cors),
  });
}
