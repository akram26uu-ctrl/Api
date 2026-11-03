/**
 * ORDIUM Platform Architecture Page
 */

import React from 'react';
import { MessageCircle, CheckCircle2, Timer, Gauge, ScanSearch } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { LazyRiskCore3D as RiskCore3D } from '../3d/lazy';
import { PipelineSection } from '../marketing/PipelineSection';

export const PlatformPage: React.FC = () => {
  const { t } = useLanguage();
  const facts = [
    { icon: <Timer className="w-5 h-5" />, value: t('pages.platform.f1_value', 'Measured'), label: t('pages.platform.f1_label', 'Evaluation time'), desc: t('pages.platform.f1_desc', 'The dashboard reports measured evaluation time when persisted telemetry is available.'), tone: 'text-[#52D9E8]' },
    { icon: <Gauge className="w-5 h-5" />, value: t('pages.platform.f2_value', 'Merchant-scoped'), label: t('pages.platform.f2_label', 'Rate limits'), desc: t('pages.platform.f2_desc', 'Request limits are controlled by the active API environment and merchant configuration.'), tone: 'text-[#48D6A0]' },
    { icon: <ScanSearch className="w-5 h-5" />, value: t('pages.platform.f3_value', 'Inspectable'), label: t('pages.platform.f3_label', 'Decision traceability'), desc: t('pages.platform.f3_desc', 'Persisted assessments expose the risk events, rule version, profile version, and identity context available for review.'), tone: 'text-[#958AFF]' },
  ];
  return (
    <div className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <header className="text-center max-w-3xl mx-auto mb-14 space-y-5">
          <span className="ordium-eyebrow !text-[#958AFF]">{t('pages.platform.eyebrow', 'ENGINEERING SPECIFICATION')}</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight text-balance">{t('pages.platform.title', 'The ORDIUM Risk Engine')}</h1>
          <p className="text-base text-[#A5B1C3] leading-relaxed">{t('pages.platform.subtitle', 'Designed for merchant-scoped checkout risk evaluation. The platform persists risk signals, rule versions, identity relationships, and measured evaluation telemetry.')}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <article className="ordium-card p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#52D9E8]"><MessageCircle aria-hidden="true" className="w-5 h-5" /><h2 className="text-base font-semibold text-white">{t('pages.platform.manual_title', 'Manual order confirmation')}</h2></div>
            <p className="text-sm text-[#A5B1C3] leading-relaxed">{t('pages.platform.manual_desc', 'Open a pre-filled WhatsApp conversation or start a phone call yourself, then record the result against the order. ORDIUM does not send messages or place calls automatically.')}</p>
          </article>
          <article className="ordium-card p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#48D6A0]"><CheckCircle2 aria-hidden="true" className="w-5 h-5" /><h2 className="text-base font-semibold text-white">{t('pages.platform.metrics_title', 'Confirmation metrics and audit history')}</h2></div>
            <p className="text-sm text-[#A5B1C3] leading-relaxed">{t('pages.platform.metrics_desc', 'Track confirmed orders, orders awaiting first contact, work in progress, cancellations and contact attempts. The confirmation rate uses orders with recorded confirmation activity as its denominator; untouched new orders are reported separately.')}</p>
          </article>
        </div>

        <figure className="ordium-card p-3 sm:p-4 mb-14">
          <div className="h-[320px] sm:h-[460px] w-full rounded-xl overflow-hidden bg-[#080B12]">
            <RiskCore3D />
          </div>
          <figcaption className="px-2 pt-4 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-[#A5B1C3] border-t border-white/[0.06] mt-3">
            <span>{t('pages.platform.caption_arch', 'Core architecture: distributed decision graph')}</span>
            <span className="text-[#52D9E8]">{t('pages.platform.caption_latency', 'Latency: measured per evaluation')}</span>
          </figcaption>
        </figure>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {facts.map(fact => (
            <article key={fact.label} className="ordium-card p-6 space-y-2">
              <span aria-hidden="true" className={`inline-flex ${fact.tone}`}>{fact.icon}</span>
              <p className="text-2xl font-extrabold text-white">{fact.value}</p>
              <h3 className={`text-sm font-semibold ${fact.tone}`}>{fact.label}</h3>
              <p className="text-sm text-[#A5B1C3] leading-relaxed">{fact.desc}</p>
            </article>
          ))}
        </div>

        {/* Include Pipeline Detail */}
        <PipelineSection />

      </div>
    </div>
  );
};
