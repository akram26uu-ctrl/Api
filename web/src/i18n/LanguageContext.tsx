/**
 * ORDIUM Internationalization (i18n) Engine & Context
 * Supports English, Arabic (RTL with IBM Plex Sans Arabic), and French.
 * Persists user preference and automatically synchronizes document attributes.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import en from './en.json';
import ar from './ar.json';
import fr from './fr.json';

export type Language = 'en' | 'ar' | 'fr';

export interface LanguageInfo {
  code: Language;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr' }
];

const TRANSLATIONS: Record<Language, any> = {
  en,
  ar,
  fr
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  t: (keyPath: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'ordium_language_preference_v2';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ar' || saved === 'fr') {
        return saved;
      }
      // Arabic is ORDIUM's primary language and the automatic first-visit default.
      // Browser language is intentionally not used to override the product default;
      // users can explicitly choose English or French from the language switcher.
    } catch {
      // LocalStorage access restricted in private browsing
    }
    return 'ar';
  });

  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  // Synchronize document attributes when language changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = dir;
      if (isRTL) {
        document.documentElement.classList.add('rtl');
      } else {
        document.documentElement.classList.remove('rtl');
      }
    }
  }, [language, dir, isRTL]);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
  };

  /**
   * Helper to retrieve nested keys like "auth.errors.invalid_credentials"
   */
  const t = useMemo(() => {
    return (keyPath: string, defaultText?: string): string => {
      const segments = keyPath.split('.');
      
      // Look up in active dictionary
      let currentVal: any = TRANSLATIONS[language];
      for (const segment of segments) {
        if (currentVal && typeof currentVal === 'object' && segment in currentVal) {
          currentVal = currentVal[segment];
        } else {
          currentVal = undefined;
          break;
        }
      }

      if (typeof currentVal === 'string') {
        return currentVal;
      }

      // Fallback to English dictionary
      if (language !== 'en') {
        let fallbackVal: any = TRANSLATIONS.en;
        for (const segment of segments) {
          if (fallbackVal && typeof fallbackVal === 'object' && segment in fallbackVal) {
            fallbackVal = fallbackVal[segment];
          } else {
            fallbackVal = undefined;
            break;
          }
        }
        if (typeof fallbackVal === 'string') {
          return fallbackVal;
        }
      }

      // Final fallback
      return defaultText !== undefined ? defaultText : keyPath;
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dir, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
