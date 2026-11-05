/**
 * ORDIUM Metric Card Component
 */

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'accent' | 'warning' | 'danger';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  subtitle,
  icon,
  variant = 'default',
  className = ''
}) => {
  const borderVariants = {
    default: 'border-white/[0.10] hover:border-white/20',
    accent: 'border-[var(--ordium-accent)]/30 hover:border-[var(--ordium-accent)]/55',
    warning: 'border-[var(--ordium-warning)]/30 hover:border-[var(--ordium-warning)]',
    danger: 'border-[var(--ordium-danger)]/30 hover:border-[var(--ordium-danger)]'
  };

  return (
    <div
      className={`bg-gradient-to-br from-[var(--ordium-surface-raised)] to-[var(--ordium-surface)] border rounded-2xl p-3.5 sm:p-5 transition-colors duration-200 shadow-sm hover:shadow-lg hover:shadow-black/10 ${borderVariants[variant]} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs sm:text-[13px] font-medium text-[var(--ordium-muted)] tracking-normal">{title}</span>
        {icon && <div className="text-[var(--ordium-muted)] p-1.5 bg-white/5 rounded-lg">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-3 mb-1">
        <div className="text-xl sm:text-2xl lg:text-[1.75rem] font-semibold text-white tracking-tight font-mono tabular-nums break-words">{value}</div>
        {change && (
          <div
            className={`inline-flex items-center text-xs font-mono font-medium ${
              change.trend === 'up'
                ? 'text-[var(--ordium-success)]'
                : change.trend === 'down'
                ? 'text-[var(--ordium-danger)]'
                : 'text-[var(--ordium-muted)]'
            }`}
          >
            {change.trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />}
            {change.trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
            {change.trend === 'neutral' && <Minus className="w-3.5 h-3.5 mr-0.5" />}
            <span>{change.value}</span>
          </div>
        )}
      </div>

      {(subtitle || change?.label) && (
        <p className="text-xs leading-relaxed text-[var(--ordium-muted)] line-clamp-2">
          {subtitle || change?.label}
        </p>
      )}
    </div>
  );
};
