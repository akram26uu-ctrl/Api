import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { Button } from '../common/Button';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { useLanguage } from '../../i18n/LanguageContext';

interface VerifyEmailPageProps { token: string; onNavigate: (path: string) => void; onVerified: () => void; }

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ token, onNavigate, onVerified }) => {
  const { t, dir } = useLanguage();
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>(token ? 'ready' : 'error');
  const [message, setMessage] = useState(token
    ? t('auth.verify_ready', 'اضغط على الزر أدناه لتأكيد بريدك وتفعيل حساب ORDIUM.')
    : t('auth.verify_missing_token', 'رابط التحقق لا يحتوي على رمز صالح. يمكنك طلب رابط جديد أدناه.'));
  const handleVerify = async () => {
    if (!token || status === 'loading' || status === 'success') return;
    setStatus('loading');
    setMessage(t('auth.verify_loading', 'جارٍ التحقق من حسابك بأمان…'));
    try {
      await authApi.verifyEmail(token);
      setStatus('success');
      setMessage(t('auth.verify_success', 'تم تأكيد بريدك الإلكتروني وتفعيل مساحة ORDIUM.'));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof OrdiumApiError
        ? error.message
        : t('auth.verify_error', 'رابط التحقق غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.'));
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[#0D1320] border border-white/10 rounded-2xl p-8 text-center space-y-5">
        {status === 'ready' && <MailCheck className="w-12 h-12 text-[#22D3EE] mx-auto" />}
        {status === 'loading' && <Loader2 className="w-10 h-10 text-[#22D3EE] mx-auto animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto" />}
        {status === 'error' && <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto" />}
        <p className="text-xs font-mono tracking-[0.25em] text-[#22D3EE]">{t('auth.verify_eyebrow', 'ORDIUM / ACCOUNT SECURITY')}</p>
        <h1 className="text-xl font-bold">
          {status === 'success'
            ? t('auth.verify_title_success', 'تم تأكيد البريد')
            : status === 'error'
            ? t('auth.verify_title_error', 'تعذر التحقق')
            : status === 'loading'
            ? t('auth.verify_title_loading', 'جارٍ التحقق')
            : t('auth.verify_title_ready', 'تأكيد البريد الإلكتروني')}
        </h1>
        <p className="text-sm text-[#94A3B8] leading-7">{message}</p>
        {status === 'ready' && <Button variant="primary" onClick={() => void handleVerify()}>{t('auth.verify_button', 'تأكيد البريد')}</Button>}
        {status === 'success' && <Button variant="primary" onClick={onVerified}>{t('auth.open_console', 'فتح لوحة التحكم')}</Button>}
        <button type="button" onClick={() => onNavigate('/login')} className="text-sm text-[#22D3EE] hover:underline">{t('auth.back_to_login', 'العودة إلى تسجيل الدخول')}</button>
      </div>
    </div>
  );
};
