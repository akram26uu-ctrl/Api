/**
 * ORDIUM Global Footer
 */

import React from 'react';
import { Cpu, ShieldCheck, Terminal, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 bg-[#080B12] text-[#94A3B8] text-xs pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12 text-start">
          {/* Col 1: Brand */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('/')}>
              <div className="w-7 h-7 rounded-lg bg-[#0D1320] border border-white/10 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-[#22D3EE]" />
              </div>
              <span className="font-mono text-base font-bold text-white tracking-wider">ORDIUM</span>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-sm leading-relaxed">
              {t('brand.metaDescription', 'Fraud Detection & Order Risk Intelligence Infrastructure for high-velocity e-commerce. Protect checkout pipelines with graph-based relationship intelligence and explainable risk scores.')}
            </p>
            <div className="flex items-center gap-3 pt-2 text-[11px] font-mono">
              <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                {t('footer.network_status', 'ORDIUM Network: status telemetry available when reported')}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-[#94A3B8]" dir="ltr">Evaluation latency: measured when available</span>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-3">
            <h4 className="text-white font-mono text-xs uppercase tracking-wider font-semibold">
              {t('nav.platform', 'Platform')}
            </h4>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigate('/platform')} className="hover:text-white transition-colors text-start">{t('footer.risk_core_arch', 'Risk Core Architecture')}</button></li>
              <li><button onClick={() => onNavigate('/intelligence')} className="hover:text-white transition-colors text-start">{t('footer.identity_graph', 'Identity Graph Engine')}</button></li>
              <li><button onClick={() => onNavigate('/security')} className="hover:text-white transition-colors text-start">{t('footer.zero_trust_sec', 'Zero-Trust Security')}</button></li>
              <li><button onClick={() => onNavigate('/pricing')} className="hover:text-white transition-colors text-start">{t('footer.enterprise_pricing', 'Enterprise Pricing')}</button></li>
            </ul>
          </div>

          {/* Col 3: Developers */}
          <div className="space-y-3">
            <h4 className="text-white font-mono text-xs uppercase tracking-wider font-semibold">
              {t('nav.developers', 'Developers')}
            </h4>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors text-start">{t('footer.api_ref', 'API Reference v1')}</button></li>
              <li><button onClick={() => onNavigate('/developers')} className="hover:text-white transition-colors text-start">{t('footer.sdks_webhooks', 'SDKs & Webhooks')}</button></li>
              <li><button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors text-start">{t('footer.idempotency_errors', 'Idempotency & Errors')}</button></li>
              <li><button onClick={() => onNavigate('/login')} className="hover:text-white transition-colors text-start">{t('nav.sign_in', 'Sign In')}</button></li>
            </ul>
          </div>

          {/* Col 4: Company & Legal */}
          <div className="space-y-3">
            <h4 className="text-white font-mono text-xs uppercase tracking-wider font-semibold">
              {t('nav.company', 'Company')}
            </h4>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigate('/company')} className="hover:text-white transition-colors text-start">{t('footer.about_us', 'About Us')}</button></li>
              <li><button onClick={() => onNavigate('/security')} className="hover:text-white transition-colors text-start">{t('footer.security_arch', 'Security Architecture')}</button></li>
              <li><button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors text-start">{t('footer.api_status', 'API Status')}</button></li>
              <li><button onClick={() => onNavigate('/pricing')} className="hover:text-white transition-colors text-start">{t('nav.pricing', 'Pricing')}</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#94A3B8]">
          <div>
            © {new Date().getFullYear()} ORDIUM Technologies Inc. {t('footer.all_rights', 'All rights reserved.')}
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>{t('footer.encrypted', 'Encrypted transport and protected credentials')}</span>
            <span>{t('footer.tenant_isolated', 'Tenant-Isolated Ingestion')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
