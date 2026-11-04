/**
 * ORDIUM Public Website Navbar
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, Menu, X } from 'lucide-react';
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

  const primaryLinks = [
    { label: t('nav.platform', 'المنصة'), path: '/platform' },
    { label: t('nav.intelligence', 'ذكاء المخاطر'), path: '/intelligence' },
    { label: t('mkt.nav.pricing', 'الأسعار'), path: '/pricing' },
    { label: t('mkt.nav.docs', 'التوثيق'), path: '/docs' },
  ];
  const moreLinks = [
    { label: t('nav.developers', 'المطورون'), path: '/developers' },
    { label: t('nav.security', 'الأمان والحماية'), path: '/security' },
    { label: t('nav.company', 'عن الشركة'), path: '/company' },
  ];
  const navLinks = [...primaryLinks, ...moreLinks];
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = moreLinks.some(link => link.path === currentPath);

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Close the mobile menu with Escape and whenever the route changes.
  useEffect(() => { setMobileMenuOpen(false); setMoreOpen(false); }, [currentPath]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    const onPointer = (event: PointerEvent) => { if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [moreOpen]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  return (
    <header className="ordium-navbar sticky top-0 z-40 w-full border-b border-white/5 bg-[var(--ordium-canvas)]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <BrandLogo onClick={() => { onNavigate('/'); setMobileMenuOpen(false); }} />

        {/* Desktop nav: four primary links inline, the rest in a "More" menu so ar/fr/en all fit from 1280px. */}
        <nav aria-label={t('ui.main_navigation', 'Main navigation')} className="hidden xl:flex items-center gap-1 px-3 min-w-0">
          {primaryLinks.map(link => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => onNavigate(link.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-lg ${
                  isActive ? 'text-[var(--ordium-signal)] font-semibold' : 'text-[var(--ordium-muted)] hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={moreOpen}
              aria-controls="ordium-more-nav"
              aria-current={moreActive ? 'page' : undefined}
              className={`inline-flex items-center gap-1 px-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-lg ${
                moreActive ? 'text-[var(--ordium-signal)] font-semibold' : 'text-[var(--ordium-muted)] hover:text-white'
              }`}
            >
              {t('mkt.nav.more', 'المزيد')}
              <ChevronDown aria-hidden="true" className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <ul id="ordium-more-nav" className="absolute top-full mt-2 start-0 min-w-[12rem] rounded-xl border border-white/10 bg-[var(--ordium-surface)] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.4)]">
                {moreLinks.map(link => (
                  <li key={link.path}>
                    <button
                      type="button"
                      onClick={() => { setMoreOpen(false); onNavigate(link.path); }}
                      aria-current={currentPath === link.path ? 'page' : undefined}
                      className={`w-full min-h-10 px-3 rounded-lg text-start text-sm whitespace-nowrap transition-colors ${
                        currentPath === link.path ? 'text-[var(--ordium-signal)] bg-white/5' : 'text-[#C7D0DD] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        {/* Desktop actions */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className={`min-h-10 text-sm font-medium px-3 rounded-lg text-[var(--ordium-muted)] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap ${
              currentPath === '/login' ? 'text-[var(--ordium-signal)] font-semibold bg-white/5' : ''
            }`}
          >
            {t('nav.sign_in', 'Sign In')}
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenDashboard}
            rightIcon={<ChevronIcon className="w-3.5 h-3.5" />}
            className="whitespace-nowrap"
          >
            {t('mkt.nav.cta', 'لوحة التحكم')}
          </Button>

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
            className="p-2.5 text-[var(--ordium-muted)] hover:text-white rounded-xl hover:bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center border border-white/5"
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
        <nav id="ordium-mobile-nav" aria-label={t('ui.main_navigation', 'Main navigation')} className="xl:hidden border-b border-white/10 bg-[var(--ordium-surface)] px-4 py-4 space-y-3 animate-in slide-in-from-top-2 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          {/* Mobile Language Switcher Bar */}
          <div className="py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-[var(--ordium-muted)] block mb-2">
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
                className={`w-full min-h-11 px-3 rounded-lg text-start text-[15px] font-medium transition-colors ${currentPath === link.path ? 'bg-[var(--ordium-signal)]/10 text-[var(--ordium-signal)]' : 'text-[#C7D0DD] hover:text-white hover:bg-white/5'}`}
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
                className="min-h-11 text-sm text-center font-medium text-[var(--ordium-signal)] bg-[var(--ordium-signal)]/10 rounded-lg hover:bg-[var(--ordium-signal)]/20 transition-colors"
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
              {t('mkt.nav.cta', 'لوحة التحكم')}
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
};

