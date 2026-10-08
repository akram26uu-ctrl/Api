/**
 * ORDIUM Explainable Risk Assessment Card
 * "Built for explainable decisions."
 * Demonstrates the exact explainable signal breakdown with 0 black-box ambiguity.
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight, HelpCircle, Activity } from 'lucide-react';
import { RiskBadge } from '../common/RiskBadge';
import { RiskScoreGauge } from '../common/RiskScoreGauge';
import { useLanguage } from '../../i18n/LanguageContext';

export const ExplainableCard: React.FC = () => {
  const { t } = useLanguage();

  const sampleSignals = [
    { name: t('explainable.sig_net_name', 'Network Reputation'), code: 'NETWORK_REPUTATION', severity: 'critical', desc: t('explainable.sig_net_desc', 'IP mapped directly to active Tor exit node registry.') },
    { name: t('explainable.sig_dev_name', 'Device Reuse'), code: 'DEVICE_REUSE', severity: 'critical', desc: t('explainable.sig_dev_desc', 'Hardware fingerprint dev_8f0a observed across 3 distinct cards in 2h.') },
    { name: t('explainable.sig_cluster_name', 'Identity Cluster Anomaly'), code: 'IDENTITY_CLUSTER', severity: 'high', desc: t('explainable.sig_cluster_desc', 'Phone and shipping address linked to multi-actor cluster #CL-441.') },
    { name: t('explainable.sig_velo_name', 'High IP Velocity'), code: 'HIGH_IP_VELOCITY', severity: 'high', desc: t('explainable.sig_velo_desc', '14 rapid checkout attempts observed on subnet in past 60 minutes.') },
    { name: t('explainable.sig_cancel_name', 'High إلغاءlation Rate'), code: 'HIGH_CANCELLATION_RATE', severity: 'medium', desc: t('explainable.sig_cancel_desc', 'Connected drop address has an 80% past cancellation/chargeback rate.') }
  ];

  return (
    <section className="py-24 border-t border-white/5 bg-[#080B12] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#F59E0B]">
            <span>{t('explainable.badge', 'INSPECTABLE RISK REASONING')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {t('explainable.title', 'Built for explainable decisions.')}
          </h2>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            {t('explainable.subtitle', 'Risk decisions expose the persisted signals, rule version, and evaluation metadata available to the merchant.')}
          </p>
        </div>

        {/* Realistic Assessment Card Container */}
        <div className="max-w-4xl mx-auto">
          {/* Top Sample Flag */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0D1320] border-t border-x border-white/10 rounded-t-2xl text-[11px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5 text-[#22D3EE]">
              <Activity className="w-3.5 h-3.5" />
              {t('explainable.snapshot_label', 'ORDIUM ASSESSMENT DEMO SNAPSHOT')}
            </span>
            <span>RULES: ordium-rules-v2.4</span>
          </div>

          <div className="bg-[#0D1320]/90 border border-white/10 rounded-b-2xl p-6 sm:p-8 shadow-2xl space-y-8 backdrop-blur-md text-start">
            
            {/* Upper Section: Score & Decision */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-6">
                <RiskScoreGauge score={82} size="lg" />
                <div className="space-y-1 text-start">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#94A3B8]">{t('explainable.decision_title', 'DECISION:')}</span>
                    <RiskBadge decision="REJECT" size="lg" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t('explainable.high_confidence_flag', 'High Confidence Fraud Flag')}</h3>
                  <p className="text-xs text-[#94A3B8] max-w-sm">
                    {t('explainable.reject_rationale', 'Aggregated risk exceeds the merchant reject threshold of 75. Order blocked from payment authorization.')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 text-xs font-mono bg-white/5 p-4 rounded-xl shrink-0 w-full sm:w-auto">
                <div className="flex justify-between gap-4">
                  <span className="text-[#94A3B8]">{t('explainable.exec_time', 'Execution Time:')}</span>
                  <span className="font-bold text-white" dir="ltr">38ms</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#94A3B8]">{t('explainable.confidence', 'Confidence:')}</span>
                  <span className="font-bold text-[#10B981]" dir="ltr">94%</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#94A3B8]">{t('explainable.order_id', 'Order ID:')}</span>
                  <span className="font-bold text-white font-mono" dir="ltr">ORD-77402</span>
                </div>
              </div>
            </div>

            {/* Dimensional Score Breakdown Bar */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
                {t('explainable.dimension_title', 'Risk Dimension Scores')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-[#080B12] rounded-lg border border-white/5">
                  <div className="text-[11px] text-[#94A3B8]">{t('explainable.dim_identity', 'Identity Risk')}</div>
                  <div className="text-lg font-bold font-mono text-[#EF4444] mt-0.5" dir="ltr">88/100</div>
                </div>
                <div className="p-3 bg-[#080B12] rounded-lg border border-white/5">
                  <div className="text-[11px] text-[#94A3B8]">{t('explainable.dim_network', 'Network Risk')}</div>
                  <div className="text-lg font-bold font-mono text-[#EF4444] mt-0.5" dir="ltr">92/100</div>
                </div>
                <div className="p-3 bg-[#080B12] rounded-lg border border-white/5">
                  <div className="text-[11px] text-[#94A3B8]">{t('explainable.dim_velocity', 'Velocity Risk')}</div>
                  <div className="text-lg font-bold font-mono text-[#EF4444] mt-0.5" dir="ltr">80/100</div>
                </div>
                <div className="p-3 bg-[#080B12] rounded-lg border border-white/5">
                  <div className="text-[11px] text-[#94A3B8]">{t('explainable.dim_historical', 'Historical Risk')}</div>
                  <div className="text-lg font-bold font-mono text-[#F59E0B] mt-0.5" dir="ltr">74/100</div>
                </div>
                <div className="p-3 bg-[#080B12] rounded-lg border border-white/5">
                  <div className="text-[11px] text-[#94A3B8]">{t('explainable.dim_behavioral', 'Behavioral')}</div>
                  <div className="text-lg font-bold font-mono text-[#F59E0B] mt-0.5" dir="ltr">65/100</div>
                </div>
              </div>
            </div>

            {/* Triggered Signals List */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#94A3B8] flex items-center justify-between">
                <span>{t('explainable.triggered_signals', 'Triggered Heuristic Signals')} ({sampleSignals.length})</span>
                <span className="text-[10px] text-[#EF4444]">{t('explainable.all_explainable', 'All factors explainable')}</span>
              </h4>

              <div className="space-y-2">
                {sampleSignals.map((sig, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#080B12]/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          sig.severity === 'critical' ? 'bg-[#EF4444]' : (sig.severity === 'high' ? 'bg-[#F59E0B]' : 'bg-[#22D3EE]')
                        }`}
                      />
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{sig.name}</span>
                          <span className="font-mono text-[10px] text-[#94A3B8] bg-white/5 px-1.5 py-0.5 rounded" dir="ltr">
                            {sig.code}
                          </span>
                        </div>
                        <p className="text-[#94A3B8] mt-0.5">{sig.desc}</p>
                      </div>
                    </div>

                    <span
                      className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded self-start sm:self-center shrink-0 ${
                        sig.severity === 'critical'
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                          : sig.severity === 'high'
                          ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {sig.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
