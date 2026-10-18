import { AuthSession, RegisterPayload, LoginCredentials } from './types';

/**
 * The control plane owns account/session endpoints.
 * Local development talks directly to localhost:8010. Production uses a
 * same-origin Vercel function so the HttpOnly cookie is first-party.
 */
const configuredControlPlaneUrl =
  typeof import.meta !== 'undefined'
    ? ((import.meta as any).env?.VITE_ORDIUM_CONTROL_PLANE_URL as string | undefined)
    : undefined;

const isDevelopment = Boolean((import.meta as any).env?.DEV);
const CONTROL_PLANE_URL = (
  isDevelopment
    ? (configuredControlPlaneUrl?.trim() || 'http://localhost:8010')
    : '/api/account'
).replace(/\/+$/, '');

export class ControlPlaneError extends Error {
  readonly statusCode: number;
  readonly requestId: string;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string, requestId: string) {
    super(message);
    this.name = 'ControlPlaneError';
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
  }
}

function errorMessage(status: number): string {
  switch (status) {
    case 400: return 'The request could not be processed.';
    case 401: return 'Invalid email or password.';
    case 403: return 'Your account is not active.';
    case 404: return 'The requested account resource was not found.';
    case 409: return 'An account with this email already exists.';
    case 422: return 'Please review the information you entered.';
    case 429: return 'Too many attempts. Please try again later.';
    case 500:
    case 502:
    case 504: return 'The ORDIUM account service is temporarily unavailable.';
    case 503: return 'ORDIUM workspace provisioning is temporarily unavailable.';
    default: return 'The ORDIUM account service returned an unexpected response.';
  }
}

async function readErrorPayload(response: Response): Promise<{ detail?: string; message?: string; error?: string }> {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

export async function controlPlaneFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Only account-auth endpoints may use this cookie-bearing client.
  if (!endpoint.startsWith('/api/v1/auth/')) {
    throw new ControlPlaneError(
      403,
      'CREDENTIAL_ISOLATION',
      'Non-auth requests must use the dashboard proxy, not the control-plane client directly.',
      'req_' + Date.now(),
    );
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(CONTROL_PLANE_URL + endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    throw new ControlPlaneError(
      0,
      'CONTROL_PLANE_UNREACHABLE',
      'Unable to reach the ORDIUM account service.' + (reason ? ' (' + reason + ')' : ''),
      'req_' + Date.now(),
    );
  }

  const requestId = response.headers.get('X-Request-ID') || 'req_' + Date.now();
  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const detail =
      (typeof payload.detail === 'string' && payload.detail) ||
      (typeof payload.message === 'string' && payload.message) ||
      (typeof payload.error === 'string' && payload.error) ||
      errorMessage(response.status);
    throw new ControlPlaneError(response.status, 'HTTP_' + response.status, detail, requestId);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return undefined as T;
  return response.json() as Promise<T>;
}

export const CONTROL_PLANE_CONFIG = { baseUrl: CONTROL_PLANE_URL };
