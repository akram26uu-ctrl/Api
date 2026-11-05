import React, { useEffect, useState } from 'react';
import { Download, LockKeyhole, LogOut, Save } from 'lucide-react';
import { AccountSettingsUpdate, AuthSession } from '../../../lib/api/types';
import { authApi, SessionInfo } from '../../../lib/api/auth';
import { Button } from '../../common/Button';
import { useLanguage } from '../../../i18n/LanguageContext';

interface AccountSettingsPanelProps {
  session: AuthSession;
  onSessionUpdate: (session: AuthSession) => void;
}

type Feedback = { kind: 'success' | 'error'; text: string } | null;

const formFromSession = (session: AuthSession, defaultCountry: string): AccountSettingsUpdate => ({
  first_name: session.user.first_name || '',
  last_name: session.user.last_name || '',
  organization_name: session.organization?.name || '',
  country: session.organization?.country || defaultCountry,
  wilaya: session.organization?.wilaya || '',
  city: session.organization?.city || '',
  website_url: session.organization?.website_url || '',
  ecommerce_platform: session.organization?.ecommerce_platform || '',
  business_type: session.organization?.business_type || '',
  primary_market: session.organization?.primary_market || '',
  monthly_orders: session.organization?.monthly_orders || '',
  phone: session.organization?.phone || '',
});

const orNull = (value?: string | null) => value?.trim() || null;

const FeedbackLine: React.FC<{ feedback: Feedback }> = ({ feedback }) => feedback ? (
  <p role={feedback.kind === 'error' ? 'alert' : 'status'} className={`settings-feedback settings-feedback--${feedback.kind}`}>{feedback.text}</p>
) : null;

