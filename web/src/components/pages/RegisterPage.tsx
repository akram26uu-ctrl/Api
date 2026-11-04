/**
 * ORDIUM Professional Authentication: Registration Page
 *
 * - Grouped sections: Account, Business, E-Commerce, Contact & Security
 * - Algerian market localization: 58 Wilayas, localized names, phone prefix (+213)
 * - Password strength meter aligned with the enforced password policy
 * - Connects to the typed authApi.register (no mock authentication, no tokens in localStorage)
 * - Fully responsive with RTL support for Arabic, French, and English
 */

import React, { useId, useMemo, useState } from 'react';
import {
  Shield, Lock, Mail, Building2, User, Phone, Globe, ShoppingBag,
  CheckCircle2, ArrowRight, ArrowLeft, Eye, EyeOff, Info, RefreshCw, MapPin, Check, X
} from 'lucide-react';
import { Button } from '../common/Button';
import { BrandLogo } from '../common/BrandLogo';
import { FormAlert } from '../common/FormAlert';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from '../marketing/Bidi';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import { ALGERIAN_WILAYAS, ECOMMERCE_PLATFORMS, MONTHLY_VOLUME_OPTIONS, BUSINESS_TYPES } from '../../lib/algeriaData';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
  onLaunchConsole?: () => void;
}

type FieldName = 'firstName' | 'lastName' | 'email' | 'organization' | 'password' | 'confirmPassword' | 'terms';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Declared at module scope: defining these inside the page would remount every input on each keystroke.
const Section: React.FC<{ step: number; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ step, icon, title, children }) => (
  <fieldset className="space-y-4 min-w-0">
    <legend className="ordium-section-title w-full mb-4">
      <span className="ordium-step-badge" aria-hidden="true">{step}</span>
      <span aria-hidden="true" className="text-[#22D3EE]">{icon}</span>
      <span>{title}</span>
    </legend>
    {children}
  </fieldset>
);

