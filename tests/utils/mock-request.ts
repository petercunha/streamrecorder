import { NextRequest } from 'next/server';

/**
 * Creates a mock NextRequest for API testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;
  
  const request = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;

  // Add Next.js specific properties
  Object.defineProperty(request, 'nextUrl', {
    get() {
      return new URL(url);
    },
  });

  Object.defineProperty(request, 'json', {
    value: () => Promise.resolve(body || {}),
  });

  return request;
}

/**
 * Helper to create GET request
 */
export function createGetRequest(url: string, headers?: Record<string, string>): NextRequest {
  return createMockRequest(url, { method: 'GET', headers });
}

/**
 * Helper to create POST request
 */
export function createPostRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): NextRequest {
  return createMockRequest(url, { method: 'POST', body, headers });
}

/**
 * Helper to create PATCH request
 */
export function createPatchRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): NextRequest {
  return createMockRequest(url, { method: 'PATCH', body, headers });
}

/**
 * Helper to create DELETE request
 */
export function createDeleteRequest(url: string, headers?: Record<string, string>): NextRequest {
  return createMockRequest(url, { method: 'DELETE', headers });
}
