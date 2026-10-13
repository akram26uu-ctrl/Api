import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { useLanguage } from '../../i18n/LanguageContext';

interface VerifyEmailPageProps { token: string; onNavigate: (path: string) => void; onVerified: () => void; }

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ token, onNavigate, onVerified }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>(token ? 'ready' : 'error');
  const [message, setMessage] = useState(token
    ? t('auth.verify_ready', 'اضغط على الزر أدناه لتأكيد بريدك وتفعيل حساب ORDIUM.')
    : t('auth.verify_missing_token', 'رابط التحقق لا يحتوي على رمز صالح. يمكنك طلب رابط جديد أدناه.'));
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState(false);

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

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    setResendMessage('');
    setResendError(false);
    setResending(true);
    try {
      const result = await authApi.resendVerification(email.trim());
      setResendMessage(result.message || t('auth.resend_generic', 'إذا كان الحساب بحاجة إلى التحقق، فسيتم إرسال رسالة جديدة.'));
    } catch (error) {
      setResendError(true);
      setResendMessage(error instanceof OrdiumApiError
        ? error.message
        : t('auth.resend_error', 'تعذر إرسال الرسالة الآن. حاول لاحقًا.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[#0D1320] border border-white/10 rounded-2xl p-8 text-center space-y-5">
        {status === 'ready' && <MailCheck className="w-12 h-12 text-[#22D3EE] mx-auto" />}
        {status === 'loading' && <Loader2 className="w-10 h-10 text-[#22D3EE] mx-auto animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto" />}
        {status === 'error' && <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto" />}
        <p className="text-xs font-mono tracking-[0.25em] text-[#22D3EE]">ORDIUM / ACCOUNT SECURITY</p>
        <h1 className="text-xl font-bold">
          {status === 'success' ? 'تم تأكيد البريد' : status === 'error' ? 'تعذر التحقق' : status === 'loading' ? 'جارٍ التحقق' : 'تأكيد البريد الإلكتروني'}
        </h1>
        <p className="text-sm text-[#94A3B8] leading-7">{message}</p>
        {status === 'ready' && <Button variant="primary" onClick={() => void handleVerify()}>{t('auth.verify_button', 'تأكيد البريد')}</Button>}
        {status === 'success' && <Button variant="primary" onClick={onVerified}>{t('auth.open_console', 'فتح لوحة التحكم')}</Button>}
        <div className="border-t border-white/10 pt-5 mt-2 text-right space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">لم يصلك رابط التحقق أو انتهت صلاحيته؟</h2>
            <p className="text-xs text-[#94A3B8] mt-1 leading-6">يمكنك طلب رابط جديد كل دقيقتين، بحد أقصى 5 مرات خلال 4 ساعات.</p>
          </div>
          <form onSubmit={(event) => void handleResend(event)} className="space-y-3">
            <label htmlFor="resend-email" className="block text-xs text-[#94A3B8]">البريد الإلكتروني المسجل</label>
            <input id="resend-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full rounded-xl bg-[#080B12] border border-white/10 px-3 py-3 text-sm text-white text-left" dir="ltr" />
            <button type="submit" disabled={resending} className="w-full rounded-xl bg-[#22D3EE] px-4 py-3 text-sm font-bold text-[#061018] disabled:opacity-50">{resending ? 'جارٍ الإرسال…' : <><RefreshCw className="inline w-4 h-4 ml-2" />إعادة إرسال رابط التحقق</>}</button>
          </form>
          {resendMessage && <p role="status" className={`text-xs leading-6 ${resendError ? 'text-red-300' : 'text-emerald-300'}`}>{resendMessage}</p>}
        </div>
        <button type="button" onClick={() => onNavigate('/login')} className="text-sm text-[#22D3EE] hover:underline">العودة إلى تسجيل الدخول</button>
      </div>
    </div>
  );
};
