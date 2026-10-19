/**
 * ORDIUM Empty & Loading States
 */

import React from 'react';
import { Database, Inbox, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-white/[0.12] bg-[#101827]/45 ${className}`}
    >
      <div className="p-3.5 mb-4 rounded-2xl bg-[#111A29] border border-white/[0.06] text-[#A1AEC1]">
        {icon || <Inbox className="w-8 h-8" />}
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-[#A1AEC1] max-w-md mb-6 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading intelligence telemetry...',
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-10 sm:p-16 text-center ${className}`} role="status" aria-live="polite">
      <Loader2 className="w-8 h-8 animate-spin text-[#817AFF] mb-4" aria-hidden="true" />
      <span className="text-xs font-mono text-[#94A3B8]">{message}</span>
    </div>
  );
};
