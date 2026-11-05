/** ORDIUM Shipment Detail Drawer: stages, tracking log, parcel facts, Ordium decision and actions. */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Printer, Ban, RotateCcw, Check, AlertTriangle } from 'lucide-react';
import type { Shipment, ShipmentStatus } from '../../lib/api/types';
import { shippingApi } from '../../lib/api/shipping';
import { Drawer } from '../common/Drawer';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingState } from '../common/EmptyState';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { shippingErrorMessage } from './shippingErrors';
import { useLanguage } from '../../i18n/LanguageContext';

const STAGES: { key: string; statuses: ShipmentStatus[] }[] = [
  { key: 'created', statuses: ['pending_dispatch'] },
  { key: 'accepted', statuses: ['accepted'] },
  { key: 'picked_up', statuses: ['picked_up'] },
  { key: 'in_transit', statuses: ['in_transit'] },
  { key: 'out_for_delivery', statuses: ['out_for_delivery', 'delivery_attempt_failed'] },
  { key: 'delivered', statuses: ['delivered'] },
];
const stageIndex = (status: ShipmentStatus) => STAGES.findIndex(s => s.statuses.includes(status));
const CANCELLABLE: ShipmentStatus[] = ['pending_dispatch', 'dispatch_failed', 'accepted'];

export type ToastFn = (type: 'success' | 'error' | 'info', title: string, message?: string) => void;

interface Props {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: (shipment: Shipment) => void;
  notify: ToastFn;
}

