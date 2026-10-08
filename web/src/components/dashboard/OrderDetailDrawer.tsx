/**
 * ORDIUM Order Detail Inspector Drawer
 * Comprehensive inspection view with customer, device, IP, signals,
 * score breakdown, timeline, outcome logger, and raw JSON payload.
 */

import React, { useState } from 'react';
import { Order, RiskOutcome } from '../../lib/api/types';
import { Drawer } from '../common/Drawer';
import { RiskBadge } from '../common/RiskBadge';
import { RiskScoreGauge } from '../common/RiskScoreGauge';
import { Button } from '../common/Button';
import { CodeBlock } from '../common/CodeBlock';
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
  Code,
  FileText
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
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'timeline' | 'json'>('overview');
  const [isUpdatingOutcome, setIsUpdatingOutcome] = useState(false);

  if (!order) return null;

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
          {t('dashboard.orders.tab_entity', 'Entity Overview')}
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          className={`pb-2.5 px-3 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'signals' ? 'text-[#22D3EE] border-b-2 border-[#22D3EE]' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <span>{t('dashboard.orders.tab_signals', 'Signals')}</span>
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
          {t('dashboard.orders.tab_timeline', 'Events Timeline')}
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`pb-2.5 px-3 font-semibold transition-colors ${
            activeTab === 'json' ? 'text-[#22D3EE] border-b-2 border-[#22D3EE]' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          {t('dashboard.orders.tab_json', 'Raw JSON')}
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4 text-start">
          {/* Customer & Device */}
          <div className="p-4 rounded-xl bg-[#080B12]/80 border border-white/5 space-y-3 text-xs">
            <h4 className="font-mono text-white uppercase tracking-wider font-bold flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>{t('dashboard.orders.customer_device', 'Customer & Hardware Fingerprint')}</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.customer', 'Full Name')}:</span>
                <p className="text-white font-medium">{order.customer.name}</p>
              </div>
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.email', 'Email')}:</span>
                <p className="text-white font-medium break-all" dir="ltr">{order.customer.email}</p>
              </div>
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.phone', 'Phone')}:</span>
                <p className="text-white font-medium" dir="ltr">{order.customer.phone || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[#94A3B8]">{t('dashboard.orders.device_id', 'Device Identifier')}:</span>
                <p className="text-white font-medium break-all" dir="ltr">{order.customer.device_id || 'dev_fingerprint_auto'}</p>
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

      {/* Tab: Raw JSON */}
      {activeTab === 'json' && (
        <CodeBlock
          code={JSON.stringify(order, null, 2)}
          language="json"
          title={t('dashboard.orders.raw_json_title', 'Full Order Ingestion & Risk Object')}
        />
      )}
    </Drawer>
  );
};
