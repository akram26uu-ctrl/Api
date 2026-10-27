/** ORDIUM Dashboard Sidebar Navigation */
import React, { useEffect, useRef } from 'react';
import { LayoutDashboard, ShoppingCart, ClipboardCheck, Network, Zap, Sliders, Webhook, Key, BarChart3, Cpu, X, Link2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

export type DashboardTab = 'overview' | 'confirmation' | 'orders' | 'network' | 'simulator' | 'rules' | 'integrations' | 'webhooks' | 'apikeys' | 'usage';

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

  const menuItems = [
    { id: 'overview' as DashboardTab, label: t('dashboard.sidebar.overview', 'ملخص المتجر'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'confirmation' as DashboardTab, label: t('dashboard.confirmation_metrics.title', 'مؤشرات تأكيد الطلبات'), icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'orders' as DashboardTab, label: t('dashboard.sidebar.orders', 'الطلبات والتأكيد'), icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'network' as DashboardTab, label: t('dashboard.sidebar.network', 'تحليل المخاطر'), icon: <Network className="w-4 h-4" /> },
    { id: 'simulator' as DashboardTab, label: t('dashboard.sidebar.simulator', 'طلب تجريبي'), icon: <Zap className="w-4 h-4" /> },
    { id: 'rules' as DashboardTab, label: t('dashboard.sidebar.rules', 'قواعد المخاطر'), icon: <Sliders className="w-4 h-4" /> },
    { id: 'integrations' as DashboardTab, label: t('dashboard.sidebar.integrations', 'ربط المتجر'), icon: <Link2 className="w-4 h-4" /> },
    { id: 'webhooks' as DashboardTab, label: t('dashboard.sidebar.webhooks', 'إشعارات الأنظمة'), icon: <Webhook className="w-4 h-4" /> },
    { id: 'apikeys' as DashboardTab, label: t('dashboard.sidebar.apikeys', 'إعدادات الربط'), icon: <Key className="w-4 h-4" /> },
    { id: 'usage' as DashboardTab, label: t('dashboard.sidebar.usage', 'الاستخدام'), icon: <BarChart3 className="w-4 h-4" /> }
  ];

  const sidebarContent = (
    <div className="ordium-sidebar w-[17rem] border-r rtl:border-r-0 rtl:border-l border-white/[0.08] bg-[#090D15]/95 flex flex-col justify-between shrink-0 h-full min-h-0 overflow-y-auto overscroll-contain">
      <div>
        <div className="h-[4.5rem] px-6 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="ordium-brand-mark w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63F5]/20 to-[#43D9E8]/10 border border-[#43D9E8]/20 flex items-center justify-center shadow-lg shadow-black/20"><Cpu className="w-4 h-4 text-[#22D3EE]" /></div>
            <div><span className="font-mono text-sm font-extrabold tracking-wider text-white">ORDIUM</span><span className="block text-[8px] font-mono tracking-widest text-[#22D3EE] uppercase -mt-0.5">{t('nav.console', 'Console')}</span></div>
          </div>
          {onCloseMobile && <button ref={closeButtonRef} type="button" onClick={onCloseMobile} className="lg:hidden inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg text-[#A1AEC1] hover:text-white hover:bg-white/5" aria-label={t('common.close', 'إغلاق')}><X className="w-4 h-4" /></button>}
        </div>
        <nav className="p-4 space-y-1.5" aria-label={t('nav.console', 'Console')}>
          <div className="px-3 py-2 text-[10px] font-mono uppercase text-[#A1AEC1] font-bold tracking-wider text-start">{t('dashboard.sidebar.risk_platform', 'إدارة المتجر')}</div>
          {menuItems.map(item => {
            const isActive = activeTab === item.id;
            return <button key={item.id} type="button" onClick={() => { onSelectTab(item.id); onCloseMobile?.(); }} aria-current={isActive ? 'page' : undefined} className={`ordium-nav-item w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-medium text-start ${isActive ? 'bg-gradient-to-r from-[#6C63F5]/15 to-[#43D9E8]/[0.06] text-white border border-[#6C63F5]/30 shadow-sm font-semibold' : 'text-[#A1AEC1] hover:text-white hover:bg-white/[0.045] active:bg-white/[0.08]'}`}><span className={isActive ? 'text-[#22D3EE]' : 'text-[#A1AEC1]'}>{item.icon}</span><span>{item.label}</span></button>;
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-white/[0.08] space-y-3 shrink-0">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0D1320] border border-white/5 text-xs font-mono"><span className="text-[#A1AEC1] text-[11px]">{t('language.select', 'Language')}:</span><LanguageSwitcher variant="dropdown" align="start" /></div>
        <div className="p-4 rounded-xl bg-[#101827] border border-white/[0.08] text-[11px] text-[#A1AEC1] space-y-1.5 text-start"><div className="font-semibold text-white">{t('dashboard.sidebar.store_workspace', 'مساحة عمل المتجر')}</div><div className="leading-relaxed">{t('dashboard.sidebar.store_workspace_hint', 'تابع الطلبات وسجّل نتائج التواصل من صفحة الطلبات.')}</div></div>
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
