/**
 * ORDIUM Risk Badge
 * Displays ALLOW (emerald), REVIEW (amber), and REJECT (red) decisions
 * with restrained, high-end technical styling.
 */

import React from 'react';
import { RiskDecision } from '../../lib/api/types';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface RiskBadgeProps {
  decision?: RiskDecision;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  decision = 'ALLOW',
  size = 'md',
  showIcon = true
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1 font-mono',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-mono',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-mono'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  if (decision === 'ALLOW') {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded border whitespace-nowrap bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 ${sizeClasses[size]}`}
      >
        {showIcon && <CheckCircle2 className={iconSizes[size]} />}
        <span>ALLOW</span>
      </span>
    );
  }

  if (decision === 'REVIEW') {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded border whitespace-nowrap bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 ${sizeClasses[size]}`}
      >
        {showIcon && <AlertTriangle className={iconSizes[size]} />}
        <span>REVIEW</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded border whitespace-nowrap bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30 ${sizeClasses[size]}`}
    >
      {showIcon && <XCircle className={iconSizes[size]} />}
      <span>REJECT</span>
    </span>
  );
};