const FieldLabel: React.FC<{ htmlFor: string; required?: boolean; children: React.ReactNode }> = ({ htmlFor, required, children }) => (
  <label htmlFor={htmlFor} className="ordium-label">
    {children}
    {required && <span className="ordium-required" aria-hidden="true">*</span>}
  </label>
);

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate, onLaunchConsole }) => {
  const { t, language, isRTL } = useLanguage();
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [businessType, setBusinessType] = useState('direct_ecommerce');
  const [wilaya, setWilaya] = useState('');
  const [city, setCity] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [platform, setPlatform] = useState('shopify');
  const [monthlyVolume, setMonthlyVolume] = useState('100_500');
  const [primaryMarket, setPrimaryMarket] = useState('market_algeria');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<FieldName | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationResendMessage, setVerificationResendMessage] = useState('');
  const [verificationResendError, setVerificationResendError] = useState(false);

  // The same rules the submit handler enforces, shown live as a checklist.
  const passwordRules = useMemo(() => [
    { id: 'length', ok: password.length >= 12, label: t('auth.rule_length', 'At least 12 characters') },
    { id: 'upper', ok: /[A-Z]/.test(password), label: t('auth.rule_upper', 'One uppercase letter') },
    { id: 'lower', ok: /[a-z]/.test(password), label: t('auth.rule_lower', 'One lowercase letter') },
    { id: 'digit', ok: /[0-9]/.test(password), label: t('auth.rule_digit', 'One number') },
  ], [password, t]);
  const meetsPolicy = passwordRules.every(rule => rule.ok);

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = passwordRules.filter(rule => rule.ok).length; // 0-4
    if (meetsPolicy && (password.length >= 16 || /[^A-Za-z0-9]/.test(password))) score += 1;
    return score; // 0-5
  }, [password, passwordRules, meetsPolicy]);

  const strength = (() => {
    if (!meetsPolicy) {
      return passwordStrength <= 2
        ? { label: t('auth.strength_weak', 'Weak'), color: 'bg-rose-500', text: 'text-rose-300' }
        : { label: t('auth.strength_fair', 'Fair'), color: 'bg-amber-500', text: 'text-amber-300' };
    }
    return passwordStrength >= 5
      ? { label: t('auth.strength_very_strong', 'Very Strong'), color: 'bg-emerald-500', text: 'text-emerald-300' }
      : { label: t('auth.strength_strong', 'Strong'), color: 'bg-[#22D3EE]', text: 'text-[#52D9E8]' };
  })();

  const fail = (field: FieldName, message: string) => {
    setErrorField(field);
    setErrorMessage(message);
    window.setTimeout(() => document.getElementById(fid(field))?.focus({ preventScroll: false }), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitCount(count => count + 1);
    setErrorMessage(null);
    setErrorField(null);
    setRequestId(null);

    if (!firstName.trim()) return fail('firstName', t('auth.errors.first_name_required', 'First name is required.'));
    if (!lastName.trim()) return fail('lastName', t('auth.errors.last_name_required', 'Last name is required.'));
    if (!email.trim()) return fail('email', t('auth.errors.email_required', 'Email address is required.'));
    if (!EMAIL_PATTERN.test(email.trim())) return fail('email', t('auth.errors.email_invalid', 'Please enter a valid work email address.'));
    if (!organization.trim()) return fail('organization', t('auth.errors.organization_required', 'Store or company name is required.'));
    if (!password) return fail('password', t('auth.errors.password_required', 'Password is required.'));
    if (!meetsPolicy) return fail('password', t('auth.errors.password_policy', 'Password must be at least 12 characters and include uppercase, lowercase, and numeric characters.'));
    if (password !== confirmPassword) return fail('confirmPassword', t('auth.errors.password_mismatch', 'Passwords do not match.'));
    if (!agreedToTerms) return fail('terms', t('auth.errors.terms_required', 'You must accept the Terms of Service and Privacy Policy to continue.'));

    setIsLoading(true);
    try {
      const session = await authApi.register({
        email: email.trim(),
        password,
        organization: organization.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone ? `+213${phone.replace(/\D/g, '')}` : undefined,
        country: 'Algeria',
        wilaya: wilaya || undefined,
        city: city.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        business_type: businessType,
        ecommerce_platform: platform,
        monthly_orders: monthlyVolume,
        primary_market: primaryMarket,
      });
      setVerificationRequired(Boolean(session.verification_required));
      setIsSuccess(true);
      window.scrollTo({ top: 0 });
    } catch (err: unknown) {
      if (err instanceof OrdiumApiError) {
        setRequestId(err.requestId || null);
        if (err.statusCode === 409) fail('email', t('auth.errors.conflict_email', 'An account with this email address already exists.'));
        else if (err.statusCode === 429) setErrorMessage(t('auth.errors.rate_limited', 'Too many attempts. Please try again later.'));
        else if (err.statusCode === 0) setErrorMessage(t('auth.errors.network', 'Unable to reach ORDIUM. Check your connection and try again.'));
        else setErrorMessage(err.message || t('auth.errors.server_error', 'Something went wrong. Please try again.'));
      } else {
        setErrorMessage(t('auth.errors.server_error', 'Something went wrong. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || isResendingVerification) return;
    setIsResendingVerification(true);
    setVerificationResendMessage('');
    setVerificationResendError(false);
    try {
      await authApi.resendVerification(email.trim());
      // The server reply is a deliberately generic English sentence; show its localized equivalent.
      setVerificationResendMessage(t('auth.resend_generic', 'If the account still needs verification, a new message will be sent.'));
    } catch (err) {
      setVerificationResendError(true);
      setVerificationResendMessage(err instanceof OrdiumApiError ? err.message : t('auth.resend_error', 'The message could not be sent right now. Please try again later.'));
    } finally {
      setIsResendingVerification(false);
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const invalid = (field: FieldName) => (errorField === field ? true : undefined);
  const clearErrorFor = (field: FieldName) => { if (errorField === field) { setErrorField(null); setErrorMessage(null); } };

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col py-6 sm:py-8 px-4 sm:px-6 relative overflow-hidden">
      <div aria-hidden="true" className="absolute top-1/4 -end-32 w-96 h-96 bg-[#6C5CE7]/15 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute bottom-1/4 -start-32 w-96 h-96 bg-[#22D3EE]/10 rounded-full blur-3xl pointer-events-none" />

      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3 z-10 mb-6">
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

      <main className="w-full max-w-3xl mx-auto my-4 z-10 flex-1">
        <div className="ordium-auth-card p-5 sm:p-10">
          <div className="text-center mb-8 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#6C5CE7]/30 to-[#22D3EE]/20 border border-white/10 flex items-center justify-center mb-4">
              <Shield aria-hidden="true" className="w-6 h-6 text-[#22D3EE]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {t('auth.register_title', 'Create your ORDIUM Account')}
            </h1>
            <p className="text-sm text-[#A5B1C3] max-w-xl mx-auto leading-relaxed">
              {t('auth.register_subtitle', 'Deploy deterministic order risk intelligence and protect your e-commerce operations.')}
            </p>
          </div>

          {isSuccess ? (
            <div className="py-6 text-center space-y-6 animate-in zoom-in-95" role="status">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 aria-hidden="true" className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">
                  {verificationRequired ? t('auth.registration_verification_title', 'Verify Your Email') : t('auth.registration_success_title', 'Account Provisioned Successfully')}
                </h2>
                <p className="text-sm text-[#A5B1C3] max-w-md mx-auto leading-relaxed">
                  {verificationRequired
                    ? t('auth.registration_verification_desc', 'Your account was created securely. Check your email and follow the verification link before signing in.')
                    : t('auth.registration_success_desc', 'Your ORDIUM workspace is ready. Open the Simulator to validate your integration before live traffic.')}
                </p>
              </div>

              <dl className="p-4 rounded-xl bg-white/[0.03] border border-white/10 max-w-md mx-auto text-start space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A5B1C3]">{t('auth.summary_merchant', 'Merchant')}</dt>
                  <dd className="text-white font-semibold truncate">{organization}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A5B1C3]">{t('auth.summary_email', 'Email')}</dt>
                  <dd dir="ltr" className="text-white font-mono truncate">{email}</dd>
                </div>
                {!verificationRequired && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A5B1C3]">{t('auth.workspace_status_label', 'Status')}</dt>
                    <dd className="text-emerald-300">{t('auth.workspace_status_ready', 'Workspace ready')}</dd>
                  </div>
                )}
              </dl>

              {verificationRequired && (
                <div className="max-w-md mx-auto w-full space-y-3 rounded-xl border border-[#22D3EE]/20 bg-[#22D3EE]/5 p-4 text-start">
                  <p className="text-sm font-semibold text-white">{t('auth.resend_title', "Didn't receive the verification link?")}</p>
                  <p className="text-sm leading-6 text-[#A5B1C3]">
                    {t('auth.resend_desc', 'You can resend the verification link to the email address you used to create the account:')}{' '}
                    <span dir="ltr" className="font-mono text-white break-all">{email}</span>
                  </p>
                  <Button type="button" variant="outline" className="w-full" isLoading={isResendingVerification} onClick={() => void handleResendVerification()} leftIcon={<RefreshCw aria-hidden="true" className="w-4 h-4" />}>
                    {isResendingVerification ? t('auth.resend_sending', 'Sending the link…') : t('auth.resend_button', 'Resend verification link')}
                  </Button>
                  {verificationResendMessage && (
                    <p role="status" aria-live="polite" className={`text-sm leading-6 ${verificationResendError ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {verificationResendMessage}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {!verificationRequired && (
                  <Button variant="primary" size="md" onClick={() => (onLaunchConsole ? onLaunchConsole() : onNavigate('/'))} rightIcon={<ArrowIcon aria-hidden="true" className="w-4 h-4" />}>
                    {t('auth.launch_sandbox_direct', 'Open simulator')}
                  </Button>
                )}
                <Button variant="outline" size="md" onClick={() => onNavigate('/login')}>
                  {t('auth.back_to_login', 'Return to sign in')}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-9" noValidate>
              <FormAlert message={errorMessage} requestId={requestId} focusKey={errorField ? undefined : submitCount} />

              <p className="text-xs text-[#A5B1C3] text-start">
                <span className="text-[#52D9E8]" aria-hidden="true">*</span> {t('ui.required_fields', 'Required fields')}
              </p>

              {/* Group 1: Account credentials */}
              <Section step={1} icon={<User className="w-4 h-4" />} title={t('auth.step_account', 'Account Credentials')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor={fid('firstName')} required>{t('auth.first_name_label', 'First Name')}</FieldLabel>
                    <input id={fid('firstName')} type="text" required autoComplete="given-name" value={firstName}
                      onChange={e => { setFirstName(e.target.value); clearErrorFor('firstName'); }}
                      placeholder={t('auth.first_name_placeholder', 'Karim')} aria-invalid={invalid('firstName')} className="ordium-input placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={fid('lastName')} required>{t('auth.last_name_label', 'Last Name')}</FieldLabel>
                    <input id={fid('lastName')} type="text" required autoComplete="family-name" value={lastName}
                      onChange={e => { setLastName(e.target.value); clearErrorFor('lastName'); }}
                      placeholder={t('auth.last_name_placeholder', 'Bensalem')} aria-invalid={invalid('lastName')} className="ordium-input placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor={fid('email')} required>{t('auth.email_label', 'Work Email')}</FieldLabel>
                  <div className="relative" dir="ltr">
                    <span className="ordium-input-icon placeholder:!text-[var(--ordium-subtle)]"><Mail aria-hidden="true" className="w-4 h-4" /></span>
                    <input id={fid('email')} type="email" inputMode="email" required autoComplete="email" autoCapitalize="none" spellCheck={false}
                      value={email} onChange={e => { setEmail(e.target.value); clearErrorFor('email'); }}
                      placeholder={t('auth.email_placeholder', 'karim@store.dz')} aria-invalid={invalid('email')}
                      className="ordium-input has-leading-icon font-mono placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor={fid('password')} required>{t('auth.password_label', 'Password')}</FieldLabel>
                    <div className="relative" dir="ltr">
                      <span className="ordium-input-icon placeholder:!text-[var(--ordium-subtle)]"><Lock aria-hidden="true" className="w-4 h-4" /></span>
                      <input id={fid('password')} type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                        value={password} onChange={e => { setPassword(e.target.value); clearErrorFor('password'); }}
                        placeholder="••••••••••••" aria-invalid={invalid('password')} aria-describedby={fid('password-rules')}
                        className="ordium-input has-leading-icon has-trailing-action font-mono placeholder:!text-[var(--ordium-subtle)]" />
                      <button type="button" onClick={() => setShowPassword(value => !value)} className="ordium-input-action placeholder:!text-[var(--ordium-subtle)]"
                        aria-label={showPassword ? t('auth.hide_password', 'Hide password') : t('auth.show_password', 'Show password')} aria-pressed={showPassword}>
                        {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor={fid('confirmPassword')} required>{t('auth.confirm_password_label', 'Confirm Password')}</FieldLabel>
                    <div className="relative" dir="ltr">
                      <span className="ordium-input-icon placeholder:!text-[var(--ordium-subtle)]"><Lock aria-hidden="true" className="w-4 h-4" /></span>
                      <input id={fid('confirmPassword')} type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                        value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearErrorFor('confirmPassword'); }}
                        placeholder="••••••••••••" aria-invalid={invalid('confirmPassword')}
                        className="ordium-input has-leading-icon font-mono placeholder:!text-[var(--ordium-subtle)]" />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="ordium-field-error">{t('auth.errors.password_mismatch', 'Passwords do not match.')}</p>
                    )}
                  </div>
                </div>

                <div id={fid('password-rules')} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-3">
                  {password && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#A5B1C3]">{t('auth.password_strength', 'Password Strength')}</span>
                        <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 h-1.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map(level => (
                          <div key={level} className={`h-full rounded-full transition-colors ${passwordStrength >= level ? strength.color : 'bg-white/[0.07]'}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {passwordRules.map(rule => (
                      <li key={rule.id} className={`flex items-center gap-2 ${rule.ok ? 'text-emerald-300' : 'text-[#A5B1C3]'}`}>
                        {rule.ok ? <Check aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> : <X aria-hidden="true" className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                        <span>{rule.label}</span>
                        <span className="sr-only">{rule.ok ? t('ui.rule_met', '(met)') : t('ui.rule_unmet', '(not met)')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              {/* Group 2: Business & regional identity */}
              <Section step={2} icon={<Building2 className="w-4 h-4" />} title={t('auth.step_business', 'Business & Regional Identity')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor={fid('organization')} required>{t('auth.organization_label', 'Company / Store Name')}</FieldLabel>
                    <input id={fid('organization')} type="text" required autoComplete="organization" value={organization}
                      onChange={e => { setOrganization(e.target.value); clearErrorFor('organization'); }}
                      placeholder={t('auth.organization_placeholder', 'Atlas Retail Store')} aria-invalid={invalid('organization')} className="ordium-input placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={fid('businessType')}>{t('auth.business_type_label', 'Business Type')}</FieldLabel>
                    <select id={fid('businessType')} value={businessType} onChange={e => setBusinessType(e.target.value)} className="ordium-input placeholder:!text-[var(--ordium-subtle)]">
                      {BUSINESS_TYPES.map(bt => (
                        <option key={bt.id} value={bt.id}>{language === 'ar' ? bt.labelAr : language === 'fr' ? bt.labelFr : bt.labelEn}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="ordium-label">{t('auth.country_label', 'Country')}</span>
                    <div className="ordium-input flex items-center gap-2 text-[#A5B1C3] placeholder:!text-[var(--ordium-subtle)]" aria-readonly="true">
                      <MapPin aria-hidden="true" className="w-4 h-4 text-[#22D3EE] shrink-0" />
                      <span>{t('auth.country_algeria', 'Algeria (الجزائر)')}</span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor={fid('wilaya')}>{t('auth.wilaya_label', 'Wilaya / Province')}</FieldLabel>
                    <select id={fid('wilaya')} value={wilaya} onChange={e => setWilaya(e.target.value)} className="ordium-input placeholder:!text-[var(--ordium-subtle)]">
                      <option value="">{t('auth.wilaya_placeholder', 'Select your Wilaya')}</option>
                      {ALGERIAN_WILAYAS.map(w => (
                        <option key={w.code} value={`${w.code} - ${w.nameEn}`}>
                          {w.code}. {language === 'ar' ? w.nameAr : language === 'fr' ? w.nameFr : w.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor={fid('city')}>{t('auth.city_label', 'City / Commune')}</FieldLabel>
                    <input id={fid('city')} type="text" autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)}
                      placeholder={t('auth.city_placeholder', "e.g. Sidi M'Hamed, Oran")} className="ordium-input placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor={fid('website')}>{t('auth.website_label', 'Store Website / URL')}</FieldLabel>
                  <div className="relative" dir="ltr">
                    <span className="ordium-input-icon placeholder:!text-[var(--ordium-subtle)]"><Globe aria-hidden="true" className="w-4 h-4" /></span>
                    <input id={fid('website')} type="url" inputMode="url" autoComplete="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                      placeholder={t('auth.website_placeholder', 'https://www.yourstore.dz')} className="ordium-input has-leading-icon font-mono placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                </div>
              </Section>

              {/* Group 3: E-commerce */}
              <Section step={3} icon={<ShoppingBag className="w-4 h-4" />} title={t('auth.step_ecommerce', 'E-Commerce Infrastructure')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor={fid('platform')}>{t('auth.platform_label', 'Primary E-Commerce Platform')}</FieldLabel>
                    <select id={fid('platform')} value={platform} onChange={e => setPlatform(e.target.value)} className="ordium-input placeholder:!text-[var(--ordium-subtle)]">
                      {ECOMMERCE_PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor={fid('volume')}>{t('auth.volume_label', 'Monthly Order Volume')}</FieldLabel>
                    <select id={fid('volume')} value={monthlyVolume} onChange={e => setMonthlyVolume(e.target.value)} className="ordium-input placeholder:!text-[var(--ordium-subtle)]">
                      {MONTHLY_VOLUME_OPTIONS.map(v => (
                        <option key={v.id} value={v.id}>{language === 'ar' ? v.labelAr : language === 'fr' ? v.labelFr : v.labelEn}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div role="radiogroup" aria-labelledby={fid('market-label')}>
                  <span id={fid('market-label')} className="ordium-label">{t('auth.market_label', 'Primary Sales Market')}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'market_algeria', labelKey: 'auth.market_algeria', defaultText: 'Algeria Domestic (National COD & Pre-paid)' },
                      { id: 'market_regional', labelKey: 'auth.market_regional', defaultText: 'Maghreb / North Africa' },
                      { id: 'market_international', labelKey: 'auth.market_international', defaultText: 'International / Export' },
                    ].map(market => {
                      const isSelected = primaryMarket === market.id;
                      return (
                        <button
                          key={market.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setPrimaryMarket(market.id)}
                          className={`min-h-12 p-3 rounded-xl border text-sm text-start transition-colors flex items-start gap-2 ${
                            isSelected ? 'bg-[#22D3EE]/10 border-[#22D3EE] text-white font-medium' : 'bg-white/[0.02] border-white/10 text-[#A5B1C3] hover:border-white/25 hover:text-white'
                          }`}
                        >
                          <span aria-hidden="true" className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${isSelected ? 'border-[#22D3EE]' : 'border-white/30'}`}>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-[#22D3EE]" />}
                          </span>
                          <span>{t(market.labelKey, market.defaultText)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              {/* Group 4: Contact & security */}
              <Section step={4} icon={<Phone className="w-4 h-4" />} title={t('auth.step_security', 'Contact & Security')}>
                <div>
                  <FieldLabel htmlFor={fid('phone')}>{t('auth.phone_label', 'Business Phone')}</FieldLabel>
                  <div dir="ltr" className="flex items-stretch rounded-xl border border-white/20 bg-[#080B12] focus-within:border-[#52D9E8] focus-within:shadow-[0_0_0_3px_rgba(82,217,232,.16)] overflow-hidden transition-colors">
                    <span className="px-3.5 flex items-center text-sm font-mono text-[#22D3EE] bg-white/[0.05] border-e border-white/10 select-none">+213</span>
                    <input id={fid('phone')} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder={t('auth.phone_placeholder', '550 12 34 56')}
                      className="ordium-input !border-0 !shadow-none !rounded-none !bg-transparent font-mono placeholder:!text-[var(--ordium-subtle)]" />
                  </div>
                </div>

                <div className={`flex items-start gap-3 rounded-xl p-3 text-start ${errorField === 'terms' ? 'border border-rose-400/40 bg-rose-500/5' : ''}`}>
                  <input
                    type="checkbox"
                    id={fid('terms')}
                    required
                    checked={agreedToTerms}
                    onChange={e => { setAgreedToTerms(e.target.checked); clearErrorFor('terms'); }}
                    aria-invalid={invalid('terms')}
                    className="mt-0.5 w-5 h-5 shrink-0 rounded accent-[#22D3EE] cursor-pointer"
                  />
                  <label htmlFor={fid('terms')} className="text-sm text-[#A5B1C3] leading-relaxed cursor-pointer select-none">
                    {t('auth.terms_prefix', 'I agree to the')}{' '}
                    <a href="/terms" target="_blank" rel="noopener" className="text-[#52D9E8] underline underline-offset-2 hover:text-[#67E8F9]">{t('auth.terms_link', 'Terms of Service')}</a>{' '}
                    {t('auth.terms_and', 'and')}{' '}
                    <a href="/privacy" target="_blank" rel="noopener" className="text-[#52D9E8] underline underline-offset-2 hover:text-[#67E8F9]">{t('auth.privacy_link', 'Privacy Policy')}</a>.
                  </label>
                </div>
              </Section>

              <div className="p-4 rounded-xl bg-[#22D3EE]/5 border border-[#22D3EE]/15 flex items-start gap-3 text-start">
                <Info aria-hidden="true" className="w-4 h-4 text-[#22D3EE] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-sm text-white block">{t('mkt.auth.notice_title', 'معلومات حسابك')}</span>
                  <p className="text-[#A5B1C3] text-xs leading-relaxed">
                    {bidiIsolate(t('mkt.auth.notice_desc', 'نحفظ معلومات حسابك بأمان ونستعملها لتشغيل متجرك على ORDIUM فقط. لا تحتاج إلى مفاتيح API إلا إذا كان متجرك مبنيًا خصيصًا.'), isRTL)}
                  </p>
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full justify-center font-semibold" isLoading={isLoading} rightIcon={<ArrowIcon aria-hidden="true" className="w-4 h-4" />}>
                {isLoading ? t('auth.registering', 'Registering organization...') : t('auth.register_btn', 'Create Account')}
              </Button>

              <div className="text-center space-y-4">
                <p className="text-sm text-[#A5B1C3]">
                  {t('auth.have_account', 'Already have an account?')}{' '}
                  <button type="button" onClick={() => onNavigate('/login')} className="text-[#52D9E8] hover:underline font-semibold">
                    {t('auth.sign_in_btn', 'Sign In')}
                  </button>
                </p>
                <p>
                  <button type="button" onClick={() => onNavigate('/docs')} className="min-h-10 text-sm text-[var(--ordium-subtle)] hover:text-white hover:underline">
                    {t('mkt.auth.dev_link', 'للمطورين: توثيق API')}
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center z-10 pt-4">
        <p className="text-xs text-[var(--ordium-subtle)]">© {new Date().getFullYear()} ORDIUM. {t('footer.all_rights', 'All rights reserved.')}</p>
      </footer>
    </div>
  );
};
