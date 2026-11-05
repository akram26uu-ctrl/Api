/** Focusable, announced form-level alert. Receives focus when it appears after a failed submit. */
import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FormAlertProps {
  message: string | null;
  requestId?: string | null;
  tone?: 'error' | 'success';
  /** Changing this value re-focuses the alert (e.g. a submit counter). */
  focusKey?: number;
}

export const FormAlert: React.FC<FormAlertProps> = ({ message, requestId, tone = 'error', focusKey }) => {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && tone === 'error') ref.current?.focus();
  }, [message, tone, focusKey]);

  if (!message) return null;
  const isError = tone === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={isError ? 'alert' : 'status'}
      className={`animate-in flex items-start gap-3 rounded-xl border p-3.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ordium-surface)] ${
        isError
          ? 'border-rose-400/30 bg-rose-500/10 text-rose-100 focus-visible:ring-rose-300'
          : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100 focus-visible:ring-emerald-300'
      }`}
    >
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? 'text-rose-300' : 'text-emerald-300'}`} />
      <div className="min-w-0 space-y-1 text-sm leading-relaxed">
        <p>{message}</p>
        {requestId && (
          <p className="font-mono text-xs opacity-75">
            {t('common.reference_id', 'Reference ID')}: <span dir="ltr">{requestId}</span>
          </p>
        )}
      </div>
    </div>
  );
};
