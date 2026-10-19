import React, { useEffect, useMemo, useState } from 'react';
import { UsageQuota, MetricsSummary } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { LoadingState } from '../common/EmptyState';
import { MetricCard } from '../common/MetricCard';
import { Button } from '../common/Button';
import { BarChart3, Activity, Clock, ShieldCheck, RefreshCw, Sparkles, Gauge } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const UsageView: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [usage, setUsage] = useState<UsageQuota | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [u, m] = await Promise.all([ordiumClient.getUsage(), ordiumClient.getMetrics()]);
      setUsage(u); setMetrics(m);
    } catch (e) { setError(e instanceof Error ? e.message : t('dashboard.usage.load_error', 'تعذر تحميل بيانات الاستهلاك.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const resetDate = useMemo(() => {
    if (!usage?.period_end) return '—';
    return new Date(usage.period_end).toLocaleDateString(isRTL ? 'ar-DZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [usage?.period_end, isRTL]);

  if (loading) return <LoadingState message={t('dashboard.usage.loading', 'جارٍ تحميل الاستهلاك…')} />;
  if (error || !usage) return <div className="p-6"><div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-white">{error || t('dashboard.usage.unavailable', 'بيانات الاستخدام غير متاحة.') }<div><Button className="mt-4" variant="outline" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>{t('common.retry', 'إعادة المحاولة')}</Button></div></div></div>;

  const percent = Math.min(100, Math.max(0, Number(usage.percent_used ?? 0)));
  const nearLimit = percent >= 80;
  return (
    <div className="dashboard-content space-y-6 sm:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="dashboard-panel relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-16 -end-12 h-36 w-36 rounded-full bg-[#22D3EE]/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#22D3EE]/10 border border-[#22D3EE]/20 flex items-center justify-center text-[#22D3EE]"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">{t('dashboard.usage.title', 'الاستهلاك والحصة')}</h2>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">{usage.plan_name}</span>
                {usage.beta_access && <span className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2.5 py-1 text-[10px] font-semibold text-violet-300">Beta</span>}
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8] max-w-2xl leading-relaxed">{t('dashboard.usage.subtitle', 'الاستهلاك الحقيقي للطلبات الحية المرتبطة بحسابك. المحاكي يعمل في TEST ولا يخصم من حصة Live.')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>{t('dashboard.usage.refresh', 'تحديث')}</Button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dashboard-panel lg:col-span-2 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-xs text-[#64748B]">{t('dashboard.usage.monthly_quota', 'الحصة الشهرية')}</div><div className="mt-1 text-3xl font-bold text-white tracking-tight">{usage.evaluations_used.toLocaleString()} <span className="text-sm font-medium text-[#64748B]">/ {usage.evaluations_limit.toLocaleString()}</span></div></div>
            <div className={`rounded-xl border px-3 py-2 text-end ${nearLimit ? 'border-amber-400/20 bg-amber-400/5' : 'border-[#22D3EE]/15 bg-[#22D3EE]/5'}`}><div className="text-[10px] text-[#64748B]">{t('dashboard.usage.remaining', 'المتبقي')}</div><div className={`text-sm font-bold ${nearLimit ? 'text-amber-300' : 'text-[#22D3EE]'}`}>{usage.evaluations_remaining.toLocaleString()}</div></div>
          </div>
          <div className="mt-5 h-3 rounded-full bg-[#080B12] overflow-hidden border border-white/5"><div className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-400' : 'bg-gradient-to-r from-[#6C5CE7] to-[#22D3EE]'}`} style={{ width: `${percent}%` }} /></div>
          <div className="mt-2 flex justify-between gap-3 text-[11px] text-[#64748B]"><span>{percent}% {t('dashboard.usage.used', 'مستخدم')}</span><span>{t('dashboard.usage.reset', 'التجديد')}: {resetDate}</span></div>
        </div>

        <div className="dashboard-panel p-5">
          <div className="flex items-center gap-2 text-[#22D3EE]"><Gauge className="w-4 h-4" /><span className="text-xs font-semibold text-white">{t('dashboard.usage.plan_limits', 'حدود الخطة')}</span></div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-[#64748B]">{t('dashboard.usage.plan', 'الخطة')}</span><span className="text-white font-medium">{usage.plan_name}</span></div>
            <div className="flex justify-between"><span className="text-[#64748B]">{t('dashboard.usage.order_limit', 'الطلبات')}</span><span className="text-white font-medium">{usage.evaluations_limit.toLocaleString()} / {t('dashboard.usage.month', 'شهر')}</span></div>
            <div className="flex justify-between"><span className="text-[#64748B]">Rate limit</span><span dir="ltr" className="text-white font-medium">{usage.rate_limit_per_min.toLocaleString()} req/min</span></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title={t('dashboard.usage.execution', 'متوسط زمن التقييم')} value={metrics?.avg_execution_time_ms != null ? `${metrics.avg_execution_time_ms}ms` : '—'} subtitle={t('dashboard.usage.execution_desc', 'من التقييمات المحفوظة')} icon={<Clock className="w-4 h-4 text-[#10B981]" />} />
        <MetricCard title={t('dashboard.usage.health', 'صحة API')} value={metrics?.api_health != null ? `${metrics.api_health}%` : '—'} subtitle={t('dashboard.usage.health_desc', 'معلومة تشغيلية عند توفرها')} icon={<ShieldCheck className="w-4 h-4 text-[#10B981]" />} />
        <MetricCard title={t('dashboard.usage.evaluated', 'التقييمات المحللة')} value={(metrics?.orders_analyzed ?? 0).toLocaleString()} subtitle={t('dashboard.usage.evaluated_desc', 'تقييمات المخاطر المحفوظة')} icon={<Activity className="w-4 h-4 text-[#22D3EE]" />} />
      </div>

      {usage.beta_access && <div className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-4 flex items-start gap-3 text-xs text-violet-100"><Sparkles className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" /><p className="leading-relaxed">{t('dashboard.usage.beta_note', 'أنت ضمن برنامج Beta: جميع الحسابات حاليًا على الخطة المجانية بحصة 1,000 طلب حي شهريًا. حدود الخطط المستقبلية ستظهر هنا تلقائيًا عند تفعيل الاشتراكات المدفوعة.')}</p></div>}
    </div>
  );
};
