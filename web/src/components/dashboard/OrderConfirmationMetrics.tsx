import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, MessageCircle, RefreshCw, XCircle } from 'lucide-react';
import { ordiumClient } from '../../lib/api/client';
import { OrderConfirmationMetrics as Metrics } from '../../lib/api/types';
import { useLanguage } from '../../i18n/LanguageContext';

export const OrderConfirmationMetrics: React.FC = () => {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError(false);
    try { setMetrics(await ordiumClient.getOrderConfirmationMetrics()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onUpdated = () => { void refresh(); };
    window.addEventListener('ordium:confirmation-updated', onUpdated);
    return () => window.removeEventListener('ordium:confirmation-updated', onUpdated);
  }, [refresh]);

  const cards = metrics ? [
    { label: t('dashboard.confirmation_metrics.rate', 'معدل التأكيد'), value: `${metrics.confirmation_rate.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`, detail: `${metrics.confirmed_orders} / ${metrics.attempted_orders} ${t('dashboard.confirmation_metrics.processed', 'طلبًا بدأت محاولة تأكيدها')}`, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
    { label: t('dashboard.confirmation_metrics.unstarted', 'بانتظار بدء التأكيد'), value: metrics.unstarted_pending_orders.toLocaleString(), detail: t('dashboard.confirmation_metrics.unstarted_hint', 'طلبات جديدة لم تُسجّل لها محاولة تواصل'), icon: <Clock3 className="w-4 h-4 text-amber-300" /> },
    { label: t('dashboard.confirmation_metrics.progress', 'قيد التأكيد'), value: metrics.in_progress_orders.toLocaleString(), detail: t('dashboard.confirmation_metrics.progress_hint', 'بدأ العمل عليها ولم تُحسم بعد'), icon: <Activity className="w-4 h-4 text-cyan-300" /> },
    { label: t('dashboard.confirmation_metrics.confirmed', 'طلبات مؤكدة'), value: metrics.confirmed_orders.toLocaleString(), detail: t('dashboard.confirmation_metrics.confirmed_hint', 'تأكيدات مسجلة في سجل النشاط'), icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
  ] : [];

  return <section className="space-y-3" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-bold text-white">{t('dashboard.confirmation_metrics.title', 'مؤشرات تأكيد الطلبات')}</h3><p className="mt-1 text-xs text-[#94A3B8]">{t('dashboard.confirmation_metrics.subtitle', 'تُحسب النسبة من الطلبات التي سُجّلت لها محاولة تأكيد واحدة على الأقل، وتُعرض الطلبات الجديدة منفصلة.')}</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#CBD5E1] hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{t('dashboard.confirmation_metrics.refresh', 'تحديث المؤشرات')}</button>
    </div>
    {error ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">{t('dashboard.confirmation_metrics.error', 'تعذر تحميل مؤشرات التأكيد. يمكنك إعادة المحاولة من زر التحديث.')}</div> : <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(card => <div key={card.label} className="rounded-xl border border-white/10 bg-[#0D1320] p-4 space-y-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-[#94A3B8]">{card.label}</span>{card.icon}</div><div className="text-2xl font-bold text-white tabular-nums">{loading ? '—' : card.value}</div><p className="text-[11px] leading-relaxed text-[#64748B]">{loading ? t('dashboard.confirmation_metrics.loading', 'جارٍ تحميل المؤشرات…') : card.detail}</p></div>)}
      </div>
      {metrics && <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-white/5 bg-[#080B12]/70 px-4 py-3 text-[11px] text-[#94A3B8]"><span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{t('dashboard.confirmation_metrics.attempts', 'إجمالي محاولات التواصل')}: <strong className="text-white">{metrics.total_attempts}</strong></span><span className="inline-flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />{t('dashboard.confirmation_metrics.cancelled', 'أُلغيت بعد بدء التأكيد')}: <strong className="text-white">{metrics.cancelled_orders}</strong></span><span>{t('dashboard.confirmation_metrics.average_attempts', 'متوسط المحاولات لكل طلب قيد المتابعة')}: <strong className="text-white">{metrics.average_attempts_per_order}</strong></span></div>}
    </>}
  </section>;
};
