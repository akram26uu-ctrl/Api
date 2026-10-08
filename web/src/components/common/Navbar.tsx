/**
 * ORDIUM Public Website Navbar
 */

import React, { useState } from 'react';
import { Shield, ChevronRight, ChevronLeft, Menu, X, Terminal, Cpu, LogIn, UserPlus } from 'lucide-react';
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#080B12]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div
          onClick={() => { onNavigate('/'); setMobileMenuOpen(false); }}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="relative w-8 h-8 rounded-lg bg-[#0D1320] border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-[#22D3EE]/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6C5CE7]/30 to-[#22D3EE]/20 opacity-50 group-hover:opacity-100 transition-opacity" />
            <Cpu className="w-4 h-4 text-[#22D3EE] relative z-10 transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-base font-extrabold tracking-wider text-white">ORDIUM</span>
            <span className="text-[9px] font-mono tracking-widest text-[#22D3EE] uppercase -mt-1">
              {t('brand.tagline', 'Risk Intelligence')}
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6 px-4">
          {navLinks.map(link => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                onClick={() => onNavigate(link.path)}
                className={`text-xs font-medium tracking-wide transition-colors whitespace-nowrap py-1 ${
                  isActive ? 'text-[#22D3EE] font-semibold' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Desktop Action CTAs & Language Switcher */}
        <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
          {/* Auth Sign In Link */}
          <button
            onClick={() => onNavigate('/login')}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap ${
              currentPath === '/login' ? 'text-[#22D3EE] font-semibold bg-white/5' : ''
            }`}
          >
            {t('nav.sign_in', 'Sign In')}
          </button>

          {/* Register Link */}
          <button
            onClick={() => onNavigate('/register')}
            className={`hidden xl:inline-flex text-xs font-medium px-2.5 py-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap ${
              currentPath === '/register' ? 'text-[#22D3EE] font-semibold bg-white/5' : ''
            }`}
          >
            {t('nav.register', 'Register')}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/docs')}
            leftIcon={<Terminal className="w-3.5 h-3.5 text-[#22D3EE]" />}
            className="hidden xl:inline-flex whitespace-nowrap"
          >
            {t('nav.api_docs', 'API Docs')}
          </Button>

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
          <div className="flex items-center ps-3 xl:ps-4 ms-2 xl:ms-3 border-s border-white/10 shrink-0">
            <LanguageSwitcher variant="dropdown" align="end" />
          </div>
        </div>

        {/* Mobile & Tablet controls (screens < lg) */}
        <div className="flex lg:hidden items-center gap-2 sm:gap-3 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenDashboard}
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-mono whitespace-nowrap"
          >
            {t('nav.console', 'Console')}
          </Button>

          {/* Language Switcher with clear separation from menu button */}
          <div className="shrink-0">
            <LanguageSwitcher variant="dropdown" align="end" />
          </div>

          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 text-[#94A3B8] hover:text-white rounded-xl hover:bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center border border-white/5"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-white/10 bg-[#0D1320] px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          {/* Mobile Language Switcher Bar */}
          <div className="py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] font-mono text-[#94A3B8] uppercase block mb-2">
              Language / اللغة / Langue
            </span>
            <LanguageSwitcher variant="segmented" className="w-full justify-center" />
          </div>

          <div className="space-y-1">
            {navLinks.map(link => (
              <button
                key={link.path}
                onClick={() => {
                  onNavigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-start py-2 text-sm text-[#94A3B8] hover:text-white font-medium"
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
                className="py-2 text-sm text-center font-medium text-[#22D3EE] bg-[#22D3EE]/10 rounded-lg hover:bg-[#22D3EE]/20 transition-colors"
              >
                {t('nav.sign_in', 'Sign In')}
              </button>
              <button
                onClick={() => {
                  onNavigate('/register');
                  setMobileMenuOpen(false);
                }}
                className="py-2 text-sm text-center font-medium text-white bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
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
        </div>
      )}
    </header>
  );
};

