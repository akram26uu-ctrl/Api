import React from 'react';
import { Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';

interface PricingPageProps { onSelectPlan: (plan: string) => void; onOpenDashboard: () => void; }
export const PricingPage: React.FC<PricingPageProps> = ({ onSelectPlan, onOpenDashboard }) => {
  const { t } = useLanguage();
  const features = [
    t('pricing.sandbox_feat_1','integration simulator for integration development'),
    t('pricing.sandbox_feat_2','Live order risk evaluation API'),
    t('pricing.sandbox_feat_3','Scoped API keys and webhook signing'),
    t('pricing.sandbox_feat_4','Merchant-scoped identity graph and risk telemetry'),
    t('pricing.sandbox_feat_5','No billing or overage charges in the current MVP'),
  ];
  return <div className="py-20 bg-[#080B12] min-h-screen"><div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center max-w-3xl mx-auto mb-14 space-y-4"><div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#22D3EE]"><Zap className="w-3.5 h-3.5"/>ORDIUM MVP</div><h1 className="text-4xl sm:text-5xl font-extrabold text-white">Free while the platform is in MVP.</h1><p className="text-sm text-[#94A3B8] leading-relaxed">The current release has no subscription billing, paid tiers, overage charges, or SLA guarantees. Future commercial plans will be announced separately when billing infrastructure is available.</p></div>
    <div className="max-w-2xl mx-auto bg-[#0D1320] border border-[#22D3EE]/30 rounded-2xl p-8 shadow-2xl"><div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-[#22D3EE]/10"><ShieldCheck className="w-5 h-5 text-[#22D3EE]"/></div><div><h2 className="text-xl font-bold text-white">ORDIUM MVP</h2><p className="text-xs text-[#64748B]">No payment required</p></div></div><div className="text-5xl font-extrabold text-white font-mono mb-6">$0 <span className="text-sm text-[#64748B] font-normal">for the current MVP</span></div><div className="space-y-3 border-t border-white/5 pt-5 mb-8">{features.map((feature,i)=><div key={i} className="flex items-start gap-2.5 text-xs text-[#F8FAFC]"><Check className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5"/><span>{feature}</span></div>)}</div><Button variant="primary" size="md" className="w-full justify-center" onClick={()=>{onSelectPlan('ORDIUM MVP');onOpenDashboard();}} rightIcon={<ArrowRight className="w-4 h-4"/>}>Open Dashboard</Button></div>
    <p className="text-center text-[11px] text-[#64748B] mt-8">Performance, availability, fraud-rate, and compliance figures are shown in the product only when backed by measured data or explicitly documented scope.</p>
  </div></div>;
};
