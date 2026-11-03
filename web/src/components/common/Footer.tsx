/**
 * ORDIUM Global Footer
 */

import React from 'react';
import { BrandLogo } from './BrandLogo';
import { useLanguage } from '../../i18n/LanguageContext';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-[#080B12] text-[#A5B1C3] text-sm pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12 text-start">
          {/* Col 1: Brand */}
          <div className="col-span-2 space-y-4">
            <BrandLogo onClick={() => onNavigate('/')} />
            <p className="text-sm text-[#A5B1C3] max-w-sm leading-relaxed">
              {t('brand.metaDescription', 'Fraud Detection & Order Risk Intelligence Infrastructure for high-velocity e-commerce. Protect checkout pipelines with graph-based relationship intelligence and explainable risk scores.')}
            </p>
            <p className="flex items-center gap-2 pt-1 text-xs text-[#A5B1C3]">
              {/* Neutral indicator: no live status feed exists, so do not imply one with a pulsing green dot. */}
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#52D9E8]/70" />
              {t('footer.status_note', 'Service health and evaluation latency are reported inside the dashboard.')}
            </p>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-3">
            <h2 className="text-white text-sm font-semibold">
              {t('nav.platform', 'Platform')}
            </h2>
            <ul className="space-y-1">
              <li><button onClick={() => onNavigate('/platform')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.risk_core_arch', 'Risk Core Architecture')}</button></li>
              <li><button onClick={() => onNavigate('/intelligence')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.identity_graph', 'Identity Graph Engine')}</button></li>
              <li><button onClick={() => onNavigate('/security')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.zero_trust_sec', 'Zero-Trust Security')}</button></li>
              <li><button onClick={() => onNavigate('/pricing')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.enterprise_pricing', 'Enterprise Pricing')}</button></li>
            </ul>
          </div>

          {/* Col 3: Developers */}
          <div className="space-y-3">
            <h2 className="text-white text-sm font-semibold">
              {t('nav.developers', 'Developers')}
            </h2>
            <ul className="space-y-1">
              <li><button onClick={() => onNavigate('/docs')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.api_ref', 'API Reference v1')}</button></li>
              <li><button onClick={() => onNavigate('/developers')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.sdks_webhooks', 'SDKs & Webhooks')}</button></li>
              <li><button onClick={() => onNavigate('/docs')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.idempotency_errors', 'Idempotency & Errors')}</button></li>
              <li><button onClick={() => onNavigate('/login')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('nav.sign_in', 'Sign In')}</button></li>
            </ul>
          </div>

          {/* Col 4: Company & Legal */}
          <div className="space-y-3">
            <h2 className="text-white text-sm font-semibold">
              {t('nav.company', 'Company')}
            </h2>
            <ul className="space-y-1">
              <li><button onClick={() => onNavigate('/company')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.about_us', 'About Us')}</button></li>
              <li><button onClick={() => onNavigate('/security')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.security_arch', 'Security Architecture')}</button></li>
              <li><button onClick={() => onNavigate('/docs')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('footer.api_status', 'API Status')}</button></li>
              <li><button onClick={() => onNavigate('/pricing')} type="button" className="min-h-9 text-start text-sm text-[#A5B1C3] hover:text-white transition-colors">{t('nav.pricing', 'Pricing')}</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8A97AB]">
          <div>
            © {new Date().getFullYear()} ORDIUM. {t('footer.all_rights', 'All rights reserved.')}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <span>{t('footer.encrypted', 'Encrypted transport and protected credentials')}</span>
            <span>{t('footer.tenant_isolated', 'Tenant-Isolated Ingestion')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
