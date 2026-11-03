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
      <span className={`ordium-brand-mark relative ${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg bg-[#0D1320] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 transition-colors group-hover:border-[#22D3EE]/50`}>
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#6C5CE7]/30 to-[#22D3EE]/20 opacity-60 group-hover:opacity-100 transition-opacity" />
        <Cpu aria-hidden="true" className="w-4 h-4 text-[#22D3EE] relative z-10" />
      </span>
      <span className="flex flex-col text-start leading-none">
        <span dir="ltr" className="font-mono text-base font-extrabold tracking-wider text-white">ORDIUM</span>
        {!compact && (
          <span className="mt-1 text-[10px] font-semibold tracking-widest text-[#22D3EE] uppercase">
            {subtitle ?? t('brand.tagline', 'Risk Intelligence')}
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
