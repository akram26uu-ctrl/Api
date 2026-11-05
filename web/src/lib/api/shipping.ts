/**
 * ORDIUM Shipping API Service (carriers, settings, routes, shipments, pending decisions).
 */

import { ordiumFetch } from './client';
import { id, json, withStore } from './queryHelpers';
import type {
  CarrierAccount, CarrierListResponse, CarrierWarehouse, NextPickup, PendingAction, PendingListResponse,
  Shipment, ShipmentActionResponse, ShipmentListResponse, ShippingRoute, ShippingRouteWrite, ShippingSettings, ShippingSettingsUpdate,
} from './types';

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
    ordiumFetch<ShipmentActionResponse>(withStore('/shipping/shipments'), json('POST', { order_id: orderId })),
  retryShipment: (shipmentId: string) =>
    ordiumFetch<ShipmentActionResponse>(withStore(`/shipping/shipments/${id(shipmentId)}/retry`), json('POST')),
  cancelShipment: (shipmentId: string) =>
    ordiumFetch<Shipment>(withStore(`/shipping/shipments/${id(shipmentId)}/cancel`), json('POST')),
  nextPickups: () => ordiumFetch<{ data: NextPickup[] }>(withStore('/shipping/next-pickups')),

  listPending: (query: { reason?: 'review' | 'stock' | 'rejected'; page?: number; limit?: number } = {}) =>
    ordiumFetch<PendingListResponse>(withStore('/shipping/pending', query)),
  /** action 'dispatch-from' requires body `{ warehouse_id }`. */
  pendingAction: (shipmentId: string, action: PendingAction, body?: { warehouse_id: string }) =>
    ordiumFetch<Shipment>(withStore(`/shipping/pending/${id(shipmentId)}/${action}`), json('POST', body)),
};
