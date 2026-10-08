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
      className={`flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-white/10 bg-[#0D1320]/40 ${className}`}
    >
      <div className="p-3 mb-4 rounded-xl bg-white/5 text-[#94A3B8]">
        {icon || <Inbox className="w-8 h-8" />}
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-[#94A3B8] max-w-md mb-6 leading-relaxed">{description}</p>
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
    <div className={`flex flex-col items-center justify-center p-16 text-center ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-[#6C5CE7] mb-4" />
      <span className="text-xs font-mono text-[#94A3B8]">{message}</span>
    </div>
  );
};
