/**
 * Landing page for "Continue with Google".
 *
 * /auth/google/callback: Google redirects here with ?code&state. The code is posted to the account
 * service once; an existing account opens the dashboard, a new one continues to /register/google.
 * /register/google: the store-details form for a Google-verified email without an ORDIUM account.
 * The verified identity lives in an HttpOnly cookie, so a reload asks the server for it again.
 */
import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { BrandLogo } from '../common/BrandLogo';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { AuthSession, GoogleCallbackResult, GoogleProfile } from '../../lib/api/types';
import { RegisterPage } from './RegisterPage';

export const GOOGLE_CALLBACK_PATH = '/auth/google/callback';
export const GOOGLE_SIGNUP_PATH = '/register/google';

interface GoogleCallbackPageProps {
  path: string;
  onNavigate: (path: string) => void;
  onSignedIn: (session: AuthSession) => void;
}

// The authorization code is single-use. React StrictMode runs effects twice in development, so
// remember the in-flight exchange per code instead of posting it again.
const exchanges = new Map<string, Promise<GoogleCallbackResult>>();

type View =
  | { kind: 'loading' }
  | { kind: 'signup'; profile: GoogleProfile }
  | { kind: 'error'; message: string };

export const GoogleCallbackPage: React.FC<GoogleCallbackPageProps> = ({ path, onNavigate, onSignedIn }) => {
  const { t } = useLanguage();
  const [view, setView] = useState<View>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    const fail = (message: string) => { if (active) setView({ kind: 'error', message }); };
    const showSignup = (profile: GoogleProfile) => {
      if (!active) return;
      try { window.history.replaceState(null, '', GOOGLE_SIGNUP_PATH); } catch { /* Restricted environments. */ }
      setView({ kind: 'signup', profile });
    };

    if (path === GOOGLE_SIGNUP_PATH) {
      authApi.googlePending().then(showSignup).catch(() => fail(t('auth.google.signup_expired', 'Your Google sign-up expired. Continue with Google again to finish creating your account.')));
      return () => { active = false; };
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (params.get('error') || !code || !state) {
      fail(params.get('error') === 'access_denied'
        ? t('auth.google.cancelled', 'Google sign-in was cancelled.')
        : t('auth.google.failed', 'Google sign-in could not be completed. Please try again.'));
      return () => { active = false; };
    }

    let exchange = exchanges.get(code);
    if (!exchange) {
      exchange = authApi.googleCallback(code, state);
      exchanges.set(code, exchange);
    }
    exchange.then(result => {
      if (!active) return;
      if (result.status === 'signed_in' && result.session) onSignedIn(result.session);
      else if (result.status === 'signup_required' && result.profile) showSignup(result.profile);
      else fail(t('auth.google.failed', 'Google sign-in could not be completed. Please try again.'));
    }).catch(err => {
      const status = err instanceof OrdiumApiError ? err.statusCode : -1;
      if (status === 409) fail(/different Google/i.test(err.message)
        ? t('auth.google.linked_elsewhere', 'This email is already linked to a different Google account.')
        : t('auth.google.pending_verification', 'An account with this email is waiting for email verification. Open the verification link we emailed you, or sign in with your password.'));
      else if (status === 403) fail(t('auth.errors.account_inactive', 'Your account is not active yet. Verify your email address first.'));
      else if (status === 429) fail(t('auth.errors.rate_limited', 'Too many attempts. Please try again later.'));
      else fail(t('auth.google.failed', 'Google sign-in could not be completed. Please try again.'));
    });
    return () => { active = false; };
    // Runs once per landing; translations are read at the time of the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (view.kind === 'signup') {
    return <RegisterPage key={view.profile.email} onNavigate={onNavigate} googleProfile={view.profile} onGoogleSignupComplete={onSignedIn} />;
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col py-6 sm:py-8 px-4 sm:px-6">
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3">
        <BrandLogo onClick={() => onNavigate('/')} />
        <LanguageSwitcher variant="dropdown" align="end" />
      </header>
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="ordium-auth-card w-full max-w-md p-6 sm:p-8 text-center">
          {view.kind === 'loading' ? (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
              <span aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-white/10 border-t-[#52D9E8] animate-spin" />
              <span className="text-sm text-[#A5B1C3]">{t('auth.google.verifying', 'Confirming your Google account…')}</span>
            </div>
          ) : (
            <div role="alert" className="space-y-5">
              <AlertCircle aria-hidden="true" className="w-10 h-10 mx-auto text-rose-300" />
              <p className="text-sm text-[#E2E8F0] leading-relaxed">{view.message}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" size="md" onClick={() => onNavigate('/login')}>{t('auth.back_to_login', 'Return to sign in')}</Button>
                <Button variant="outline" size="md" onClick={() => onNavigate('/register')}>{t('auth.create_account', 'Create account')}</Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
