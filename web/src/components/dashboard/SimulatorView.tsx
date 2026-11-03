/**
 * ORDIUM Interactive Order Risk Simulator
 */

import React, { useState } from 'react';
import { CreateOrderRequest, Order } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { RiskBadge } from '../common/RiskBadge';
import { RiskScoreGauge } from '../common/RiskScoreGauge';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CodeBlock } from '../common/CodeBlock';
import { useLanguage } from '../../i18n/LanguageContext';
import { Zap, Send, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Sliders, Gauge, Network } from 'lucide-react';

interface SimulatorViewProps {
  storeId: string | null;
  onOrderCreated?: (order: Order) => void;
}

const simulationOrderId = (prefix = 'SIM') =>
  `ORD-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const SimulatorView: React.FC<SimulatorViewProps> = ({ storeId, onOrderCreated }) => {
  const { t, isRTL } = useLanguage();
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [evaluatedOrder, setEvaluatedOrder] = useState<Order | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateOrderRequest>({
    order_number: simulationOrderId(),
    amount: 1420.00,
    currency: 'DZD',
    customer: {
      name: 'Arthur Vance',
      email: 'a.vance99@temp-inbox.net',
      phone: '0555000001',
      ip_address: '185.220.101.44',
      device_id: 'dev_8f0a_tor'
    },
    shipping_address: {
      street1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'Algiers',
      postal_code: '16000',
      country: 'DZ'
    }
  });

  const [jsonText, setJsonText] = useState(JSON.stringify(formData, null, 2));

  // Presets
  const applyPreset = (type: 'clean' | 'tor_device' | 'velocity_vpn' | 'synthetic_cluster') => {
    let preset: CreateOrderRequest;

    if (type === 'clean') {
      preset = {
        order_number: simulationOrderId('CLN'),
        amount: 185.50,
        currency: 'DZD',
        customer: {
          name: 'Sarah Connor',
          email: 'sarah.connor@gmail.com',
          phone: '0555000002',
          ip_address: '76.102.19.14',
          device_id: 'dev_macbook_m3_clean'
        },
        shipping_address: {
          street1: '1200 Wilshire Blvd',
          city: 'Los Angeles',
          state: 'Algiers',
          postal_code: '16000',
          country: 'DZ'
        }
      };
    } else if (type === 'velocity_vpn') {
      preset = {
        order_number: simulationOrderId('VEL'),
        amount: 890.00,
        currency: 'DZD',
        customer: {
          name: 'Marcus Brody',
          email: 'm.brody92@proton.me',
          phone: '0555000003',
          ip_address: '198.51.100.22',
          device_id: 'dev_iphone14_vpn'
        },
        shipping_address: {
          street1: '400 Pine St',
          city: 'Seattle',
          state: 'Oran',
          postal_code: '31000',
          country: 'DZ'
        }
      };
    } else if (type === 'synthetic_cluster') {
      preset = {
        order_number: simulationOrderId('SYN'),
        amount: 2190.00,
        currency: 'DZD',
        customer: {
          name: 'Viktor Reznov',
          email: 'reznov.supply@disposable-mail.org',
          phone: '0555000001',
          ip_address: '104.244.72.115',
          device_id: 'dev_8f0a_tor'
        },
        shipping_address: {
          street1: '100 Industrial Parkway',
          city: 'Portland',
          state: 'Algiers',
          postal_code: '31000',
          country: 'DZ'
        }
      };
    } else {
      // tor_device (default)
      preset = {
        order_number: simulationOrderId('TOR'),
        amount: 1420.00,
        currency: 'DZD',
        customer: {
          name: 'Arthur Vance',
          email: 'a.vance99@temp-inbox.net',
          phone: '0555000001',
          ip_address: '185.220.101.44',
          device_id: 'dev_8f0a_tor'
        },
        shipping_address: {
          street1: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'Algiers',
          postal_code: '16000',
          country: 'DZ'
        }
      };
    }

    setFormData(preset);
    setJsonText(JSON.stringify(preset, null, 2));
  };

  const handleModeChange = (nextMode: 'form' | 'json') => {
    if (nextMode === mode) return;
    if (nextMode === 'json') {
      setJsonText(JSON.stringify(formData, null, 2));
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON payload must be an object');
        setFormData(parsed as CreateOrderRequest);
      } catch {
        setSimulationError(t('dashboard.simulator.invalid_json', 'صيغة JSON غير صالحة. صححها قبل العودة إلى النموذج المنظم.'));
        return;
      }
    }
    setMode(nextMode);
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setSimulationError(null);
    try {
      let payload = mode === 'json' ? JSON.parse(jsonText) : { ...formData };
      let resolvedStoreId = storeId || ordiumClient.getStoreId();
      if (!resolvedStoreId) {
        const stores = await ordiumClient.getStores();
        const activeStore = stores.find(store => store.is_active);
        if (activeStore) {
          resolvedStoreId = activeStore.id;
          ordiumClient.setStoreId(activeStore.id);
        }
      }
      if (!resolvedStoreId) {
        setSimulationError(t('dashboard.simulator.store_required', 'لا يوجد متجر نشط. أنشئ متجرًا واحدًا على الأقل ثم أعد تشغيل المحاكاة.'));
        return;
      }

      // A simulator run must never reuse the same external order number.
      // This also makes a second click/retry safe after a previous successful run.
      const runPayload = { ...payload, order_number: simulationOrderId('SIM') };
      if (mode === 'json') {
        setJsonText(JSON.stringify(runPayload, null, 2));
      } else {
        setFormData(prev => ({ ...prev, order_number: runPayload.order_number }));
      }
      payload = runPayload;

      const result = await ordiumClient.createOrder(payload, { simulation: true, storeId: resolvedStoreId });
      setEvaluatedOrder(result);
      onOrderCreated?.(result);
    } catch (err: any) {
      const status = Number(err?.statusCode || 0);
      const apiMessage = typeof err?.message === 'string' ? err.message : '';
      const message = status === 409
        ? (apiMessage || t('dashboard.simulator.conflict', 'تعذر إكمال المحاكاة بسبب تعارض في الطلب.'))
        : status === 429
          ? t('dashboard.simulator.rate_limited', 'تم الوصول إلى حد المحاولات التجريبية مؤقتًا. انتظر قليلًا ثم أعد المحاولة.')
          : apiMessage || t('dashboard.simulator.unknown_error', 'تعذر تنفيذ المحاكاة.');
      setSimulationError(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={Boolean(simulationError)}
        onClose={() => setSimulationError(null)}
        title={t('dashboard.common.error', 'تعذر تشغيل المحاكاة')}
      >
        <p className="text-sm text-[#CBD5E1]">{simulationError}</p>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setSimulationError(null)}>{t('common.close', 'إغلاق')}</Button>
        </div>
      </Modal>
      <div className="dashboard-content space-y-6 sm:space-y-8">
      {/* Simulator workspace header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#22D3EE]/15 bg-gradient-to-br from-[#0D1320] via-[#0D1320] to-[#111827] shadow-2xl">
        <div className="absolute -top-20 -end-16 h-40 w-40 rounded-full bg-[#22D3EE]/8 blur-3xl pointer-events-none" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 text-start">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#22D3EE]/10 border border-[#22D3EE]/20 flex items-center justify-center text-[#22D3EE] shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">{t('dashboard.simulator.title', 'تجربة الطلبات')}</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> TEST
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1.5 max-w-2xl leading-relaxed">
                  {t('dashboard.simulator.subtitle', 'أدخل بيانات طلب تجريبي لمراجعة تقييم المخاطر دون التأثير على الطلبات الفعلية.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-start">
                <div className="text-[9px] uppercase tracking-wider text-[#64748B]">{t('dashboard.simulator.store_context', 'المتجر المحدد')}</div>
                <div className="mt-0.5 text-xs font-medium text-white">{storeId ? t('dashboard.simulator.store_ready', 'جاهز لتجربة طلب') : t('dashboard.simulator.store_missing', 'اختر متجرًا')}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-start">
                <div className="text-[9px] uppercase tracking-wider text-[#64748B]">{t('dashboard.simulator.quota_context', 'الاستهلاك')}</div>
                <div className="mt-0.5 text-xs font-medium text-emerald-300">{t('dashboard.simulator.quota_free', 'لا يخصم من حصة Live')}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/5 pt-4">
            <div role="tablist" aria-label={t('dashboard.simulator.input_mode', 'طريقة إدخال البيانات')} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#080B12]/80 p-1 shadow-inner">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'form'}
                onClick={() => handleModeChange('form')}
                className={`min-h-9 min-w-[132px] rounded-lg px-4 py-2 text-xs font-mono font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  mode === 'form'
                    ? 'bg-[#22D3EE]/15 text-[#67E8F9] border border-[#22D3EE]/50 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
                    : 'border border-transparent text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
              >
                {t('dashboard.simulator.form_mode', 'نموذج منظم')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'json'}
                onClick={() => handleModeChange('json')}
                className={`min-h-9 min-w-[132px] rounded-lg px-4 py-2 text-xs font-mono font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  mode === 'json'
                    ? 'bg-[#22D3EE]/15 text-[#67E8F9] border border-[#22D3EE]/50 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
                    : 'border border-transparent text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
              >
                {t('dashboard.simulator.json_mode', 'Raw JSON')}
              </button>
            </div>
            <span className="text-[10px] font-mono text-[#64748B]">{mode === 'form' ? 'FORM' : 'JSON'} • {t('dashboard.simulator.input_mode_hint', 'اختر طريقة إدخال البيانات')}</span>
          </div>

          {/* Attack Presets */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="simulator-presets-label">
          {/* Previously this label reused the "clean" preset key and rendered as the first preset's name. */}
          <span id="simulator-presets-label" className="text-xs text-[#A5B1C3]">{t('dashboard.simulator.load_scenario', 'Load scenario')}:</span>
          {([
            { id: 'clean', key: 'preset_clean', fallback: 'Clean Customer', icon: CheckCircle2, tone: 'text-[#48D6A0] border-[#48D6A0]/30 hover:bg-[#48D6A0]/10' },
            { id: 'tor_device', key: 'preset_tor', fallback: 'Tor Egress & Reused Device', icon: ShieldAlert, tone: 'text-[#FB7185] border-[#FB7185]/30 hover:bg-[#FB7185]/10' },
            { id: 'velocity_vpn', key: 'preset_velocity', fallback: 'Velocity Spike & VPN', icon: Gauge, tone: 'text-[#F5C465] border-[#F5C465]/30 hover:bg-[#F5C465]/10' },
            { id: 'synthetic_cluster', key: 'preset_cluster', fallback: 'Synthetic Cluster', icon: Network, tone: 'text-[#FB7185] border-[#FB7185]/30 hover:bg-[#FB7185]/10' },
          ] as const).map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`inline-flex min-h-9 items-center gap-1.5 px-3 rounded-lg text-xs font-medium bg-white/[0.03] border transition-colors ${preset.tone}`}
            >
              <preset.icon aria-hidden="true" className="w-3.5 h-3.5" />
              {t(`dashboard.simulator.${preset.key}`, preset.fallback)}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Simulator Inputs & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form / JSON Editor */}
        <div className="dashboard-panel lg:col-span-7 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {mode === 'form' ? t('dashboard.simulator.order_details', 'تفاصيل الطلب التجريبي') : t('dashboard.simulator.payload_editor', 'بيانات متقدمة (JSON)')}
            </span>
            <span className="text-[11px] font-mono text-[#94A3B8]">{t('dashboard.simulator.destination', 'Destination')}: <span dir="ltr">POST /api/v1/dashboard/orders → TEST</span></span>
          </div>

          {mode === 'form' ? (
            <div className="space-y-4 text-xs font-mono text-start">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.order_number', 'Order Number')}</label>
                  <input
                    type="text"
                    value={formData.order_number}
                    onChange={e => setFormData({ ...formData, order_number: e.target.value })}
                    className="w-full min-h-11 bg-[#080B12] border border-white/[0.12] rounded-lg p-3 text-white focus:outline-none focus:border-[#43D9E8] focus:ring-2 focus:ring-[#43D9E8]/15"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.amount', 'Amount')}</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] block mb-1">{t('dashboard.orders.col_amount', 'Currency')}</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-3">
                <span className="text-white font-bold block text-[11px] uppercase text-[#22D3EE]">{t('dashboard.drawer.customer_intel', 'Customer Identity')}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.customer_name', 'Name')}</label>
                    <input
                      type="text"
                      value={formData.customer.name}
                      onChange={e => setFormData({
                        ...formData,
                        customer: { ...formData.customer, name: e.target.value }
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.customer_email', 'Email')}</label>
                    <input
                      type="email"
                      value={formData.customer.email}
                      onChange={e => setFormData({
                        ...formData,
                        customer: { ...formData.customer, email: e.target.value }
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.phone', 'Phone')}</label>
                    <input
                      type="text"
                      value={formData.customer.phone || ''}
                      onChange={e => setFormData({
                        ...formData,
                        customer: { ...formData.customer, phone: e.target.value }
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.ip_address', 'IP Address')}</label>
                    <input
                      type="text"
                      value={formData.customer.ip_address || ''}
                      onChange={e => setFormData({
                        ...formData,
                        customer: { ...formData.customer, ip_address: e.target.value }
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.device_id', 'Device Hardware Fingerprint')}</label>
                    <input
                      type="text"
                      value={formData.customer.device_id || ''}
                      onChange={e => setFormData({
                        ...formData,
                        customer: { ...formData.customer, device_id: e.target.value }
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-3">
                <span className="text-white font-bold block text-[11px] uppercase text-[#6C5CE7]">{t('dashboard.simulator.shipping_address', 'Shipping Address')}</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.street', 'Street')}</label>
                    <input
                      type="text"
                      value={formData.shipping_address?.street1 || ''}
                      onChange={e => setFormData({
                        ...formData,
                        shipping_address: { ...formData.shipping_address, street1: e.target.value } as any
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.city', 'City')}</label>
                    <input
                      type="text"
                      value={formData.shipping_address?.city || ''}
                      onChange={e => setFormData({
                        ...formData,
                        shipping_address: { ...formData.shipping_address, city: e.target.value } as any
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] block mb-1">{t('dashboard.simulator.postal_code', 'Postal Code')}</label>
                    <input
                      type="text"
                      value={formData.shipping_address?.postal_code || ''}
                      onChange={e => setFormData({
                        ...formData,
                        shipping_address: { ...formData.shipping_address, postal_code: e.target.value } as any
                      })}
                      className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#22D3EE]"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              rows={16}
              className="w-full min-h-48 bg-[#080B12] border border-white/[0.12] rounded-xl p-3 sm:p-4 font-mono text-xs text-white focus:outline-none focus:border-[#43D9E8] focus:ring-2 focus:ring-[#43D9E8]/15 leading-relaxed resize-y"
              spellCheck={false}
              dir="ltr"
            />
          )}

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <Button
              variant="primary"
              size="md"
              isLoading={isEvaluating}
              onClick={handleEvaluate}
              leftIcon={<Send className="w-4 h-4" />}
            >
              {isEvaluating ? t('dashboard.simulator.evaluating', 'Evaluating risk...') : t('dashboard.simulator.evaluate_btn', 'تقييم الطلب التجريبي')}
            </Button>
          </div>
        </div>

        {/* Right Column: Instant Evaluation Result */}
        <div className="dashboard-panel lg:col-span-5 p-4 sm:p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {t('dashboard.simulator.result_title', 'Evaluation Result')}
            </span>
            {evaluatedOrder && (
              <span className="text-[11px] font-mono text-[#10B981]">
                Processed in {evaluatedOrder.risk?.execution_time_ms}ms
              </span>
            )}
          </div>

          {!evaluatedOrder ? (
            <div className="py-16 text-center text-xs font-mono text-[#94A3B8] space-y-3">
              <Zap className="w-8 h-8 text-[#22D3EE]/50 mx-auto animate-pulse" />
              <p>{t('dashboard.simulator.run_simulation_desc', 'أدخل بيانات الطلب التجريبي ثم اعرض نتيجة تقييم المخاطر.')}</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Score Gauge & Decision */}
              <div className="p-4 rounded-xl bg-[#080B12] border border-white/5 flex items-center justify-between gap-4">
                <RiskScoreGauge score={evaluatedOrder.risk?.score || 0} size="md" />
                <div className="text-end space-y-1">
                  <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">{t('dashboard.drawer.decision', 'القرار الناتج')}</span>
                  <RiskBadge decision={evaluatedOrder.risk?.decision} size="lg" />
                  <span className="text-[10px] font-mono text-[#94A3B8] block pt-1">
                    {t('dashboard.simulator.deterministic_decision', 'الثقة')}: {evaluatedOrder.risk?.confidence != null ? `${Math.round(evaluatedOrder.risk.confidence * 100)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* إشارات المخاطر المكتشفة */}
              <div className="space-y-2 text-start">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white font-bold">{t('dashboard.simulator.signals_detected', 'إشارات المخاطر المكتشفة')}</span>
                  <span className="text-[#94A3B8]">
                    {evaluatedOrder.risk?.signals?.length || 0} {t('dashboard.simulator.active_signals', 'active signals')}
                  </span>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pe-1">
                  {(!evaluatedOrder.risk?.signals || evaluatedOrder.risk.signals.length === 0) ? (
                    <div className="flex items-center gap-2 text-sm text-[#48D6A0] p-3 rounded-lg bg-white/5">
                      <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
                      {t('dashboard.simulator.no_signals', 'No active risk signals on this order.')}
                    </div>
                  ) : (
                    evaluatedOrder.risk.signals.map((sig, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#080B12] border border-white/5 text-xs font-mono flex items-center justify-between gap-2"
                      >
                        <div className="truncate text-start">
                          <div className="text-white font-bold truncate">{sig.name}</div>
                          <div className="text-[10px] text-[#94A3B8] truncate">{sig.description}</div>
                        </div>
                        <span className="font-bold text-[#EF4444] shrink-0 font-mono">
                          +{sig.weight} {t('dashboard.simulator.points', 'pts')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick API Snippet */}
              <div className="text-[11px] font-mono p-3 bg-white/5 rounded-lg text-[#94A3B8] text-start">
                {t('dashboard.simulator.saved_prefix', 'Test result saved for order')}{' '}
                <span dir="ltr" className="text-white font-bold">{evaluatedOrder.order_number}</span>. {t('dashboard.simulator.saved_suffix', 'You can review it on the Orders page.')}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
    </>
  );
};
