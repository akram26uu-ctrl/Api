/** ORDIUM brand mark: one keyboard-accessible logo used across public and auth pages. */
import React from 'react';
import { Cpu } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface BrandLogoProps {
  onClick?: () => void;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ onClick, subtitle, compact = false, className = '' }) => {
  const { t } = useLanguage();
  const content = (
    <>
      <span className={`ordium-brand-mark relative ${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg bg-[var(--ordium-surface)] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 transition-colors group-hover:border-[var(--ordium-signal)]/50`}>
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[var(--ordium-accent)]/30 to-[var(--ordium-signal)]/20 opacity-60 group-hover:opacity-100 transition-opacity" />
        <Cpu aria-hidden="true" className="w-4 h-4 text-[var(--ordium-signal)] relative z-10" />
      </span>
      <span className="flex flex-col text-start leading-none">
        <span dir="ltr" className="font-mono text-base font-extrabold tracking-wider text-white">ORDIUM</span>
        {!compact && (
          <span className="mt-1 text-xs font-semibold tracking-wider rtl:tracking-normal text-[var(--ordium-signal)] uppercase whitespace-nowrap">
            {subtitle ?? t('mkt.brand.tagline', 'ذكاء المخاطر')}
          </span>
        )}
      </span>
    </>
  );

  if (!onClick) return <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>{content}</span>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('ui.home_link', 'ORDIUM — home')}
      className={`group inline-flex items-center gap-2.5 rounded-lg select-none bg-transparent border-0 p-0 cursor-pointer ${className}`}
    >
      {content}
    </button>
  );
};
