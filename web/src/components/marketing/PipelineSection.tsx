/**
 * ORDIUM Pipeline Section
 * "From signals to decisions."
 * Demonstrates the end-to-end evaluation pipeline with animated steps and 3D Risk Scanner.
 */

import React, { useState } from 'react';
import { RiskScanner3D } from '../3d/RiskScanner3D';
import { ArrowDown, Cpu, Network, ShieldCheck, Activity, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const PipelineSection: React.FC = () => {
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState<number>(4);

  const steps = [
    { title: t('pipeline.step_1_title', 'Order Ingestion'), desc: t('pipeline.step_1_desc', 'Normalized checkout payload arrives via API, webhook, or SDK.'), badge: 'REST / JSON' },
    { title: t('pipeline.step_2_title', 'Identity Resolution'), desc: t('pipeline.step_2_desc', 'Resolves customer, phone, device, and email into graph entities.'), badge: 'Graph Linker' },
    { title: t('pipeline.step_3_title', 'Behavior Analysis'), desc: t('pipeline.step_3_desc', 'Examines checkout duration, velocity spikes, and interaction cadence.'), badge: 'Cadence Engine' },
    { title: t('pipeline.step_4_title', 'Network Intelligence'), desc: t('pipeline.step_4_desc', 'Inspects IP egress, VPN/Tor, ASN reputation, and geo-distance variance.'), badge: 'Geo/IP ASN' },
    { title: t('pipeline.step_5_title', 'Risk Engine Evaluation'), desc: t('pipeline.step_5_desc', 'Weights verified signals against merchant policy rules & thresholds.'), badge: 'Engine v2.4' },
    { title: t('pipeline.step_6_title', 'Risk Score Computation'), desc: t('pipeline.step_6_desc', 'Calculates unified 0-100 risk score with dimensional sub-scores.'), badge: '0-100 Score' },
    { title: t('pipeline.step_7_title', 'Actionable Decision'), desc: t('pipeline.step_7_desc', 'Finalizes decision: ALLOW (<35), REVIEW (35-75), or REJECT (>75).'), badge: 'Instant Outcome' }
  ];

  return (
    <section className="py-24 border-t border-white/5 bg-[#0D1320]/30 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#6C5CE7]">
            <span>{t('pipeline.badge', 'MEASURED EVALUATION PIPELINE')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {t('pipeline.title', 'From signals to decisions.')}
          </h2>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            {t('pipeline.subtitle', 'Every transaction passes through a multi-stage risk pipeline designed for consistent, inspectable decisions.')}
          </p>
        </div>

        {/* 3D Risk Scanner + Step Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left: 3D Scanner Simulation */}
          <div className="lg:col-span-6 bg-[#080B12] border border-white/10 rounded-2xl p-2 shadow-2xl">
            <div className="h-[460px] w-full rounded-xl overflow-hidden">
              <RiskScanner3D />
            </div>
          </div>

          {/* Right: Pipeline Steps List */}
          <div className="lg:col-span-6 space-y-2">
            {steps.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveStep(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-start ${
                    isActive
                      ? 'bg-[#0D1320] border-[#22D3EE]/40 shadow-lg shadow-[#22D3EE]/5 translate-x-1 rtl:-translate-x-1'
                      : 'bg-[#080B12]/60 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                          isActive
                            ? 'bg-[#22D3EE] text-[#080B12]'
                            : 'bg-white/5 text-[#94A3B8]'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <h4 className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-[#94A3B8]'}`}>
                        {step.title}
                      </h4>
                    </div>
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-white/5 text-[#22D3EE] shrink-0">
                      {step.badge}
                    </span>
                  </div>
                  {isActive && (
                    <p className="text-xs text-[#94A3B8] mt-2 ms-9 leading-relaxed animate-in fade-in duration-200">
                      {step.desc}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
};
