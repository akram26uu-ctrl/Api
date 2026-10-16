/**
 * ORDIUM Professional Authentication: Login Page
 * 
 * Complies strictly with ORDIUM visual identity, Electric Indigo / Signal Cyan accents,
 * localized in English, Arabic (RTL), and French.
 * Integrates directly with authApi typed service layer with safe error handling and no fake localStorage JWTs.
 */

import React, { useState } from 'react';
import { Shield, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, Key, Terminal, ExternalLink, Cpu } from 'lucide-react';
import { Button } from '../common/Button';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { authApi } from '../../lib/api/auth';
import { AuthSession } from '../../lib/api/types';
import { OrdiumApiError } from '../../lib/api/client';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  onLoginSuccess?: (session: AuthSession) => void;
  onLaunchConsole?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
  onLaunchConsole
}) => {
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Form submit handler calling real API client
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRequestId(null);

    // Client-side validations
    if (!email.trim()) {
      setErrorMessage(t('auth.errors.email_required', 'Email address is required.'));
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setErrorMessage(t('auth.errors.email_invalid', 'Please enter a valid work email address.'));
      return;
    }
    if (!password) {
      setErrorMessage(t('auth.errors.password_required', 'Password is required.'));
      return;
    }

    setIsLoading(true);
    let credentialsAccepted = false;
    try {
      await authApi.login({ email, password });
      credentialsAccepted = true;
      // Confirm the browser accepted and sends the HttpOnly session cookie before leaving this form.
      // If cookie/CORS configuration is wrong, keep the form mounted so the user can see the error.
      const session = await authApi.me();
      if (onLoginSuccess) {
        onLoginSuccess(session);
      } else if (onLaunchConsole) {
        onLaunchConsole();
      }
    } catch (err: any) {
      if (credentialsAccepted) {
        setRequestId(err instanceof OrdiumApiError ? err.requestId : `req_${Date.now()}`);
        setErrorMessage(t('auth.errors.session_not_persisted', 'Sign-in was accepted, but the browser session could not be verified. Please try again; if this continues, the account service cookie/CORS configuration needs checking.'));
      } else if (err instanceof OrdiumApiError) {
        setRequestId(err.requestId);
        if (err.statusCode === 401) {
          setErrorMessage(t('auth.errors.invalid_credentials', 'Invalid email or password.'));
        } else if (err.statusCode === 429) {
          setErrorMessage(t('auth.errors.rate_limited', 'Too many attempts. Please try again later.'));
        } else {
          setErrorMessage(err.message || t('auth.errors.server_error', 'Something went wrong. Please try again.'));
        }
      } else {
        setRequestId(`req_${Date.now()}`);
        setErrorMessage(t('auth.errors.server_error', 'Something went wrong. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#6C5CE7]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#22D3EE]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0D1320] border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-[#22D3EE]/50 transition-colors">
            <Cpu className="w-4 h-4 text-[#22D3EE]" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-base font-extrabold tracking-wider text-white">ORDIUM</span>
            <span className="text-[9px] font-mono tracking-widest text-[#22D3EE] uppercase -mt-1">
              {t('brand.tagline', 'Risk Intelligence')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            onClick={() => onNavigate('/')}
            className="text-xs text-[#94A3B8] hover:text-white flex items-center gap-1.5 font-mono px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/15 bg-[#0D1320] transition-colors"
          >
            <span>{t('nav.website', 'Website')}</span>
          </button>
          <div className="flex items-center ps-2.5 sm:ps-3 border-s border-white/10 shrink-0">
            <LanguageSwitcher variant="dropdown" align="end" />
          </div>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="w-full max-w-md mx-auto my-8 z-10">
        <div className="bg-[#0D1320] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
          
          {/* Subtle Top Accent Bar */}
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-[#22D3EE]/50 to-transparent" />

          {/* Title Header */}
          <div className="text-center mb-6 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#6C5CE7]/30 to-[#22D3EE]/20 border border-white/10 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5 text-[#22D3EE]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {t('auth.login_title', 'Sign in to ORDIUM')}
            </h1>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {t('auth.login_subtitle', 'Access your fraud intelligence cluster, live order streams, and API keys.')}
            </p>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#FCA5A5] flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="leading-relaxed">{errorMessage}</p>
                {requestId && (
                  <p className="font-mono text-[10px] text-[#EF4444]/80">
                    {t('common.reference_id', 'Reference ID')}: {requestId}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-medium text-[#94A3B8] text-start">
                {t('auth.email_label', 'Work Email')}
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none text-[#64748B]`}>
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('auth.email_placeholder', 'analyst@company.com')}
                  disabled={isLoading}
                  autoComplete="email"
                  className={`w-full bg-[#080B12] border border-white/10 rounded-xl ${
                    isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
                  } py-2.5 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#22D3EE] transition-colors`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-medium text-[#94A3B8]">
                  {t('auth.password_label', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-mono text-[#22D3EE] hover:underline"
                >
                  {t('auth.forgot_password', 'Forgot password?')}
                </button>
              </div>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none text-[#64748B]`}>
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('auth.password_placeholder', '••••••••••••')}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className={`w-full bg-[#080B12] border border-white/10 rounded-xl ${
                    isRTL ? 'pr-9 pl-10 text-right' : 'pl-9 pr-10 text-left'
                  } py-2.5 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#22D3EE] transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center text-[#64748B] hover:text-white`}
                  aria-label={showPassword ? t('auth.hide_password', 'Hide password') : t('auth.show_password', 'Show password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center mt-2"
              isLoading={isLoading}
              disabled={isLoading}
              rightIcon={<ArrowIcon className="w-4 h-4" />}
            >
              {isLoading ? t('auth.signing_in', 'Authenticating...') : t('auth.sign_in_btn', 'Sign In')}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative px-3 bg-[#0D1320] text-[11px] font-mono text-[#64748B]">
              OR
            </span>
          </div>

          {/* Merchant API Key Direct Entry Notice */}
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
              <Key className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>{t('auth.api_key_access', 'Merchant API Key Access')}</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              {t('auth.api_key_access_desc', 'للتكامل البرمجي، استخدم مفاتيح API الخاصة بالمتجر من لوحة التحكم.')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onLaunchConsole}
              className="w-full justify-center text-xs"
              leftIcon={<Terminal className="w-3.5 h-3.5 text-[#22D3EE]" />}
            >
              {t('auth.launch_sandbox_direct', 'فتح المحاكي')}
            </Button>
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 text-center text-xs text-[#94A3B8]">
            <span>{t('auth.no_account', "Don't have an account?")} </span>
            <button
              onClick={() => onNavigate('/register')}
              className="text-[#22D3EE] font-bold hover:underline"
            >
              {t('auth.create_account', 'Create account')}
            </button>
          </div>

        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-md w-full mx-auto text-center text-[11px] text-[#64748B] font-mono z-10">
        <span>© 2026 ORDIUM Risk Intelligence. All rights reserved.</span>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0D1320] border border-white/15 rounded-2xl max-w-sm w-full p-6 space-y-4 text-start">
            <div className="w-10 h-10 rounded-xl bg-[#6C5CE7]/20 border border-[#6C5CE7]/40 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#22D3EE]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {t('auth.forgot_password_title', 'Password Reset')}
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                {t('auth.forgot_password_desc', "Account recovery is managed by your organization's ORDIUM administrator or via security key verification.")}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForgotModal(false)}
              className="w-full justify-center"
            >
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
};
