/** ORDIUM Pending-decision queue: orders held before dispatch until the merchant decides. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Link2, ChevronLeft, ChevronRight, Clock, PhoneOff, Check, X, Undo2, Archive, Send, ClipboardCheck } from 'lucide-react';
import type { Order, PendingAction, PendingItem, PendingListResponse } from '../../lib/api/types';
import { shippingApi } from '../../lib/api/shipping';
import { ordiumClient } from '../../lib/api/client';
import { Button } from '../common/Button';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { shippingErrorMessage } from './shippingErrors';
import { resolveWilaya } from './wilaya';
import type { DashboardRoute } from './DashboardLayout';
import { useLanguage } from '../../i18n/LanguageContext';

const TABS = ['review', 'stock', 'rejected'] as const;
type Tab = typeof TABS[number];
type Sort = 'oldest' | 'risk' | 'value';
const STALE_MS = 48 * 3600 * 1000;

interface Props { storeName?: string; onNavigate?: (route: DashboardRoute) => void }

export const PendingView: React.FC<Props> = ({ storeName, onNavigate }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [tab, setTab] = useState<Tab>('review');
  const [sort, setSort] = useState<Sort>('oldest');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PendingListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [warehouse, setWarehouse] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ item: PendingItem; action: 'reject' | 'archive' | 'cancel_stock' } | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: ToastMessage['type'], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 6000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await shippingApi.listPending({ reason: tab, page, limit: 20 })); }
    catch (err) { setData(null); setError(shippingErrorMessage(err, t)); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);
  useEffect(() => { void load(); }, [load]);

  const items = data?.data ?? [];
  const counts = data?.counts;
  const pagination = data?.pagination;
  const stale = useMemo(() => items.filter(i => Date.now() - new Date(i.created_at).getTime() > STALE_MS).length, [items]);
  const rows = useMemo(() => {
    const list = [...items];
    if (sort === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === 'risk') list.sort((a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1));
    else list.sort((a, b) => (b.cod_amount ?? -1) - (a.cod_amount ?? -1));
    return list;
  }, [items, sort]);

  const age = (v: string) => {
    const h = Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 3600000));
    return h < 48 ? `${h} ${t('pending.hours', 'س')}` : `${Math.floor(h / 24)} ${t('pending.days', 'يوم')}`;
  };
  const money = (i: PendingItem) => i.cod_amount == null ? '—' : `${i.cod_amount.toLocaleString(locale)} ${i.currency ?? ''}`.trim();
  const isStale = (i: PendingItem) => Date.now() - new Date(i.created_at).getTime() > STALE_MS;

  const run = async (item: PendingItem, action: PendingAction, doneKey: string) => {
    setBusy(item.shipment_id);
    try {
      let body: { warehouse_id: string } | undefined;
      if (action === 'dispatch-from') {
        const warehouseId = warehouse[item.shipment_id] ?? item.available_warehouses[0]?.id;
        if (!warehouseId) { notify('error', t('pending.no_warehouse', 'اختر مستودعًا به مخزون أولًا')); return; }
        body = { warehouse_id: warehouseId };
      }
      await shippingApi.pendingAction(item.shipment_id, action, body);
      notify('success', t(`pending.done.${doneKey}`, t('pending.done.generic', 'تم تنفيذ الإجراء')));
      setConfirm(null);
      await load();
    } catch (err) { notify('error', t('pending.action_failed', 'تعذر تنفيذ الإجراء'), shippingErrorMessage(err, t)); setConfirm(null); }
    finally { setBusy(null); }
  };
  const noAnswer = async (item: PendingItem) => {
    setBusy(item.shipment_id);
    try {
      await ordiumClient.recordConfirmationAttempt(item.order_id, { channel: 'manual_call', outcome: 'no_answer' });
      notify('success', t('pending.done.no_answer', 'سُجّلت محاولة اتصال بلا رد'));
      await load();
    } catch (err) { notify('error', t('pending.action_failed', 'تعذر تنفيذ الإجراء'), shippingErrorMessage(err, t)); }
    finally { setBusy(null); }
  };
  const openOrder = async (item: PendingItem) => {
    try { setOrder(await ordiumClient.getOrder(item.order_id)); }
    catch (err) { notify('error', t('pending.order_failed', 'تعذر فتح الطلب'), shippingErrorMessage(err, t)); }
  };

  const reasonLines = (i: PendingItem) => i.reasons.length > 0 && i.hold_reason === 'review' ? i.reasons : [t(`pending.reason.${i.hold_reason}`, i.hold_reason), ...i.reasons];
  const selectCls = 'bg-[var(--ordium-surface)] border border-white/10 rounded-xl px-3 min-h-11 text-xs font-mono text-white';
  const tabCount = (k: Tab) => counts?.[k] ?? 0;

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-white">{t('pending.title', 'بانتظار القرار')}</h2>
        <p className="text-sm text-[var(--ordium-muted)] mt-1 leading-relaxed max-w-2xl">{t('pending.description', 'طلبات أوقفناها قبل الإرسال إلى أن تقرر أنت. لا يُشحن أي طلب منها دون موافقتك.')}</p>
      </div>

      <div role="tablist" aria-label={t('pending.tabs_label', 'سبب الإيقاف')} className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[var(--ordium-surface)] p-1 w-full md:w-fit">
        {TABS.map(key => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setPage(1); }} className={`min-h-11 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${tab === key ? 'bg-[var(--ordium-surface-raised)] text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>
            {t(`pending.tab.${key}`, key)}<span className="text-xs tabular-nums text-[var(--ordium-subtle)]">{tabCount(key)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--ordium-muted)] inline-flex items-center gap-2"><Clock className="w-4 h-4 text-[var(--ordium-signal)]" aria-hidden="true" />{t('pending.older_than_48', 'أقدم من 48 ساعة')}: <span className={`font-bold tabular-nums ${stale > 0 ? 'text-[var(--ordium-danger)]' : 'text-white'}`}>{stale}</span></p>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label={t('pending.sort', 'ترتيب')} value={sort} onChange={e => setSort(e.target.value as Sort)} className={selectCls}>
            <option value="oldest">{t('pending.sort_oldest', 'الأقدم أولًا')}</option>
            <option value="risk">{t('pending.sort_risk', 'الأعلى خطورة')}</option>
            <option value="value">{t('pending.sort_value', 'الأعلى قيمة')}</option>
          </select>
          <Button variant="outline" size="md" onClick={() => void load()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.refresh', 'تحديث')}</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h3 className="text-sm font-semibold text-white">{t('pending.load_error', 'تعذر تحميل الطلبات الموقوفة')}</h3><p className="text-xs text-[var(--ordium-muted)] mt-2">{error}</p>
          <Button className="mt-4" variant="outline" size="md" onClick={() => void load()}>{t('common.retry', 'إعادة المحاولة')}</Button>
        </div>
      ) : loading && !data ? <LoadingState message={t('pending.loading', 'جارٍ تحميل الطلبات الموقوفة…')} />
      : rows.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title={t('pending.empty.title', 'لا شيء بانتظار قرارك')} description={t(`pending.empty.${tab}`, '')} />
      ) : (
        <div className={`dashboard-panel overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <ul className="divide-y divide-white/5">
            {rows.map(i => {
              const disabled = busy === i.shipment_id;
              const whs = i.available_warehouses;
              return (
                <li key={i.shipment_id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 text-start">
                  <div className="shrink-0 w-14 h-14 rounded-xl border border-white/10 bg-[var(--ordium-surface-raised)] flex flex-col items-center justify-center" aria-label={tab === 'stock' ? t('pending.warehouses_with_stock', 'مستودعات بها مخزون') : t('pending.risk_score', 'درجة الخطورة')}>
                    <span className="text-lg font-bold text-white tabular-nums">{tab === 'stock' ? whs.length : (i.risk_score ?? '—')}</span>
                    <span className="text-[10px] font-mono text-[var(--ordium-subtle)]">{tab === 'stock' ? t('pending.box_stock', 'مخزون') : t('pending.box_risk', 'خطورة')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-white" dir="auto">{i.customer_name ?? '—'}</span>
                      <button type="button" onClick={() => void openOrder(i)} className="min-h-11 lg:min-h-0 text-xs font-mono text-[var(--ordium-signal)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ordium-signal)]" dir="ltr" aria-label={`${t('pending.open_order', 'فتح الطلب')} ${i.external_order_id ?? i.order_id}`}>{i.external_order_id ?? i.order_id.slice(0, 8)}</button>
                    </div>
                    <div className="text-xs text-[var(--ordium-muted)] mt-1 flex flex-wrap gap-x-2">
                      <span dir="auto">{resolveWilaya(i.wilaya, language) ?? '—'}</span><span aria-hidden="true">·</span>
                      <span className="tabular-nums" dir="ltr">{money(i)}</span><span aria-hidden="true">·</span>
                      <span className={isStale(i) ? 'text-[var(--ordium-danger)]' : ''}>{age(i.created_at)}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5">{reasonLines(i).map((r, idx) => <li key={idx} className="text-xs text-[#C1CCDA]" dir="auto">{r}</li>)}</ul>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {tab === 'review' && <>
                      {(i.hold_reason === 'review' || i.hold_reason === 'no_answer') && <Button variant="primary" size="md" disabled={disabled} onClick={() => void run(i, 'approve', 'approve')} leftIcon={<Check className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.approve', 'قبول وإرسال')}</Button>}
                      {i.hold_reason === 'unmapped_product' && <Button variant="primary" size="md" onClick={() => onNavigate?.('inventory')} leftIcon={<Link2 className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.link_products', 'ربط المنتجات')}</Button>}
                      {(i.hold_reason === 'review' || i.hold_reason === 'no_answer') && <Button variant="outline" size="md" disabled={disabled} onClick={() => void noAnswer(i)} leftIcon={<PhoneOff className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.no_answer', 'لم يرد')}</Button>}
                      <Button variant="danger" size="md" disabled={disabled} onClick={() => setConfirm({ item: i, action: 'reject' })} leftIcon={<X className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.reject', 'رفض')}</Button>
                    </>}
                    {tab === 'stock' && <>
                      {i.hold_reason === 'out_of_stock' && whs.length > 0 && <>
                        <select aria-label={t('pending.warehouse', 'المستودع')} value={warehouse[i.shipment_id] ?? whs[0].id} onChange={e => setWarehouse(p => ({ ...p, [i.shipment_id]: e.target.value }))} className={selectCls}>
                          {whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <Button variant="primary" size="md" disabled={disabled} onClick={() => void run(i, 'dispatch-from', 'dispatch')} leftIcon={<Send className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.dispatch_from', 'إرسال من هذا المستودع')}</Button>
                      </>}
                      {i.hold_reason === 'unmapped_product' && <Button variant="primary" size="md" onClick={() => onNavigate?.('inventory')} leftIcon={<Link2 className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.link_products', 'ربط المنتجات')}</Button>}
                      <Button variant="danger" size="md" disabled={disabled} onClick={() => setConfirm({ item: i, action: i.hold_reason === 'out_of_stock' ? 'cancel_stock' : 'reject' })} leftIcon={<X className="w-3.5 h-3.5" aria-hidden="true" />}>{i.hold_reason === 'out_of_stock' ? t('pending.cancel_order', 'إلغاء الطلب (نفاد المخزون)') : t('pending.reject', 'رفض')}</Button>
                    </>}
                    {tab === 'rejected' && <>
                      <Button variant="outline" size="md" disabled={disabled} onClick={() => void run(i, 'restore', 'restore')} leftIcon={<Undo2 className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.restore', 'استعادة')}</Button>
                      <Button variant="outline" size="md" disabled={disabled} onClick={() => setConfirm({ item: i, action: 'archive' })} leftIcon={<Archive className="w-3.5 h-3.5" aria-hidden="true" />}>{t('pending.archive', 'أرشفة')}</Button>
                    </>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <Button variant="outline" size="md" disabled={page <= 1} onClick={() => setPage(p => p - 1)} leftIcon={<ChevronLeft aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('shipping.prev_page', 'السابق')}</Button>
            <span className="text-xs font-mono text-[var(--ordium-subtle)]">{page} / {pagination?.total_pages ?? 1}</span>
            <Button variant="outline" size="md" disabled={page >= (pagination?.total_pages ?? 1)} onClick={() => setPage(p => p + 1)} rightIcon={<ChevronRight aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('shipping.next_page', 'التالي')}</Button>
          </div>
        </div>
      )}

      <Modal isOpen={Boolean(confirm)} onClose={() => setConfirm(null)} title={t(`pending.confirm_${confirm?.action ?? 'reject'}.title`, 'تأكيد الإجراء')} description={t(`pending.confirm_${confirm?.action ?? 'reject'}.desc`, '')}>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={() => setConfirm(null)}>{t('common.cancel', 'إلغاء')}</Button>
          <Button type="button" variant="danger" size="md" isLoading={Boolean(confirm && busy === confirm.item.shipment_id)} onClick={() => confirm && void run(confirm.item, confirm.action === 'cancel_stock' ? 'reject' : confirm.action, confirm.action)}>{confirm?.action === 'archive' ? t('pending.archive', 'أرشفة') : confirm?.action === 'cancel_stock' ? t('pending.cancel_order', 'إلغاء الطلب (نفاد المخزون)') : t('pending.reject', 'رفض')}</Button>
        </div>
      </Modal>
      <OrderDetailDrawer order={order} isOpen={Boolean(order)} onClose={() => setOrder(null)} storeName={storeName} />
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(x => x.id !== id))} />
    </div>
  );
};
