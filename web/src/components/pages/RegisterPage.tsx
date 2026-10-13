/**
 * ORDIUM Professional Authentication: Registration Page
 * 
 * Complies strictly with backend API contracts & real merchant onboarding:
 * - Grouped sections: Account, Business, E-Commerce, Contact & Security
 * - Algerian market localization: 58 Wilayas, localized names, phone prefix (+213)
 * - Password strength entropy calculation
 * - Transparent API contract notice: No mock authentication or fake localStorage tokens
 * - Connects to typed authApi.register
 * - Fully responsive with RTL support for Arabic, French, and English
 */

import React, { useState, useMemo } from 'react';
import {
  Shield, Lock, Mail, Building2, User, Phone, Globe, ShoppingBag,
  TrendingUp, MapPin, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  Eye, EyeOff, Key, Terminal, Cpu, Info, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from '../common/Button';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { authApi } from '../../lib/api/auth';
import { OrdiumApiError } from '../../lib/api/client';
import {
  ALGERIAN_WILAYAS,
  ECOMMERCE_PLATFORMS,
  MONTHLY_VOLUME_OPTIONS,
  BUSINESS_TYPES
} from '../../lib/algeriaData';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
  onLaunchConsole?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onNavigate,
  onLaunchConsole
}) => {
  const { t, language, isRTL } = useLanguage();

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [businessType, setBusinessType] = useState('direct_ecommerce');
  const [country] = useState('Algeria');
  const [wilaya, setWilaya] = useState('');
  const [city, setCity] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [platform, setPlatform] = useState('shopify');
  const [monthlyVolume, setMonthlyVolume] = useState('100_500');
  const [primaryMarket, setPrimaryMarket] = useState('market_algeria');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationResendMessage, setVerificationResendMessage] = useState('');
  const [verificationResendError, setVerificationResendError] = useState(false);

  // Password entropy calculation
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score; // 0 to 5
  }, [password]);

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return { label: t('auth.strength_weak', 'Weak'), color: 'bg-rose-500', text: 'text-rose-400' };
    if (passwordStrength <= 2) return { label: t('auth.strength_fair', 'Fair'), color: 'bg-amber-500', text: 'text-amber-400' };
    if (passwordStrength <= 3) return { label: t('auth.strength_strong', 'Strong'), color: 'bg-[#22D3EE]', text: 'text-[#22D3EE]' };
    return { label: t('auth.strength_very_strong', 'Very Strong'), color: 'bg-emerald-500', text: 'text-emerald-400' };
  };

  const strength = getStrengthLabel();

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRequestId(null);

    // Validation
    if (!firstName.trim()) {
      setErrorMessage(t('auth.errors.first_name_required', 'First name is required.'));
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage(t('auth.errors.last_name_required', 'Last name is required.'));
      return;
    }
    if (!email.trim()) {
      setErrorMessage(t('auth.errors.email_required', 'Email address is required.'));
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setErrorMessage(t('auth.errors.email_invalid', 'Please enter a valid work email address.'));
      return;
    }
    if (!organization.trim()) {
      setErrorMessage(t('auth.errors.organization_required', 'Store or company name is required.'));
      return;
    }
    if (!password) {
      setErrorMessage(t('auth.errors.password_required', 'Password is required.'));
      return;
    }
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage(t('auth.errors.password_length', 'Password must be at least 12 characters and include uppercase, lowercase, and numeric characters.'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('auth.errors.password_mismatch', 'Passwords do not match.'));
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage(t('auth.errors.terms_required', 'You must accept the Terms of Service and Privacy Policy to continue.'));
      return;
    }

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
        primary_market: primaryMarket
      });

      setVerificationRequired(Boolean(session.verification_required));
      setIsSuccess(true);
    } catch (err: any) {
      if (err instanceof OrdiumApiError) {
        setRequestId(err.requestId);
        if (err.statusCode === 409) {
          setErrorMessage(t('auth.errors.conflict_email', 'An account with this email address already exists.'));
        } else {
          setErrorMessage(err.message || t('auth.errors.registration_restricted', 'Public self-service registration is currently restricted to enterprise teams.'));
        }
      } else {
        setRequestId(`req_${Date.now()}`);
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
      const result = await authApi.resendVerification(email.trim());
      setVerificationResendMessage(result.message || t('auth.resend_generic', 'إذا كان الحساب بحاجة إلى التحقق، فسيتم إرسال رسالة جديدة.'));
    } catch (err) {
      setVerificationResendError(true);
      setVerificationResendMessage(err instanceof OrdiumApiError
        ? err.message
        : t('auth.resend_error', 'تعذر إرسال الرسالة الآن. حاول لاحقًا.'));
    } finally {
      setIsResendingVerification(false);
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#6C5CE7]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-[#22D3EE]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between z-10 mb-6">
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
      </header>

      {/* Main Registration Container */}
      <main className="w-full max-w-3xl mx-auto my-4 z-10">
        <div className="bg-[#0D1320] border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl shadow-black/80 relative">
          
          {/* Subtle Accent Gradient Line */}
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#6C5CE7]/60 to-transparent" />

          {/* Form Header */}
          <div className="text-center mb-8 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#6C5CE7]/30 to-[#22D3EE]/20 border border-white/10 flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-[#22D3EE]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              {t('auth.register_title', 'Create your ORDIUM Account')}
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
              {t('auth.register_subtitle', 'Deploy deterministic order risk intelligence and protect your e-commerce operations.')}
            </p>
          </div>

          {/* Success State Screen */}
          {isSuccess ? (
            <div className="py-8 text-center space-y-6 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white font-mono">
                  {verificationRequired ? t('auth.registration_verification_title', 'Verify Your Email') : t('auth.registration_success_title', 'Account Provisioned Successfully')}
                </h2>
                <p className="text-sm text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                  {verificationRequired ? t('auth.registration_verification_desc', 'Your account was created securely. Check your email and follow the verification link before signing in.') : t('auth.registration_success_desc', 'Your ORDIUM workspace is ready. Open the Simulator to validate your integration before live traffic.')}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 max-w-md mx-auto text-start space-y-1 font-mono text-xs text-[#94A3B8]">
                <div className="flex justify-between">
                  <span>Merchant:</span>
                  <span className="text-white font-bold">{organization}</span>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="text-white">{email}</span>
                </div>
                {!verificationRequired && <div className="flex justify-between">
                  <span>{t('auth.workspace_status_label', 'الحالة:')}</span>
                  <span className="text-emerald-400">{t('auth.workspace_status_ready', 'الحساب جاهز')}</span>
                </div>}

              </div>


              {verificationRequired && (
                <div className="max-w-md mx-auto w-full space-y-3 rounded-xl border border-[#22D3EE]/20 bg-[#22D3EE]/5 p-4 text-start">
                  <p className="text-sm font-semibold text-white">لم يصلك رابط التحقق؟</p>
                  <p className="text-xs leading-6 text-[#94A3B8]">يمكنك إعادة إرسال رابط التحقق إلى البريد الذي استخدمته لإنشاء الحساب: <span dir="ltr" className="font-mono text-white">{email}</span></p>
                  <Button type="button" variant="outline" className="w-full" disabled={isResendingVerification} onClick={() => void handleResendVerification()} leftIcon={<RefreshCw className="w-4 h-4" />}>
                    {isResendingVerification ? 'جارٍ إرسال الرابط…' : 'إعادة إرسال رابط التحقق'}
                  </Button>
                  {verificationResendMessage && <p role="status" aria-live="polite" className={`text-xs leading-6 ${verificationResendError ? 'text-red-300' : 'text-emerald-300'}`}>{verificationResendMessage}</p>}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {!verificationRequired && <Button
                  variant="primary"
                  size="md"
                  onClick={() => onLaunchConsole ? onLaunchConsole() : onNavigate('/')}
                  rightIcon={<ArrowIcon className="w-4 h-4" />}
                >
                  {t('auth.launch_sandbox_direct', 'فتح المحاكي')}
                </Button>}
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => onNavigate('/login')}
                >
                  {t('auth.back_to_login', 'Return to sign in')}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Error Message Box */}
              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-start animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="text-rose-200 font-medium">{errorMessage}</p>
                    {requestId && (
                      <p className="text-[10px] text-rose-400/80 font-mono mt-1">
                        Request ID: {requestId}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Group 1: Account Credentials */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <User className="w-4 h-4 text-[#22D3EE]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    1. {t('auth.step_account', 'Account Credentials')}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.first_name_label', 'First Name')} <span className="text-[#22D3EE]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder={t('auth.first_name_placeholder', 'Karim')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all"
                    />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.last_name_label', 'Last Name')} <span className="text-[#22D3EE]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder={t('auth.last_name_placeholder', 'Bensalem')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-mono text-[#94A3B8]">
                    {t('auth.email_label', 'Work Email')} <span className="text-[#22D3EE]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-[#64748B]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t('auth.email_placeholder', 'karim@store.dz')}
                      dir="ltr"
                      className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-start">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-[#94A3B8]">
                        {t('auth.password_label', 'Password')} <span className="text-[#22D3EE]">*</span>
                      </label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-[#64748B]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        dir="ltr"
                        className="w-full ps-10 pe-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 end-0 pe-3 flex items-center text-[#64748B] hover:text-[#94A3B8]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.confirm_password_label', 'Confirm Password')} <span className="text-[#22D3EE]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-[#64748B]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        dir="ltr"
                        className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {password && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#64748B]">{t('auth.password_strength', 'Password Strength')}:</span>
                      <span className={strength.text}>{strength.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${passwordStrength >= 1 ? strength.color : 'bg-transparent'}`} />
                      <div className={`h-full transition-all ${passwordStrength >= 2 ? strength.color : 'bg-transparent'}`} />
                      <div className={`h-full transition-all ${passwordStrength >= 3 ? strength.color : 'bg-transparent'}`} />
                      <div className={`h-full transition-all ${passwordStrength >= 4 ? strength.color : 'bg-transparent'}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Group 2: Business & Algerian Regional Identity */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Building2 className="w-4 h-4 text-[#22D3EE]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    2. {t('auth.step_business', 'Business & Regional Identity')}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Organization Name */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.organization_label', 'Company / Store Name')} <span className="text-[#22D3EE]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={organization}
                      onChange={e => setOrganization(e.target.value)}
                      placeholder={t('auth.organization_placeholder', 'Atlas Retail Store')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all"
                    />
                  </div>

                  {/* Business Type */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.business_type_label', 'Business Type')}
                    </label>
                    <select
                      value={businessType}
                      onChange={e => setBusinessType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#080B12] border border-white/10 focus:border-[#22D3EE] text-sm text-white outline-none transition-all"
                    >
                      {BUSINESS_TYPES.map(bt => {
                        const label = language === 'ar' ? bt.labelAr : language === 'fr' ? bt.labelFr : bt.labelEn;
                        return (
                          <option key={bt.id} value={bt.id} className="bg-[#080B12] text-white">
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Country (Algeria fixed / targeted) */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.country_label', 'Country')}
                    </label>
                    <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-sm text-[#94A3B8] font-medium flex items-center gap-2">
                      <span className="text-base">🇩🇿</span>
                      <span>{t('auth.country_algeria', 'Algeria (الجزائر)')}</span>
                    </div>
                  </div>

                  {/* Algerian Wilaya Selector */}
                  <div className="space-y-1.5 text-start sm:col-span-1">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.wilaya_label', 'Wilaya / Province')}
                    </label>
                    <select
                      value={wilaya}
                      onChange={e => setWilaya(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#080B12] border border-white/10 focus:border-[#22D3EE] text-sm text-white outline-none transition-all"
                    >
                      <option value="">{t('auth.wilaya_placeholder', 'Select your Wilaya')}</option>
                      {ALGERIAN_WILAYAS.map(w => {
                        const name = language === 'ar' ? w.nameAr : language === 'fr' ? w.nameFr : w.nameEn;
                        return (
                          <option key={w.code} value={`${w.code} - ${w.nameEn}`} className="bg-[#080B12] text-white">
                            {w.code}. {name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* City / Commune */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.city_label', 'City / Commune')}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder={t('auth.city_placeholder', 'e.g. Sidi M\'Hamed, Oran')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Website URL */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-mono text-[#94A3B8]">
                    {t('auth.website_label', 'Store Website / URL')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-[#64748B]">
                      <Globe className="w-4 h-4" />
                    </div>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                      placeholder={t('auth.website_placeholder', 'https://www.yourstore.dz')}
                      dir="ltr"
                      className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] text-sm text-white placeholder:text-[#475569] outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: E-Commerce Architecture */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <ShoppingBag className="w-4 h-4 text-[#22D3EE]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    3. {t('auth.step_ecommerce', 'E-Commerce Infrastructure')}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Platform */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.platform_label', 'Primary E-Commerce Platform')}
                    </label>
                    <select
                      value={platform}
                      onChange={e => setPlatform(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#080B12] border border-white/10 focus:border-[#22D3EE] text-sm text-white outline-none transition-all"
                    >
                      {ECOMMERCE_PLATFORMS.map(p => (
                        <option key={p.id} value={p.id} className="bg-[#080B12] text-white">
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Monthly Volume */}
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-mono text-[#94A3B8]">
                      {t('auth.volume_label', 'Monthly Order Volume')}
                    </label>
                    <select
                      value={monthlyVolume}
                      onChange={e => setMonthlyVolume(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#080B12] border border-white/10 focus:border-[#22D3EE] text-sm text-white outline-none transition-all"
                    >
                      {MONTHLY_VOLUME_OPTIONS.map(v => {
                        const label = language === 'ar' ? v.labelAr : language === 'fr' ? v.labelFr : v.labelEn;
                        return (
                          <option key={v.id} value={v.id} className="bg-[#080B12] text-white">
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Primary Sales Market */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-mono text-[#94A3B8]">
                    {t('auth.market_label', 'Primary Sales Market')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'market_algeria', labelKey: 'auth.market_algeria', defaultText: 'Algeria Domestic (National COD & Pre-paid)' },
                      { id: 'market_regional', labelKey: 'auth.market_regional', defaultText: 'Maghreb / North Africa' },
                      { id: 'market_international', labelKey: 'auth.market_international', defaultText: 'International / Export' }
                    ].map(market => {
                      const isSelected = primaryMarket === market.id;
                      return (
                        <button
                          key={market.id}
                          type="button"
                          onClick={() => setPrimaryMarket(market.id)}
                          className={`p-3 rounded-xl border text-xs text-start transition-all ${
                            isSelected
                              ? 'bg-[#22D3EE]/10 border-[#22D3EE] text-white font-medium shadow-sm'
                              : 'bg-white/[0.02] border-white/10 text-[#94A3B8] hover:border-white/20'
                          }`}
                        >
                          {t(market.labelKey, market.defaultText)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Group 4: Contact & Security Compliance */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Phone className="w-4 h-4 text-[#22D3EE]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    4. {t('auth.step_security', 'Contact & Security')}
                  </h3>
                </div>

                {/* Business Phone with +213 Prefix */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-mono text-[#94A3B8]">
                    {t('auth.phone_label', 'Business Phone')}
                  </label>
                  <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-[#22D3EE] overflow-hidden transition-all">
                    <span className="px-3.5 py-2.5 text-xs font-mono text-[#22D3EE] bg-white/[0.05] border-e border-white/10 select-none">
                      +213
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder={t('auth.phone_placeholder', '550 12 34 56')}
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-transparent text-sm text-white placeholder:text-[#475569] outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Terms and Privacy Checkbox */}
                <div className="flex items-start gap-2.5 pt-2 text-start">
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-[#22D3EE] focus:ring-[#22D3EE] cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-xs text-[#94A3B8] leading-relaxed cursor-pointer select-none">
                    {t('auth.terms_prefix', 'I agree to the')}{' '}
                    <span className="text-[#22D3EE] hover:underline">{t('auth.terms_link', 'Terms of Service')}</span>{' '}
                    {t('auth.terms_and', 'and')}{' '}
                    <span className="text-[#22D3EE] hover:underline">{t('auth.privacy_link', 'Privacy Policy')}</span>.
                  </label>
                </div>
              </div>

              {/* API Contract Transparency Notice */}
              <div className="p-3.5 rounded-xl bg-[#22D3EE]/5 border border-[#22D3EE]/15 flex items-start gap-3 text-start">
                <Info className="w-4 h-4 text-[#22D3EE] shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-white font-mono block">
                    {t('auth.registration_notice_title', 'API Contract Transparency')}
                  </span>
                  <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                    {t('auth.registration_notice_desc', 'ORDIUM clusters authenticate primarily via Merchant API Keys. Profile fields are stored securely and mapped directly to your tenant metadata.')}
                  </p>
                </div>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full justify-center text-sm font-bold font-mono tracking-wider"
                disabled={isLoading}
                rightIcon={<ArrowIcon className="w-4 h-4" />}
              >
                {isLoading ? t('auth.registering', 'Registering organization...') : t('auth.register_btn', 'Create Account')}
              </Button>

              {/* Bottom Nav Links */}
              <div className="text-center pt-2 space-y-3">
                <p className="text-xs text-[#94A3B8]">
                  {t('auth.have_account', 'Already have an account?')}{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/login')}
                    className="text-[#22D3EE] hover:underline font-semibold"
                  >
                    {t('auth.sign_in_btn', 'Sign In')}
                  </button>
                </p>

                {/* Developer Direct Sandbox Access */}
                <div className="pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => onLaunchConsole ? onLaunchConsole() : onNavigate('/')}
                    className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white font-mono transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-[#22D3EE]" />
                    <span>{t('auth.api_key_access', 'Merchant API Key Access')}</span>
                    <ArrowIcon className="w-3 h-3 text-[#22D3EE]" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center z-10 pt-4">
        <p className="text-[11px] font-mono text-[#64748B]">
          © {new Date().getFullYear()} ORDIUM Risk Intelligence. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
