/** ORDIUM Dashboard Sidebar Navigation */
import React, { useEffect, useRef } from 'react';
import { LayoutDashboard, ShoppingCart, ClipboardCheck, Network, Zap, Cpu, X, Settings, Link2, Sliders } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

export type DashboardTab = 'overview' | 'confirmation' | 'orders' | 'integrations' | 'network' | 'rules' | 'simulator' | 'settings';

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ activeTab, onSelectTab, mobileOpen = false, onCloseMobile }) => {
  const { t, isRTL } = useLanguage();
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onCloseMobile);
  onCloseRef.current = onCloseMobile;

  useEffect(() => {
    if (!mobileOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current?.(); return; }
      if (event.key !== 'Tab' || !mobileDialogRef.current) return;
      const focusableElements = Array.from(mobileDialogRef.current.querySelectorAll<HTMLElement>('button, [href], select, [tabindex]:not([tabindex="-1"])')) as HTMLElement[];
      const focusable = focusableElements.filter(el => !el.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [mobileOpen]);

  // Daily work only. Everything configurable lives in Settings (bottom of the rail).
  const menuGroups: { label: string; items: { id: DashboardTab; label: string; icon: React.ReactNode }[] }[] = [
    {
      label: t('dashboard.sidebar.group_main', 'الرئيسية'),
      items: [
        { id: 'overview', label: t('dashboard.sidebar.overview', 'نظرة عامة'), icon: <LayoutDashboard className="w-4 h-4" /> }
      ]
    },
    {
      label: t('dashboard.sidebar.group_orders', 'الطلبات'),
      items: [
        { id: 'orders', label: t('dashboard.sidebar.orders', 'الطلبات'), icon: <ShoppingCart className="w-4 h-4" /> },
        { id: 'confirmation', label: t('dashboard.sidebar.confirmation_page', 'التأكيد'), icon: <ClipboardCheck className="w-4 h-4" /> }
      ]
    },
    {
      label: t('dashboard.sidebar.group_store', 'المتجر'),
      items: [
        { id: 'integrations', label: t('dashboard.sidebar.integrations', 'ربط المتجر'), icon: <Link2 className="w-4 h-4" /> }
      ]
    },
    {
      label: t('dashboard.sidebar.group_risk', 'المخاطر'),
      items: [
        { id: 'network', label: t('dashboard.sidebar.network', 'تحليل المخاطر'), icon: <Network className="w-4 h-4" /> },
        { id: 'rules', label: t('dashboard.sidebar.rules', 'قواعد المخاطر'), icon: <Sliders className="w-4 h-4" /> },
        { id: 'simulator', label: t('dashboard.sidebar.simulator', 'طلب تجريبي'), icon: <Zap className="w-4 h-4" /> }
      ]
    }
  ];

  const sidebarContent = (
    <div className="ordium-sidebar w-[17rem] border-r rtl:border-r-0 rtl:border-l border-white/[0.08] bg-[#090D15]/95 flex flex-col justify-between shrink-0 h-full min-h-0 overflow-y-auto overscroll-contain">
      <div>
        <div className="h-[4.5rem] px-6 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="ordium-brand-mark w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--ordium-accent)]/20 to-[var(--ordium-signal)]/10 border border-[var(--ordium-signal)]/20 flex items-center justify-center shadow-lg shadow-black/20"><Cpu className="w-4 h-4 text-[var(--ordium-signal)]" /></div>
            <div><span className="font-mono text-sm font-extrabold tracking-wider text-white">ORDIUM</span><span className="block text-xs font-mono tracking-widest text-[var(--ordium-signal)] uppercase -mt-0.5">{t('nav.console', 'Console')}</span></div>
          </div>
          {onCloseMobile && <button ref={closeButtonRef} type="button" onClick={onCloseMobile} className="lg:hidden inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg text-[var(--ordium-muted)] hover:text-white hover:bg-white/5" aria-label={t('common.close', 'إغلاق')}><X className="w-4 h-4" /></button>}
        </div>
        <nav className="p-4 space-y-4" aria-label={t('nav.console', 'Console')}>
          {menuGroups.map(group => (
            <div key={group.label} className="space-y-1.5">
              <div className="px-3 pt-1.5 pb-1 text-xs font-semibold text-[var(--ordium-subtle)] text-start">{group.label}</div>
              {group.items.map(item => {
                const isActive = activeTab === item.id;
                return <button key={item.id} type="button" onClick={() => { onSelectTab(item.id); onCloseMobile?.(); }} aria-current={isActive ? 'page' : undefined} className={`ordium-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-start ${isActive ? 'bg-gradient-to-r from-[var(--ordium-accent)]/15 to-[var(--ordium-signal)]/[0.06] text-white border border-[var(--ordium-accent)]/30 shadow-sm font-semibold' : 'text-[var(--ordium-muted)] hover:text-white hover:bg-white/[0.045] active:bg-white/[0.08]'}`}><span className={isActive ? 'text-[var(--ordium-signal)]' : 'text-[var(--ordium-muted)]'}>{item.icon}</span><span>{item.label}</span></button>;
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="p-4 border-t border-white/[0.08] space-y-2 shrink-0">
        <button type="button" onClick={() => { onSelectTab('settings'); onCloseMobile?.(); }} aria-current={activeTab === 'settings' ? 'page' : undefined} className={`ordium-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-start ${activeTab === 'settings' ? 'bg-gradient-to-r from-[var(--ordium-accent)]/15 to-[var(--ordium-signal)]/[0.06] text-white border border-[var(--ordium-accent)]/30 font-semibold' : 'text-[var(--ordium-muted)] hover:text-white hover:bg-white/[0.045] active:bg-white/[0.08]'}`}><Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[var(--ordium-signal)]' : ''}`} /><span>{t('settings.title', 'الإعدادات')}</span></button>
        <div className="flex items-center justify-between px-3.5 py-2 text-[13px] text-[var(--ordium-muted)]"><span>{t('language.select', 'اللغة')}</span><LanguageSwitcher variant="dropdown" align="start" /></div>
      </div>
    </div>
  );

  return <>
    <aside className="hidden lg:flex shrink-0 h-full">{sidebarContent}</aside>
    {mobileOpen && <div ref={mobileDialogRef} className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={t('nav.console', 'Console')}>
      <button type="button" tabIndex={-1} className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-default" onClick={onCloseMobile} aria-label={t('common.close', 'إغلاق')} />
      <div className={`ordium-mobile-drawer relative z-10 h-[100dvh] max-h-[100dvh] ${isRTL ? 'ordium-drawer-from-right' : 'ordium-drawer-from-left'}`}>{sidebarContent}</div>
    </div>}
  </>;
};
