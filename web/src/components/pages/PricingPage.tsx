import React from 'react';
import { Check, ArrowRight, ArrowLeft, ShieldCheck, Info } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';

interface PricingPageProps { onSelectPlan: (plan: string) => void; onOpenDashboard: () => void; }

export const PricingPage: React.FC<PricingPageProps> = ({ onSelectPlan, onOpenDashboard }) => {
  const { t, isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const features = [
    t('pages.pricing.feat_1', 'Integration simulator for development and testing'),
    t('pages.pricing.feat_2', 'Live order risk evaluation API'),
    t('pages.pricing.feat_3', 'Scoped API keys and webhook signing'),
    t('pages.pricing.feat_4', 'Merchant-scoped identity graph and risk telemetry'),
    t('pages.pricing.feat_5', 'No billing or overage charges in the current MVP'),
    t('pages.pricing.feat_6', 'Manual WhatsApp or phone follow-up with confirmation metrics'),
  ];

  return (
    <div className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center max-w-3xl mx-auto mb-12 space-y-5">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight text-balance">{t('pages.pricing.title', 'Free while the platform is in MVP.')}</h1>
          <p className="text-base text-[#A5B1C3] leading-relaxed max-w-[68ch] mx-auto">{t('pages.pricing.subtitle', 'The current release has no subscription billing, paid tiers, overage charges, or SLA guarantees. Future commercial plans will be announced separately when billing infrastructure is available.')}</p>
        </header>

        <section className="relative max-w-2xl mx-auto ordium-card !border-[#22D3EE]/30 p-6 sm:p-9" aria-labelledby="pricing-plan">
          <div className="flex items-center gap-3 mb-6">
            <span aria-hidden="true" className="p-2.5 rounded-xl bg-[#22D3EE]/10 text-[#52D9E8]"><ShieldCheck className="w-5 h-5" /></span>
            <div>
              <h2 id="pricing-plan" className="text-xl font-bold text-white">{t('mkt.pricing.plan', 'النسخة التجريبية')}</h2>
              <p className="text-sm text-[#A5B1C3]">{t('pages.pricing.no_payment', 'No payment required')}</p>
            </div>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-7">
            <span className="text-5xl font-extrabold text-white">{t('mkt.pricing.price', 'مجاني')}</span>
            <span className="text-sm text-[#A5B1C3]">{t('mkt.pricing.price_note', '0 دج خلال النسخة التجريبية الحالية')}</span>
          </p>
          <ul className="space-y-3 border-t border-white/[0.06] pt-6 mb-8">
            {features.map(feature => (
              <li key={feature} className="flex items-start gap-3 text-sm text-[#E2E8F0] leading-relaxed">
                <span aria-hidden="true" className="mt-0.5 inline-flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"><Check className="w-3.5 h-3.5" /></span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button variant="primary" size="lg" className="w-full justify-center" onClick={() => { onSelectPlan('ORDIUM MVP'); onOpenDashboard(); }} rightIcon={<Arrow aria-hidden="true" className="w-4 h-4" />}>
            {t('pages.pricing.cta', 'Open Dashboard')}
          </Button>
        </section>

        <p className="mt-8 mx-auto max-w-2xl flex items-start justify-center gap-2 text-center text-xs text-[#8A97AB] leading-relaxed">
          <Info aria-hidden="true" className="w-4 h-4 shrink-0 mt-px" />
          {t('pages.pricing.disclaimer', 'Performance, availability, fraud-rate, and compliance figures are shown in the product only when backed by measured data or explicitly documented scope.')}
        </p>
      </div>
    </div>
  );
};
