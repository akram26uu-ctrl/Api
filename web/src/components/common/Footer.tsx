import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { BrandMark } from './BrandMark';

interface FooterProps { onNavigate: (path: string) => void; }

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const columns = [
    {
      title: t('nav.platform', 'Platform'),
      links: [
        [t('footer.risk_core_arch', 'Risk architecture'), '/platform'],
        [t('footer.identity_graph', 'Identity graph'), '/intelligence'],
        [t('footer.security_arch', 'Security'), '/security'],
        [t('nav.pricing', 'Pricing'), '/pricing'],
      ],
    },
    {
      title: t('nav.developers', 'Developers'),
      links: [
        [t('footer.api_ref', 'API reference'), '/docs'],
        [t('footer.sdks_webhooks', 'Webhooks & integrations'), '/developers'],
        [t('footer.idempotency_errors', 'Idempotency & errors'), '/docs'],
        [t('nav.sign_in', 'Sign in'), '/login'],
      ],
    },
    {
      title: t('nav.company', 'Company'),
      links: [
        [t('footer.about_us', 'About ORDIUM'), '/company'],
        [t('nav.docs', 'Documentation'), '/docs'],
        [t('footer.enterprise_pricing', 'Plans'), '/pricing'],
      ],
    },
  ];

  return (
    <footer className="ordium-footer">
      <div className="ordium-footer-grid">
        <div className="ordium-footer-brand">
          <button className="ordium-brand" type="button" onClick={() => onNavigate('/')} aria-label="ORDIUM home">
            <BrandMark /><span>ORDIUM<small>{t('brand.tagline', 'Risk Intelligence')}</small></span>
          </button>
          <p>{t('brand.metaDescription', 'Explainable order-risk infrastructure for e-commerce. Evaluate identity, behavior, network and order history before fraud becomes a loss.')}</p>
          <div className="ordium-footer-status"><i />{t('footer.network_status', 'Service telemetry available in the console')}</div>
        </div>
        <div className="ordium-footer-links">
          {columns.map((column) => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              <ul>{column.links.map(([label, path]) => <li key={label}><button type="button" onClick={() => onNavigate(path)}>{label}</button></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
      <div className="ordium-footer-bottom">
        <span>© {new Date().getFullYear()} ORDIUM. {t('footer.all_rights', 'All rights reserved.')}</span>
        <span>{t('footer.tenant_isolated', 'Merchant-scoped data')} / {t('footer.encrypted', 'Encrypted transport')}</span>
      </div>
    </footer>
  );
};
