import React, { useId, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, MailCheck, Mail, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { BrandLogo } from '../common/BrandLogo';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { useLanguage } from '../../i18n/LanguageContext';

interface VerifyEmailPageProps { token: string; onNavigate: (path: string) => void; onVerified: () => void; }

type Status = 'ready' | 'loading' | 'success' | 'error';

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ token, onNavigate, onVerified }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>(token ? 'ready' : 'error');
  // Keep only the server's message in state; static copy is derived at render time so it follows language changes.
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const emailId = useId();
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ ok: boolean; text: string } | null>(null);

  // The page promises a new link on failure, so offer the existing resend endpoint right here.
  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail.trim()) || resending) {
      setResendResult({ ok: false, text: t('auth.errors.email_invalid', 'Please enter a valid work email address.') });
      return;
    }
    setResending(true);
    setResendResult(null);
    try {
      await authApi.resendVerification(resendEmail.trim());
      // The server reply is a deliberately generic English sentence; show its localized equivalent.
      setResendResult({ ok: true, text: t('auth.resend_generic', 'If the account still needs verification, a new message will be sent.') });
    } catch (error) {
      setResendResult({ ok: false, text: error instanceof OrdiumApiError && error.statusCode !== 0 ? error.message : t('auth.resend_error', 'The message could not be sent right now. Please try again later.') });
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (!token || status === 'loading' || status === 'success') return;
    setStatus('loading');
    setServerMessage(null);
    try {
      await authApi.verifyEmail(token);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setServerMessage(error instanceof OrdiumApiError && error.statusCode !== 0 ? error.message : null);
    }
  };

  const message = (() => {
    if (status === 'ready') return t('auth.verify_ready', 'Press the button below to confirm your email and activate your ORDIUM account.');
    if (status === 'loading') return t('auth.verify_loading', 'Verifying your account securely…');
    if (status === 'success') return t('auth.verify_success', 'Your email is confirmed and your ORDIUM workspace is active.');
    if (!token) return t('auth.verify_missing_token', 'This verification link does not contain a valid token. You can request a new link below.');
    return serverMessage || t('auth.verify_error', 'The verification link is invalid or expired. Request a new link.');
  })();

  const title = status === 'success'
    ? t('auth.verify_title_success', 'Email confirmed')
    : status === 'error'
      ? t('auth.verify_title_error', 'Verification failed')
      : status === 'loading'
        ? t('auth.verify_title_loading', 'Verifying')
        : t('auth.verify_title_ready', 'Confirm your email');

  return (
    <div className="min-h-screen bg-[#080B12] text-white flex flex-col px-4 py-6 sm:py-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3">
        <BrandLogo onClick={() => onNavigate('/')} />
        <LanguageSwitcher variant="dropdown" align="end" />
      </header>
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="ordium-auth-card w-full max-w-md p-8 text-center space-y-5">
          <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            {status === 'ready' && <MailCheck className="w-8 h-8 text-[#22D3EE]" />}
            {status === 'loading' && <Loader2 className="w-8 h-8 text-[#22D3EE] animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-8 h-8 text-[#48D6A0]" />}
            {status === 'error' && <AlertCircle className="w-8 h-8 text-[#FB7185]" />}
          </div>
          <p className="text-xs font-mono tracking-[0.2em] text-[#52D9E8]">{t('auth.verify_eyebrow', 'ORDIUM / ACCOUNT SECURITY')}</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-[#A5B1C3] leading-7" role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>
          <div className="flex flex-col gap-3 pt-1">
            {status === 'ready' && <Button variant="primary" className="w-full" onClick={() => void handleVerify()}>{t('auth.verify_button', 'Confirm email')}</Button>}
            {status === 'loading' && <Button variant="primary" className="w-full" isLoading>{t('auth.verify_title_loading', 'Verifying')}</Button>}
            {status === 'success' && <Button variant="primary" className="w-full" onClick={onVerified}>{t('auth.open_console', 'Open dashboard')}</Button>}
            {status === 'error' && (
              <form onSubmit={handleResend} noValidate className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-start">
                <label htmlFor={emailId} className="ordium-label">{t('auth.verify_request_new', 'Request a new link')}</label>
                <div className="relative" dir="ltr">
                  <span className="ordium-input-icon"><Mail aria-hidden="true" className="w-4 h-4" /></span>
                  <input id={emailId} type="email" inputMode="email" autoComplete="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)}
                    placeholder={t('auth.email_placeholder', 'analyst@company.com')} className="ordium-input has-leading-icon font-mono" />
                </div>
                <Button type="submit" variant="outline" className="w-full" isLoading={resending} leftIcon={<RefreshCw aria-hidden="true" className="w-4 h-4" />}>
                  {resending ? t('auth.resend_sending', 'Sending the link…') : t('auth.resend_button', 'Resend verification link')}
                </Button>
                {resendResult && <p role="status" aria-live="polite" className={`text-sm leading-6 ${resendResult.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{resendResult.text}</p>}
              </form>
            )}
            <button type="button" onClick={() => onNavigate('/login')} className="min-h-10 text-sm text-[#52D9E8] hover:underline">
              {t('auth.back_to_login', 'Return to sign in')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
