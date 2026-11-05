/**
 * ORDIUM Inventory API Service (products, stock, deposits, movements).
 */

import { ordiumFetch } from './client';
import { id, json, withStore } from './queryHelpers';
import type { Deposit, DepositLine, MovementPage, Product, StockRow, UnmappedProduct } from './types';


export const inventoryApi = {
  listProducts: () => ordiumFetch<Product[]>(withStore('/inventory/products')),
  createProduct: (payload: { sku: string; name: string; fulfillment?: 'carrier' | 'merchant'; weight_grams?: number | null }) =>
    ordiumFetch<Product>(withStore('/inventory/products'), json('POST', payload)),
  updateProduct: (productId: string, payload: { name?: string; fulfillment?: 'carrier' | 'merchant'; weight_grams?: number | null }) =>
    ordiumFetch<Product>(withStore(`/inventory/products/${id(productId)}`), json('PUT', payload)),
  linkProduct: (productId: string, payload: { carrier_account_id: string; external_product_id: string }) =>
    ordiumFetch<{ product_id: string; carrier_account_id: string; external_product_id: string }>(
      withStore(`/inventory/products/${id(productId)}/links`), json('POST', payload)),
  listUnmapped: () => ordiumFetch<UnmappedProduct[]>(withStore('/inventory/products/unmapped')),

  getStock: (opts: { refresh?: boolean } = {}) =>
    ordiumFetch<StockRow[]>(withStore('/inventory/stock', { refresh: opts.refresh ? 1 : undefined })),

  listDeposits: () => ordiumFetch<Deposit[]>(withStore('/inventory/deposits')),
  createDeposit: (payload: { carrier_account_id: string; warehouse_id?: string | null; reference: string; lines: DepositLine[] }) =>
    ordiumFetch<Deposit>(withStore('/inventory/deposits'), json('POST', payload)),
  setDepositStatus: (depositId: string, status: 'in_transit' | 'counting' | 'received') =>
    ordiumFetch<Deposit>(withStore(`/inventory/deposits/${id(depositId)}/status`), json('POST', { status })),

  listMovements: (query: { page?: number; limit?: number } = {}) =>
    ordiumFetch<MovementPage>(withStore('/inventory/movements', query)),
};
