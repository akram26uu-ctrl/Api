import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../common/Button';

interface VerifyEmailPageProps { token: string; onNavigate: (path: string) => void; onVerified: () => void; }

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ token, onNavigate, onVerified }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>(token ? 'ready' : 'error');
  const [message, setMessage] = useState(token
    ? t('auth.verify_ready', 'Press the button below to verify your email and activate your ORDIUM workspace.')
    : t('auth.verify_missing_token', 'This verification link is missing its token. Request a new verification email.'));

  // Do not consume verification tokens on page load: mail security scanners and
  // React StrictMode can open/run the page before the user explicitly confirms.
  const handleVerify = async () => {
    if (!token || status === 'loading' || status === 'success') return;
    setStatus('loading');
    setMessage(t('auth.verify_loading', 'Verifying your account securely…'));
    try {
      await authApi.verifyEmail(token);
      setStatus('success');
      setMessage(t('auth.verify_success', 'Your email has been verified and your ORDIUM workspace is ready.'));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof OrdiumApiError
        ? error.message
        : t('auth.verify_error', 'This verification link is invalid or expired. Request a new link if needed.'));
    }
  };

  return (
    <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0D1320] border border-white/10 rounded-2xl p-8 text-center space-y-5">
        {status === 'ready' && <MailCheck className="w-12 h-12 text-[#22D3EE] mx-auto" />}
        {status === 'loading' && <Loader2 className="w-10 h-10 text-[#22D3EE] mx-auto animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto" />}
        {status === 'error' && <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto" />}
        <h1 className="text-xl font-bold">
          {status === 'success'
            ? t('auth.verify_title_success', 'Email Verified')
            : status === 'error'
              ? t('auth.verify_title_error', 'Verification Failed')
              : status === 'loading'
                ? t('auth.verify_title_loading', 'Verifying Email')
                : t('auth.verify_title_ready', 'Verify Your Email')}
        </h1>
        <p className="text-sm text-[#94A3B8]">{message}</p>
        {status === 'ready' && <Button variant="primary" onClick={() => void handleVerify()}>{t('auth.verify_button', 'Verify Email')}</Button>}
        {status === 'success' && <Button variant="primary" onClick={onVerified}>{t('auth.open_console', 'Open Console')}</Button>}
        {status === 'error' && <Button variant="primary" onClick={() => onNavigate('/login')}>{t('auth.back_login', 'Back to Login')}</Button>}
      </div>
    </div>
  );
};
