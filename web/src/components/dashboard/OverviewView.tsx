/**
 * ORDIUM Executive Dashboard Overview
 */

import React, { useState, useEffect } from 'react';
import { MetricsSummary, Order } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { MetricCard } from '../common/MetricCard';
import { RiskBadge } from '../common/RiskBadge';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { RiskCore3D } from '../3d/RiskCore3D';
import { Button } from '../common/Button';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderConfirmationMetrics } from './OrderConfirmationMetrics';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ShieldAlert,
  DollarSign,
  Zap,
  CheckCircle2,
  TrendingUp,
  Activity,
  ArrowRight,
  ArrowLeft,
  Eye
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigateTab }) => {
  const { t, isRTL } = useLanguage();
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [m, ords] = await Promise.all([
          ordiumClient.getMetrics(),
          ordiumClient.listOrders({ page: 1, limit: 5 })
        ]);
        setMetrics(m);
        setRecentOrders(ords.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState message={t('dashboard.orders.fetching_telemetry', 'جارٍ تحميل مؤشرات المخاطر…')} />;
  }

  if (error || !metrics) {
    return <div className="p-6"><EmptyState title={t('dashboard.overview.load_error_title', 'We could not load your workspace data')} description={t('dashboard.overview.load_error_desc', 'تعذر تحميل بيانات المتجر حاليًا. حدّث الصفحة، وإذا استمرت المشكلة تواصل مع الدعم.')} actionText={t('dashboard.overview.retry', 'إعادة المحاولة')} onAction={() => window.location.reload()} /></div>;
  }

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

  return (
    <div className="p-6 space-y-6">
      <OrderConfirmationMetrics />

      {/* 4 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('dashboard.overview.orders_ingested', 'الطلبات المستلمة')}
          value={totalOrders.toLocaleString()}
          change={hasOrders ? { value: `${ordersAnalyzed.toLocaleString()} ${t('dashboard.overview.evaluated_label', 'تم تقييمها')}`, trend: 'up', label: t('dashboard.overview.evaluated_detail', 'طلبات جرى تقييمها') } : undefined}
          icon={<Activity className="w-4 h-4 text-[#22D3EE]" />}
        />
        <MetricCard
          title={t('dashboard.overview.volume_protected', 'إجمالي قيمة الطلبات')}
          value={`${(totalVolume / 1000).toFixed(1)}k DZD`}
          change={totalOrders > 0 ? { value: `${Math.round((ordersAnalyzed / totalOrders) * 100)}%`, trend: 'up', label: 'evaluated' } : undefined}
          icon={<DollarSign className="w-4 h-4 text-[#10B981]" />}
        />
        <MetricCard
          title={t('dashboard.overview.fraud_blocked_card', 'قيمة الطلبات المرفوضة')}
          value={`${(fraudBlockedVolume / 1000).toFixed(1)}k DZD`}
          subtitle={t('dashboard.overview.rejected_volume_hint', 'قيمة الطلبات التي صدر بحقها قرار رفض')}
          variant="accent"
          icon={<ShieldAlert className="w-4 h-4 text-[#6C5CE7]" />}
        />
        <MetricCard
          title={t('dashboard.overview.avg_execution', 'Average Execution')}
          value={metrics.avg_execution_time_ms != null ? `${metrics.avg_execution_time_ms}ms` : '—'}
          subtitle={t('dashboard.overview.avg_execution_hint', 'الوقت المستغرق لتقييم الطلب')}
          icon={<Zap className="w-4 h-4 text-[#22D3EE]" />}
        />
      </div>

      {/* 3D Visualizer & توزيع القرارات */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left: 3D Risk Core */}
        <div className="lg:col-span-7 bg-[#0D1320] border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE] animate-pulse" />
              {t('dashboard.overview.risk_analysis_title', 'تحليل مخاطر الطلبات')}
            </span>
            <span className="text-[#94A3B8]">{t('dashboard.overview.store_risk_context', 'مؤشرات المخاطر المرتبطة بالمتجر')}</span>
          </div>

          <div className="h-[280px] sm:h-[320px] w-full rounded-xl overflow-hidden bg-[#080B12] relative my-2">
            <RiskCore3D interactive={false} />
            <div className="absolute bottom-2 left-2 rtl:left-auto rtl:right-2 z-10 text-[10px] font-mono text-[#94A3B8] bg-[#080B12]/80 px-2 py-1 rounded">
              {t('dashboard.overview.decision_radar', 'تحليل قرارات الطلبات')}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-mono">
            <span className="text-[#94A3B8]">{t('dashboard.overview.inspect_connected_nodes', 'Inspect connected entity nodes:')}</span>
            <button
              onClick={() => onNavigateTab('network')}
              className="text-[#22D3EE] hover:underline flex items-center gap-1 font-semibold"
            >
              {t('dashboard.overview.open_3d_graph', 'فتح شبكة الهوية')} <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Decision Distribution */}
        <div className="lg:col-span-5 bg-[#0D1320] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider text-start">
              {t('dashboard.overview.decision_breakdown', 'توزيع القرارات')}
            </h3>

            {/* Distribution Bars */}
            <div className="space-y-4 font-mono text-xs">
              {/* ALLOW */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#10B981] font-bold">{t('dashboard.overview.allow_clean', 'ALLOW (Clean)')}</span>
                  <span className="text-white font-bold">{allowCount} ({allowPercentage}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#080B12] overflow-hidden">
                  <div className="h-full bg-[#10B981] rounded-full" style={{ width: `${allowPercentage}%` }} />
                </div>
              </div>

              {/* REVIEW */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#F59E0B] font-bold">{t('dashboard.overview.review_friction', 'REVIEW (Friction / 3DS)')}</span>
                  <span className="text-white font-bold">{reviewCount} ({reviewPercentage}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#080B12] overflow-hidden">
                  <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${reviewPercentage}%` }} />
                </div>
              </div>

              {/* REJECT */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#EF4444] font-bold">{t('dashboard.overview.reject_fraud', 'REJECT (Fraud Blocked)')}</span>
                  <span className="text-white font-bold">{rejectCount} ({rejectPercentage}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#080B12] overflow-hidden">
                  <div className="h-full bg-[#EF4444] rounded-full" style={{ width: `${rejectPercentage}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
            <div className="p-3 bg-[#080B12] rounded-xl border border-white/5 text-[11px] font-mono text-[#94A3B8] text-start">
              {t('dashboard.overview.average_risk_score', 'متوسط درجة المخاطر للطلبات:')}{' '}
              <span className="text-white font-bold">{avgRiskScore} / 100</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('orders')}
              className="w-full justify-center"
            >
              {t('dashboard.overview.view_all_orders', 'عرض الطلبات')}
            </Button>
          </div>
        </div>

      </div>

      {/* Recent Evaluated Orders Table */}
      <div className="bg-[#0D1320] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            {t('dashboard.overview.recent_evaluated', 'أحدث الطلبات')}
          </span>
          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-mono text-[#22D3EE] hover:underline flex items-center gap-1"
          >
            {t('dashboard.overview.view_all_orders', 'عرض جميع الطلبات')} <ArrowIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8">
            <EmptyState title={t('dashboard.overview.no_orders_title', 'لا توجد طلبات بعد')} description={t('dashboard.overview.no_orders_desc', 'ستظهر الطلبات هنا عند وصولها إلى متجرك. يمكنك مراجعة الطلبات وحالات التأكيد من هذه الصفحة.')} actionText={t('dashboard.overview.open_simulator', 'عرض الطلبات')} onAction={() => onNavigateTab('orders')} icon={<Activity className="w-8 h-8" />} />
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 bg-[#080B12]/60 text-[11px] text-[#94A3B8] uppercase text-start">
                <th className="py-3 px-4 text-start">{t('dashboard.orders.col_order', 'Order')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.orders.col_customer', 'Customer')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.orders.col_amount', 'Amount')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.orders.col_decision', 'Decision')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.orders.col_score', 'Score')}</th>
                <th className="py-3 px-4 text-end">{t('dashboard.overview.col_inspect', 'Inspect')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentOrders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer text-start"
                >
                  <td className="py-3 px-4 font-bold text-white">{order.order_number}</td>
                  <td className="py-3 px-4 text-[#94A3B8]">{order.customer.name}</td>
                  <td className="py-3 px-4 font-bold text-white">{order.amount.toFixed(2)} <span className="text-[10px] text-[#94A3B8] font-normal">DZD</span></td>
                  <td className="py-3 px-4">
                    <RiskBadge decision={order.risk?.decision} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-bold ${
                        (order.risk?.score ?? 0) >= 75
                          ? 'text-[#EF4444]'
                          : (order.risk?.score ?? 0) >= 35
                          ? 'text-[#F59E0B]'
                          : 'text-[#10B981]'
                      }`}
                    >
                      {order.risk?.score ?? 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-end">
                    <Eye className="w-4 h-4 text-[#94A3B8] hover:text-[#22D3EE] inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};
