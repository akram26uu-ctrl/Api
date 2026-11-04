/**
 * ORDIUM Order Detail Inspector Drawer
 * Merchant-facing order details, risk summary, manual confirmation, and activity history.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { riskSignalLabel } from '../../lib/riskSignals';
import { Order, RiskOutcome, OrderConfirmationAttempt, AutomaticConfirmationStatus } from '../../lib/api/types';
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
  Loader2,
  Send,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ordiumClient } from '../../lib/api/client';
import { CONFIRMATION_TEMPLATES, renderTemplate, getDefaultTemplateId, setDefaultTemplateId } from '../../lib/confirmationTemplates';

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  onUpdateOutcome?: (orderId: string, outcome: RiskOutcome) => void;
  /** Queue navigation: the drawer is the agent's workspace, so moving to the
      next order must not require closing it and hunting for the next row. */
  onPrevious?: () => void;
  onNext?: () => void;
  positionLabel?: string;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  storeName,
  onUpdateOutcome,
  onPrevious,
  onNext,
  positionLabel
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'timeline'>('overview');
  const [isUpdatingOutcome, setIsUpdatingOutcome] = useState(false);
  const [confirmationAttempts, setConfirmationAttempts] = useState<OrderConfirmationAttempt[]>([]);
  const [confirmationStatus, setConfirmationStatus] = useState('pending');
  const [automaticStatus, setAutomaticStatus] = useState<AutomaticConfirmationStatus | null>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationNote, setConfirmationNote] = useState('');
  const [contactChannel, setContactChannel] = useState<'whatsapp' | 'manual_call'>('whatsapp');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(getDefaultTemplateId);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeSaved, setOutcomeSaved] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [savedContact, setSavedContact] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState<boolean | null>(null);
  useEffect(() => { setConfirmCancel(false); setSavedContact(null); setOutcomeSaved(null); setTemplatesOpen(null); setOutcomeError(null); }, [order?.id]);

  useEffect(() => {
    if (!isOpen || !order) return;
    let active = true;
    setConfirmationLoading(true);
    setConfirmationError(null);
    setSendState('idle');
    setAutomaticStatus(null);
    ordiumClient.getConfirmationAttempts(order.id).then(result => {
      if (!active) return;
      setConfirmationAttempts(result.data || []);
      setConfirmationStatus(result.status || 'pending');
      setAutomaticStatus(result.automatic ?? null);
    }).catch(err => {
      if (active) setConfirmationError((err as Error)?.message || t('dashboard.confirmation.load_error', 'تعذر تحميل سجل التأكيد'));
    }).finally(() => { if (active) setConfirmationLoading(false); });
    return () => { active = false; };
  }, [isOpen, order?.id]);

  // Hooks must run on every render: this sits above the `if (!order)` return
  // (calling it after that return crashed the drawer when an order was opened).
  const memoTemplate = CONFIRMATION_TEMPLATES.find(template => template.id === selectedTemplateId) || CONFIRMATION_TEMPLATES[0];
  const renderedMessage = useMemo(() => order ? renderTemplate(memoTemplate, {
    customer_name: order.customer.name || '—',
    order_number: order.order_number,
    amount: `${order.amount.toFixed(2)} ${order.currency}`,
    store_name: storeName || t('dashboard.confirmation.default_store_name', 'متجرك')
  }) : '', [memoTemplate, order?.customer.name, order?.order_number, order?.amount, order?.currency, storeName]);

  if (!order) return null;

  const recordConfirmation = async (outcome: OrderConfirmationAttempt['outcome']) => {
    setConfirmationLoading(true);
    setConfirmationError(null);
    try {
      const attempt = await ordiumClient.recordConfirmationAttempt(order.id, { channel: contactChannel, outcome, notes: confirmationNote.trim() || undefined });
      setConfirmationAttempts(prev => [attempt, ...prev].slice(0, 50));
      setConfirmationStatus(outcome);
      setConfirmationNote('');
      setConfirmCancel(false);
      setSavedContact(outcome);
    } catch (err) {
      setConfirmationError((err as Error)?.message || t('dashboard.confirmation.save_error', 'تعذر حفظ نتيجة التأكيد'));
    } finally { setConfirmationLoading(false); }
  };

  const phoneDigits = (order.customer.phone || '').replace(/\D/g, '');
  const normalizedDigits = phoneDigits.startsWith('00213') ? phoneDigits.slice(2) : phoneDigits;
  const internationalPhone = normalizedDigits.startsWith('213') ? normalizedDigits : normalizedDigits.startsWith('0') ? `213${normalizedDigits.slice(1)}` : normalizedDigits;
  const canContact = internationalPhone.length >= 11;
  const productSummary = (order.items || []).map(item => `${item.name} × ${item.quantity}`).join('، ') || '—';
  const selectedTemplate = CONFIRMATION_TEMPLATES.find(template => template.id === selectedTemplateId) || CONFIRMATION_TEMPLATES[0];
  const whatsappUrl = canContact ? `https://wa.me/${internationalPhone}?text=${encodeURIComponent(renderedMessage)}` : undefined;
  const callUrl = canContact ? `tel:+${internationalPhone}` : undefined;

  const sendWhatsAppConfirmation = async () => {
    if (!whatsappUrl) return;
    setSendState('sending');
    setConfirmationError(null);
    try {
      const attempt = await ordiumClient.recordConfirmationAttempt(order.id, { channel: 'whatsapp', outcome: 'contact_started', notes: confirmationNote.trim() || undefined });
      setConfirmationAttempts(prev => [attempt, ...prev].slice(0, 50));
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      setSendState('sent');
    } catch (err) {
      setSendState('error');
      setConfirmationError((err as Error)?.message || t('dashboard.confirmation.save_error', 'تعذر حفظ نتيجة التأكيد'));
    }
  };

  const handleOutcome = async (outcome: RiskOutcome, reason?: string, label?: string) => {
    setIsUpdatingOutcome(true);
    setOutcomeError(null); setOutcomeSaved(null);
    try {
      await ordiumClient.updateOrderOutcome(order.id, outcome, reason);
      onUpdateOutcome?.(order.id, outcome);
      setOutcomeSaved(label || null);
    } catch (err) {
      setOutcomeError((err as Error)?.message || t('dashboard.orders.outcome_update_error', 'Could not update the order outcome. Please retry.'));
    } finally {
      setIsUpdatingOutcome(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`${t('dashboard.orders.drawer_title', 'الطلبية')} ${order.order_number}`} width="xl">
      {(onPrevious || onNext) && (
        <nav className="flex items-center justify-between gap-2" aria-label={t('dashboard.orders.queue_nav', 'التنقل بين الطلبيات')}>
          <Button variant="ghost" size="sm" disabled={!onPrevious} onClick={onPrevious} leftIcon={<ChevronRight className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />}>{t('dashboard.orders.previous_order', 'السابقة')}</Button>
          {positionLabel && <span className="text-sm text-[var(--ordium-subtle)] tabular-nums">{positionLabel}</span>}
          <Button variant="ghost" size="sm" disabled={!onNext} onClick={onNext} rightIcon={<ChevronLeft className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />}>{t('dashboard.orders.next_order', 'التالية')}</Button>
        </nav>
      )}
      {/* Top Banner: Score & Decision */}
      <div className="p-4 rounded-xl bg-[var(--ordium-canvas)] border border-white/10 flex items-center justify-between gap-4 text-start">
        <div className="flex items-center gap-4">
          <RiskScoreGauge score={order.risk?.score || 0} size="md" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[var(--ordium-muted)]">{t('dashboard.orders.decision_label', 'القرار')}:</span>
              <RiskBadge decision={order.risk?.decision} size="md" />
            </div>
            <div className="text-lg font-bold text-white font-mono" dir="ltr">
              {order.amount.toLocaleString(language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {order.currency}
            </div>
            <div className="text-xs font-mono text-[var(--ordium-muted)]">
              {t('dashboard.orders.evaluated_in', 'Evaluated in')} {order.risk?.execution_time_ms != null ? `${order.risk.execution_time_ms}ms` : '—'} · {t('dashboard.orders.confidence', 'Conf')}: {order.risk?.confidence != null ? `${Math.round(order.risk.confidence * 100)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Outcome Tag */}
        <div className="text-end">
          <span className="text-xs font-mono text-[var(--ordium-muted)] uppercase block">{t('dashboard.orders.delivery_outcome', 'نتيجة التسليم')}</span>
          {(() => {
            const outcomeStyles: Record<string, string> = {
              chargeback: 'bg-[var(--ordium-danger)]/20 text-[var(--ordium-danger)]',
              cancelled_fraud: 'bg-[var(--ordium-danger)]/20 text-[var(--ordium-danger)]',
              legitimate: 'bg-[var(--ordium-success)]/20 text-[var(--ordium-success)]',
              false_positive: 'bg-[var(--ordium-warning)]/20 text-[var(--ordium-warning)]',
              return_abusive: 'bg-[var(--ordium-warning)]/20 text-[var(--ordium-warning)]',
            };
            const outcomeLabels: Record<string, string> = {
              chargeback: t('dashboard.outcome.cancelled', 'أُلغيت'),
              cancelled_fraud: t('dashboard.outcome.cancelled', 'أُلغيت'),
              legitimate: t('dashboard.outcome.delivered', 'سُلِّمت'),
              false_positive: t('dashboard.outcome.returned', 'أُرجعت'),
              return_abusive: t('dashboard.outcome.returned', 'أُرجعت'),
            };
            const style = outcomeStyles[order.outcome] || 'bg-white/5 text-[var(--ordium-muted)]';
            const label = outcomeLabels[order.outcome] || t('dashboard.outcome.pending', 'لم تُسجَّل بعد');
            return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${style}`}>{label}</span>;
          })()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 text-xs font-mono">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 px-3 font-semibold transition-colors ${
            activeTab === 'overview' ? 'text-[var(--ordium-signal)] border-b-2 border-[var(--ordium-signal)]' : 'text-[var(--ordium-muted)] hover:text-white'
          }`}
        >
          {t('dashboard.orders.tab_entity', 'ملخص الطلب')}
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          className={`pb-2.5 px-3 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'signals' ? 'text-[var(--ordium-signal)] border-b-2 border-[var(--ordium-signal)]' : 'text-[var(--ordium-muted)] hover:text-white'
          }`}
        >
          <span>{t('dashboard.orders.tab_signals', 'مؤشرات المخاطر')}</span>
          <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-xs">
            {order.risk?.signals?.length || 0}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-2.5 px-3 font-semibold transition-colors ${
            activeTab === 'timeline' ? 'text-[var(--ordium-signal)] border-b-2 border-[var(--ordium-signal)]' : 'text-[var(--ordium-muted)] hover:text-white'
          }`}
        >
          {t('dashboard.orders.tab_timeline', 'سجل النشاط')}
        </button>

      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4 text-start">
          {/* Why this decision: the reasons come before any action. */}
          <section className="p-4 rounded-xl bg-[var(--ordium-canvas)]/80 border border-white/5 space-y-2" aria-labelledby="drawer-reasons-title">
            <h3 id="drawer-reasons-title" className="text-sm font-semibold text-white">{t('dashboard.orders.reasons_title', 'لماذا هذا القرار')}</h3>
            {(order.risk?.events?.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--ordium-muted)]">{t('dashboard.orders.no_reasons', 'لم تظهر أي إشارة خطر لهذه الطلبية.')}</p>
            ) : (
              <ul className="space-y-1.5">
                {[...(order.risk?.events ?? [])].sort((a, b) => b.scoreImpact - a.scoreImpact).slice(0, 4).map(event => (
                  <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--ordium-text)]">{riskSignalLabel(event.type, language)}</span>
                    <span className={`shrink-0 tabular-nums ${event.scoreImpact < 0 ? 'text-[var(--ordium-success)]' : 'text-[var(--ordium-warning)]'}`} dir="ltr">{event.scoreImpact < 0 ? `−${Math.abs(event.scoreImpact)}` : `+${event.scoreImpact}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* Order confirmation — WhatsApp is a platform-managed Ordium service */}
          <div className="p-4 rounded-xl bg-[var(--ordium-canvas)]/80 border border-[var(--ordium-signal)]/20 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><PackageCheck className="w-4 h-4 text-[var(--ordium-signal)]" />{t('dashboard.confirmation.title', 'تأكيد الطلب')}</h3>
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${confirmationStatus === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400' : confirmationStatus === 'cancelled' ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-[var(--ordium-muted)]'}`}>{t(`dashboard.confirmation.status.${confirmationStatus}`, ({pending:'بانتظار التأكيد',confirmed:'تم التأكيد',cancelled:'أُلغي الطلب',no_answer:'لم يرد',callback_requested:'طلب معاودة الاتصال',needs_review:'يتطلب المراجعة',contact_started:'بدأ التواصل'} as Record<string,string>)[confirmationStatus] || confirmationStatus)}</span>
            </div>

            {automaticStatus && (() => {
              const steps = ['queued', 'sent', 'delivered', 'read', 'replied'] as const;
              const reached: Record<string, boolean> = {
                queued: true,
                sent: !!automaticStatus.sent_at || ['sent', 'delivered', 'read', 'replied'].includes(automaticStatus.status),
                delivered: !!automaticStatus.delivered_at || ['delivered', 'read', 'replied'].includes(automaticStatus.status),
                read: !!automaticStatus.read_at || ['read', 'replied'].includes(automaticStatus.status),
                replied: !!automaticStatus.replied_at || automaticStatus.status === 'replied',
              };
              const stepLabels: Record<string, string> = {
                queued: t('dashboard.confirmation.auto.step_queued', 'في الانتظار'),
                sent: t('dashboard.confirmation.auto.step_sent', 'أُرسلت'),
                delivered: t('dashboard.confirmation.auto.step_delivered', 'وصلت'),
                read: t('dashboard.confirmation.auto.step_read', 'قُرئت'),
                replied: t('dashboard.confirmation.auto.step_replied', 'ردّ العميل'),
              };
              const replyLabels: Record<string, string> = {
                confirmed: t('dashboard.confirmation.auto.reply_confirmed', 'أكّد الطلب'),
                cancelled: t('dashboard.confirmation.auto.reply_cancelled', 'ألغى الطلب'),
                needs_review: t('dashboard.confirmation.auto.reply_needs_review', 'يتطلب المراجعة'),
                no_answer: t('dashboard.confirmation.auto.reply_no_answer', 'لم يرد'),
              };
              const terminal = automaticStatus.failed || automaticStatus.status === 'failed'
                ? { text: t('dashboard.confirmation.auto.failed', 'فشل إرسال الرسالة التلقائية'), cls: 'text-red-300' }
                : automaticStatus.status === 'expired'
                  ? { text: t('dashboard.confirmation.auto.expired', 'انتهت المهلة دون رد من العميل'), cls: 'text-amber-300' }
                  : automaticStatus.status === 'simulated'
                    ? { text: t('dashboard.confirmation.auto.simulated', 'وضع الاختبار (TEST) — لم تُرسل الرسالة فعليًا'), cls: 'text-amber-300' }
                    : null;
              return (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2" role="status" aria-label={t('dashboard.confirmation.auto.title', 'التأكيد التلقائي عبر واتساب')}>
                  <div className="flex items-center gap-2 font-semibold text-emerald-300"><MessageCircle className="w-3.5 h-3.5" />{t('dashboard.confirmation.auto.title', 'التأكيد التلقائي عبر واتساب')}</div>
                  {terminal ? (
                    <div className={`flex items-center gap-1.5 ${terminal.cls}`}><AlertTriangle className="w-3.5 h-3.5" />{terminal.text}</div>
                  ) : (
                    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {steps.map((step, i) => (
                        <li key={step} className={`inline-flex items-center gap-1 ${reached[step] ? 'text-emerald-300' : 'text-[var(--ordium-subtle)]'}`}>
                          {i > 0 && <span aria-hidden="true" className="text-[#475569]">→</span>}
                          {reached[step] && <CheckCircle2 className="w-3 h-3" />}
                          {stepLabels[step]}
                          {step === 'replied' && reached.replied && automaticStatus.reply_outcome && <span className="text-white">({replyLabels[automaticStatus.reply_outcome] || automaticStatus.reply_outcome})</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })()}

            {/* Channel + customer phone */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-white/10 bg-[var(--ordium-surface)] p-0.5" role="group" aria-label={t('dashboard.confirmation.channel', 'قناة التأكيد')}>
                {([['whatsapp', <MessageCircle key="wa" className="w-3.5 h-3.5" />, t('dashboard.confirmation.channel_whatsapp', 'واتساب')], ['manual_call', <PhoneCall key="call" className="w-3.5 h-3.5" />, t('dashboard.confirmation.channel_call', 'اتصال يدوي')]] as const).map(([value, icon, label]) => (
                  <button key={value} type="button" onClick={() => setContactChannel(value)} aria-pressed={contactChannel === value} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${contactChannel === value ? 'bg-[var(--ordium-accent)]/20 text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>{icon}{label}</button>
                ))}
              </div>
              <div className="text-[var(--ordium-muted)]">{t('dashboard.confirmation.buyer', 'المشتري')}: <span className="text-white">{order.customer.name}</span> · <span dir="ltr" className="text-white">{order.customer.phone || '—'}</span></div>
            </div>

            {contactChannel === 'whatsapp' && (
              <>
                {/* Platform-managed WhatsApp availability */}
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300/90 leading-relaxed">{t('dashboard.confirmation.whatsapp_service', 'واتساب خدمة مُدارة من ORDIUM — متاحة دون ربط أي حساب.')}</span>
                </div>

                {!(templatesOpen ?? order.risk?.decision !== 'ALLOW') ? (
                  <button type="button" onClick={() => setTemplatesOpen(true)} className="min-h-11 text-sm text-[var(--ordium-signal)] hover:underline underline-offset-4 text-start">{t('dashboard.confirmation.edit_message', 'اختيار نص الرسالة ومعاينتها')}</button>
                ) : (<>
                {/* Template picker */}
                <div className="space-y-1.5">
                  <div className="text-[var(--ordium-muted)]">{t('dashboard.confirmation.template_label', 'نموذج الرسالة')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {CONFIRMATION_TEMPLATES.map(template => {
                      const isSelected = template.id === selectedTemplate.id;
                      const isDefault = template.id === getDefaultTemplateId();
                      return (
                        <div key={template.id} className={`flex items-center rounded-lg border transition-colors ${isSelected ? 'border-[var(--ordium-signal)]/40 bg-[var(--ordium-signal)]/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                          <button type="button" onClick={() => { setSelectedTemplateId(template.id); setSendState('idle'); }} aria-pressed={isSelected} className={`flex-1 px-3 py-2 text-start text-xs font-semibold transition-colors ${isSelected ? 'text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>
                            {t(`dashboard.confirmation.template_name.${template.id}`, template.id)}
                            {isDefault && <span className="block mt-0.5 text-xs font-normal text-emerald-400">{t('dashboard.confirmation.template_default', 'افتراضي')}</span>}
                          </button>
                          {!isDefault && (
                            <button
                              type="button"
                              onClick={() => setDefaultTemplateId(template.id)}
                              title={t('dashboard.confirmation.template_set_default', 'تعيين كافتراضي')}
                              aria-label={t('dashboard.confirmation.template_set_default', 'تعيين كافتراضي')}
                              className="self-stretch px-2.5 text-[var(--ordium-subtle)] hover:text-[var(--ordium-signal)] transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* WhatsApp-style preview */}
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-3 py-2 bg-[var(--ordium-surface-raised)] border-b border-white/10 flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-white font-semibold">{order.customer.name}</span>
                    <span className="text-[var(--ordium-subtle)]" dir="ltr">{order.customer.phone || ''}</span>
                  </div>
                  <div className="p-3 bg-[#0B141A] space-y-2 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.04),transparent_50%)]">
                    <div className="max-w-[85%] rounded-xl rounded-tl-none px-3 py-2 bg-[#005C4B] text-white text-xs leading-relaxed whitespace-pre-wrap shadow ms-auto">
                      {renderedMessage}
                      <span className="block text-end text-xs text-white/50 mt-1" dir="ltr">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[t('dashboard.confirmation.preview_reply_confirm', 'تأكيد الطلب'), t('dashboard.confirmation.preview_reply_cancel', 'إلغاء')].map(reply => (
                        <span key={reply} className="rounded-full border border-[var(--ordium-signal)]/30 text-[var(--ordium-signal)] px-2.5 py-1 text-xs font-semibold">{reply}</span>
                      ))}
                    </div>
                    <div className="text-xs text-[var(--ordium-subtle)]">{t('dashboard.confirmation.preview_hint', 'معاينة — أزرار الرد تظهر لدى العميل داخل واتساب.')}</div>
                  </div>
                </div>

                </>)}
                {/* Send */}
                <div className="flex flex-wrap items-center gap-2">
                  {whatsappUrl ? (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={sendState === 'sending'}
                      onClick={() => void sendWhatsAppConfirmation()}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      {t('dashboard.confirmation.send_whatsapp', 'إرسال التأكيد عبر واتساب')}
                    </Button>
                  ) : (
                    <span className="text-amber-300">{t('dashboard.confirmation.phone_missing', 'رقم الهاتف غير صالح للتواصل')}</span>
                  )}
                  {sendState === 'sent' && <span className="inline-flex items-center gap-1.5 text-emerald-400" role="status"><CheckCircle2 className="w-3.5 h-3.5" />{t('dashboard.confirmation.sent', 'تم تسجيل المحاولة وفتح واتساب')}</span>}
                  {sendState === 'error' && <span className="inline-flex items-center gap-1.5 text-red-400" role="alert"><AlertTriangle className="w-3.5 h-3.5" />{t('dashboard.confirmation.send_error', 'تعذر إرسال التأكيد')}</span>}
                </div>
              </>
            )}

            {contactChannel === 'manual_call' && (
              <div className="flex flex-wrap items-center gap-2">
                {callUrl ? (
                  <a href={callUrl} onClick={() => void recordConfirmation('contact_started')} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 font-semibold text-white hover:bg-white/5"><PhoneCall className="w-4 h-4" />{t('dashboard.confirmation.call', 'اتصال يدوي')}</a>
                ) : (
                  <span className="text-amber-300">{t('dashboard.confirmation.phone_missing', 'رقم الهاتف غير صالح للتواصل')}</span>
                )}
              </div>
            )}

            <div className="rounded-lg bg-white/[0.03] p-3 space-y-1">
              <div className="text-[var(--ordium-muted)]">{t('dashboard.confirmation.products', 'المنتجات')}</div>
              <div className="text-white font-medium">{productSummary}</div>
            </div>
            <textarea value={confirmationNote} onChange={e => setConfirmationNote(e.target.value)} rows={2} maxLength={1000} placeholder={t('dashboard.confirmation.note_placeholder', 'ملاحظة اختيارية عن التواصل')} className="w-full rounded-lg border border-white/10 bg-[var(--ordium-surface)] p-3 text-white placeholder-[var(--ordium-subtle)] outline-none focus:border-[var(--ordium-signal)]" />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="md" isLoading={confirmationLoading} onClick={() => void recordConfirmation('confirmed')} leftIcon={<CheckCircle2 className="w-4 h-4" />}>{t('dashboard.confirmation.confirmed', 'تم التأكيد')}</Button>
              <Button variant="outline" size="md" isLoading={confirmationLoading} onClick={() => void recordConfirmation('no_answer')}>{t('dashboard.confirmation.no_answer', 'لم يرد')}</Button>
              <Button variant="outline" size="md" isLoading={confirmationLoading} onClick={() => void recordConfirmation('callback_requested')}>{t('dashboard.confirmation.callback', 'معاودة الاتصال')}</Button>
              <Button variant="ghost" size="md" disabled={confirmationLoading} onClick={() => setConfirmCancel(true)} className="ms-auto text-[var(--ordium-danger)]">{t('dashboard.confirmation.cancelled', 'إلغاء الطلب')}</Button>
            </div>
            {confirmCancel && (
              <div role="alertdialog" aria-labelledby="cancel-order-q" className="rounded-lg border border-[var(--ordium-danger)]/30 bg-[var(--ordium-danger)]/[0.06] p-3 space-y-2">
                <p id="cancel-order-q" className="text-sm text-[var(--ordium-text)]">{t('dashboard.confirmation.cancel_question', 'إلغاء الطلبية يعني عدم شحنها، ولا يمكن إعادتها إلى «تم التأكيد» بعد ذلك. هل تلغيها؟')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" size="sm" isLoading={confirmationLoading} onClick={() => void recordConfirmation('cancelled')}>{t('dashboard.confirmation.cancel_yes', 'نعم، ألغِ الطلبية')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>{t('dashboard.confirmation.cancel_keep', 'تراجع')}</Button>
                </div>
              </div>
            )}
            {savedContact && !confirmationLoading && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white/[0.04] p-3" role="status">
                <span className="inline-flex items-center gap-1.5 text-sm text-[var(--ordium-success)]"><CheckCircle2 className="w-4 h-4" />{t('dashboard.confirmation.saved_line', 'سُجّلت نتيجة التواصل.')}</span>
                {onNext && <Button variant="outline" size="sm" onClick={onNext}>{t('dashboard.orders.go_next', 'الطلبية التالية')}</Button>}
              </div>
            )}
            {confirmationError && <p className="text-red-300" role="alert">{confirmationError}</p>}
            {confirmationLoading && <p className="text-[var(--ordium-muted)] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('dashboard.confirmation.saving', 'جارٍ حفظ سجل التواصل...')}</p>}
            {confirmationAttempts.length > 0 && <div className="border-t border-white/10 pt-3 space-y-2"><div className="text-[var(--ordium-muted)]">{t('dashboard.confirmation.recent_activity', 'آخر محاولات التواصل')}</div>{confirmationAttempts.slice(0, 3).map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-white">{t(`dashboard.confirmation.outcome.${item.outcome}`, ({contact_started:'بدأ التواصل',confirmed:'تم التأكيد',cancelled:'أُلغي الطلب',no_answer:'لم يرد',callback_requested:'طلب معاودة الاتصال',needs_review:'يتطلب المراجعة'} as Record<string,string>)[item.outcome] || item.outcome)} · {item.channel === 'whatsapp' ? 'WhatsApp' : t('dashboard.confirmation.manual_call', 'اتصال يدوي')}</span><span className="text-[var(--ordium-subtle)]" dir="ltr">{new Date(item.created_at).toLocaleString()}</span></div>)}</div>}
          </div>
          {/* Customer & Device */}
          <div className="p-4 rounded-xl bg-[var(--ordium-canvas)]/80 border border-white/5 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[var(--ordium-signal)]" />
              <span>{t('dashboard.orders.customer_device', 'معلومات العميل')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-[var(--ordium-muted)]">{t('dashboard.orders.customer', 'Full Name')}:</span>
                <p className="text-white font-medium">{order.customer.name}</p>
              </div>
              <div>
                <span className="text-[var(--ordium-muted)]">{t('dashboard.orders.phone', 'الهاتف')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.customer.phone || '—'}</p>
              </div>
            </div>
          </div>

          {/* Network & Location */}
          <div className="p-4 rounded-xl bg-[var(--ordium-canvas)]/80 border border-white/5 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[var(--ordium-accent)]" />
              <span>{t('dashboard.orders.delivery_and_network', 'التوصيل والشبكة')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-[var(--ordium-muted)]">{t('dashboard.orders.ip_address', 'IP Address')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.customer.ip_address || '—'}</p>
              </div>
              <div>
                <span className="text-[var(--ordium-muted)]">{t('dashboard.orders.rules_version', 'إصدار القواعد')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.risk?.rules_version || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[var(--ordium-muted)]">{t('dashboard.orders.shipping_address', 'Shipping Address')}:</span>
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

          {/* Delivery outcome (COD): recorded after the parcel's fate is known. Feeds calibration. */}
          <section className="p-4 rounded-xl bg-[var(--ordium-canvas)]/80 border border-white/5 space-y-2 text-sm" aria-labelledby="delivery-outcome-title">
            <h3 id="delivery-outcome-title" className="text-sm font-semibold text-white">{t('dashboard.orders.delivery_outcome', 'نتيجة التسليم')}</h3>
            <p className="text-[var(--ordium-muted)]">{t('dashboard.orders.delivery_outcome_hint', 'سجّلها بعد وصول الطرد أو رجوعه. تُستعمل لقياس دقة القرارات على متجرك.')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" isLoading={isUpdatingOutcome} onClick={() => handleOutcome('legitimate', undefined, t('dashboard.outcome.delivered', 'سُلِّمت'))}>{t('dashboard.outcome.mark_delivered', 'سُلِّمت للزبون')}</Button>
              <Button variant="outline" size="sm" isLoading={isUpdatingOutcome} onClick={() => handleOutcome('return_abusive', 'customer_refused', t('dashboard.outcome.refused', 'رفض الاستلام'))}>{t('dashboard.outcome.mark_refused', 'رفض الزبون الاستلام')}</Button>
              <Button variant="outline" size="sm" isLoading={isUpdatingOutcome} onClick={() => handleOutcome('return_abusive', 'other', t('dashboard.outcome.returned', 'أُرجعت'))}>{t('dashboard.outcome.mark_returned', 'أُرجعت لسبب آخر')}</Button>
            </div>
            {outcomeSaved && <p className="text-[var(--ordium-success)]" role="status">{t('dashboard.outcome.saved', 'سُجّلت النتيجة:')} {outcomeSaved}. {t('dashboard.outcome.change_hint', 'يمكنك تغييرها بالضغط على نتيجة أخرى.')}</p>}
            {outcomeError && <p className="text-[var(--ordium-danger)]" role="alert">{outcomeError}</p>}
          </section>
        </div>
      )}

      {/* Tab: Signals */}
      {activeTab === 'signals' && (
        <div className="space-y-3 text-start">
          {(!order.risk?.signals || order.risk.signals.length === 0) ? (
            <div className="text-center py-8 text-[var(--ordium-muted)] text-xs font-mono">
              ✓ {t('dashboard.orders.no_signals', 'No malicious signals detected. Transaction passed all baseline checks.')}
            </div>
          ) : (
            order.risk.signals.map((sig, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[var(--ordium-canvas)] border border-white/5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sig.severity === 'critical' ? 'bg-[var(--ordium-danger)]' : (sig.severity === 'high' ? 'bg-[var(--ordium-warning)]' : 'bg-[var(--ordium-signal)]')
                      }`}
                    />
                    <span className="font-bold text-white">{sig.name}</span>
                    <span className="font-mono text-xs text-[var(--ordium-muted)] bg-white/5 px-1.5 py-0.5 rounded" dir="ltr">
                      {sig.code}
                    </span>
                  </div>
                  <p className="text-[var(--ordium-muted)] text-xs leading-relaxed">{sig.description}</p>
                </div>
                <div className="text-end shrink-0 font-mono">
                  <span className="font-bold text-white" dir="ltr">+{sig.weight} pts</span>
                  <span
                    className={`block text-xs uppercase font-bold ${
                      sig.severity === 'critical' ? 'text-[var(--ordium-danger)]' : (sig.severity === 'high' ? 'text-[var(--ordium-warning)]' : 'text-[var(--ordium-signal)]')
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
              <div className="w-2 h-2 rounded-full bg-[var(--ordium-signal)] mt-1.5 shrink-0" />
              <div className="flex-1 pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{ev.type}</span>
                  <span className="text-[var(--ordium-muted)] text-xs" dir="ltr">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {ev.message && <p className="text-[var(--ordium-muted)] mt-0.5 text-xs">{ev.message}</p>}
              </div>
            </div>
          ))}
        </div>
      )}


    </Drawer>
  );
};
