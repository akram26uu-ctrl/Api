/** ORDIUM Orders & Risk Ingestion View */
import React, { useEffect, useState } from 'react';
import { Order, OrderStatus, RiskDecision } from '../../lib/api/types';
import { ordiumClient, OrdiumApiError } from '../../lib/api/client';
import { RiskBadge } from '../common/RiskBadge';
import { Button } from '../common/Button';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderConfirmationMetrics } from './OrderConfirmationMetrics';
import { useLanguage } from '../../i18n/LanguageContext';
import { Search, RefreshCw, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrdersViewProps { onOpenSimulator: () => void; }

export const OrdersView: React.FC<OrdersViewProps> = ({ onOpenSimulator }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true); setError(null);
    try {
      const response = await ordiumClient.listOrders({
        page, limit: 20, search: searchQuery.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter as OrderStatus : undefined,
        decision: decisionFilter !== 'all' ? decisionFilter as RiskDecision : 'ALL',
      });
      setOrders(response.data); setTotalPages(response.pagination.total_pages); setTotal(response.pagination.total);
    } catch (err) {
      const e = err as OrdiumApiError;
      setOrders([]); setError(e.message || t('common.error', 'Unable to load orders.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => { void fetchOrders(); }, 300); return () => window.clearTimeout(timer); }, [page, statusFilter, decisionFilter, searchQuery]);

  const updateFilter = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => { setter(value); setPage(1); };
  const handleOutcomeUpdated = (orderId: string, outcome: any) => setOrders(prev => prev.map(o => o.id === orderId ? { ...o, outcome } : o));

  return (
    <div className="p-6 space-y-6">
      <OrderConfirmationMetrics />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-[#94A3B8] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input aria-label={t('dashboard.orders.search_placeholder','البحث في الطلبات')} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder={t('dashboard.orders.search_placeholder','Search order #, customer name, or IP...')} className="w-full bg-[#0D1320] border border-white/10 rounded-xl ps-10 pe-4 py-2 text-xs text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#22D3EE] font-mono" />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select value={decisionFilter} onChange={e => updateFilter(setDecisionFilter, e.target.value)} className="bg-[#0D1320] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white">
            <option value="all">{t('dashboard.orders.all_decisions','كل القرارات')}</option><option value="ALLOW">{t('dashboard.orders.allow','سماح')}</option><option value="REVIEW">{t('dashboard.orders.review','مراجعة')}</option><option value="REJECT">{t('dashboard.orders.reject','رفض')}</option>
          </select>
          <select value={statusFilter} onChange={e => updateFilter(setStatusFilter, e.target.value)} className="bg-[#0D1320] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white">
            <option value="all">{t('dashboard.orders.all_statuses','كل الحالات')}</option>{['pending','confirmed','shipped','delivered','cancelled','returned'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => void fetchOrders()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>{t('dashboard.orders.refresh','تحديث')}</Button>
          <Button variant="primary" size="sm" onClick={onOpenSimulator}>+ {t('dashboard.orders.ingest_order','إدخال طلب')}</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h3 className="text-sm font-semibold text-white">{t('dashboard.orders.load_error','تعذر تحميل الطلبات')}</h3><p className="text-xs text-[#94A3B8] mt-2">{error}</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void fetchOrders()}>{t('common.retry','إعادة المحاولة')}</Button>
        </div>
      ) : loading ? <LoadingState message="Fetching live order telemetry..." /> : orders.length === 0 ? (
        <EmptyState title={t('dashboard.orders.empty_title','لا توجد طلبات')} description={t('dashboard.orders.empty_desc','لا توجد طلبات تطابق الفلاتر الحالية لهذا المتجر.')} actionText={t('dashboard.orders.open_simulator','فتح المحاكي')} onAction={onOpenSimulator} />
      ) : (
        <div className="bg-[#0D1320] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 py-3 border-b border-white/5 text-[11px] font-mono text-[#64748B]">{total.toLocaleString()} orders · page {page} / {totalPages}</div>
          <div className="overflow-x-auto"><table className="w-full text-start border-collapse"><thead><tr className="border-b border-white/5 bg-[#080B12]/60 text-[11px] font-mono text-[#94A3B8] uppercase"><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_order','الطلب')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_product','المنتج')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_customer','العميل')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_amount','المبلغ')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_decision','القرار')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_score','الدرجة')}</th><th className="py-3.5 px-4 text-end">{t('dashboard.orders.col_actions','الإجراء')}</th></tr></thead>
          <tbody className="divide-y divide-white/5">{orders.map(order => <tr key={order.id} className="hover:bg-white/[0.02] transition-colors"><td className="py-3 px-4 font-bold text-white"><div>{order.order_number}</div><div className="text-[10px] font-normal text-[#64748B]" dir="ltr">{order.id.slice(0, 8)}</div></td><td className="py-3 px-4 text-white"><div className="max-w-[260px]">{order.items?.length ? order.items.slice(0, 2).map((item, idx) => <div key={item.id || `${item.name}-${idx}`} className="truncate" title={item.name}>{item.name} <span className="text-[#64748B]">×{item.quantity}</span></div>) : <span className="text-[#64748B]">{t('dashboard.orders.product_unavailable','اسم المنتج غير متوفر')}</span>}{(order.items?.length || 0) > 2 && <div className="text-[10px] text-[#64748B]">+{order.items!.length - 2} {t('dashboard.orders.more_products','منتجات أخرى')}</div>}</div></td><td className="py-3 px-4 text-[#94A3B8]"><div>{order.customer.name}</div>{order.customer.phone && <div className="text-[10px] mt-1" dir="ltr">{order.customer.phone}</div>}</td><td className="py-3 px-4 font-bold text-white">{order.amount.toFixed(2)} <span className="text-[10px] text-[#94A3B8]">{order.currency}</span></td><td className="py-3 px-4"><RiskBadge decision={order.risk?.decision} size="sm" /></td><td className="py-3 px-4 font-bold text-white">{order.risk?.score ?? '—'}</td><td className="py-3 px-4 text-end"><button aria-label={`${t('dashboard.orders.inspect','فحص')} ${order.order_number}`} onClick={() => setSelectedOrder(order)}><Eye className="w-4 h-4 text-[#94A3B8] hover:text-[#22D3EE]" /></button></td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>Previous</Button><span className="text-[11px] font-mono text-[#64748B]">{page} / {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>Next</Button></div>
        </div>
      )}
      <OrderDetailDrawer order={selectedOrder} isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} onUpdateOutcome={handleOutcomeUpdated} />
    </div>
  );
};
