import { jsonResponse } from '../http.js';
import type { RouteDefinition, RouteContext } from '../router.js';

export function registerHealthRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: 'GET',
    pattern: '/api/health',
    handle: async ({ repository, cors }: RouteContext) => {
      const ready = await repository.tableExists();
      return jsonResponse(
        ready ? 200 : 503,
        {
          status: ready ? 'healthy' : 'unhealthy',
          version: '1.0.0',
          framework: 'TypeScript Lambda',
        },
        cors,
      );
    },
  });
}
