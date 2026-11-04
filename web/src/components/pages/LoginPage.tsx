/**
 * ORDIUM Professional Authentication: Login Page
 *
 * Localized in Arabic (RTL), English and French. Uses the typed authApi service layer
 * and the HttpOnly session cookie issued by the Control Plane (no tokens in localStorage).
 */

import React, { useId, useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { BrandLogo } from '../common/BrandLogo';
import { FormAlert } from '../common/FormAlert';
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

type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onLoginSuccess, onLaunchConsole }) => {
  const { t, isRTL } = useLanguage();
  const ids = useId();
  const emailId = `${ids}-email`;
  const passwordId = `${ids}-password`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [showForgotModal, setShowForgotModal] = useState(false);
  // Why the user landed here: set by the app when a session expires or ends in another tab.
  const [sessionNotice] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('session'); } catch { return null; }
  });

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = t('auth.errors.email_required', 'Email address is required.');
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = t('auth.errors.email_invalid', 'Please enter a valid work email address.');
    if (!password) errors.password = t('auth.errors.password_required', 'Password is required.');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitCount(count => count + 1);
    setErrorMessage(null);
    setRequestId(null);

    const errors = validate();
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      setErrorMessage(t('ui.form_has_errors', 'Please correct the highlighted fields.'));
      return;
    }

    setIsLoading(true);
    let credentialsAccepted = false;
    try {
      await authApi.login({ email: email.trim(), password });
      credentialsAccepted = true;
      // Confirm the browser stored and sends the HttpOnly session cookie before leaving the form.
      const session = await authApi.me();
      if (onLoginSuccess) onLoginSuccess(session);
      else onLaunchConsole?.();
    } catch (err: unknown) {
      const apiError = err instanceof OrdiumApiError ? err : null;
      setRequestId(apiError?.requestId || null);

      if (credentialsAccepted) {
        // Report the failure mode accurately so a server error is not misdiagnosed as a cookie issue.
        let diagnostic = t('auth.errors.session_not_persisted', 'Sign-in was accepted, but the browser session could not be verified.');
        if (apiError?.statusCode === 401) {
          diagnostic = t('auth.errors.session_cookie_missing', 'The account service did not receive a valid session cookie after sign-in (HTTP 401). The session cookie may not have been stored or sent by the browser.');
        } else if (apiError?.statusCode === 403) {
          diagnostic = t('auth.errors.session_forbidden', 'The account service rejected this session (HTTP 403). Check the account status and session authorization.');
        } else if (!apiError || apiError.statusCode === 0) {
          diagnostic = t('auth.errors.session_network', 'Sign-in succeeded, but the session check could not reach the account service. This can indicate a network or CORS failure.');
        } else if (apiError.statusCode === 404) {
          diagnostic = t('auth.errors.session_endpoint_missing', 'Sign-in succeeded, but the deployed account service does not provide the session verification endpoint (HTTP 404).');
        } else if (apiError.statusCode >= 500) {
          diagnostic = t('auth.errors.session_server_error', 'Sign-in succeeded, but the account service failed while verifying the session.');
        } else if (apiError.message) {
          diagnostic = apiError.message;
        }
        setErrorMessage(diagnostic);
      } else if (apiError) {
        if (apiError.statusCode === 401) setErrorMessage(t('auth.errors.invalid_credentials', 'Invalid email or password.'));
        // 403 covers several cases (inactive account, blocked origin); only the inactive case gets the localized hint.
        else if (apiError.statusCode === 403 && /not active|verify your email/i.test(apiError.message)) setErrorMessage(t('auth.errors.account_inactive', 'Your account is not active yet. Verify your email address first.'));
        else if (apiError.statusCode === 429 && /this account/i.test(apiError.message)) setErrorMessage(t('auth.account_locked', 'Too many failed attempts for this account. Wait 15 minutes, then try again.'));
        else if (apiError.statusCode === 429) setErrorMessage(t('auth.errors.rate_limited', 'Too many attempts. Please try again later.'));
        else if (apiError.statusCode === 0) setErrorMessage(t('auth.errors.network', 'Unable to reach ORDIUM. Check your connection and try again.'));
        else setErrorMessage(apiError.message || t('auth.errors.server_error', 'Something went wrong. Please try again.'));
      } else {
        setErrorMessage(t('auth.errors.server_error', 'Something went wrong. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col py-6 sm:py-8 px-4 sm:px-6 relative overflow-hidden">
      <div aria-hidden="true" className="absolute top-1/4 -start-32 w-96 h-96 bg-[#6C5CE7]/15 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute bottom-1/4 -end-32 w-96 h-96 bg-[#22D3EE]/10 rounded-full blur-3xl pointer-events-none" />

      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 z-10">
        <BrandLogo onClick={() => onNavigate('/')} />
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="hidden sm:inline-flex items-center min-h-10 text-sm text-[#A5B1C3] hover:text-white px-3 rounded-lg border border-white/10 hover:border-white/20 bg-[#0D1320] transition-colors"
          >
            {t('nav.website', 'Website')}
          </button>
          <div className="flex items-center sm:ps-3 sm:border-s border-white/10 shrink-0">
            <LanguageSwitcher variant="dropdown" align="end" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center z-10 py-8">
        <div className="w-full max-w-md">
          <div className="ordium-auth-card p-6 sm:p-8">
            <div className="text-center mb-7 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#6C5CE7]/30 to-[#22D3EE]/20 border border-white/10 flex items-center justify-center mb-4">
                <Lock aria-hidden="true" className="w-5 h-5 text-[#22D3EE]" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{t('auth.login_title', 'Sign in to ORDIUM')}</h1>
              <p className="text-sm text-[#A5B1C3] leading-relaxed">
                {t('mkt.auth.login_subtitle', 'سجّل الدخول لمتابعة طلبات متجرك وتأكيدها.')}
              </p>
            </div>

            {sessionNotice && !errorMessage && (
              <p role="status" className="mb-5 rounded-xl border border-[#52D9E8]/25 bg-[#52D9E8]/[0.06] p-3.5 text-sm leading-relaxed text-[#CFF6FA]">
                {sessionNotice === 'signed_out'
                  ? t('auth.session_signed_out', 'You signed out in another tab. Sign in again to continue.')
                  : t('auth.session_expired', 'Your session has ended for your security. Sign in again to continue where you left off.')}
              </p>
            )}
            <div className="mb-5">
              <FormAlert message={errorMessage} requestId={requestId} focusKey={submitCount} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor={emailId} className="ordium-label">{t('auth.email_label', 'Work Email')}</label>
                <div className="relative" dir="ltr">
                  <span className="ordium-input-icon"><Mail aria-hidden="true" className="w-4 h-4" /></span>
                  <input
                    id={emailId}
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined })); }}
                    placeholder={t('auth.email_placeholder', 'analyst@company.com')}
                    disabled={isLoading}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
                    className="ordium-input has-leading-icon placeholder:!text-[var(--ordium-subtle)]"
                  />
                </div>
                {fieldErrors.email && <p id={`${emailId}-error`} className="ordium-field-error">{fieldErrors.email}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <label htmlFor={passwordId} className="ordium-label !mb-0">{t('auth.password_label', 'Password')}</label>
                  <button type="button" onClick={() => setShowForgotModal(true)} className="text-xs font-medium text-[#52D9E8] hover:underline">
                    {t('auth.forgot_password', 'Forgot password?')}
                  </button>
                </div>
                <div className="relative" dir="ltr">
                  <span className="ordium-input-icon"><Lock aria-hidden="true" className="w-4 h-4" /></span>
                  <input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined })); }}
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
                    className="ordium-input has-leading-icon has-trailing-action placeholder:!text-[var(--ordium-subtle)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="ordium-input-action"
                    aria-label={showPassword ? t('auth.hide_password', 'Hide password') : t('auth.show_password', 'Show password')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p id={`${passwordId}-error`} className="ordium-field-error">{fieldErrors.password}</p>}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center"
                isLoading={isLoading}
                rightIcon={<ArrowIcon aria-hidden="true" className="w-4 h-4" />}
              >
                {isLoading ? t('auth.signing_in', 'Authenticating...') : t('auth.sign_in_btn', 'Sign In')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-[#A5B1C3]">
              {t('auth.no_account', "Don't have an account?")}{' '}
              <button type="button" onClick={() => onNavigate('/register')} className="text-[#52D9E8] font-semibold hover:underline">
                {t('auth.create_account', 'Create account')}
              </button>
            </p>
          </div>

          {/* Developer access is documentation only; merchants always sign in with email and password. */}
          <p className="mt-5 text-center">
            <button type="button" onClick={() => onNavigate('/docs')} className="min-h-10 text-sm text-[var(--ordium-subtle)] hover:text-white hover:underline">
              {t('mkt.auth.dev_link', 'للمطورين: توثيق API')}
            </button>
          </p>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center text-xs text-[var(--ordium-subtle)] z-10">
        © {new Date().getFullYear()} ORDIUM. {t('footer.all_rights', 'All rights reserved.')}
      </footer>

      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title={t('auth.forgot_password_title', 'Password Reset')}
        description={t('auth.forgot_password_desc', "Account recovery is managed by your organization's ORDIUM administrator or via security key verification.")}
        maxWidth="sm"
      >
        <Button variant="primary" size="md" onClick={() => setShowForgotModal(false)} className="w-full justify-center">
          {t('common.close', 'Close')}
        </Button>
      </Modal>
    </div>
  );
};
