/** ORDIUM Shipments View: every parcel from dispatch to delivery or return. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Printer, Send, Truck, AlertTriangle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { CarrierListResponse, CarrierWarehouse, Environment, NextPickup, Shipment, ShipmentListResponse } from '../../lib/api/types';
import { shippingApi } from '../../lib/api/shipping';
import { Button } from '../common/Button';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { ShipmentDetailDrawer } from './ShipmentDetailDrawer';
import { shippingErrorMessage } from './shippingErrors';
import { useLanguage } from '../../i18n/LanguageContext';
import type { DashboardRoute } from './DashboardLayout';
import { resolveWilaya } from './wilaya';

const TABS = ['all', 'ready', 'transit', 'out', 'done', 'ret', 'fail'] as const;
type Tab = typeof TABS[number];

interface Props { environment: Environment; onNavigate?: (route: DashboardRoute) => void }

export const ShipmentsView: React.FC<Props> = ({ environment, onNavigate }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [data, setData] = useState<ShipmentListResponse | null>(null);
  const [carriers, setCarriers] = useState<CarrierListResponse | null>(null);
  const [pickups, setPickups] = useState<NextPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [origins, setOrigins] = useState<{ id: string; label: string }[]>([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const notify = useCallback((type: ToastMessage['type'], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 6000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await shippingApi.listShipments({ status: tab === 'all' ? undefined : tab, origin: source === 'all' ? undefined : source, q: query.trim() || undefined, page, limit: 20 });
      setData(res);
    } catch (err) {
      setData(null); setError(shippingErrorMessage(err, t));
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, source, query, page]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 300); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    void shippingApi.listCarriers().then(async res => {
      setCarriers(res);
      const lists = await Promise.all(res.accounts.filter(a => a.status === 'active').map(a =>
        shippingApi.listWarehouses(a.id).then((ws: CarrierWarehouse[]) => ws.filter(w => w.is_active).map(w => ({ id: w.id, label: `${w.name} · ${a.display_name}` }))).catch(() => [])));
      setOrigins(lists.flat());
    }).catch(() => setCarriers(null));
    void shippingApi.nextPickups().then(r => setPickups(r.data)).catch(() => setPickups([]));
  }, []);

  const counts = data?.counts ?? {};
  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const printable = useMemo(() => rows.filter(r => r.fulfillment === 'merchant' && r.label_url && ['accepted', 'picked_up', 'pending_dispatch'].includes(r.status)), [rows]);
  const money = (r: Shipment) => r.cod_amount == null ? '—' : `${r.cod_amount.toLocaleString(locale)} ${r.currency ?? ''}`.trim();
  const when = (v: string | null) => v ? new Date(v).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const sourceLabel = (r: Shipment) => r.fulfillment === 'merchant' ? t('shipping.source.merchant', 'من متجري') : t('shipping.source.carrier', 'مستودع الشركة');
  const onChanged = (s: Shipment) => { setSelected(prev => prev && prev.id === s.id ? { ...prev, ...s } : prev); setData(prev => prev ? { ...prev, data: prev.data.map(r => r.id === s.id ? { ...r, ...s, events: r.events } : r) } : prev); };

  const printLabels = () => {
    if (printable.length === 1) window.open(printable[0].label_url as string, '_blank', 'noopener,noreferrer');
    else if (printable.length > 1) setPrintOpen(true);
  };
  const submitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setDispatching(true); setDispatchError(null);
    try {
      const res = await shippingApi.dispatchOrder(orderId.trim());
      notify(res.outcome === 'failed' ? 'error' : 'success', t(`shipping.outcome.${res.outcome}`, res.outcome));
      setDispatchOpen(false); setOrderId(''); void load();
    } catch (err) { setDispatchError(shippingErrorMessage(err, t)); }
    finally { setDispatching(false); }
  };

  const noAccounts = carriers != null && carriers.accounts.length === 0;
  const showCarrierEmpty = noAccounts && !loading && !error && (data?.counts?.all ?? 0) === 0;
  const liveNoCarriers = environment === 'live';
  const failCount = counts.fail ?? 0;
  const selectCls = 'bg-[var(--ordium-surface)] border border-white/10 rounded-xl px-3 min-h-11 text-xs font-mono text-white';

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white">{t('shipping.title', 'الشحنات')}</h2>
          <p className="text-sm text-[var(--ordium-muted)] mt-1 leading-relaxed max-w-2xl">{t('shipping.description', 'كل طرد خرج من متجرك أو من مستودع شركة التوصيل، من الإرسال حتى التسليم أو الإرجاع.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" disabled={printable.length === 0} onClick={printLabels} leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}>{t('shipping.print_labels', 'طباعة ملصقات طرودي')}</Button>
          <Button variant="primary" size="md" onClick={() => { setDispatchError(null); setDispatchOpen(true); }} leftIcon={<Send className="w-3.5 h-3.5" aria-hidden="true" />}>{t('shipping.manual_dispatch', 'إرسال طلب يدويًا')}</Button>
        </div>
      </div>

      {pickups.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-label={t('shipping.pickups.title', 'مواعيد الاستلام القادمة')}>
          {pickups.map(p => (
            <li key={p.carrier_account_id} className="dashboard-panel p-4 flex items-start gap-3 text-start">
              <Clock className="w-4 h-4 text-[var(--ordium-signal)] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{p.display_name}</div>
                <div className="text-xs text-[var(--ordium-muted)] mt-0.5">{t('shipping.pickups.next', 'الاستلام القادم')}: <span dir="ltr" className="font-mono">{when(p.pickup_time)}</span></div>
                <div className="text-xs text-[var(--ordium-muted)] mt-0.5">{t('shipping.pickups.merchant', 'من متجرك')}: {p.merchant_parcels} · {t('shipping.pickups.warehouse', 'من المستودع')}: {p.warehouse_parcels}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {failCount > 0 && tab !== 'fail' && (
        <div role="alert" className="rounded-xl border border-[var(--ordium-danger)]/30 bg-[var(--ordium-danger)]/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0"><AlertTriangle className="w-4 h-4 text-[var(--ordium-danger)] shrink-0 mt-0.5" aria-hidden="true" /><p className="text-sm text-white">{t('shipping.fail_alert', 'طلبات لم تصل إلى شركة التوصيل:')} <span className="font-bold tabular-nums">{failCount}</span></p></div>
          <Button variant="danger" size="md" onClick={() => { setTab('fail'); setPage(1); }}>{t('shipping.fail_alert_action', 'عرض وإصلاح')}</Button>
        </div>
      )}

      <div role="tablist" aria-label={t('shipping.tabs_label', 'حالة الشحنة')} className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[var(--ordium-surface)] p-1 w-full md:w-fit">
        {TABS.map(key => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setPage(1); }} className={`min-h-11 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${tab === key ? 'bg-[var(--ordium-surface-raised)] text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>
            {t(`shipping.tab.${key}`, key)}<span className={`text-xs tabular-nums ${key === 'fail' && (counts.fail ?? 0) > 0 ? 'text-[var(--ordium-danger)]' : 'text-[var(--ordium-subtle)]'}`}>{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-[var(--ordium-muted)] absolute start-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input aria-label={t('shipping.search_label', 'البحث في الشحنات')} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder={t('shipping.search_placeholder', 'ابحث برقم الطلب أو التتبع أو اسم الزبون…')} className="w-full bg-[var(--ordium-surface-raised)] border border-white/[0.12] rounded-xl ps-10 pe-4 py-3 min-h-11 text-sm text-white placeholder:text-[var(--ordium-subtle)]" />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select aria-label={t('shipping.source_filter', 'مصدر الطلب')} value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className={selectCls}>
            <option value="all">{t('shipping.source_all', 'الكل')}</option>
            <option value="merchant">{t('shipping.source.merchant', 'من متجري')}</option>
            {origins.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <Button variant="outline" size="md" onClick={() => void load()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>{t('shipping.refresh', 'تحديث')}</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h3 className="text-sm font-semibold text-white">{t('shipping.load_error', 'تعذر تحميل الشحنات')}</h3><p className="text-xs text-[var(--ordium-muted)] mt-2">{error}</p>
          <Button className="mt-4" variant="outline" size="md" onClick={() => void load()}>{t('common.retry', 'إعادة المحاولة')}</Button>
        </div>
      ) : loading && !data ? <LoadingState message={t('shipping.loading', 'جارٍ تحميل الشحنات…')} />
      : showCarrierEmpty && liveNoCarriers ? (
        <EmptyState icon={<Truck className="w-8 h-8" />} title={t('shipping.empty.no_carriers_live', 'لا توجد شركات توصيل متاحة بعد')} description={t('shipping.empty.no_carriers_live_desc', 'سنُعلمك فور إتاحة أول شركة توصيل لحسابك.')} />
      ) : showCarrierEmpty ? (
        <EmptyState icon={<Truck className="w-8 h-8" />} title={t('shipping.empty.link_title', 'اربط شركة توصيل')} description={t('shipping.empty.link_desc', 'اربط شركة توصيل من الإعدادات لتبدأ إرسال الطلبات المقبولة تلقائيًا.')} actionText={t('shipping.empty.link_action', 'فتح الإعدادات')} onAction={() => onNavigate?.('settings')} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Truck className="w-8 h-8" />} title={t('shipping.empty.title', 'لا توجد طرود بهذه الحالة الآن')} description={t('shipping.empty.desc', 'لا توجد شحنات تطابق الفلاتر الحالية.')} />
      ) : (
        <div className={`dashboard-panel overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div className="px-4 py-3 border-b border-white/5 text-xs font-mono text-[var(--ordium-subtle)]">{(pagination?.total ?? rows.length).toLocaleString()} {t('shipping.results_label', 'شحنة')} · {t('shipping.page_label', 'صفحة')} {pagination?.page ?? 1} / {pagination?.total_pages ?? 1}</div>
          <div className="overflow-x-auto">
            <table className="ordium-stack-table md:min-w-[960px] w-full text-start border-collapse">
              <thead><tr className="border-b border-white/5 bg-[var(--ordium-canvas)]/60 text-xs font-mono text-[var(--ordium-muted)] uppercase">
                {['col_wilaya', 'col_destination', 'col_order', 'col_carrier', 'col_tracking', 'col_status', 'col_updated', 'col_cod'].map((k, i) => <th key={k} scope="col" className="py-3.5 px-4 text-start">{t(`shipping.${k}`, ['الولاية', 'الوجهة والزبون', 'الطلب', 'الشركة والمصدر', 'التتبع', 'الحالة', 'آخر تحديث', 'التحصيل'][i])}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="hover:bg-white/[0.03] transition-colors cursor-pointer">
                    <td data-label={t('shipping.col_wilaya', 'الولاية')} className="py-3 px-4 font-mono text-white" dir="ltr">{r.wilaya ?? '—'}</td>
                    <td data-label={t('shipping.col_destination', 'الوجهة والزبون')} className="py-3 px-4 text-sm text-[#C1CCDA]"><div dir="auto">{resolveWilaya(r.wilaya, language) ?? '—'}</div><div className="text-xs text-[var(--ordium-muted)]" dir="auto">{r.customer_name ?? '—'}</div></td>
                    <td data-label={t('shipping.col_order', 'الطلب')} className="py-3 px-4 font-bold text-white">
                      <button type="button" onClick={e => { e.stopPropagation(); setSelected(r); }} aria-label={`${t('shipping.open', 'فتح الشحنة')} ${r.external_order_id ?? r.order_id}`} className="min-h-11 md:min-h-0 text-start focus-visible:outline-2 focus-visible:outline-[var(--ordium-signal)]" dir="ltr">{r.external_order_id ?? r.order_id.slice(0, 8)}</button>
                    </td>
                    <td data-label={t('shipping.col_carrier', 'الشركة والمصدر')} className="py-3 px-4 text-sm text-[#C1CCDA]"><div>{r.carrier_code ?? '—'}</div><div className="text-xs text-[var(--ordium-muted)]">{sourceLabel(r)}</div></td>
                    <td data-label={t('shipping.col_tracking', 'التتبع')} className="py-3 px-4 font-mono text-xs text-[#C1CCDA]" dir="ltr">{r.tracking_number ?? '—'}</td>
                    <td data-label={t('shipping.col_status', 'الحالة')} className="py-3 px-4"><ShipmentStatusBadge status={r.status} /></td>
                    <td data-label={t('shipping.col_updated', 'آخر تحديث')} className="py-3 px-4 text-xs text-[var(--ordium-muted)]">{when(r.updated_at ?? r.created_at)}</td>
                    <td data-label={t('shipping.col_cod', 'التحصيل')} className="py-3 px-4 font-semibold text-white tabular-nums" dir="ltr">{money(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <Button variant="outline" size="md" disabled={page <= 1} onClick={() => setPage(p => p - 1)} leftIcon={<ChevronLeft aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('shipping.prev_page', 'السابق')}</Button>
            <span className="text-xs font-mono text-[var(--ordium-subtle)]">{page} / {pagination?.total_pages ?? 1}</span>
            <Button variant="outline" size="md" disabled={page >= (pagination?.total_pages ?? 1)} onClick={() => setPage(p => p + 1)} rightIcon={<ChevronRight aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('shipping.next_page', 'التالي')}</Button>
          </div>
        </div>
      )}

      <ShipmentDetailDrawer shipment={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} onChanged={onChanged} notify={notify} />

      <Modal isOpen={dispatchOpen} onClose={() => setDispatchOpen(false)} title={t('shipping.dispatch_modal.title', 'إرسال طلب يدويًا')} description={t('shipping.dispatch_modal.desc', 'أدخل معرّف الطلب لإرساله إلى شركة التوصيل الآن.')}>
        <form onSubmit={e => void submitDispatch(e)} className="space-y-4">
          <div>
            <label htmlFor="ship-dispatch-order" className="block text-xs text-[var(--ordium-muted)] mb-1.5">{t('shipping.dispatch_modal.order_id', 'معرّف الطلب')}</label>
            <input id="ship-dispatch-order" value={orderId} onChange={e => setOrderId(e.target.value)} dir="ltr" autoComplete="off" required className="w-full bg-[var(--ordium-surface-raised)] border border-white/[0.12] rounded-xl px-4 py-3 min-h-11 text-sm font-mono text-white" />
          </div>
          {dispatchError && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-[var(--ordium-muted)]">{dispatchError}</div>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setDispatchOpen(false)}>{t('common.cancel', 'إلغاء')}</Button>
            <Button type="submit" variant="primary" size="md" isLoading={dispatching} disabled={!orderId.trim()}>{t('shipping.dispatch_modal.submit', 'إرسال')}</Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={printOpen} onClose={() => setPrintOpen(false)} title={t('shipping.print_modal.title', 'ملصقات طرودي')} description={`${printable.length} ${t('shipping.print_modal.count', 'ملصقات جاهزة للطباعة')}`}>
        <ul className="space-y-2">
          {printable.map(r => (
            <li key={r.id}><a href={r.label_url as string} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 min-h-11 px-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ordium-signal)]"><span dir="ltr" className="font-mono truncate">{r.external_order_id ?? r.order_id.slice(0, 8)}</span><Printer className="w-4 h-4 text-[var(--ordium-muted)] shrink-0" aria-hidden="true" /></a></li>
          ))}
        </ul>
        <p className="text-xs text-[var(--ordium-subtle)] mt-4">{t('shipping.print_modal.note', 'يشمل هذا الصفحة الحالية فقط.')}</p>
      </Modal>
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(x => x.id !== id))} />
    </div>
  );
};
