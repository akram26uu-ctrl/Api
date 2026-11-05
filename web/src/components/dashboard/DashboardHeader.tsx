/**
 * ORDIUM Dashboard Header
 * Commercial dashboard header with store selection, notifications, language, and account controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AuthSession, Environment, Store } from '../../lib/api/types';
import { PanelLeft, ChevronDown, Settings, LogOut, Store as StoreIcon, Settings2 } from 'lucide-react';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { NotificationsCenter } from './NotificationsCenter';

interface DashboardHeaderProps {
  environment: Environment;
  onEnvironmentChange: (env: Environment) => void;
  stores: Store[];
  selectedStoreId: string | null;
  onStoreChange: (storeId: string) => void;
  onManageStores: () => void;
  onOpenAccountSettings: () => void;
  onToggleMobileSidebar?: () => void;
  title: string;
  session: AuthSession;
  onLogout: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  environment,
  onEnvironmentChange,
  stores,
  selectedStoreId,
  onStoreChange,
  onManageStores,
  onOpenAccountSettings,
  onToggleMobileSidebar,
  title,
  session,
  onLogout
}) => {
  const { t, isRTL, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const displayName = session.user.name?.trim() || [session.user.first_name, session.user.last_name].filter(Boolean).join(' ').trim() || session.user.email.split('@')[0] || t('dashboard.profile.user_default','مستخدم ORDIUM');
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'OP';

  const isTest = environment === 'test';
  const control = 'min-h-11 lg:min-h-10 rounded-xl border border-white/10 bg-[var(--ordium-surface)]';

  return (
    <header className="dashboard-topbar sticky top-0 z-40 min-h-16 border-b border-white/5 bg-[var(--ordium-canvas)]/95 backdrop-blur-xl px-2 sm:px-6 flex items-center gap-2 sm:gap-4">
      {/* Start: menu (phones) and the page title */}
      <div className="flex items-center gap-2 shrink-0 lg:shrink lg:flex-1 lg:min-w-0">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="lg:hidden inline-flex items-center justify-center min-w-11 min-h-11 rounded-xl text-[var(--ordium-muted)] hover:text-white hover:bg-white/5 shrink-0"
            aria-label={t('ui.open_menu', 'Open menu')}
          >
            <PanelLeft aria-hidden="true" className="w-5 h-5 rtl:-scale-x-100" strokeWidth={1.8} />
          </button>
        )}
        <h1 className="sr-only lg:not-sr-only text-lg font-semibold text-[var(--ordium-text)] truncate">{title}</h1>
      </div>

      {/* Workspace context: which store, which environment */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0 flex-1 lg:flex-none">
        <label className={`${control} flex items-center gap-2 ps-2.5 sm:ps-3 pe-1.5 sm:pe-2 min-w-0 flex-1 sm:flex-none cursor-pointer hover:border-white/20 transition-colors focus-within:border-[var(--ordium-signal)]/60`}>
          <StoreIcon aria-hidden="true" className="w-4 h-4 text-[var(--ordium-signal)] shrink-0" />
          <span className="sr-only">{t('dashboard.header.store_label', 'المتجر')}</span>
          <select
            disabled={!stores.length}
            value={selectedStoreId || ''}
            onChange={e => onStoreChange(e.target.value)}
            className="min-w-[4.5rem] w-full sm:w-auto sm:max-w-[12rem] bg-transparent text-sm font-medium text-white outline-none disabled:text-[var(--ordium-subtle)] truncate cursor-pointer"
          >
            {stores.length ? stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>) : <option value="">{t('dashboard.header.no_store', 'لا يوجد متجر')}</option>}
          </select>
        </label>

        <div role="radiogroup" aria-label={t('dashboard.header.environment', 'البيئة')} className={`${control} inline-flex items-center shrink-0 p-1 gap-0.5`}>
          {(['live', 'test'] as const).map(env => {
            const active = environment === env;
            const tone = env === 'test' ? 'var(--ordium-warning)' : 'var(--ordium-success)';
            return (
              <button
                key={env}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={env === 'live' ? t('dashboard.header.env_live', 'حقيقية (LIVE)') : t('dashboard.header.env_test', 'تجريبية (TEST)')}
                title={env === 'live' ? t('dashboard.header.env_live', 'حقيقية (LIVE)') : t('dashboard.header.env_test', 'تجريبية (TEST)')}
                onClick={() => { if (!active) onEnvironmentChange(env); else if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches) onEnvironmentChange(env === 'live' ? 'test' : 'live'); }}
                className={`${active ? 'inline-flex' : 'hidden sm:inline-flex'} items-center gap-1.5 h-9 lg:h-8 px-2 sm:px-2.5 rounded-lg font-mono text-xs font-semibold tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ordium-signal)]/50 transition-colors ${active ? (env === 'test' ? 'bg-[var(--ordium-warning)]/15 text-[var(--ordium-warning)]' : 'bg-[var(--ordium-surface-raised)] text-white') : 'text-[var(--ordium-subtle)] hover:text-white'}`}
              >
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: active ? tone : 'currentColor', opacity: active ? 1 : 0.5 }} />
                {env === 'live' ? 'LIVE' : 'TEST'}
              </button>
            );
          })}
        </div>
      </div>

      {/* End: notifications, language and account */}
      <div className="flex items-center gap-0.5 sm:gap-2 shrink-0 sm:ps-3 sm:border-s border-white/10">
        {selectedStoreId && <NotificationsCenter environment={environment} />}

        {/* Phones: the language switcher lives in the side menu. */}
        <div className="hidden sm:flex items-center shrink-0">
          <LanguageSwitcher variant="dropdown" align="end" />
        </div>

        <div className="relative shrink-0" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(prev => !prev)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label={t('dashboard.profile.open', 'فتح قائمة الحساب')}
            className="flex items-center gap-1.5 min-h-11 lg:min-h-10 rounded-xl px-1 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ordium-signal)]/50 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-[var(--ordium-accent)]/20 border border-[var(--ordium-accent)]/40 flex items-center justify-center font-mono text-xs font-bold text-[var(--ordium-signal)]">
              {initials}
            </span>
            <ChevronDown aria-hidden="true" className={`hidden sm:block w-3.5 h-3.5 text-[var(--ordium-subtle)] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div
              role="menu"
              className={`absolute top-full mt-2 z-[70] ${isRTL ? 'left-0 right-auto' : 'right-0 left-auto'} w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--ordium-surface)]/98 shadow-2xl shadow-black/40 backdrop-blur-xl overscroll-contain`}
            >
              <div className="p-4 border-b border-white/5">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-[var(--ordium-accent)]/20 border border-[var(--ordium-accent)]/40 flex items-center justify-center font-mono text-sm font-bold text-[var(--ordium-signal)] shrink-0">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-[var(--ordium-muted)] truncate mt-0.5">{session.user.email}</p>
                    {session.user.role && <p className="text-xs uppercase tracking-wider text-[var(--ordium-subtle)] mt-1.5">{session.user.role}</p>}
                  </div>
                </div>
              </div>

              {isTest && (
                <p className="mx-4 mt-3 text-xs font-semibold px-2 py-1 rounded bg-[var(--ordium-warning)]/20 text-[var(--ordium-warning)]">{t('dashboard.header.test_badge', 'وضع تجريبي')}</p>
              )}
              <div className="p-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); onManageStores(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#CBD5E1] hover:text-white hover:bg-white/5 text-start transition-colors"
                >
                  <Settings2 className="w-4 h-4 text-[var(--ordium-signal)] shrink-0" />
                  <span>{t('dashboard.header.manage_stores', 'إدارة المتاجر')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); onOpenAccountSettings(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#CBD5E1] hover:text-white hover:bg-white/5 text-start transition-colors"
                >
                  <Settings className="w-4 h-4 text-[var(--ordium-signal)] shrink-0" />
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

    </header>
  );
};
