/** Maps shipping API 409 details to translation keys (shared by the shipments view and drawer). */
import { OrdiumApiError } from '../../lib/api/client';

const KNOWN = new Set([
  'order_needs_decision', 'out_of_stock', 'order_predates_carrier_link', 'active_shipment_exists', 'order_cancelled', 'order_closed',
  'no_carrier_configured', 'carrier_cancel_failed', 'unmapped_product', 'mixed_source', 'no_store', 'no_answer', 'awaiting_confirmation',
  'carrier_auth_failed', 'carrier_not_available', 'carrier_already_linked', 'carrier_in_use', 'carrier_link_failed', 'carrier_unreachable',
  'store_id_required', 'fallback_same_as_primary', 'carrier_account_invalid',
]);

export const shippingErrorMessage = (err: unknown, t: (key: string, fallback: string) => string): string => {
  const e = err as Partial<OrdiumApiError> | undefined;
  const raw = e?.message || '';
  if (KNOWN.has(raw)) return t(`shipping.errors.${raw}`, raw);
  if (e?.statusCode === 404) return t('shipping.errors.not_found', 'لم يُعثر على الطلب أو الشحنة.');
  if (e?.statusCode === 409 && raw.startsWith('Shipment is ')) return t('shipping.errors.wrong_state', 'لا يمكن تنفيذ هذا الإجراء في حالة الشحنة الحالية.');
  return t('shipping.errors.generic', 'تعذر تنفيذ الإجراء. حاول مجددًا.');
};
