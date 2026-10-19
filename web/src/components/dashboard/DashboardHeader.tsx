/**
 * ORDIUM Dashboard Header
 * Commercial dashboard header with store selection, notifications, language, and account controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccountSettingsUpdate, AuthSession, Environment, Store } from '../../lib/api/types';
import { PanelLeft, ChevronDown, User, Settings, LogOut, LockKeyhole, Building2, Mail, Save, ShieldCheck, Store as StoreIcon, Settings2 } from 'lucide-react';
import { authApi, SessionInfo } from '../../lib/api/auth';
import { Button } from '../common/Button';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { NotificationsCenter } from './NotificationsCenter';

interface DashboardHeaderProps {
  environment: Environment;
  stores: Store[];
  selectedStoreId: string | null;
  onStoreChange: (storeId: string) => void;
  onManageStores: () => void;
  onToggleMobileSidebar?: () => void;
  title: string;
  session: AuthSession;
  onLogout: () => void;
  onSessionUpdate: (session: AuthSession) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  environment,
  stores,
  selectedStoreId,
  onStoreChange,
  onManageStores,
  onToggleMobileSidebar,
  title,
  session,
  onLogout,
  onSessionUpdate
}) => {
  const { t, isRTL } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'security'>('profile');
  const [savingSettings, setSavingSettings] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [profileForm, setProfileForm] = useState<AccountSettingsUpdate>(() => ({
    first_name: session.user.first_name || '',
    last_name: session.user.last_name || '',
    organization_name: session.organization?.name || '', country: session.organization?.country || t('dashboard.profile.country_default','الجزائر'),
    wilaya: session.organization?.wilaya || '', city: session.organization?.city || '',
    website_url: session.organization?.website_url || '', ecommerce_platform: session.organization?.ecommerce_platform || '',
    business_type: session.organization?.business_type || '', primary_market: session.organization?.primary_market || '',
    monthly_orders: session.organization?.monthly_orders || '', phone: session.organization?.phone || '',
  }));
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settingsOpen && settingsTab === 'security') { setSessionsLoading(true); authApi.listSessions().then(setSessions).catch(() => setSessions([])).finally(() => setSessionsLoading(false)); }
    if (!profileOpen && !settingsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen, settingsOpen]);

  const displayName = session.user.name?.trim() || [session.user.first_name, session.user.last_name].filter(Boolean).join(' ').trim() || session.user.email.split('@')[0] || t('dashboard.profile.user_default','مستخدم ORDIUM');
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'OP';

  return (
    <header className="sticky top-0 z-40 min-h-16 border-b border-white/5 bg-[#080B12]/95 backdrop-blur-xl px-2 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-3">
      {/* Left: Mobile sidebar control, optional desktop title, and store selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 shrink-0"
            aria-label="Toggle navigation menu"
          >
            <PanelLeft className="w-5 h-5" strokeWidth={1.8} />
          </button>
        )}

        <h1 className="hidden lg:block text-sm sm:text-base font-semibold text-white tracking-tight truncate">
          {title}
        </h1>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden sm:inline text-[10px] text-[#64748B]">{t('dashboard.header.store_label', 'المتجر')}</span>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0D1320] px-1 sm:px-1.5 py-1 min-w-0 max-w-[min(42vw,13rem)] sm:max-w-none">
            <StoreIcon className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" />
            <select disabled={!stores.length} value={selectedStoreId || ''} onChange={e => onStoreChange(e.target.value)} className="w-[min(25vw,6.5rem)] sm:w-auto sm:max-w-[170px] bg-transparent px-0.5 sm:px-1 text-xs text-white outline-none disabled:text-[#64748B] truncate">
              {stores.length ? stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>) : <option value="">{t('dashboard.header.no_store', 'لا يوجد متجر')}</option>}
            </select>
            <button type="button" onClick={onManageStores} className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5" aria-label={t('dashboard.header.manage_stores', 'إدارة المتاجر')} title={t('dashboard.header.manage_stores', 'إدارة المتاجر')}>
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Notifications, Language & Account */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {selectedStoreId && <NotificationsCenter environment={environment} />}

        {/* Language Switcher in Header */}
        <div className="flex items-center ps-1 sm:ps-2 border-s border-white/10 shrink-0">
          <LanguageSwitcher variant="dropdown" align="end" />
        </div>

        <div className="relative shrink-0" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(prev => !prev)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label={t('dashboard.profile.open', t('dashboard.profile.open','فتح قائمة الحساب'))}
            className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/50 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-[#6C5CE7]/20 border border-[#6C5CE7]/40 flex items-center justify-center font-mono text-xs font-bold text-[#22D3EE]">
              {initials}
            </span>
            <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[#64748B] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div
              role="menu"
              className={`absolute top-full mt-2 z-[70] ${isRTL ? 'left-0 right-auto' : 'right-0 left-auto'} w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0D1320]/98 shadow-2xl shadow-black/40 backdrop-blur-xl overscroll-contain`}
            >
              <div className="p-4 border-b border-white/5">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-[#6C5CE7]/20 border border-[#6C5CE7]/40 flex items-center justify-center font-mono text-sm font-bold text-[#22D3EE] shrink-0">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-[#94A3B8] truncate mt-0.5">{session.user.email}</p>
                    {session.user.role && <p className="text-[10px] uppercase tracking-wider text-[#64748B] mt-1.5">{session.user.role}</p>}
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setSettingsTab('profile'); setSettingsError(''); setSettingsMessage(''); setSettingsOpen(true); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#CBD5E1] hover:text-white hover:bg-white/5 text-start transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#22D3EE] shrink-0" />
                  <span>{t('dashboard.profile.settings', t('dashboard.profile.settings','إعدادات الحساب'))}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#FCA5A5] hover:text-white hover:bg-red-500/10 text-start transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{t('dashboard.profile.logout', t('dashboard.profile.logout','تسجيل الخروج'))}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ordium-account-settings-title"
            className="w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#101827] shadow-2xl shadow-black/40 flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-white/[0.08] shrink-0">
              <div className="min-w-0">
                <h2 id="ordium-account-settings-title" className="text-base font-semibold text-white">{t('dashboard.profile.settings', t('dashboard.profile.settings','إعدادات الحساب'))}</h2>
                <p className="text-xs text-[#64748B] mt-1">{t('dashboard.profile.settings_desc', 'إدارة حساب ORDIUM وبيانات مساحة العمل.')}</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label={t('common.close', t('common.close','إغلاق'))} className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 shrink-0">
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="flex border-b border-white/5 px-3 sm:px-5 shrink-0">
              <button type="button" onClick={() => setSettingsTab('profile')} className={`px-3 py-3 text-xs font-medium border-b-2 ${settingsTab === 'profile' ? 'text-white border-[#22D3EE]' : 'text-[#64748B] border-transparent hover:text-white'}`}>
                {t('dashboard.profile.profile_tab', 'Profile & Workspace')}
              </button>
              <button type="button" onClick={() => setSettingsTab('security')} className={`px-3 py-3 text-xs font-medium border-b-2 ${settingsTab === 'security' ? 'text-white border-[#22D3EE]' : 'text-[#64748B] border-transparent hover:text-white'}`}>
                {t('dashboard.profile.security_tab', t('dashboard.profile.security_tab','الأمان'))}
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6">
              {settingsError && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">{settingsError}</div>}
              {settingsMessage && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">{settingsMessage}</div>}

              {settingsTab === 'profile' ? (
                <form onSubmit={async (event) => {
                  event.preventDefault();
                  setSettingsError(''); setSettingsMessage(''); setSavingSettings(true);
                  try {
                    const updated = await authApi.updateAccount({ ...profileForm, phone: profileForm.phone?.trim() || null, website_url: profileForm.website_url?.trim() || null, wilaya: profileForm.wilaya?.trim() || null, city: profileForm.city?.trim() || null, ecommerce_platform: profileForm.ecommerce_platform?.trim() || null, business_type: profileForm.business_type?.trim() || null, primary_market: profileForm.primary_market?.trim() || null, monthly_orders: profileForm.monthly_orders?.trim() || null });
                    onSessionUpdate(updated);
                    setProfileForm({
                      first_name: updated.user.first_name,
                      last_name: updated.user.last_name,
                      organization_name: updated.organization?.name || '', country: updated.organization?.country || '', wilaya: updated.organization?.wilaya || '', city: updated.organization?.city || '', website_url: updated.organization?.website_url || '', ecommerce_platform: updated.organization?.ecommerce_platform || '', business_type: updated.organization?.business_type || '', primary_market: updated.organization?.primary_market || '', monthly_orders: updated.organization?.monthly_orders || '', phone: updated.organization?.phone || '',
                    });
                    setSettingsMessage(t('dashboard.profile.saved', 'تم حفظ إعدادات الحساب بنجاح.'));
                  } catch (error) {
                    setSettingsError(error instanceof Error ? error.message : t('common.error', 'Unable to save account settings.'));
                  } finally { setSavingSettings(false); }
                }} className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-3"><User className="w-4 h-4 text-[#22D3EE]" /><h3 className="text-sm font-semibold text-white">{t('dashboard.profile.personal_title', t('dashboard.profile.personal_title','المعلومات الشخصية'))}</h3></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([['first_name',t('dashboard.profile.first_name','الاسم الأول')],['last_name',t('dashboard.profile.last_name','اسم العائلة')]] as const).map(([key,label]) => (
                        <label key={key} className="space-y-1.5"><span className="text-[11px] text-[#94A3B8]">{t(`dashboard.profile.${key}`, label)}</span><input value={profileForm[key]} onChange={e => setProfileForm(f => ({...f,[key]:e.target.value}))} className="w-full min-h-11 rounded-xl border border-white/[0.12] bg-[#080B12] px-3 py-3 text-sm text-white outline-none focus:border-[#43D9E8] focus:ring-2 focus:ring-[#43D9E8]/15" required /></label>
                      ))}
                    </div>
                    <label className="block space-y-1.5 mt-3"><span className="text-[11px] text-[#94A3B8] flex items-center gap-1.5"><Mail className="w-3 h-3" />{t('dashboard.profile.email', t('dashboard.profile.email','البريد الإلكتروني'))}</span><input value={session.user.email} disabled readOnly className="w-full min-h-11 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-sm text-[#94A3B8] cursor-not-allowed" /><span className="text-[10px] text-[#64748B]">{t('dashboard.profile.email_locked', 'Email address cannot be changed from the dashboard.')}</span></label>
                    <label className="block space-y-1.5 mt-3"><span className="text-[11px] text-[#94A3B8]">رقم الهاتف</span><input value={profileForm.phone || ''} onChange={e => setProfileForm(f => ({...f,phone:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-[#080B12] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50" /></label>
                  </div>
                  <div className="pt-4 border-t border-white/5"><div className="flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-[#22D3EE]"/><h3 className="text-sm font-semibold text-white">معلومات مساحة العمل</h3></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{([['organization_name',t('dashboard.profile.organization_name','اسم المؤسسة')],['country',t('dashboard.profile.country','الدولة')],['wilaya',t('dashboard.profile.wilaya','الولاية')],['city',t('dashboard.profile.city','المدينة')],['website_url',t('dashboard.profile.website_url','الموقع')],['ecommerce_platform',t('dashboard.profile.ecommerce_platform','منصة التجارة الإلكترونية')],['business_type',t('dashboard.profile.business_type','نوع النشاط')],['primary_market',t('dashboard.profile.primary_market','السوق الرئيسي')],['monthly_orders',t('dashboard.profile.monthly_orders','الطلبات الشهرية')]] as const).map(([key,label]) => <label key={key} className="space-y-1.5"><span className="text-[11px] text-[#94A3B8]">{label}</span><input value={(profileForm as any)[key] || ''} onChange={e => setProfileForm(f => ({...f,[key]:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-[#080B12] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50" /></label>)}</div></div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>{t('common.cancel',t('common.cancel','إلغاء'))}</Button>
                    <Button type="submit" isLoading={savingSettings} leftIcon={<Save className="w-3.5 h-3.5" />}>{t('common.save',t('common.save','حفظ التغييرات'))}</Button>
                  </div>
                </form>
              ) : (
                <>
                <form onSubmit={async (event) => {
                  event.preventDefault(); setSettingsError(''); setSettingsMessage('');
                  if (passwordForm.new_password !== passwordForm.confirm_password) { setSettingsError(t('dashboard.profile.password_mismatch','New passwords do not match.')); return; }
                  setChangingPassword(true);
                  try {
                    await authApi.changePassword({ current_password: passwordForm.current_password, new_password: passwordForm.new_password });
                    setPasswordForm({ current_password:'', new_password:'', confirm_password:'' });
                    setSettingsMessage(t('dashboard.profile.password_saved','Password changed successfully.'));
                  } catch (error) { setSettingsError(error instanceof Error ? error.message : t('common.error','Unable to change password.')); }
                  finally { setChangingPassword(false); }
                }} className="space-y-5">
                  <div className="rounded-xl border border-[#22D3EE]/10 bg-[#22D3EE]/5 p-4 flex gap-3"><ShieldCheck className="w-5 h-5 text-[#22D3EE] shrink-0" /><div><p className="text-sm font-medium text-white">{t('dashboard.profile.security_title',t('dashboard.profile.security_title','أمان الحساب'))}</p><p className="text-xs text-[#94A3B8] mt-1">{t('dashboard.profile.security_desc','Change your account password without changing your email address.')}</p></div></div>
                  {([['current_password',t('dashboard.profile.current_password','كلمة المرور الحالية')],['new_password',t('dashboard.profile.new_password','كلمة المرور الجديدة')],['confirm_password',t('dashboard.profile.confirm_password','تأكيد كلمة المرور الجديدة')]] as const).map(([key,label]) => (
                    <label key={key} className="block space-y-1.5"><span className="text-[11px] text-[#94A3B8]">{t(`dashboard.profile.${key}`,label)}</span><input type="password" value={passwordForm[key]} onChange={e => setPasswordForm(f => ({...f,[key]:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-[#080B12] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50" required minLength={key === 'current_password' ? 1 : 12} /></label>
                  ))}
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>{t('common.cancel',t('common.cancel','إلغاء'))}</Button><Button type="submit" isLoading={changingPassword} leftIcon={<LockKeyhole className="w-3.5 h-3.5" />}>{t('dashboard.profile.change_password',t('dashboard.profile.change_password','تغيير كلمة المرور'))}</Button></div>
                </form>
                <div className="mt-6 pt-5 border-t border-white/5">
                  <div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="text-sm font-semibold text-white">الجلسات النشطة</h3><p className="text-[10px] text-[#64748B] mt-1">Revoke sessions you no longer recognize.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void authApi.exportAccount()}>تصدير البيانات</Button><Button variant="outline" size="sm" onClick={async () => { await authApi.revokeOtherSessions(); setSessions(await authApi.listSessions()); }}>تسجيل الخروج من الجلسات الأخرى</Button></div></div>
                  {sessionsLoading ? <p className="text-xs text-[#64748B]">جارٍ تحميل الجلسات…</p> : <div className="space-y-2">{sessions.map(item => <div key={item.id} className="rounded-xl border border-white/5 bg-[#080B12] p-3 flex items-center justify-between gap-3"><div><div className="text-xs text-white font-mono">{item.current ? t('dashboard.profile.current_session','الجلسة الحالية') : t('dashboard.profile.session','جلسة')} · {new Date(item.last_seen_at).toLocaleString()}</div><div className="text-[10px] text-[#64748B]">{t('dashboard.profile.created','تم الإنشاء ')} {new Date(item.created_at).toLocaleDateString()} · {t('dashboard.profile.expires','تنتهي ')} {new Date(item.expires_at).toLocaleDateString()}</div></div>{!item.current && <Button variant="danger" size="sm" onClick={async () => { await authApi.revokeSession(item.id); setSessions(await authApi.listSessions()); }}>{t('dashboard.profile.revoke','إلغاء')}</Button>}</div>)}</div>}
                </div>
                </>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
    </header>
  );
};
