import { ordiumClient } from './client';

// Internal helpers for shipping/inventory modules (not re-exported from index.ts).

/** Build `path?query` with the active store appended, like listOrders/getOrder. */
export function withStore(path: string, params: Record<string, string | number | undefined | null> = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const storeId = ordiumClient.getStoreId();
  if (storeId) qs.set('store_id', storeId);
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export const id = encodeURIComponent;
export const json = (method: string, body?: unknown): RequestInit =>
  ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

