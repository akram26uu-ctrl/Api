/**
 * ORDIUM Dashboard Sidebar Navigation
 */

import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Network,
  Zap,
  Sliders,
  Webhook,
  Key,
  BarChart3,
  Cpu,
  X
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

export type DashboardTab =
  | 'overview'
  | 'orders'
  | 'network'
  | 'simulator'
  | 'rules'
  | 'webhooks'
  | 'apikeys'
  | 'usage';

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen = false,
  onCloseMobile
}) => {
  const { t, isRTL } = useLanguage();

  const menuItems = [
    { id: 'overview' as DashboardTab, label: t('dashboard.sidebar.overview', 'ملخص المتجر'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'orders' as DashboardTab, label: t('dashboard.sidebar.orders', 'الطلبات والتأكيد'), icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'network' as DashboardTab, label: t('dashboard.sidebar.network', 'تحليل المخاطر'), icon: <Network className="w-4 h-4" /> },
    { id: 'simulator' as DashboardTab, label: t('dashboard.sidebar.simulator', 'طلب تجريبي'), icon: <Zap className="w-4 h-4" /> },
    { id: 'rules' as DashboardTab, label: t('dashboard.sidebar.rules', 'قواعد المخاطر'), icon: <Sliders className="w-4 h-4" /> },
    { id: 'webhooks' as DashboardTab, label: t('dashboard.sidebar.webhooks', 'تكاملات المتجر'), icon: <Webhook className="w-4 h-4" /> },
    { id: 'apikeys' as DashboardTab, label: t('dashboard.sidebar.apikeys', 'إعدادات الربط'), icon: <Key className="w-4 h-4" /> },
    { id: 'usage' as DashboardTab, label: t('dashboard.sidebar.usage', 'الاستخدام'), icon: <BarChart3 className="w-4 h-4" /> }
  ];

  const sidebarContent = (
    <div className="w-64 border-r rtl:border-r-0 rtl:border-l border-white/5 bg-[#080B12] flex flex-col justify-between shrink-0 h-full min-h-0 overflow-y-auto overscroll-contain">
      {/* Brand Top */}
      <div>
        <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#0D1320] border border-white/10 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-[#22D3EE]" />
            </div>
            <div>
              <span className="font-mono text-sm font-extrabold tracking-wider text-white">ORDIUM</span>
              <span className="block text-[8px] font-mono tracking-widest text-[#22D3EE] uppercase -mt-0.5">
                {t('nav.console', 'Console')}
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav Links */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-mono uppercase text-[#94A3B8] font-bold tracking-wider text-start">
            {t('dashboard.sidebar.risk_platform', 'إدارة المتجر')}
          </div>

          {menuItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-start ${
                  isActive
                    ? 'bg-[#0D1320] text-white border border-[#22D3EE]/30 shadow-lg shadow-[#22D3EE]/5 font-semibold'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={isActive ? 'text-[#22D3EE]' : 'text-[#94A3B8]'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
        {/* Language selector in sidebar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0D1320] border border-white/5 text-xs font-mono">
          <span className="text-[#94A3B8] text-[11px]">{t('language.select', 'Language')}:</span>
          <LanguageSwitcher variant="dropdown" align="start" />
        </div>

        <div className="p-3 rounded-xl bg-[#0D1320] border border-white/5 text-[11px] text-[#94A3B8] space-y-1.5 text-start">
          <div className="font-semibold text-white">{t('dashboard.sidebar.store_workspace', 'مساحة عمل المتجر')}</div>
          <div className="leading-relaxed">{t('dashboard.sidebar.store_workspace_hint', 'تابع الطلبات وسجّل نتائج التواصل من صفحة الطلبات.')}</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          {/* Slide Drawer */}
          <div className={`relative z-10 h-[100dvh] max-h-[100dvh] animate-in ${isRTL ? 'slide-in-from-right' : 'slide-in-from-left'} duration-200`}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
