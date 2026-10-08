/**
 * ORDIUM Hero Section
 * Large cinematic hero with 3D Risk Intelligence Core and real-time signal stream.
 */

import React from 'react';
import { ArrowRight, ArrowLeft, Terminal, Shield, CheckCircle2, Zap, Lock } from 'lucide-react';
import { Button } from '../common/Button';
import { RiskCore3D } from '../3d/RiskCore3D';
import { useLanguage } from '../../i18n/LanguageContext';

interface HeroSectionProps {
  onStart: () => void;
  onExploreApi: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onStart, onExploreApi }) => {
  const { t, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-8 pb-16">
      {/* Background radial gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#6C5CE7]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[450px] h-[450px] bg-[#22D3EE]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left rtl:lg:text-right">
            {/* Tagline Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#22D3EE] shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE] animate-pulse" />
              <span>{t('hero.badge', 'ORDIUM INFRASTRUCTURE ENGINE v2.4')}</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.08]">
              {t('hero.title_p1', 'Stop Fraud Before')} <br />
              <span className="bg-gradient-to-r from-white via-[#F8FAFC] to-[#94A3B8] bg-clip-text text-transparent">
                {t('hero.title_p2', 'It Hits Settlement.')}
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="text-base sm:text-lg text-[#94A3B8] max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
              {t('brand.metaDescription', 'ORDIUM analyzes identity, behavior, network signals, order history, and connected entities to help e-commerce businesses stop suspicious orders before they become chargeback losses.')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start rtl:lg:justify-start gap-4 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={onStart}
                rightIcon={<ArrowIcon className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                {t('hero.cta_launch', 'Launch Console')}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={onExploreApi}
                leftIcon={<Terminal className="w-4 h-4 text-[#22D3EE]" />}
                className="w-full sm:w-auto"
              >
                {t('hero.cta_docs', 'Explore the API')}
              </Button>
            </div>

            {/* Trust Signal Badges */}
            <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-center lg:justify-start rtl:lg:justify-start gap-6 text-xs text-[#94A3B8] font-mono">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#22D3EE]" />
                <span>{t('hero.stat_latency', 'Measured in dashboard')} {t('hero.stat_latency_label', 'Latency')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#10B981]" />
                <span>{t('hero.stat_signals', 'Merchant-scoped')} {t('hero.stat_signals_label', 'risk signals')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#6C5CE7]" />
                <span>{t('hero.stat_disruption', 'Outcome-based')} {t('hero.stat_disruption_label', 'feedback')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Risk Intelligence Core */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            <div className="w-full h-[460px] sm:h-[540px] relative rounded-2xl bg-[#080B12]/40 border border-white/5 backdrop-blur-sm overflow-hidden shadow-2xl">
              <RiskCore3D interactive={true} />

              {/* Holographic Decision Pulse Markers */}
              <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-20 flex flex-col gap-2 pointer-events-none">
                <div className="flex items-center gap-2 bg-[#080B12]/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span className="text-white">{t('dashboard.orders.allow', 'ALLOW')}</span>
                  <span className="text-[#94A3B8]">Score &lt; 50</span>
                </div>
                <div className="flex items-center gap-2 bg-[#080B12]/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span className="text-white">{t('dashboard.orders.review', 'REVIEW')}</span>
                  <span className="text-[#94A3B8]">Score 50–79</span>
                </div>
                <div className="flex items-center gap-2 bg-[#080B12]/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                  <span className="text-white">{t('dashboard.orders.reject', 'REJECT')}</span>
                  <span className="text-[#94A3B8]">Score &ge; 80</span>
                </div>
              </div>

              {/* Bottom Telemetry HUD */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-between items-center text-[10px] font-mono text-[#94A3B8] bg-[#080B12]/85 backdrop-blur-sm border border-white/5 px-3 py-2 rounded-md">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-ping" />
                  ORD-CORE: ACTIVE EVALUATION
                </span>
                <span>SIGNALS: RESOLVING RELATIONSHIPS</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
