import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { BrandMark } from './BrandMark';
import { LanguageSwitcher } from './LanguageSwitcher';
import './navigation.css';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenDashboard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, onOpenDashboard }) => {
  const [open, setOpen] = useState(false);
  const { t, isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const links = [
    [t('nav.platform', 'Platform'), '/platform'],
    [t('nav.intelligence', 'Intelligence'), '/intelligence'],
    [t('nav.security', 'Security'), '/security'],
    [t('nav.developers', 'Developers'), '/developers'],
    [t('nav.pricing', 'Pricing'), '/pricing'],
  ];

  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const go = (path: string) => { onNavigate(path); setOpen(false); };

  return (
    <>
      <a className="ordium-skip-link" href="#main-content">Skip to content</a>
      <header className="ordium-nav">
        <div className="ordium-nav-inner">
          <button className="ordium-brand" type="button" onClick={() => go('/')} aria-label="ORDIUM home">
            <BrandMark />
            <span>ORDIUM<small>{t('brand.tagline', 'Risk Intelligence')}</small></span>
          </button>

          <nav className="ordium-desktop-links" aria-label="Primary navigation">
            {links.map(([label, path]) => (
              <button key={path} type="button" onClick={() => go(path)} aria-current={currentPath === path ? 'page' : undefined}>{label}</button>
            ))}
          </nav>

          <div className="ordium-nav-actions">
            <LanguageSwitcher variant="dropdown" align="end" />
            <button className="ordium-sign-in" type="button" onClick={() => go('/login')}>{t('nav.sign_in', 'Sign in')}</button>
            <button className="ordium-console-button" type="button" onClick={onOpenDashboard}>{t('nav.launch_console', 'Open console')}<Arrow /></button>
          </div>

          <div className="ordium-mobile-actions">
            <LanguageSwitcher variant="dropdown" align="end" />
            <button type="button" className="ordium-menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="ordium-mobile-menu" aria-label={open ? 'Close navigation' : 'Open navigation'}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {open && (
          <div className="ordium-mobile-menu" id="ordium-mobile-menu">
            <nav aria-label="Mobile navigation">
              {links.map(([label, path], index) => (
                <button key={path} type="button" onClick={() => go(path)} aria-current={currentPath === path ? 'page' : undefined}>
                  <span dir="ltr">0{index + 1}</span>{label}<Arrow />
                </button>
              ))}
            </nav>
            <div className="ordium-mobile-cta">
              <button type="button" onClick={() => go('/login')}>{t('nav.sign_in', 'Sign in')}</button>
              <button type="button" onClick={() => go('/docs')}>{t('nav.api_docs', 'API documentation')}</button>
              <button type="button" className="ordium-console-button" onClick={onOpenDashboard}>{t('nav.launch_console', 'Open console')}<Arrow /></button>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
