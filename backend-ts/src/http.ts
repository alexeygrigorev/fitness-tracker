import type {
  ApiResponse,
  JsonObject,
  NormalizedRequest,
} from './types.js';
import { HttpError } from './types.js';

interface RawEvent {
  version?: string;
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  isBase64Encoded?: boolean;
  body?: string | null;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };
}

function normalizeHeaders(headers: Record<string, string | undefined> | null | undefined) {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (value !== undefined && value !== '') {
      result[name.toLowerCase()] = value;
    }
  }
  return result;
}

function parseUrlEncoded(body: string): JsonObject {
  return Object.fromEntries(new URLSearchParams(body));
}

function attributeValue(input: string): string {
  return input.replace(/\\(.)/g, '$1');
}

function parseMultipart(body: Buffer, contentType: string): JsonObject {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundary) {
    throw new HttpError(400, { detail: 'JSON parse error - Missing boundary.' });
  }
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  const result: JsonObject = {};
  let position = body.indexOf(marker);

  while (position >= 0) {
    let start = position + marker.length;
    if (body.subarray(start, start + 2).toString() === '--') {
      break;
    }
    if (body.subarray(start, start + 2).toString() === '\r\n') {
      start += 2;
    }

    const end = body.indexOf(Buffer.concat([Buffer.from('\r\n'), marker]), start);
    if (end < 0) {
      throw new HttpError(400, { detail: 'JSON parse error - Malformed multipart body.' });
    }

    const section = body.subarray(start, end);
    const headerEnd = section.indexOf('\r\n\r\n');
    if (headerEnd < 0) {
      throw new HttpError(400, { detail: 'JSON parse error - Malformed multipart part.' });
    }
    const headers = section.subarray(0, headerEnd).toString('utf8');
    const value = section.subarray(headerEnd + 4);
    const disposition = /name="((?:[^"\\]|\\.)*)"/i.exec(headers);
    if (disposition) {
      result[attributeValue(disposition[1])] = value.toString('utf8');
    }
    position = end + 2;
  }
  return result;
}

export function parseBody(rawEvent: RawEvent, headers: Record<string, string>): unknown {
  const rawBody = rawEvent.body;
  if (!rawBody) {
    return {};
  }

  const encoding = headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  try {
    if (encoding === 'multipart/form-data') {
      const bytes = rawEvent.isBase64Encoded
        ? Buffer.from(rawBody, 'base64')
        : Buffer.from(rawBody, 'utf8');
      return parseMultipart(bytes, headers['content-type'] ?? '');
    }

    if (encoding === 'application/x-www-form-urlencoded') {
      return parseUrlEncoded(rawBody);
    }

    if (encoding === 'application/json' || rawBody.trimStart().startsWith('{') || rawBody.trimStart().startsWith('[')) {
      return JSON.parse(rawBody) as unknown;
    }
    return {};
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    const reason = error instanceof SyntaxError ? error.message : 'Invalid request body.';
    throw new HttpError(400, { detail: `JSON parse error - ${reason}` });
  }
}

export function normalizeRequest(event: unknown): NormalizedRequest {
  const rawEvent = event as RawEvent;
  const headers = normalizeHeaders(rawEvent.headers);
  const method = (
    rawEvent.requestContext?.http?.method ??
    rawEvent.httpMethod ??
    ''
  ).toUpperCase();
  const path = rawEvent.rawPath ?? rawEvent.path ?? rawEvent.requestContext?.http?.path ?? '/';
  const query = Object.fromEntries(
    Object.entries(rawEvent.queryStringParameters ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

  return {
    method,
    path,
    query,
    headers,
    body: parseBody(rawEvent, headers),
    origin: headers.origin,
  };
}

export function corsHeaders(
  request: NormalizedRequest,
  allowedOrigins: ReadonlySet<string>,
): Record<string, string> {
  const origin = request.origin;
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    vary: 'Origin',
  };
}

export function jsonResponse(
  status: number,
  payload: object,
  cors: Record<string, string> = {},
): ApiResponse {
  const headers: Record<string, string> = {
    ...cors,
    'content-type': 'application/json',
    'cross-origin-opener-policy': 'same-origin',
    'referrer-policy': 'same-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-frame-options': 'DENY',
  };
  return {
    statusCode: status,
    headers,
    body: JSON.stringify(payload),
    isBase64Encoded: false,
  };
}

export function emptyResponse(status: number, cors: Record<string, string>): ApiResponse {
  return {
    statusCode: status,
    headers: { ...cors },
    body: '',
    isBase64Encoded: false,
  };
}
