/**
 * ORDIUM Architecture & Roadmap Section
 * "From rules today to intelligence tomorrow."
 * Transparent evolutionary path: Rules -> Signals -> Graph -> Real Outcomes -> Future ML.
 */

import React from 'react';
import { ArrowRight, CheckCircle2, CircleDot, Clock, Shield, Database, Cpu } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const RoadmapSection: React.FC = () => {
  const { t } = useLanguage();

  const roadmapStages = [
    {
      phase: t('roadmap.phase_1_label', 'Phase 1'),
      title: t('roadmap.phase_1_title', 'Deterministic Rules Engine'),
      desc: t('roadmap.phase_1_desc', 'Transparent heuristic rules, custom threshold controls, and instant rule overrides for immediate merchant defense.'),
      status: t('roadmap.status_prod', 'Current Production'),
      isCurrent: true,
      icon: <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
    },
    {
      phase: t('roadmap.phase_2_label', 'Phase 2'),
      title: t('roadmap.phase_2_title', 'Risk Signal Aggregation'),
      desc: t('roadmap.phase_2_desc', 'Cross-dimensional scoring uniting device fingerprinting, ASN network intelligence, and behavioral velocity indicators.'),
      status: t('roadmap.status_prod', 'Current Production'),
      isCurrent: true,
      icon: <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
    },
    {
      phase: t('roadmap.phase_3_label', 'Phase 3'),
      title: t('roadmap.phase_3_title', 'Graph Entity Resolution'),
      desc: t('roadmap.phase_3_desc', '3D multi-node correlation joining phone, IP, device, and address to uncover multi-actor syndicates and carding rings.'),
      status: t('roadmap.status_prod', 'Current Production'),
      isCurrent: true,
      icon: <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
    },
    {
      phase: t('roadmap.phase_4_label', 'Phase 4'),
      title: t('roadmap.phase_4_title', 'Outcome Tracking & Backtesting'),
      desc: t('roadmap.phase_4_desc', 'Connecting real merchant outcomes (chargebacks, manual approvals, returns) back to evaluated risk scores.'),
      status: t('roadmap.status_rollout', 'Active Rollout'),
      isRollout: true,
      icon: <CircleDot className="w-5 h-5 text-[#22D3EE]" />
    },
    {
      phase: t('roadmap.phase_5_label', 'Phase 5'),
      title: t('roadmap.phase_5_title', 'Supervised ML Risk Models'),
      desc: t('roadmap.phase_5_desc', 'Adaptive learning models trained exclusively on verified historical merchant outcomes for bespoke merchant tuning.'),
      status: t('roadmap.status_pipeline', 'Future Pipeline'),
      icon: <Clock className="w-5 h-5 text-[#94A3B8]" />
    }
  ];

  return (
    <section className="py-24 border-t border-white/5 bg-[#0D1320]/20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#22D3EE]">
            <span>{t('roadmap.badge', 'ENGINEERING TRANSPARENCY')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {t('roadmap.title', 'From rules today to intelligence tomorrow.')}
          </h2>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            {t('roadmap.subtitle', 'We believe in complete architectural honesty. We do not claim nebulous black-box machine learning where proven deterministic rules and entity graphs deliver far greater precision and accountability.')}
          </p>
        </div>

        {/* Roadmap Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {roadmapStages.map((stage, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-xl border flex flex-col justify-between transition-all text-start ${
                stage.isCurrent
                  ? 'bg-[#0D1320] border-[#10B981]/30'
                  : stage.isRollout
                  ? 'bg-[#0D1320] border-[#22D3EE]/40'
                  : 'bg-[#080B12]/60 border-white/5 opacity-80'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#94A3B8]">{stage.phase}</span>
                  {stage.icon}
                </div>
                <h4 className="text-sm font-bold text-white">{stage.title}</h4>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{stage.desc}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-white/5">
                <span
                  className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded ${
                    stage.isCurrent
                      ? 'bg-[#10B981]/15 text-[#10B981]'
                      : stage.isRollout
                      ? 'bg-[#22D3EE]/15 text-[#22D3EE]'
                      : 'bg-white/5 text-[#94A3B8]'
                  }`}
                >
                  {stage.status}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