const Field: React.FC<{ id: string; label: string; hint?: string; children: React.ReactNode }> = ({ id, label, hint, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="settings-label">{label}</label>
    {children}
    {hint && <p id={`${id}-hint`} className="settings-hint">{hint}</p>}
  </div>
);

export const AccountSettingsPanel: React.FC<AccountSettingsPanelProps> = ({ session, onSessionUpdate }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [profile, setProfile] = useState<AccountSettingsUpdate>(() => formFromSession(session, t('dashboard.profile.country_default', 'الجزائر')));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);

  const [password, setPassword] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsFeedback, setSessionsFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;
    authApi.listSessions().then(items => { if (active) setSessions(items); }).catch(() => { if (active) setSessions([]); }).finally(() => { if (active) setSessionsLoading(false); });
    return () => { active = false; };
  }, []);

  const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true); setProfileFeedback(null);
    try {
      const updated = await authApi.updateAccount({
        ...profile,
        phone: orNull(profile.phone), website_url: orNull(profile.website_url), wilaya: orNull(profile.wilaya), city: orNull(profile.city),
        ecommerce_platform: orNull(profile.ecommerce_platform), business_type: orNull(profile.business_type),
        primary_market: orNull(profile.primary_market), monthly_orders: orNull(profile.monthly_orders),
      });
      onSessionUpdate(updated);
      setProfile(formFromSession(updated, ''));
      setProfileFeedback({ kind: 'success', text: t('settings.account.saved', 'تم حفظ بيانات الحساب.') });
    } catch (error) {
      setProfileFeedback({ kind: 'error', text: errorText(error, t('settings.account.save_error', 'لم تُحفظ البيانات. تحقّق من الحقول ثم أعد المحاولة.')) });
    } finally { setSavingProfile(false); }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (password.new_password !== password.confirm_password) {
      setPasswordFeedback({ kind: 'error', text: t('dashboard.profile.password_mismatch', 'كلمتا المرور الجديدتان غير متطابقتين.') });
      return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword({ current_password: password.current_password, new_password: password.new_password });
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordFeedback({ kind: 'success', text: t('dashboard.profile.password_saved', 'تم تغيير كلمة المرور.') });
    } catch (error) {
      setPasswordFeedback({ kind: 'error', text: errorText(error, t('settings.account.password_error', 'لم تتغير كلمة المرور. تحقّق من كلمة المرور الحالية.')) });
    } finally { setSavingPassword(false); }
  };

  const sessionAction = async (action: () => Promise<unknown>, success: string, reload = true) => {
    setSessionsFeedback(null);
    try {
      await action();
      if (reload) setSessions(await authApi.listSessions());
      setSessionsFeedback({ kind: 'success', text: success });
    } catch (error) {
      setSessionsFeedback({ kind: 'error', text: errorText(error, t('common.error', 'تعذر إكمال العملية.')) });
    }
  };

  const textField = (key: keyof AccountSettingsUpdate, label: string, options: { type?: string; autoComplete?: string; required?: boolean } = {}) => (
    <Field id={`acct-${key}`} label={label}>
      <input
        id={`acct-${key}`}
        type={options.type || 'text'}
        autoComplete={options.autoComplete}
        required={options.required}
        value={(profile[key] as string) || ''}
        onChange={e => { setProfile(prev => ({ ...prev, [key]: e.target.value })); setProfileFeedback(null); }}
        className="settings-input w-full"
      />
    </Field>
  );

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="settings-card space-y-6">
        <fieldset className="space-y-4">
          <legend className="settings-card-title">{t('dashboard.profile.personal_title', 'المعلومات الشخصية')}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {textField('first_name', t('dashboard.profile.first_name', 'الاسم الأول'), { autoComplete: 'given-name', required: true })}
            {textField('last_name', t('dashboard.profile.last_name', 'اسم العائلة'), { autoComplete: 'family-name', required: true })}
            <Field id="acct-email" label={t('dashboard.profile.email', 'البريد الإلكتروني')} hint={t('settings.account.email_locked', 'لا يمكن تغيير البريد من لوحة التحكم.')}>
              <input id="acct-email" value={session.user.email} readOnly aria-describedby="acct-email-hint" className="settings-input w-full is-readonly" />
            </Field>
            {textField('phone', t('dashboard.profile.phone', 'رقم الهاتف'), { type: 'tel', autoComplete: 'tel' })}
          </div>
        </fieldset>

        <fieldset className="space-y-4 pt-6 border-t border-[var(--ordium-border)]">
          <legend className="settings-card-title">{t('settings.account.business_title', 'بيانات النشاط')}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {textField('organization_name', t('dashboard.profile.organization_name', 'اسم النشاط'), { autoComplete: 'organization', required: true })}
            {textField('website_url', t('dashboard.profile.website_url', 'الموقع'), { type: 'url', autoComplete: 'url' })}
            {textField('country', t('dashboard.profile.country', 'الدولة'), { autoComplete: 'country-name' })}
            {textField('wilaya', t('dashboard.profile.wilaya', 'الولاية'))}
            {textField('city', t('dashboard.profile.city', 'المدينة'), { autoComplete: 'address-level2' })}
            {textField('ecommerce_platform', t('dashboard.profile.ecommerce_platform', 'منصة المتجر'))}
            {textField('business_type', t('dashboard.profile.business_type', 'نوع النشاط'))}
            {textField('monthly_orders', t('dashboard.profile.monthly_orders', 'الطلبات الشهرية'))}
          </div>
        </fieldset>

        <div className="settings-actions">
          <FeedbackLine feedback={profileFeedback} />
          <Button type="submit" isLoading={savingProfile} leftIcon={<Save className="w-4 h-4" />}>{t('settings.account.save', 'حفظ البيانات')}</Button>
        </div>
      </form>

      <form onSubmit={savePassword} className="settings-card space-y-4">
        <div>
          <h3 className="settings-card-title">{t('settings.account.password_title', 'كلمة المرور')}</h3>
          <p className="settings-hint mt-1">{t('settings.account.password_hint', '12 حرفًا على الأقل. تغييرها لا يغلق الجلسة الحالية.')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            ['current_password', t('dashboard.profile.current_password', 'كلمة المرور الحالية'), 'current-password', 1],
            ['new_password', t('dashboard.profile.new_password', 'كلمة المرور الجديدة'), 'new-password', 12],
            ['confirm_password', t('dashboard.profile.confirm_password', 'تأكيد كلمة المرور'), 'new-password', 12],
          ] as const).map(([key, label, autoComplete, minLength]) => (
            <Field key={key} id={`pw-${key}`} label={label}>
              <input id={`pw-${key}`} type="password" autoComplete={autoComplete} required minLength={minLength}
                value={password[key]} onChange={e => { setPassword(prev => ({ ...prev, [key]: e.target.value })); setPasswordFeedback(null); }}
                className="settings-input w-full" />
            </Field>
          ))}
        </div>
        <div className="settings-actions">
          <FeedbackLine feedback={passwordFeedback} />
          <Button type="submit" variant="outline" isLoading={savingPassword} leftIcon={<LockKeyhole className="w-4 h-4" />}>{t('dashboard.profile.change_password', 'تغيير كلمة المرور')}</Button>
        </div>
      </form>

      <section className="settings-card space-y-4" aria-labelledby="acct-sessions-title">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 id="acct-sessions-title" className="settings-card-title">{t('settings.account.sessions_title', 'الأجهزة المتصلة')}</h3>
            <p className="settings-hint mt-1">{t('settings.account.sessions_hint', 'أغلق أي جلسة لا تعرفها.')}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="ghost" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => void sessionAction(() => authApi.exportAccount(), t('settings.account.exported', 'بدأ تنزيل بياناتك.'), false)}>{t('dashboard.profile.export_data', 'تنزيل بياناتي')}</Button>
            <Button variant="outline" size="sm" leftIcon={<LogOut className="w-3.5 h-3.5" />} onClick={() => void sessionAction(() => authApi.revokeOtherSessions(), t('settings.account.others_closed', 'أُغلقت الجلسات الأخرى.'))}>{t('dashboard.profile.revoke_others', 'إغلاق الجلسات الأخرى')}</Button>
          </div>
        </div>
        <FeedbackLine feedback={sessionsFeedback} />
        {sessionsLoading ? (
          <p className="settings-hint" role="status">{t('dashboard.profile.sessions_loading', 'جارٍ تحميل الجلسات…')}</p>
        ) : (
          <ul className="settings-list">
            {sessions.map(item => (
              <li key={item.id} className="settings-list-row">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ordium-text)]">
                    {item.current ? t('settings.account.this_device', 'هذا الجهاز') : t('dashboard.profile.session', 'جلسة')}
                  </p>
                  <p className="text-xs text-[var(--ordium-subtle)] mt-0.5">
                    {t('settings.account.last_active', 'آخر نشاط')} {new Date(item.last_seen_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    {' — '}{t('settings.account.expires', 'تنتهي')} {new Date(item.expires_at).toLocaleDateString(locale, { dateStyle: 'medium' })}
                  </p>
                </div>
                {item.current
                  ? <span className="settings-status settings-status--ok">{t('settings.account.current', 'الحالية')}</span>
                  : <Button variant="danger" size="sm" onClick={() => void sessionAction(() => authApi.revokeSession(item.id), t('settings.account.session_closed', 'أُغلقت الجلسة.'))}>{t('settings.account.close_session', 'إغلاق')}</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
