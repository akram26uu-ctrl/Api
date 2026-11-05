/**
 * ORDIUM Shipping API Service (carriers, settings, routes, shipments, pending decisions).
 */

import { ordiumClient, ordiumFetch } from './client';
import type {
  CarrierAccount, CarrierListResponse, CarrierWarehouse, NextPickup, PendingAction, PendingListResponse,
  Shipment, ShipmentListResponse, ShippingRoute, ShippingRouteWrite, ShippingSettings, ShippingSettingsUpdate,
} from './types';

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

const id = encodeURIComponent;
const json = (method: string, body?: unknown): RequestInit =>
  ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const shippingApi = {
  listCarriers: () => ordiumFetch<CarrierListResponse>(withStore('/shipping/carriers')),
  linkCarrier: (payload: { carrier_code: string; display_name: string; credentials?: Record<string, unknown> }) =>
    ordiumFetch<CarrierAccount>(withStore('/shipping/carriers'), json('POST', payload)),
  testCarrier: (accountId: string) =>
    ordiumFetch<CarrierAccount>(withStore(`/shipping/carriers/${id(accountId)}/test`), json('POST')),
  disableCarrier: (accountId: string) =>
    ordiumFetch<CarrierAccount>(withStore(`/shipping/carriers/${id(accountId)}/disable`), json('POST')),
  deleteCarrier: (accountId: string) =>
    ordiumFetch<void>(withStore(`/shipping/carriers/${id(accountId)}`), json('DELETE')),
  listWarehouses: (accountId: string) =>
    ordiumFetch<CarrierWarehouse[]>(withStore(`/shipping/carriers/${id(accountId)}/warehouses`)),

  getSettings: () => ordiumFetch<ShippingSettings>(withStore('/shipping/settings')),
  updateSettings: (payload: ShippingSettingsUpdate) =>
    ordiumFetch<ShippingSettings>(withStore('/shipping/settings'), json('PUT', payload)),

  listRoutes: () => ordiumFetch<ShippingRoute[]>(withStore('/shipping/routes')),
  createRoute: (payload: ShippingRouteWrite) =>
    ordiumFetch<ShippingRoute>(withStore('/shipping/routes'), json('POST', payload)),
  updateRoute: (routeId: string, payload: ShippingRouteWrite) =>
    ordiumFetch<ShippingRoute>(withStore(`/shipping/routes/${id(routeId)}`), json('PUT', payload)),
  deleteRoute: (routeId: string) =>
    ordiumFetch<void>(withStore(`/shipping/routes/${id(routeId)}`), json('DELETE')),

  listShipments: (query: { status?: string; source?: string; q?: string; page?: number; limit?: number } = {}) =>
    ordiumFetch<ShipmentListResponse>(withStore('/shipping/shipments', query)),
  getShipment: (shipmentId: string) =>
    ordiumFetch<Shipment>(withStore(`/shipping/shipments/${id(shipmentId)}`)),
  dispatchOrder: (orderId: string) =>
    ordiumFetch<Shipment>(withStore('/shipping/shipments'), json('POST', { order_id: orderId })),
  retryShipment: (shipmentId: string) =>
    ordiumFetch<Shipment>(withStore(`/shipping/shipments/${id(shipmentId)}/retry`), json('POST')),
  cancelShipment: (shipmentId: string) =>
    ordiumFetch<Shipment>(withStore(`/shipping/shipments/${id(shipmentId)}/cancel`), json('POST')),
  nextPickups: () => ordiumFetch<{ data: NextPickup[] }>(withStore('/shipping/next-pickups')),

  listPending: (query: { reason?: 'review' | 'stock' | 'rejected'; page?: number; limit?: number } = {}) =>
    ordiumFetch<PendingListResponse>(withStore('/shipping/pending', query)),
  /** action 'dispatch-from' requires body `{ warehouse_id }`. */
  pendingAction: (shipmentId: string, action: PendingAction, body?: { warehouse_id: string }) =>
    ordiumFetch<Shipment>(withStore(`/shipping/pending/${id(shipmentId)}/${action}`), json('POST', body)),
};
