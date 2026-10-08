/**
 * ORDIUM Identity Section
 * "The order is only one piece of the puzzle."
 * Visualizes how entity relationships uncover hidden fraud clusters.
 */

import React from 'react';
import { FraudNetwork3D } from '../3d/FraudNetwork3D';
import { Network, UserCheck, Smartphone, MapPin, Globe, Cpu } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const IdentitySection: React.FC = () => {
  const { t } = useLanguage();

  const entities = [
    { icon: <UserCheck className="w-4 h-4 text-[#22D3EE]" />, title: t('identity.customer_identity', 'Customer Identity'), desc: t('identity.customer_identity_desc', 'Cross-merchant velocity and synthetic identity anomaly scoring.') },
    { icon: <Smartphone className="w-4 h-4 text-[#38BDF8]" />, title: t('identity.phone_carrier', 'Phone & SMS Carrier'), desc: t('identity.phone_carrier_desc', 'VOIP detection, prepaid line classification, and SIM-swap indicators.') },
    { icon: <Cpu className="w-4 h-4 text-[#A855F7]" />, title: t('identity.hardware_fp', 'Hardware Fingerprint'), desc: t('identity.hardware_fp_desc', 'Canvas hash, WebGL hardware profile, and emulator detection.') },
    { icon: <MapPin className="w-4 h-4 text-[#10B981]" />, title: t('identity.address_clustering', 'Address Clustering'), desc: t('identity.address_clustering_desc', 'Drop address detection, commercial freight forwarders, and geo-variance.') },
    { icon: <Globe className="w-4 h-4 text-[#94A3B8]" />, title: t('identity.network_ip', 'Network & IP Egress'), desc: t('identity.network_ip_desc', 'Residential proxy check, Tor node registry, and ASN reputation.') },
    { icon: <Network className="w-4 h-4 text-[#6C5CE7]" />, title: t('identity.order_history', 'Order History'), desc: t('identity.order_history_desc', 'Cart item velocity, repeat card trials, and baseline behavioral cadence.') }
  ];

  return (
    <section className="py-24 border-t border-white/5 bg-[#080B12] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#22D3EE]">
            <span>{t('identity.badge', 'MULTI-ENTITY RESOLUTION')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {t('identity.title', 'The order is only one piece of the puzzle.')}
          </h2>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            {t('identity.subtitle', 'Fraudsters change their names and cards in seconds, but cannot easily forge their entire digital graph. ORDIUM analyzes relational links across entities rather than evaluating isolated fields in a vacuum.')}
          </p>
        </div>

        {/* 3D Visualizer + Feature Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* 3D Network Canvas */}
          <div className="lg:col-span-7 bg-[#0D1320]/60 border border-white/10 rounded-2xl p-2 shadow-2xl relative">
            <div className="h-[440px] w-full rounded-xl overflow-hidden bg-[#080B12]/80">
              <FraudNetwork3D highlightCluster={true} />
            </div>
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#94A3B8] border-t border-white/5 gap-2">
              <span>{t('identity.graph_hint', 'INTERACTIVE GRAPH: HOVER NODES TO INSPECT')}</span>
              <span className="text-[#EF4444] font-medium">{t('identity.cluster_alert', 'RED = DETECTED SUSPICIOUS CLUSTER')}</span>
            </div>
          </div>

          {/* Connected Entities Cards */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {entities.map((ent, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#0D1320]/70 border border-white/5 hover:border-white/15 transition-all flex items-start gap-3.5 text-start"
              >
                <div className="p-2 rounded-lg bg-white/5 shrink-0 mt-0.5">{ent.icon}</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{ent.title}</h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5 leading-snug">{ent.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
