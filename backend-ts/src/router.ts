import type {
  ApiResponse,
  NormalizedRequest,
} from './types.js';
import type { RuntimeConfig } from './config.js';
import { HttpError } from './types.js';
import type { FitnessRepository } from './repository.js';
import type { UserItem } from './types.js';

export interface RouteContext {
  readonly request: NormalizedRequest;
  readonly repository: FitnessRepository;
  readonly config: RuntimeConfig;
  readonly cors: Record<string, string>;
  requireUser(): Promise<UserItem>;
}

export type RouteParams = Record<string, number | string>;

export type RouteHandler = (
  context: RouteContext,
  params: RouteParams,
) => Promise<ApiResponse> | ApiResponse;

export interface RouteDefinition {
  method?: string | ReadonlyArray<string>;
  pattern: string;
  /** Protected static routes authenticate before rejecting a bad method. */
  authRequired?: boolean;
  authBeforeMethod?: boolean;
  handle: RouteHandler;
}

interface RegisteredRoute extends RouteDefinition {
  methods: ReadonlyArray<string> | undefined;
  matcher: RegExp;
  readonly authRequired: boolean;
  readonly authBeforeMethod: boolean;
}

export interface Router {
  add(route: RouteDefinition): void;
  handle(context: Omit<RouteContext, 'requireUser'> & {
    requireUser(): Promise<UserItem>;
  }): Promise<ApiResponse>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(pattern: string): RegExp {
  const segments = pattern.split('/').filter(Boolean).map((segment) => {
    if (!segment.startsWith(':')) {
      return escapeRegExp(segment);
    }
    const rawName = segment.slice(1);
    const stringParameter = rawName.endsWith(':string');
    if (stringParameter) {
      const name = rawName.slice(0, -':string'.length);
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
        throw new Error(`Invalid route parameter ${segment}`);
      }
      return `(?<${name}>[^/]+)`;
    }
    const name = rawName;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
      throw new Error(`Invalid route parameter ${segment}`);
    }
    return `(?<${name}>\\d+)`;
  });
  return new RegExp(`^/${segments.join('/')}/?$`);
}

function methods(route: RouteDefinition): ReadonlyArray<string> | undefined {
  if (!route.method) return undefined;
  const values = Array.isArray(route.method)
    ? [...route.method]
    : [route.method];
  return values.map((value) => value.toUpperCase());
}

export function createRouter(): Router {
  const routes: RegisteredRoute[] = [];

  return {
    add(definition) {
      routes.push({
        ...definition,
        methods: methods(definition),
        matcher: compilePattern(definition.pattern),
        authRequired: definition.authRequired ?? false,
        authBeforeMethod: definition.authBeforeMethod ?? false,
      });
    },
    async handle(context) {
      routeLoop: for (const route of routes) {
        const match = route.matcher.exec(context.request.path);
        if (!match) continue;

        if (route.authRequired && route.authBeforeMethod) {
          await context.requireUser();
        }
        if (route.methods && !route.methods.includes(context.request.method)) {
          throw new HttpError(405, {
            detail: `Method "${context.request.method}" not allowed.`,
          });
        }

        const params: RouteParams = {};
        for (const [name, value] of Object.entries(match.groups ?? {})) {
          const parsed = /^\d+$/.test(value)
            ? Number.parseInt(value, 10)
            : value;
          if (/^\d+$/.test(value) && !Number.isSafeInteger(parsed)) {
            continue routeLoop;
          }
          params[name] = parsed;
        }
        return await route.handle(context, params);
      }

      throw new HttpError(404, { detail: 'Not found.' });
    },
  };
}
