/**
 * ORDIUM Language Switcher
 * Provides seamless switching between English, العربية (Arabic), and Français (French).
 * Mirrors correctly in RTL.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES, Language } from '../../i18n/LanguageContext';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'segmented' | 'minimal';
  className?: string;
  align?: 'start' | 'end';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  className = '',
  align = 'end'
}) => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  if (variant === 'segmented') {
    return (
      <div role="group" aria-label={t('language.select', 'Language')} className={`flex items-center bg-[#0D1320] p-0.5 rounded-lg border border-white/10 ${className}`}>
        {SUPPORTED_LANGUAGES.map(lang => {
          const isActive = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              lang={lang.code}
              aria-pressed={isActive}
              onClick={() => setLanguage(lang.code)}
              className={`flex-1 min-h-10 px-2.5 text-sm font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-[#22D3EE]/20 text-[#22D3EE] font-bold shadow-sm'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              {lang.nativeLabel}
            </button>
          );
        })}
      </div>
    );
  }

  const alignmentClass = align === 'start'
    ? (isRTL ? 'right-0 origin-top-right' : 'left-0 origin-top-left')
    : (isRTL ? 'left-0 origin-top-left' : 'right-0 origin-top-right');

  return (
    <div className={`relative inline-block text-start ${className}`} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        type="button"
        className="flex items-center gap-1.5 min-h-10 px-2.5 rounded-lg bg-[#0D1320] border border-white/10 hover:border-white/20 text-[#A5B1C3] hover:text-white text-xs font-medium transition-colors"
        aria-label={`${t('language.select', 'Language')}: ${currentLang.nativeLabel}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
      >
        <Globe aria-hidden="true" className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" />
        <span lang={currentLang.code}>{currentLang.nativeLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t('language.select', 'Language')}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
          className={`absolute mt-1.5 w-40 rounded-xl bg-[#0D1320] border border-white/15 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 ${alignmentClass}`}
        >
          {SUPPORTED_LANGUAGES.map(lang => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                lang={lang.code}
                onClick={(e) => {
                  e.stopPropagation();
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full min-h-11 flex items-center justify-between px-3 py-2 text-sm transition-colors text-start ${
                  isSelected
                    ? 'text-[#22D3EE] bg-[#22D3EE]/10 font-bold'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex flex-col text-start">
                  <span className="font-medium text-white">{lang.nativeLabel}</span>
                  <span className="text-[10px] text-[#64748B] font-mono">{lang.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#22D3EE] shrink-0 ms-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
