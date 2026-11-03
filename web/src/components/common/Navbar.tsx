/**
 * ORDIUM Public Website Navbar
 */

import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, Menu, X, Terminal } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenDashboard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, onOpenDashboard }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, isRTL } = useLanguage();

  const navLinks = [
    { label: t('nav.platform', 'Platform'), path: '/platform' },
    { label: t('nav.intelligence', 'Intelligence'), path: '/intelligence' },
    { label: t('nav.security', 'Security'), path: '/security' },
    { label: t('nav.developers', 'Developers'), path: '/developers' },
    { label: t('nav.pricing', 'Pricing'), path: '/pricing' },
    { label: t('nav.docs', 'Docs'), path: '/docs' },
    { label: t('nav.company', 'Company'), path: '/company' }
  ];

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Close the mobile menu with Escape and whenever the route changes.
  useEffect(() => { setMobileMenuOpen(false); }, [currentPath]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  return (
    <header className="ordium-navbar sticky top-0 z-40 w-full border-b border-white/5 bg-[#080B12]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <BrandLogo onClick={() => { onNavigate('/'); setMobileMenuOpen(false); }} />

        {/* Desktop Nav Links */}
        <nav aria-label={t('ui.main_navigation', 'Main navigation')} className="hidden xl:flex items-center gap-0.5 2xl:gap-2 px-3 min-w-0">
          {navLinks.map(link => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => onNavigate(link.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-2.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-lg ${
                  isActive ? 'text-[#22D3EE] font-semibold' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Desktop Action CTAs & Language Switcher */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          {/* Auth Sign In Link */}
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className={`min-h-10 text-[13px] font-medium px-3 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap ${
              currentPath === '/login' ? 'text-[#22D3EE] font-semibold bg-white/5' : ''
            }`}
          >
            {t('nav.sign_in', 'Sign In')}
          </button>

          {/* Register Link */}
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className={`hidden 2xl:inline-flex items-center min-h-10 text-[13px] font-medium px-3 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap ${
              currentPath === '/register' ? 'text-[#22D3EE] font-semibold bg-white/5' : ''
            }`}
          >
            {t('nav.register', 'Register')}
          </button>

          {/* Wrapper controls visibility: Button's own inline-flex would override a `hidden` class on it. */}
          <span className="hidden 2xl:inline-flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('/docs')}
              leftIcon={<Terminal aria-hidden="true" className="w-3.5 h-3.5 text-[#22D3EE]" />}
              className="whitespace-nowrap"
            >
              {t('nav.api_docs', 'API Docs')}
            </Button>
          </span>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenDashboard}
            rightIcon={<ChevronIcon className="w-3.5 h-3.5" />}
            className="whitespace-nowrap"
          >
            {t('nav.launch_console', 'Launch Console')}
          </Button>

          {/* Distinct Separator & Language Switcher with clear spacing */}
          <div className="flex items-center ps-3 ms-1 border-s border-white/10 shrink-0">
            <LanguageSwitcher variant="dropdown" align="end" />
          </div>
        </div>

        {/* Mobile & Tablet controls (screens < lg) */}
        <div className="flex xl:hidden items-center gap-2 sm:gap-3 shrink-0">
          <span className="hidden sm:inline-flex">
            <Button variant="primary" size="sm" onClick={onOpenDashboard} className="px-3 whitespace-nowrap">
              {t('nav.console', 'Console')}
            </Button>
          </span>

          {/* Language Switcher with clear separation from menu button */}
          <div className="shrink-0">
            <LanguageSwitcher variant="dropdown" align="end" />
          </div>

          {/* Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="p-2.5 text-[#94A3B8] hover:text-white rounded-xl hover:bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center border border-white/5"
            aria-label={mobileMenuOpen ? t('ui.close_menu', 'Close menu') : t('ui.open_menu', 'Open menu')}
            aria-expanded={mobileMenuOpen}
            aria-controls="ordium-mobile-nav"
          >
            {mobileMenuOpen ? <X aria-hidden="true" className="w-5 h-5" /> : <Menu aria-hidden="true" className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <nav id="ordium-mobile-nav" aria-label={t('ui.main_navigation', 'Main navigation')} className="xl:hidden border-b border-white/10 bg-[#0D1320] px-4 py-4 space-y-3 animate-in slide-in-from-top-2 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          {/* Mobile Language Switcher Bar */}
          <div className="py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-[#A5B1C3] block mb-2">
              {t('language.select', 'Language')}
            </span>
            <LanguageSwitcher variant="segmented" className="w-full justify-center" />
          </div>

          <div className="space-y-1">
            {navLinks.map(link => (
              <button
                key={link.path}
                type="button"
                aria-current={currentPath === link.path ? 'page' : undefined}
                onClick={() => {
                  onNavigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-11 px-3 rounded-lg text-start text-[15px] font-medium transition-colors ${currentPath === link.path ? 'bg-[#22D3EE]/10 text-[#52D9E8]' : 'text-[#C7D0DD] hover:text-white hover:bg-white/5'}`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onNavigate('/login');
                  setMobileMenuOpen(false);
                }}
                type="button"
                className="min-h-11 text-sm text-center font-medium text-[#22D3EE] bg-[#22D3EE]/10 rounded-lg hover:bg-[#22D3EE]/20 transition-colors"
              >
                {t('nav.sign_in', 'Sign In')}
              </button>
              <button
                onClick={() => {
                  onNavigate('/register');
                  setMobileMenuOpen(false);
                }}
                type="button"
                className="min-h-11 text-sm text-center font-medium text-white bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
              >
                {t('nav.register', 'Register')}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onNavigate('/docs');
                setMobileMenuOpen(false);
              }}
              className="w-full justify-center"
            >
              {t('nav.api_docs', 'API Docs')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onOpenDashboard();
                setMobileMenuOpen(false);
              }}
              className="w-full justify-center"
            >
              {t('nav.launch_console', 'Launch Console')}
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
};