export const ShipmentDetailDrawer: React.FC<Props> = ({ shipment, isOpen, onClose, onChanged, notify }) => {
  const { t, language } = useLanguage();
  const [detail, setDetail] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'refresh' | 'cancel' | 'retry' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const id = shipment?.id;
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const fmt = (value: string | null | undefined) => value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!id) return;
    if (mode === 'initial') setLoading(true); else setBusy('refresh');
    setError(null);
    try {
      const fresh = await shippingApi.getShipment(id);
      setDetail(fresh); onChanged(fresh);
    } catch (err) {
      setError(shippingErrorMessage(err, t));
    } finally { setLoading(false); setBusy(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { setDetail(null); setConfirmCancel(false); if (isOpen && id) void load('initial'); }, [isOpen, id, load]);

  if (!shipment) return null;
  const s = detail ?? shipment;
  const events = [...(detail?.events ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const reached = Math.max(stageIndex(s.status), ...events.map(e => stageIndex(e.status)), 0);
  const terminalOff = ['dispatch_failed', 'cancelled', 'returning', 'returned'].includes(s.status);
  const money = (v: number | null) => v == null ? '—' : `${v.toLocaleString(locale)} ${s.currency ?? ''}`.trim();
  const orderRef = s.external_order_id ?? s.order_id.slice(0, 8);

  const doRetry = async () => {
    setBusy('retry');
    try {
      const res = await shippingApi.retryShipment(s.id);
      setDetail(prev => ({ ...(prev ?? res.shipment), ...res.shipment, events: prev?.events })); onChanged(res.shipment);
      notify(res.outcome === 'failed' ? 'error' : 'success', t(`shipping.outcome.${res.outcome}`, res.outcome));
      void load('refresh');
    } catch (err) { notify('error', t('shipping.actions.retry_failed', 'تعذرت إعادة المحاولة'), shippingErrorMessage(err, t)); }
    finally { setBusy(null); }
  };
  const doCancel = async () => {
    setBusy('cancel');
    try {
      const res = await shippingApi.cancelShipment(s.id);
      setDetail(prev => ({ ...(prev ?? res), ...res, events: prev?.events })); onChanged(res);
      notify('success', t('shipping.actions.cancelled', 'أُلغيت الشحنة'));
      setConfirmCancel(false);
    } catch (err) { notify('error', t('shipping.actions.cancel_failed', 'تعذر إلغاء الشحنة'), shippingErrorMessage(err, t)); setConfirmCancel(false); }
    finally { setBusy(null); }
  };

  const facts: [string, React.ReactNode][] = [
    [t('shipping.drawer.fact_tracking', 'رقم التتبع'), <span dir="ltr" className="font-mono">{s.tracking_number ?? '—'}</span>],
    [t('shipping.drawer.fact_carrier', 'شركة التوصيل'), s.carrier_code ?? '—'],
    [t('shipping.drawer.fact_source', 'مصدر الإرسال'), s.fulfillment === 'merchant' ? t('shipping.source.merchant', 'من متجري') : t('shipping.source.carrier', 'مستودع الشركة')],
    [t('shipping.drawer.fact_destination', 'الوجهة'), `${s.wilaya ?? '—'}${s.customer_name ? ` · ${s.customer_name}` : ''}`],
    [t('shipping.drawer.fact_cod', 'التحصيل عند التسليم'), <span dir="ltr">{money(s.cod_amount)}</span>],
    [t('shipping.drawer.fact_type', 'نوع التسليم'), s.delivery_type ? t(`shipping.delivery_type.${s.delivery_type}`, s.delivery_type) : '—'],
    [t('shipping.drawer.fact_attempts', 'محاولات الإرسال'), String(s.attempts)],
    [t('shipping.drawer.fact_dispatched', 'تاريخ الإرسال'), fmt(s.dispatched_at)],
  ];
  const itemsList = detail?.order?.items ?? [];

  return (
    <Drawer isOpen={isOpen} onClose={() => { if (!confirmCancel) onClose(); }} title={`${t('shipping.drawer.title', 'الشحنة')} ${orderRef}`} width="xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShipmentStatusBadge status={s.status} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" isLoading={busy === 'refresh'} onClick={() => void load('refresh')} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>{t('shipping.actions.refresh', 'تحديث الحالة الآن')}</Button>
          {s.label_url && <a href={s.label_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-medium rounded-lg border border-white/15 text-[#F8FAFC] hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ordium-signal)]"><Printer className="w-3.5 h-3.5" aria-hidden="true" />{t('shipping.actions.label', 'طباعة الملصق')}</a>}
          {s.status === 'dispatch_failed' && <Button variant="primary" size="sm" isLoading={busy === 'retry'} onClick={() => void doRetry()} leftIcon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}>{t('shipping.actions.retry', 'إعادة المحاولة')}</Button>}
          {CANCELLABLE.includes(s.status) && <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)} leftIcon={<Ban className="w-3.5 h-3.5" aria-hidden="true" />}>{t('shipping.actions.cancel', 'إلغاء الشحنة')}</Button>}
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-[var(--ordium-muted)]">{error}</div>}

      {s.last_error && (s.status === 'dispatch_failed' || s.status === 'pending_dispatch') && (
        <div className="rounded-xl border border-[var(--ordium-danger)]/30 bg-[var(--ordium-danger)]/5 p-4 flex gap-3 text-start">
          <AlertTriangle className="w-4 h-4 text-[var(--ordium-danger)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0"><div className="text-sm font-semibold text-white">{t('shipping.drawer.last_error', 'سبب الفشل الأخير')}</div><p className="text-xs text-[var(--ordium-muted)] mt-1 break-words" dir="auto">{s.last_error}</p>{s.next_attempt_at && <p className="text-xs text-[var(--ordium-subtle)] mt-1">{t('shipping.drawer.next_attempt', 'المحاولة التالية')}: {fmt(s.next_attempt_at)}</p>}</div>
        </div>
      )}

      <section aria-label={t('shipping.drawer.stages', 'مراحل الشحنة')}>
        <ol className="grid grid-cols-6 gap-1 text-center">
          {STAGES.map((stage, i) => {
            const done = !terminalOff ? i <= reached : i <= reached && s.status !== 'dispatch_failed' && s.status !== 'cancelled';
            const current = i === reached && !terminalOff;
            return (
              <li key={stage.key} aria-current={current ? 'step' : undefined} className="min-w-0">
                <div className={`h-1.5 rounded-full ${done ? 'bg-[var(--ordium-signal)]' : 'bg-white/10'}`} />
                <div className={`mt-2 mx-auto w-6 h-6 rounded-full border flex items-center justify-center ${done ? 'border-[var(--ordium-signal)] text-[var(--ordium-signal)]' : 'border-white/15 text-transparent'}`}>{done && <Check className="w-3.5 h-3.5" aria-hidden="true" />}</div>
                <div className={`mt-1.5 text-[11px] leading-tight ${current ? 'text-white font-semibold' : 'text-[var(--ordium-muted)]'}`}>{t(`shipping.stage.${stage.key}`, stage.key)}</div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="dashboard-panel p-4">
        <h4 className="text-sm font-semibold text-white mb-3">{t('shipping.drawer.log', 'سجل التتبع')}</h4>
        {loading ? <LoadingState message={t('common.loading', 'جارٍ التحميل…')} className="!p-6" />
          : events.length === 0 ? <p className="text-xs text-[var(--ordium-muted)]">{t('shipping.drawer.log_empty', 'لا توجد أحداث تتبع بعد.')}</p>
          : <ul className="space-y-3">{events.map(ev => (
            <li key={ev.id} className="flex items-start justify-between gap-3 text-start">
              <div className="min-w-0"><div className="text-sm text-white">{t(`shipping.status.${ev.status}`, ev.raw_status ?? ev.status)}</div>{ev.location && <div className="text-xs text-[var(--ordium-muted)]" dir="auto">{ev.location}</div>}</div>
              <time dateTime={ev.occurred_at} className="text-xs font-mono text-[var(--ordium-subtle)] shrink-0">{fmt(ev.occurred_at)}</time>
            </li>))}</ul>}
        <p className="text-xs text-[var(--ordium-subtle)] mt-4">{t('shipping.drawer.last_sync', 'آخر تحديث')}: {fmt(s.updated_at)}</p>
      </section>

      <section className="dashboard-panel p-4">
        <h4 className="text-sm font-semibold text-white mb-3">{t('shipping.drawer.parcel', 'الطرد')}</h4>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-[var(--ordium-muted)]">{k}</dt><dd className="text-sm text-white break-words">{v}</dd></div>)}
        </dl>
        {itemsList.length > 0 && <ul className="mt-4 pt-3 border-t border-white/5 space-y-1">{itemsList.map((it, i) => <li key={i} className="flex justify-between gap-3 text-xs text-[#C1CCDA]"><span className="truncate" dir="auto">{it.product_name}</span><span className="tabular-nums" dir="ltr">×{it.quantity}</span></li>)}</ul>}
      </section>

      <section className="dashboard-panel p-4">
        <h4 className="text-sm font-semibold text-white mb-2">{t('shipping.drawer.decision', 'قرار Ordium')}</h4>
        <p className="text-sm text-[var(--ordium-muted)] leading-relaxed">
          {s.hold_reason ? t(`shipping.hold.${s.hold_reason}`, s.hold_reason)
            : s.fulfillment === 'merchant' ? t('shipping.drawer.decision_merchant', 'خرج الطلب من مخزونك وأُرسل إلى شركة التوصيل بعد قبوله.')
            : t('shipping.drawer.decision_carrier', 'قُبل الطلب وأُرسل تلقائيًا من مستودع شركة التوصيل.')}
        </p>
        <p className="text-xs text-[var(--ordium-subtle)] mt-2">{t('shipping.drawer.decision_note', 'عند التسليم أو الإرجاع تُسجَّل النتيجة تلقائيًا وتُستعمل لتحسين التقييم.')}</p>
      </section>

      <Modal isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} title={t('shipping.cancel_modal.title', 'إلغاء الشحنة؟')} description={t('shipping.cancel_modal.desc', 'سيُطلب من شركة التوصيل إلغاء هذا الطرد. لا يمكن التراجع عن ذلك.')}>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>{t('shipping.cancel_modal.keep', 'إبقاء الشحنة')}</Button>
          <Button variant="danger" size="sm" isLoading={busy === 'cancel'} onClick={() => void doCancel()}>{t('shipping.cancel_modal.confirm', 'نعم، ألغِ الشحنة')}</Button>
        </div>
      </Modal>
    </Drawer>
  );
};
