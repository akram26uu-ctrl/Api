/**
 * ORDIUM Risk Badge — the engine's decision in the merchant's language.
 * Icon + text carry the meaning; color only reinforces it.
 */

import React from 'react';
import { RiskDecision } from '../../lib/api/types';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface RiskBadgeProps {
  decision?: RiskDecision;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const STYLES: Record<RiskDecision, { icon: typeof CheckCircle2; className: string; key: string; fallback: string }> = {
  ALLOW: { icon: CheckCircle2, key: 'dashboard.decision.allow', fallback: 'مقبولة', className: 'bg-[var(--ordium-success)]/12 text-[var(--ordium-success)] border-[var(--ordium-success)]/30' },
  REVIEW: { icon: AlertTriangle, key: 'dashboard.decision.review', fallback: 'مراجعة', className: 'bg-[var(--ordium-warning)]/12 text-[var(--ordium-warning)] border-[var(--ordium-warning)]/30' },
  REJECT: { icon: XCircle, key: 'dashboard.decision.reject', fallback: 'مرفوضة', className: 'bg-[var(--ordium-danger)]/12 text-[var(--ordium-danger)] border-[var(--ordium-danger)]/30' },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ decision = 'ALLOW', size = 'md', showIcon = true }) => {
  const { t } = useLanguage();
  const style = STYLES[decision] ?? STYLES.REJECT;
  const Icon = style.icon;
  const sizeClasses = { sm: 'text-xs px-2 py-0.5 gap-1', md: 'text-xs px-2.5 py-1 gap-1.5', lg: 'text-sm px-3.5 py-1.5 gap-2' };
  const iconSizes = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' };
  return (
    <span className={`inline-flex items-center font-semibold rounded-md border whitespace-nowrap ${style.className} ${sizeClasses[size]}`}>
      {showIcon && <Icon className={iconSizes[size]} aria-hidden="true" />}
      <span>{t(style.key, style.fallback)}</span>
    </span>
  );
};
