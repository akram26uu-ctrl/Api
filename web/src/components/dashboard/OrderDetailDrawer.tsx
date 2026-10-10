/**
 * ORDIUM Order Detail Inspector Drawer
 * Merchant-facing order details, risk summary, manual confirmation, and activity history.
 */

import React, { useEffect, useState } from 'react';
import { Order, RiskOutcome, OrderConfirmationAttempt } from '../../lib/api/types';
import { Drawer } from '../common/Drawer';
import { RiskBadge } from '../common/RiskBadge';
import { RiskScoreGauge } from '../common/RiskScoreGauge';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  User,
  Smartphone,
  Cpu,
  MapPin,
  Globe,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  PhoneCall,
  PackageCheck,
  Loader2
} from 'lucide-react';
import { ordiumClient } from '../../lib/api/client';

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOutcome?: (orderId: string, outcome: RiskOutcome) => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateOutcome
}) => {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'timeline'>('overview');
  const [isUpdatingOutcome, setIsUpdatingOutcome] = useState(false);
  const [confirmationAttempts, setConfirmationAttempts] = useState<OrderConfirmationAttempt[]>([]);
  const [confirmationStatus, setConfirmationStatus] = useState('pending');
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationNote, setConfirmationNote] = useState('');
  const [lastContactChannel, setLastContactChannel] = useState<'whatsapp' | 'manual_call'>('manual_call');
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !order) return;
    let active = true;
    setConfirmationLoading(true);
    setConfirmationError(null);
    ordiumClient.getConfirmationAttempts(order.id).then(result => {
      if (!active) return;
      setConfirmationAttempts(result.data || []);
      setConfirmationStatus(result.status || 'pending');
    }).catch(err => {
      if (active) setConfirmationError((err as Error)?.message || t('dashboard.confirmation.load_error', 'تعذر تحميل سجل التأكيد'));
    }).finally(() => { if (active) setConfirmationLoading(false); });
    return () => { active = false; };
  }, [isOpen, order?.id]);

  if (!order) return null;

  const recordConfirmation = async (channel: 'whatsapp' | 'manual_call', outcome: OrderConfirmationAttempt['outcome']) => {
    setConfirmationLoading(true);
    setConfirmationError(null);
    try {
      const attempt = await ordiumClient.recordConfirmationAttempt(order.id, { channel, outcome, notes: confirmationNote.trim() || undefined });
      setConfirmationAttempts(prev => [attempt, ...prev].slice(0, 50));
      setConfirmationStatus(outcome);
      setConfirmationNote('');
    } catch (err) {
      setConfirmationError((err as Error)?.message || t('dashboard.confirmation.save_error', 'تعذر حفظ نتيجة التأكيد'));
    } finally { setConfirmationLoading(false); }
  };

  const phoneDigits = (order.customer.phone || '').replace(/\D/g, '');
  const normalizedDigits = phoneDigits.startsWith('00213') ? phoneDigits.slice(2) : phoneDigits;
  const internationalPhone = normalizedDigits.startsWith('213') ? normalizedDigits : normalizedDigits.startsWith('0') ? `213${normalizedDigits.slice(1)}` : normalizedDigits;
  const canContact = internationalPhone.length >= 11;
  const productSummary = (order.items || []).map(item => `${item.name} × ${item.quantity}`).join('، ') || '—';
  const whatsappMessage = `السلام عليكم ${order.customer.name}، نتواصل معكم لتأكيد طلبكم رقم ${order.order_number}. المنتجات: ${productSummary}. المبلغ الإجمالي: ${order.amount.toFixed(2)} ${order.currency}. هل تؤكدون الطلب؟`;
  const whatsappUrl = canContact ? `https://wa.me/${internationalPhone}?text=${encodeURIComponent(whatsappMessage)}` : undefined;
  const callUrl = canContact ? `tel:+${internationalPhone}` : undefined;

  const handleOutcome = async (outcome: RiskOutcome) => {
    setIsUpdatingOutcome(true);
    try {
      await ordiumClient.updateOrderOutcome(order.id, outcome);
      onUpdateOutcome?.(order.id, outcome);
    } catch {
      // ignore
    } finally {
      setIsUpdatingOutcome(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`${t('dashboard.orders.inspector_title', 'Order Inspector')}: ${order.order_number}`} width="xl">
      {/* Top Banner: Score & Decision */}
      <div className="p-4 rounded-xl bg-[#080B12] border border-white/10 flex items-center justify-between gap-4 text-start">
        <div className="flex items-center gap-4">
          <RiskScoreGauge score={order.risk?.score || 0} size="md" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#94A3B8]">{t('dashboard.orders.decision', 'DECISION')}:</span>
              <RiskBadge decision={order.risk?.decision} size="md" />
            </div>
            <div className="text-lg font-bold text-white font-mono" dir="ltr">
              ${order.amount.toFixed(2)} {order.currency}
            </div>
            <div className="text-[11px] font-mono text-[#94A3B8]">
              {t('dashboard.orders.evaluated_in', 'Evaluated in')} {order.risk?.execution_time_ms != null ? `${order.risk.execution_time_ms}ms` : '—'} · {t('dashboard.orders.confidence', 'Conf')}: {order.risk?.confidence != null ? `${Math.round(order.risk.confidence * 100)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Outcome Tag */}
        <div className="text-end">
          <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">{t('dashboard.orders.recorded_outcome', 'Recorded Outcome')}</span>
          <span
            className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
              order.outcome === 'chargeback'
                ? 'bg-[#EF4444]/20 text-[#EF4444]'
                : order.outcome === 'legitimate'
                ? 'bg-[#10B981]/20 text-[#10B981]'
                : order.outcome === 'false_positive'
                ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                : 'bg-white/5 text-[#94A3B8]'
            }`}
          >
            {order.outcome === 'chargeback'
              ? t('dashboard.orders.chargeback', 'CHARGEBACK')
              : order.outcome === 'legitimate'
              ? t('dashboard.orders.legitimate', 'LEGITIMATE')
              : order.outcome === 'false_positive'
              ? t('dashboard.orders.false_positive', 'FALSE POSITIVE')
              : t('dashboard.orders.unresolved', 'UNRESOLVED')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 text-xs font-mono">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 px-3 font-semibold transition-colors ${
            activeTab === 'overview' ? 'text-[#22D3EE] border-b-2 border-[#22D3EE]' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          {t('dashboard.orders.tab_entity', 'ملخص الطلب')}
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          className={`pb-2.5 px-3 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'signals' ? 'text-[#22D3EE] border-b-2 border-[#22D3EE]' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <span>{t('dashboard.orders.tab_signals', 'مؤشرات المخاطر')}</span>
          <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
            {order.risk?.signals?.length || 0}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-2.5 px-3 font-semibold transition-colors ${
            activeTab === 'timeline' ? 'text-[#22D3EE] border-b-2 border-[#22D3EE]' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          {t('dashboard.orders.tab_timeline', 'سجل النشاط')}
        </button>

      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4 text-start">
          {/* Integrated manual order confirmation — no separate confirmation dashboard or automated calls */}
          <div className="p-4 rounded-xl bg-[#080B12]/80 border border-[#22D3EE]/20 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-mono text-white uppercase tracking-wider font-bold flex items-center gap-2"><PackageCheck className="w-4 h-4 text-[#22D3EE]" />{t('dashboard.confirmation.title', 'تأكيد الطلب')}</h4>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${confirmationStatus === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400' : confirmationStatus === 'cancelled' ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-[#94A3B8]'}`}>{t(`dashboard.confirmation.status.${confirmationStatus}`, ({pending:'بانتظار التأكيد',confirmed:'تم التأكيد',cancelled:'أُلغي الطلب',no_answer:'لم يرد',callback_requested:'طلب معاودة الاتصال',needs_review:'يتطلب المراجعة',contact_started:'بدأ التواصل'} as Record<string,string>)[confirmationStatus] || confirmationStatus)}</span>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3 space-y-1">
              <div className="text-[#94A3B8]">{t('dashboard.confirmation.products', 'المنتجات')}</div>
              <div className="text-white font-medium">{productSummary}</div>
              <div className="text-[#94A3B8]">{t('dashboard.confirmation.buyer', 'المشتري')}: <span className="text-white">{order.customer.name}</span> · <span dir="ltr" className="text-white">{order.customer.phone || '—'}</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => { setLastContactChannel('whatsapp'); void recordConfirmation('whatsapp', 'contact_started'); }} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-300 hover:bg-emerald-500/20"><MessageCircle className="w-4 h-4" />{t('dashboard.confirmation.whatsapp', 'فتح واتساب')}</a> : <span className="text-amber-300">{t('dashboard.confirmation.phone_missing', 'رقم الهاتف غير صالح للتواصل')}</span>}
              {callUrl && <a href={callUrl} onClick={() => { setLastContactChannel('manual_call'); void recordConfirmation('manual_call', 'contact_started'); }} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 font-semibold text-white hover:bg-white/5"><PhoneCall className="w-4 h-4" />{t('dashboard.confirmation.call', 'اتصال يدوي')}</a>}
            </div>
            <textarea value={confirmationNote} onChange={e => setConfirmationNote(e.target.value)} rows={2} maxLength={1000} placeholder={t('dashboard.confirmation.note_placeholder', 'ملاحظة اختيارية عن التواصل')} className="w-full rounded-lg border border-white/10 bg-[#0D1320] p-3 text-white placeholder-[#64748B] outline-none focus:border-[#22D3EE]" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" isLoading={confirmationLoading} onClick={() => void recordConfirmation(lastContactChannel, 'confirmed')} className="text-emerald-300 border-emerald-500/30">{t('dashboard.confirmation.confirmed', 'تم التأكيد')}</Button>
              <Button variant="outline" size="sm" isLoading={confirmationLoading} onClick={() => void recordConfirmation(lastContactChannel, 'cancelled')} className="text-red-300 border-red-500/30">{t('dashboard.confirmation.cancelled', 'إلغاء الطلب')}</Button>
              <Button variant="outline" size="sm" isLoading={confirmationLoading} onClick={() => void recordConfirmation(lastContactChannel, 'no_answer')}>{t('dashboard.confirmation.no_answer', 'لم يرد')}</Button>
              <Button variant="outline" size="sm" isLoading={confirmationLoading} onClick={() => void recordConfirmation(lastContactChannel, 'callback_requested')}>{t('dashboard.confirmation.callback', 'معاودة الاتصال')}</Button>
            </div>
            {confirmationError && <p className="text-red-300" role="alert">{confirmationError}</p>}
            {confirmationLoading && <p className="text-[#94A3B8] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('dashboard.confirmation.saving', 'جارٍ حفظ سجل التواصل...')}</p>}
            {confirmationAttempts.length > 0 && <div className="border-t border-white/10 pt-3 space-y-2"><div className="text-[#94A3B8]">{t('dashboard.confirmation.recent_activity', 'آخر محاولات التواصل')}</div>{confirmationAttempts.slice(0, 3).map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 text-[10px]"><span className="text-white">{t(`dashboard.confirmation.outcome.${item.outcome}`, ({contact_started:'بدأ التواصل',confirmed:'تم التأكيد',cancelled:'أُلغي الطلب',no_answer:'لم يرد',callback_requested:'طلب معاودة الاتصال',needs_review:'يتطلب المراجعة'} as Record<string,string>)[item.outcome] || item.outcome)} · {item.channel === 'whatsapp' ? 'WhatsApp' : t('dashboard.confirmation.manual_call', 'اتصال يدوي')}</span><span className="text-[#64748B]" dir="ltr">{new Date(item.created_at).toLocaleString()}</span></div>)}</div>}
          </div>
          {/* Customer & Device */}
          <div className="p-4 rounded-xl bg-[#080B12]/80 border border-white/5 space-y-3 text-xs">
            <h4 className="font-mono text-white uppercase tracking-wider font-bold flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>{t('dashboard.orders.customer_device', 'معلومات العميل')}</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.customer', 'Full Name')}:</span>
                <p className="text-white font-medium">{order.customer.name}</p>
              </div>
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.phone', 'الهاتف')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.customer.phone || '—'}</p>
              </div>
            </div>
          </div>

          {/* Network & Location */}
          <div className="p-4 rounded-xl bg-[#080B12]/80 border border-white/5 space-y-3 text-xs">
            <h4 className="font-mono text-white uppercase tracking-wider font-bold flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#6C5CE7]" />
              <span>{t('dashboard.orders.network_destination', 'Network & Shipping Destination')}</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.ip_address', 'IP Address')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.customer.ip_address || '127.0.0.1'}</p>
              </div>
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.rules_model', 'Rules Engine Model')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.risk?.rules_version || 'ordium-rules-v2.4'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[#94A3B8]">{t('dashboard.orders.shipping_address', 'Shipping Address')}:</span>
                <p className="text-white font-medium">
                  {order.shipping_address ? (
                    `${order.shipping_address.street1}, ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.postal_code}, ${order.shipping_address.country}`
                  ) : (
                    t('dashboard.orders.digital_delivery', 'Digital delivery / No physical address')
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Manual Outcome Feedback Logger */}
          <div className="p-4 rounded-xl bg-[#080B12]/80 border border-white/5 space-y-2 text-xs">
            <h4 className="font-mono text-white uppercase tracking-wider font-bold">
              {t('dashboard.orders.record_merchant_outcome', 'Record Merchant Outcome')}
            </h4>
            <p className="text-[#94A3B8] text-[11px]">
              {t('dashboard.orders.outcome_desc', 'Label real-world settlement outcomes to audit risk engine accuracy and train future models.')}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                isLoading={isUpdatingOutcome}
                onClick={() => handleOutcome('legitimate')}
                className="text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/10"
              >
                {t('dashboard.orders.mark_legitimate', 'Mark Legitimate')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isLoading={isUpdatingOutcome}
                onClick={() => handleOutcome('chargeback')}
                className="text-[#EF4444] border-[#EF4444]/30 hover:bg-[#EF4444]/10"
              >
                {t('dashboard.orders.log_chargeback', 'Log Chargeback')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isLoading={isUpdatingOutcome}
                onClick={() => handleOutcome('false_positive')}
                className="text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/10"
              >
                {t('dashboard.orders.mark_false_positive', 'Mark False Positive')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Signals */}
      {activeTab === 'signals' && (
        <div className="space-y-3 text-start">
          {(!order.risk?.signals || order.risk.signals.length === 0) ? (
            <div className="text-center py-8 text-[#94A3B8] text-xs font-mono">
              ✓ {t('dashboard.orders.no_signals', 'No malicious signals detected. Transaction passed all baseline checks.')}
            </div>
          ) : (
            order.risk.signals.map((sig, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#080B12] border border-white/5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sig.severity === 'critical' ? 'bg-[#EF4444]' : (sig.severity === 'high' ? 'bg-[#F59E0B]' : 'bg-[#22D3EE]')
                      }`}
                    />
                    <span className="font-bold text-white">{sig.name}</span>
                    <span className="font-mono text-[10px] text-[#94A3B8] bg-white/5 px-1.5 py-0.5 rounded" dir="ltr">
                      {sig.code}
                    </span>
                  </div>
                  <p className="text-[#94A3B8] text-[11px] leading-relaxed">{sig.description}</p>
                </div>
                <div className="text-end shrink-0 font-mono">
                  <span className="font-bold text-white" dir="ltr">+{sig.weight} pts</span>
                  <span
                    className={`block text-[10px] uppercase font-bold ${
                      sig.severity === 'critical' ? 'text-[#EF4444]' : (sig.severity === 'high' ? 'text-[#F59E0B]' : 'text-[#22D3EE]')
                    }`}
                  >
                    {sig.severity}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-3 text-start">
          {order.risk?.events?.map((ev, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-[#22D3EE] mt-1.5 shrink-0" />
              <div className="flex-1 pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{ev.type}</span>
                  <span className="text-[#94A3B8] text-[10px]" dir="ltr">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {ev.message && <p className="text-[#94A3B8] mt-0.5 text-[11px]">{ev.message}</p>}
              </div>
            </div>
          ))}
        </div>
      )}


    </Drawer>
  );
};
