import React from 'react';
import { Cpu, Mail, Shield, Terminal, Eye, Layers, Code2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const CompanyPage: React.FC = () => {
  const { t } = useLanguage();
  const principles = [
    { icon: <Eye className="w-5 h-5" />, title: t('pages.company.p1_title', 'Inspectable decisions'), desc: t('pages.company.p1_desc', 'Risk decisions expose the persisted signals and rule/profile versions used for evaluation.') },
    { icon: <Layers className="w-5 h-5" />, title: t('pages.company.p2_title', 'Tenant boundaries'), desc: t('pages.company.p2_desc', 'Merchant and environment context is enforced by the API credential and database query scope.') },
    { icon: <Code2 className="w-5 h-5" />, title: t('pages.company.p3_title', 'Developer-first API'), desc: t('pages.company.p3_desc', 'Scoped credentials, idempotency, request IDs, webhooks, live order processing and an isolated simulator are core product primitives.') },
  ];
  const cards = [
    { icon: <Shield className="w-5 h-5" />, title: t('pages.company.security_title', 'Security'), desc: t('pages.company.security_desc', 'Security controls and limitations are documented based on the current implementation.') },
    { icon: <Terminal className="w-5 h-5" />, title: t('pages.company.dev_title', 'Developer access'), desc: t('pages.company.dev_desc', 'Use the developer documentation and dashboard to create scoped integration keys and configure webhooks.') },
    { icon: <Mail className="w-5 h-5" />, title: t('pages.company.contact_title', 'Contact'), desc: t('pages.company.contact_desc', 'Contact details will be published here once an official support address and disclosure process are configured.') },
  ];

  return (
    <div className="py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center max-w-3xl mx-auto mb-14 space-y-5">
          <span className="ordium-eyebrow">ORDIUM</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight text-balance">{t('pages.company.title', 'Order risk intelligence for digital commerce.')}</h1>
          <p className="text-base sm:text-lg text-[#A5B1C3] leading-relaxed">{t('pages.company.subtitle', 'ORDIUM is an engineering project focused on helping commerce platforms evaluate order risk using deterministic signals, identity relationships, and merchant-scoped telemetry.')}</p>
        </header>

        <section className="ordium-card p-6 sm:p-10 mb-8" aria-labelledby="company-principles">
          <div className="flex items-center gap-3 mb-6">
            <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-[#6C5CE7]/15 border border-[#6C5CE7]/35 flex items-center justify-center text-[#52D9E8]"><Cpu className="w-5 h-5" /></span>
            <h2 id="company-principles" className="text-xl sm:text-2xl font-bold text-white">{t('pages.company.principles_title', 'Engineering principles')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/[0.06]">
            {principles.map(item => (
              <div key={item.title} className="space-y-2">
                <div className="flex items-center gap-2 text-[#52D9E8]"><span aria-hidden="true">{item.icon}</span><h3 className="text-base font-semibold text-white">{item.title}</h3></div>
                <p className="text-sm text-[#A5B1C3] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(card => (
            <article key={card.title} className="ordium-card p-6 space-y-3">
              <span aria-hidden="true" className="inline-flex w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 items-center justify-center text-[#52D9E8]">{card.icon}</span>
              <h3 className="text-lg font-semibold text-white">{card.title}</h3>
              <p className="text-sm text-[#A5B1C3] leading-relaxed">{card.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
