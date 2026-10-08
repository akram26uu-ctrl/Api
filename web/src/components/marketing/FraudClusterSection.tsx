/**
 * ORDIUM Fraud Cluster Section
 * "Detect patterns before they become losses."
 * Explains and visualizes how single isolated suspicious orders
 * connect into multi-actor syndicates.
 */

import React from 'react';
import { SecurityShield3D } from '../3d/SecurityShield3D';
import { FraudNetwork3D } from '../3d/FraudNetwork3D';
import { ShieldCheck, Share2, Layers, AlertCircle, TrendingDown } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const FraudClusterSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-24 border-t border-white/5 bg-[#0D1320]/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#EF4444]">
            <span>{t('fraud_cluster.badge', 'CROSS-ORDER SYNDICATE DETECTION')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {t('fraud_cluster.title', 'Detect patterns before they become losses.')}
          </h2>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            {t('fraud_cluster.subtitle', 'A single suspicious order might pass a traditional basic check. But when ORDIUM joins phone numbers, device IDs, and IP subnets across multiple transactions, the fraudulent ring becomes instantly apparent.')}
          </p>
        </div>

        {/* 3D Shield & Cluster Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: 3D Shield Defense Visualizer */}
          <div className="lg:col-span-6 bg-[#080B12] border border-white/10 rounded-2xl p-2 shadow-2xl relative overflow-hidden">
            <div className="h-[440px] w-full rounded-xl overflow-hidden">
              <SecurityShield3D />
            </div>
            <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-[#94A3B8]">
              <span>{t('fraud_cluster.barrier_label', 'BARRIER: ZERO-TRUST SHIELD')}</span>
              <span className="text-[#10B981]">{t('fraud_cluster.auto_deflect', 'AUTOMATIC THREAT DEFLECTION')}</span>
            </div>
          </div>

          {/* Right: Explanatory cluster timeline */}
          <div className="lg:col-span-6 space-y-6 text-start">
            <div className="p-5 rounded-xl bg-[#080B12]/80 border border-white/5 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#EF4444]/20 text-[#EF4444] flex items-center justify-center font-mono text-xs font-bold shrink-0">1</span>
                <h4 className="text-sm font-semibold text-white">{t('fraud_cluster.step1_title', 'Isolated Order Appears Legitimate')}</h4>
              </div>
              <p className="text-xs text-[#94A3B8] ps-9 leading-relaxed">
                {t('fraud_cluster.step1_desc', 'Order #1 uses a clean synthetic email and passes standard postal address formatting checks. Single-point filters see no red flags.')}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#080B12]/80 border border-white/5 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center font-mono text-xs font-bold shrink-0">2</span>
                <h4 className="text-sm font-semibold text-white">{t('fraud_cluster.step2_title', 'Entity Links Collide in ORDIUM Graph')}</h4>
              </div>
              <p className="text-xs text-[#94A3B8] ps-9 leading-relaxed">
                {t('fraud_cluster.step2_desc', 'Within 2 hours, Orders #2 and #3 arrive with different cardholder names but match the same hardware fingerprint and VoIP phone trunk.')}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#080B12]/80 border border-[#EF4444]/30 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">3</span>
                <h4 className="text-sm font-semibold text-white">{t('fraud_cluster.step3_title', 'Cluster #CL-441 Locked & Blocked')}</h4>
              </div>
              <p className="text-xs text-[#94A3B8] ps-9 leading-relaxed">
                {t('fraud_cluster.step3_desc', 'ORDIUM automatically groups all 4 related identities into a high-risk syndicate cluster, elevating risk score to 82+ and neutralizing further attempts.')}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center gap-3 text-xs text-[#10B981]">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>{t('fraud_cluster.outcome_feedback', 'Outcome impact is measured from merchant-reported delivery, return, and chargeback feedback.')}</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
