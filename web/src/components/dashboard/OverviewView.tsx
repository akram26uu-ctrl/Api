/** ORDIUM Executive Dashboard Overview */
import React, { useMemo, useState, useEffect } from 'react';
import { MetricsSummary, Order } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { MetricCard } from '../common/MetricCard';
import { RiskBadge } from '../common/RiskBadge';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { useLanguage } from '../../i18n/LanguageContext';
import { ShieldAlert, DollarSign, Zap, Activity, ArrowRight, ArrowLeft, Eye } from 'lucide-react';

import { riskSignalLabel } from '../../lib/riskSignals';

// Enough recent orders to show which risk signals actually fire for this store.
const SIGNAL_SAMPLE = 50;

interface OverviewViewProps { onNavigateTab: (tab: any) => void; }

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigateTab }) => {
  const { t, isRTL, language } = useLanguage();
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true); setError(false);
      try {
        const [m, ords] = await Promise.all([ordiumClient.getMetrics(), ordiumClient.listOrders({ page: 1, limit: SIGNAL_SAMPLE })]);
        if (!active) return;
        setMetrics(m); setRecentOrders(ords.data);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    };
    void fetchData();
    return () => { active = false; };
  }, []);

  // Which signals fired most in recent orders, from the orders themselves (no decoration).
  const topSignals = useMemo(() => {
    const counts = new Map<string, { count: number; points: number }>();
    for (const order of recentOrders) {
      for (const event of order.risk?.events ?? []) {
        if (!event.type || event.scoreImpact <= 0) continue;
        const entry = counts.get(event.type) ?? { count: 0, points: 0 };
        entry.count += 1; entry.points += event.scoreImpact;
        counts.set(event.type, entry);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  }, [recentOrders]);
  const flaggedSample = recentOrders.filter(order => (order.risk?.events?.length ?? 0) > 0).length;
  const latestOrders = recentOrders.slice(0, 5);

  if (loading) return <LoadingState message={t('dashboard.orders.fetching_telemetry', 'جارٍ تحميل مؤشرات المخاطر…')} />;
  if (error || !metrics) return <div className="p-6"><EmptyState title={t('dashboard.overview.load_error_title', 'We could not load your workspace data')} description={t('dashboard.overview.load_error_desc', 'تعذر تحميل بيانات المتجر حاليًا. حدّث الصفحة، وإذا استمرت المشكلة تواصل مع الدعم.')} actionText={t('dashboard.overview.retry', 'إعادة المحاولة')} onAction={() => window.location.reload()} /></div>;

  const totalOrders = metrics.total_orders ?? 0;
  const totalVolume = metrics.total_volume ?? 0;
  const fraudBlockedVolume = metrics.fraud_blocked_volume ?? 0;
  const ordersAnalyzed = metrics.orders_analyzed ?? 0;
  const allowCount = metrics.allow_count ?? 0;
  const allowPercentage = metrics.allow_percentage ?? 0;
  const reviewCount = metrics.review_count ?? 0;
  const reviewPercentage = metrics.review_percentage ?? 0;
  const rejectCount = metrics.reject_count ?? 0;
  const rejectPercentage = metrics.reject_percentage ?? 0;
  const avgRiskScore = metrics.avg_risk_score ?? metrics.average_risk_score ?? 0;
  const hasOrders = totalOrders > 0 || recentOrders.length > 0;

  return <div className="dashboard-content space-y-6 sm:space-y-8">
    <section className="dashboard-page-heading">
      <div className="relative z-10 min-w-0"><h2>{t('dashboard.overview.page_heading', 'نظرة عامة على المتجر')}</h2><p className="mt-2 text-sm">{t('dashboard.overview.page_description', 'تابع الطلبات ومؤشرات المخاطر وقرارات التقييم من مساحة عمل واحدة.')}</p></div>
      <div className="relative z-10 shrink-0"><Button variant="outline" size="md" onClick={() => onNavigateTab('orders')} rightIcon={<ArrowIcon className="w-4 h-4" />}>{t('dashboard.overview.view_orders_cta', 'عرض الطلبات')}</Button></div>
    </section>

    {!hasOrders && <p className="settings-note">{t('dashboard.overview.no_data_note', 'لا توجد طلبات حية بعد، فالأرقام أدناه صفر. اربط متجرك من الإعدادات أو جرّب طلبًا تجريبيًا.')}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard title={t('dashboard.overview.orders_ingested', 'الطلبات المستلمة')} value={totalOrders.toLocaleString()} change={hasOrders ? { value: `${ordersAnalyzed.toLocaleString()} ${t('dashboard.overview.evaluated_label', 'تم تقييمها')}`, trend: 'up', label: t('dashboard.overview.evaluated_detail', 'طلبات جرى تقييمها') } : undefined} icon={<Activity className="w-4 h-4 text-[var(--ordium-signal)]" />} />
      <MetricCard title={t('dashboard.overview.volume_protected', 'إجمالي قيمة الطلبات')} value={`${(totalVolume / 1000).toFixed(1)}k DZD`} change={totalOrders > 0 ? { value: `${Math.round((ordersAnalyzed / totalOrders) * 100)}%`, trend: 'up', label: t('dashboard.overview.evaluated_label', 'تم تقييمها') } : undefined} icon={<DollarSign className="w-4 h-4 text-[var(--ordium-success)]" />} />
      <MetricCard title={t('dashboard.overview.fraud_blocked_card', 'قيمة الطلبات المرفوضة')} value={`${(fraudBlockedVolume / 1000).toFixed(1)}k DZD`} subtitle={t('dashboard.overview.rejected_volume_hint', 'قيمة الطلبات التي صدر بحقها قرار رفض')} variant="accent" icon={<ShieldAlert className="w-4 h-4 text-[var(--ordium-accent)]" />} />
      <MetricCard title={t('dashboard.overview.avg_execution', 'Average Execution')} value={metrics.avg_execution_time_ms != null ? `${metrics.avg_execution_time_ms}ms` : '—'} subtitle={t('dashboard.overview.avg_execution_hint', 'الوقت المستغرق لتقييم الطلب')} icon={<Zap className="w-4 h-4 text-[var(--ordium-signal)]" />} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <section className="dashboard-panel lg:col-span-7 p-4 sm:p-5 flex flex-col" aria-labelledby="overview-signals-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-white/5">
          <h2 id="overview-signals-title" className="text-base font-semibold text-[var(--ordium-text)]">{t('dashboard.overview.top_signals_title', 'أكثر إشارات الخطر ظهورًا')}</h2>
          <p className="text-xs text-[var(--ordium-subtle)]">{t('dashboard.overview.top_signals_scope', 'في آخر {count} طلبية').replace('{count}', recentOrders.length.toLocaleString())}</p>
        </div>
        {topSignals.length === 0 ? (
          <p className="flex-1 flex items-center justify-center py-10 text-sm text-[var(--ordium-muted)] text-center">{recentOrders.length ? t('dashboard.overview.no_signals', 'لم تظهر أي إشارة خطر في هذه الطلبيات.') : t('dashboard.overview.no_orders_yet', 'ستظهر الإشارات هنا بعد وصول أول طلبية.')}</p>
        ) : (
          <ol className="flex-1 divide-y divide-white/5">
            {topSignals.map(([code, stat]) => {
              const share = flaggedSample ? Math.round((stat.count / recentOrders.length) * 100) : 0;
              return (
                <li key={code} className="py-3 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--ordium-text)]">{riskSignalLabel(code, language)}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true"><div className="h-full rounded-full bg-[var(--ordium-warning)]" style={{ width: `${Math.max(4, share)}%` }} /></div>
                  </div>
                  <p className="shrink-0 text-end text-sm tabular-nums text-[var(--ordium-muted)]"><span className="text-[var(--ordium-text)] font-semibold">{stat.count.toLocaleString()}</span> {t('dashboard.overview.signal_orders', 'طلبية')}</p>
                </li>
              );
            })}
          </ol>
        )}
        <div className="pt-3 border-t border-white/5 flex justify-end">
          <button type="button" onClick={() => onNavigateTab('network')} className="min-h-11 text-sm text-[var(--ordium-signal)] hover:underline underline-offset-4 flex items-center gap-1 font-semibold">{t('dashboard.overview.open_network', 'افتح تحليل المخاطر')} <ArrowIcon className="w-3.5 h-3.5" /></button>
        </div>
      </section>

      <div className="dashboard-panel lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between">
        <div className="space-y-4"><h2 className="text-base font-semibold text-[var(--ordium-text)] text-start">{t('dashboard.overview.decision_breakdown', 'توزيع القرارات')}</h2><div className="space-y-4 font-mono text-xs">
          {[{ label: t('dashboard.overview.allow_plain', 'مقبولة'), count: allowCount, pct: allowPercentage, color: '#10B981' }, { label: t('dashboard.overview.review_plain', 'تحتاج مراجعة'), count: reviewCount, pct: reviewPercentage, color: '#F59E0B' }, { label: t('dashboard.overview.reject_plain', 'مرفوضة'), count: rejectCount, pct: rejectPercentage, color: '#EF4444' }].map(item => <div key={item.label}><div className="flex justify-between gap-3 mb-1"><span className="font-bold" style={{ color: item.color }}>{item.label}</span><span className="text-white font-bold">{item.count} ({item.pct}%)</span></div><div className="w-full h-2 rounded-full bg-[var(--ordium-canvas)] overflow-hidden" role="img" aria-label={`${item.label}: ${item.pct}%`}><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, item.pct))}%`, backgroundColor: item.color }} /></div></div>)}
        </div></div>
        <div className="pt-6 border-t border-white/5 space-y-3"><div className="p-3 bg-[var(--ordium-canvas)] rounded-xl border border-white/5 text-xs font-mono text-[var(--ordium-muted)] text-start">{t('dashboard.overview.average_risk_score', 'متوسط درجة المخاطر للطلبات:')} <span className="text-white font-bold">{avgRiskScore} / 100</span></div><Button variant="outline" size="sm" onClick={() => onNavigateTab('orders')} className="w-full justify-center">{t('dashboard.overview.view_all_orders', 'عرض الطلبات')}</Button></div>
      </div>
    </div>

    <div className="dashboard-panel overflow-hidden">
      <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-[var(--ordium-text)]">{t('dashboard.overview.recent_evaluated', 'أحدث الطلبات')}</h2><button type="button" onClick={() => onNavigateTab('orders')} className="min-h-11 text-xs font-mono text-[var(--ordium-signal)] hover:underline flex items-center gap-1">{t('dashboard.overview.view_all_orders', 'عرض جميع الطلبات')} <ArrowIcon className="w-3.5 h-3.5" /></button></div>
      {latestOrders.length === 0 ? <div className="p-8"><EmptyState title={t('dashboard.overview.no_orders_title', 'لا توجد طلبات بعد')} description={t('dashboard.overview.no_orders_desc', 'ستظهر الطلبات هنا عند وصولها إلى متجرك. يمكنك مراجعة الطلبات وحالات التأكيد من هذه الصفحة.')} actionText={t('dashboard.overview.open_simulator', 'عرض الطلبات')} onAction={() => onNavigateTab('orders')} icon={<Activity className="w-8 h-8" />} /></div> : <div className="overflow-x-auto" tabIndex={0}><table className="w-full text-start border-collapse text-xs font-mono"><thead><tr className="border-b border-white/5 bg-[var(--ordium-canvas)]/60 text-xs text-[var(--ordium-muted)] uppercase text-start"><th className="py-3 px-4 text-start">{t('dashboard.orders.col_order', 'Order')}</th><th className="py-3 px-4 text-start">{t('dashboard.orders.col_customer', 'Customer')}</th><th className="py-3 px-4 text-start">{t('dashboard.orders.col_amount', 'Amount')}</th><th className="py-3 px-4 text-start">{t('dashboard.orders.col_decision', 'Decision')}</th><th className="py-3 px-4 text-start">{t('dashboard.orders.col_score', 'Score')}</th><th className="py-3 px-4 text-end">{t('dashboard.overview.col_inspect', 'Inspect')}</th></tr></thead><tbody className="divide-y divide-white/5">{latestOrders.map(order => <tr key={order.id} className="hover:bg-white/[0.02] transition-colors text-start"><td className="py-3 px-4 font-bold text-white">{order.order_number}</td><td className="py-3 px-4 text-[var(--ordium-muted)]">{order.customer.name}</td><td className="py-3 px-4 font-bold text-white">{order.amount.toFixed(2)} <span className="text-xs text-[var(--ordium-muted)] font-normal">DZD</span></td><td className="py-3 px-4"><RiskBadge decision={order.risk?.decision} size="sm" /></td><td className="py-3 px-4"><span className={`font-bold ${(order.risk?.score ?? 0) >= 75 ? 'text-[var(--ordium-danger)]' : (order.risk?.score ?? 0) >= 35 ? 'text-[var(--ordium-warning)]' : 'text-[var(--ordium-success)]'}`}>{order.risk?.score ?? 0}</span></td><td className="py-3 px-4 text-end"><button type="button" onClick={() => setSelectedOrder(order)} aria-label={`${t('dashboard.orders.inspect', 'فحص')} ${order.order_number}`} className="inline-flex min-w-11 min-h-11 items-center justify-center"><Eye className="w-4 h-4 text-[var(--ordium-muted)] hover:text-[var(--ordium-signal)]" /></button></td></tr>)}</tbody></table></div>}
    </div>
    <OrderDetailDrawer order={selectedOrder} isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} />
  </div>;
};
