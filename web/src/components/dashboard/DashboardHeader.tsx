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

  return (
    <header className="dashboard-topbar sticky top-0 z-40 min-h-16 border-b border-white/5 bg-[var(--ordium-canvas)]/95 backdrop-blur-xl px-2 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-3">
      {/* Left: Mobile sidebar control, optional desktop title, and store selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="lg:hidden inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg text-[var(--ordium-muted)] hover:text-white hover:bg-white/5 shrink-0"
            aria-label={t('ui.open_menu', 'Open menu')}
          >
            <PanelLeft aria-hidden="true" className="w-5 h-5 rtl:-scale-x-100" strokeWidth={1.8} />
          </button>
        )}

        <h1 className="sr-only lg:not-sr-only text-xl font-semibold text-[var(--ordium-text)] truncate">
          {title}
        </h1>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden sm:inline text-xs text-[var(--ordium-subtle)]">{t('dashboard.header.store_label', 'المتجر')}</span>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[var(--ordium-surface)] px-1 sm:px-1.5 py-1 min-w-0 max-w-[min(56vw,15rem)] sm:max-w-none">
            <StoreIcon className="w-3.5 h-3.5 text-[var(--ordium-signal)] shrink-0" />
            <select disabled={!stores.length} value={selectedStoreId || ''} onChange={e => onStoreChange(e.target.value)} className="w-[min(38vw,9.5rem)] sm:w-auto sm:max-w-[170px] bg-transparent px-0.5 sm:px-1 text-xs text-white outline-none disabled:text-[var(--ordium-subtle)] truncate">
              {stores.length ? stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>) : <option value="">{t('dashboard.header.no_store', 'لا يوجد متجر')}</option>}
            </select>
            <button type="button" onClick={onManageStores} className="p-1.5 rounded-lg text-[var(--ordium-muted)] hover:text-white hover:bg-white/5" aria-label={t('dashboard.header.manage_stores', 'إدارة المتاجر')} title={t('dashboard.header.manage_stores', 'إدارة المتاجر')}>
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Notifications, Language & Account */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {selectedStoreId && <NotificationsCenter environment={environment} />}

        {/* Language Switcher in Header */}
        {/* Phones: the language switcher lives in the side menu, freeing room for the store name. */}
        <div className="hidden sm:flex items-center ps-2 border-s border-white/10 shrink-0">
          <LanguageSwitcher variant="dropdown" align="end" />
        </div>

        <div className="relative shrink-0" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(prev => !prev)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label={t('dashboard.profile.open', t('dashboard.profile.open','فتح قائمة الحساب'))}
            className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--ordium-accent)]/50 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-[var(--ordium-accent)]/20 border border-[var(--ordium-accent)]/40 flex items-center justify-center font-mono text-xs font-bold text-[var(--ordium-signal)]">
              {initials}
            </span>
            <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[var(--ordium-subtle)] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
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

              <div className="p-2">
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
