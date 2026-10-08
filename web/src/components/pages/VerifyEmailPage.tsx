import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../common/Button';

interface VerifyEmailPageProps { token: string; onNavigate: (path: string) => void; onVerified: () => void; }

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ token, onNavigate, onVerified }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    authApi.verifyEmail(token).then(() => {
      if (!active) return;
      setStatus('success');
      setMessage(t('auth.verify_success', 'Your email has been verified and your ORDIUM workspace is ready.'));
    }).catch((error) => {
      if (!active) return;
      setStatus('error');
      setMessage(error instanceof OrdiumApiError ? error.message : t('auth.verify_error', 'This verification link is invalid or expired.'));
    });
    return () => { active = false; };
  }, [token, t]);

  return (
    <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0D1320] border border-white/10 rounded-2xl p-8 text-center space-y-5">
        {status === 'loading' && <Loader2 className="w-10 h-10 text-[#22D3EE] mx-auto animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto" />}
        {status === 'error' && <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto" />}
        <h1 className="text-xl font-bold">{status === 'success' ? t('auth.verify_title_success', 'Email Verified') : status === 'error' ? t('auth.verify_title_error', 'Verification Failed') : t('auth.verify_title_loading', 'Verifying Email')}</h1>
        <p className="text-sm text-[#94A3B8]">{message || t('auth.verify_loading', 'Verifying your account securely…')}</p>
        {status !== 'loading' && <Button variant="primary" onClick={() => status === 'success' ? onVerified() : onNavigate('/login')}>{status === 'success' ? t('auth.open_console', 'Open Console') : t('auth.back_login', 'Back to Login')}</Button>}
      </div>
    </div>
  );
};
