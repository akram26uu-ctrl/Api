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

interface OrdersViewProps { onOpenSimulator: () => void; storeName?: string; onOpenConfirmation?: () => void; }

export const OrdersView: React.FC<OrdersViewProps> = ({ onOpenSimulator, storeName, onOpenConfirmation }) => {
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
  // Default view is the agent's work queue: pending orders, riskiest first.
  const [queue, setQueue] = useState<'needs_action' | 'all'>('needs_action');

  const fetchOrders = async () => {
    setLoading(true); setError(null);
    try {
      const response = await ordiumClient.listOrders({
        page, limit: 20, search: searchQuery.trim() || undefined,
        status: queue === 'needs_action' ? 'pending' as OrderStatus : statusFilter !== 'all' ? statusFilter as OrderStatus : undefined,
        sort: queue === 'needs_action' ? 'risk' : 'newest',
        decision: decisionFilter !== 'all' ? decisionFilter as RiskDecision : 'ALL',
      });
      setOrders(response.data); setTotalPages(response.pagination.total_pages); setTotal(response.pagination.total);
    } catch (err) {
      const e = err as OrdiumApiError;
      setOrders([]); setError(e.message || t('common.error', 'Unable to load orders.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => { void fetchOrders(); }, 300); return () => window.clearTimeout(timer); }, [page, statusFilter, decisionFilter, searchQuery, queue]);

  const selectedIndex = selectedOrder ? orders.findIndex(o => o.id === selectedOrder.id) : -1;
  const updateFilter = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => { setter(value); setPage(1); };
  const handleOutcomeUpdated = (orderId: string, outcome: any) => setOrders(prev => prev.map(o => o.id === orderId ? { ...o, outcome } : o));

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <OrderConfirmationMetrics compact onOpenDetails={onOpenConfirmation} />
      <div role="tablist" aria-label={t('dashboard.orders.queue_label', 'عرض الطلبات')} className="inline-flex rounded-xl border border-white/10 bg-[var(--ordium-surface)] p-1">
        {(['needs_action', 'all'] as const).map(key => (
          <button key={key} type="button" role="tab" aria-selected={queue === key} onClick={() => { setQueue(key); setPage(1); }} className={`min-h-11 px-4 rounded-lg text-sm font-semibold ${queue === key ? 'bg-[var(--ordium-surface-raised)] text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>
            {key === 'needs_action' ? t('dashboard.orders.queue_needs_action', 'تحتاج إجراء') : t('dashboard.orders.queue_all', 'كل الطلبات')}
          </button>
        ))}
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-[var(--ordium-muted)] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input aria-label={t('dashboard.orders.search_placeholder','البحث في الطلبات')} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder={t('dashboard.orders.search_placeholder','ابحث برقم الطلب أو اسم العميل أو الهاتف…')} className="w-full bg-[var(--ordium-surface-raised)] border border-white/[0.12] rounded-xl ps-10 pe-4 py-3 text-sm text-white placeholder-[var(--ordium-muted)] focus:outline-none focus:border-[var(--ordium-signal)] focus:ring-2 focus:ring-[var(--ordium-signal)]/15 font-mono" />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select aria-label={t('dashboard.orders.decision_filter', 'القرار')} value={decisionFilter} onChange={e => updateFilter(setDecisionFilter, e.target.value)} className="bg-[var(--ordium-surface)] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white">
            <option value="all">{t('dashboard.orders.all_decisions','كل القرارات')}</option><option value="ALLOW">{t('dashboard.decision.allow','مقبولة')}</option><option value="REVIEW">{t('dashboard.decision.review','مراجعة')}</option><option value="REJECT">{t('dashboard.decision.reject','مرفوضة')}</option>
          </select>
          {queue === 'all' && <select aria-label={t('dashboard.orders.status_filter', 'حالة الطلبية')} value={statusFilter} onChange={e => updateFilter(setStatusFilter, e.target.value)} className="bg-[var(--ordium-surface)] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white">
            <option value="all">{t('dashboard.orders.all_statuses','كل الحالات')}</option>{['pending','confirmed','shipped','delivered','cancelled','returned'].map(s => <option key={s} value={s}>{t(`dashboard.orders.status.${s}`, s)}</option>)}
          </select>}
          <Button variant="outline" size="sm" onClick={() => void fetchOrders()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>{t('dashboard.orders.refresh','تحديث')}</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h3 className="text-sm font-semibold text-white">{t('dashboard.orders.load_error','تعذر تحميل الطلبات')}</h3><p className="text-xs text-[var(--ordium-muted)] mt-2">{error}</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void fetchOrders()}>{t('common.retry','إعادة المحاولة')}</Button>
        </div>
      ) : loading ? <LoadingState message={t('dashboard.orders.loading', 'جارٍ تحميل الطلبات…')} /> : orders.length === 0 ? (
        <EmptyState title={t('dashboard.orders.empty_title','لا توجد طلبات')} description={t('dashboard.orders.empty_desc','لا توجد طلبات تطابق الفلاتر الحالية لهذا المتجر.')} actionText={t('dashboard.orders.open_simulator','تجربة طلب')} onAction={onOpenSimulator} />
      ) : (
        <div className="dashboard-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 text-xs font-mono text-[var(--ordium-subtle)]">{total.toLocaleString()} {t('dashboard.orders.results_label', 'طلب')} · {t('dashboard.orders.page_label', 'صفحة')} {page} / {totalPages}</div>
          {/* Phones: one tappable card per order instead of a 7-column table that needs sideways scrolling. */}
          <ul className="md:hidden divide-y divide-white/5">
            {orders.map(order => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  aria-label={`${t('dashboard.orders.inspect', 'فحص')} ${order.order_number}`}
                  className="w-full px-4 py-3.5 text-start active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white" dir="ltr">{order.order_number}</div>
                      <div className="mt-0.5 truncate text-sm text-[var(--ordium-muted)]">{order.customer.name}</div>
                      {order.customer.phone && <div className="mt-0.5 text-xs text-[#8492A6]" dir="ltr">{order.customer.phone}</div>}
                    </div>
                    <div className="shrink-0 text-end">
                      <RiskBadge decision={order.risk?.decision} size="sm" />
                      <div className="mt-1.5 text-xs text-[#8492A6]">{t('dashboard.orders.col_score', 'الدرجة')}: <span className="font-semibold text-white">{order.risk?.score ?? '—'}</span></div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-[#C1CCDA]">
                      {order.items?.length
                        ? order.items.slice(0, 2).map(item => `${item.name} ×${item.quantity}`).join('، ') + ((order.items.length > 2) ? ` +${order.items.length - 2}` : '')
                        : t('dashboard.orders.product_unavailable', 'اسم المنتج غير متوفر')}
                    </span>
                    <span className="shrink-0 font-semibold text-white tabular-nums" dir="ltr">{order.amount.toFixed(2)} <span className="text-xs text-[#8492A6]">{order.currency}</span></span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto"><table className="w-full text-start border-collapse"><thead><tr className="border-b border-white/5 bg-[var(--ordium-canvas)]/60 text-xs font-mono text-[var(--ordium-muted)] uppercase"><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_order','الطلب')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_product','المنتج')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_customer','العميل')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_amount','المبلغ')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_decision','القرار')}</th><th className="py-3.5 px-4 text-start">{t('dashboard.orders.col_score','الدرجة')}</th><th className="py-3.5 px-4 text-end">{t('dashboard.orders.col_actions','الإجراء')}</th></tr></thead>
          <tbody className="divide-y divide-white/5">{orders.map(order => <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-white/[0.03] transition-colors cursor-pointer"><td className="py-3 px-4 font-bold text-white"><div>{order.order_number}</div></td><td className="py-3 px-4 text-white"><div className="max-w-[260px]">{order.items?.length ? order.items.slice(0, 2).map((item, idx) => <div key={item.id || `${item.name}-${idx}`} className="truncate" title={item.name}>{item.name} <span className="text-[var(--ordium-subtle)]">×{item.quantity}</span></div>) : <span className="text-[var(--ordium-subtle)]">{t('dashboard.orders.product_unavailable','اسم المنتج غير متوفر')}</span>}{(order.items?.length || 0) > 2 && <div className="text-xs text-[var(--ordium-subtle)]">+{order.items!.length - 2} {t('dashboard.orders.more_products','منتجات أخرى')}</div>}</div></td><td className="py-3 px-4 text-[var(--ordium-muted)]"><div>{order.customer.name}</div>{order.customer.phone && <div className="text-xs mt-1" dir="ltr">{order.customer.phone}</div>}</td><td className="py-3 px-4 font-bold text-white">{order.amount.toFixed(2)} <span className="text-xs text-[var(--ordium-muted)]">{order.currency}</span></td><td className="py-3 px-4"><RiskBadge decision={order.risk?.decision} size="sm" /></td><td className="py-3 px-4 font-bold text-white">{order.risk?.score ?? '—'}</td><td className="py-3 px-4 text-end"><button type="button" className="inline-flex min-w-10 min-h-10 items-center justify-center rounded-lg hover:bg-white/5" aria-label={`${t('dashboard.orders.inspect','فحص')} ${order.order_number}`} onClick={() => setSelectedOrder(order)}><Eye aria-hidden="true" className="w-4 h-4 text-[var(--ordium-muted)] hover:text-[var(--ordium-signal)]" /></button></td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} leftIcon={<ChevronLeft aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('dashboard.orders.previous_page', 'السابق')}</Button><span className="text-xs font-mono text-[var(--ordium-subtle)]">{page} / {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} rightIcon={<ChevronRight aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('dashboard.orders.next_page', 'التالي')}</Button></div>
        </div>
      )}
      <OrderDetailDrawer order={selectedOrder} isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} storeName={storeName} onUpdateOutcome={handleOutcomeUpdated} onPrevious={selectedIndex > 0 ? () => setSelectedOrder(orders[selectedIndex - 1]) : undefined} onNext={selectedIndex >= 0 && selectedIndex < orders.length - 1 ? () => setSelectedOrder(orders[selectedIndex + 1]) : undefined} positionLabel={selectedIndex >= 0 ? `${selectedIndex + 1} / ${orders.length}` : undefined} />
    </div>
  );
};
