/**
 * ORDIUM Authenticated لوحة التحكم & Dashboard Layout
 */

import React, { useEffect, useState } from 'react';
import { AuthSession, Environment, Store } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { DashboardSidebar, DashboardTab } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { OverviewView } from './OverviewView';
import { MerchantOnboarding } from './MerchantOnboarding';
import { OrdersView } from './OrdersView';
import { IdentityNetworkView } from './IdentityNetworkView';
import { SimulatorView } from './SimulatorView';
import { RulesEngineView } from './RulesEngineView';
import { WebhooksView } from './WebhooksView';
import { ApiKeysView } from './ApiKeysView';
import { UsageView } from './UsageView';
import { useLanguage } from '../../i18n/LanguageContext';
import { StoreManagementModal } from './StoreManagementModal';

interface DashboardLayoutProps {
  onExitToWebsite: () => void;
  session: AuthSession;
  onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ onExitToWebsite, session, onLogout }) => {
  const { t } = useLanguage();
  const [currentSession, setCurrentSession] = useState<AuthSession>(session);
  useEffect(() => setCurrentSession(session), [session]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [environment] = useState<Environment>('live');
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeManagementOpen, setStoreManagementOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(ordiumClient.getStoreId());
  const [keyRefreshCounter, setKeyRefreshCounter] = useState(0);
  useEffect(() => {
    let mounted = true;
    setStoresLoading(true);
    void ordiumClient.getStores().then(items => {
      if (!mounted) return;
      setStores(items);
      const active = items.find(item => item.id === selectedStoreId && item.is_active) || items.find(item => item.is_active);
      if (active) { ordiumClient.setStoreId(active.id); setSelectedStoreId(active.id); } else { ordiumClient.setStoreId(null); setSelectedStoreId(null); }
      setStoreManagementOpen(items.every(item => !item.is_active));
    }).catch(() => {
      if (mounted) { setStores([]); setStoreManagementOpen(true); }
    }).finally(() => { if (mounted) setStoresLoading(false); });
    return () => { mounted = false; };
  }, []);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const onboardingStorageKey = `ordium:onboarding:${currentSession.organization?.id ?? currentSession.user.id}`;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return window.localStorage.getItem(onboardingStorageKey) !== 'complete'; } catch { return true; }
  });
  const dismissOnboarding = () => {
    try { window.localStorage.setItem(onboardingStorageKey, 'complete'); } catch { /* ignore storage restrictions */ }
    setShowOnboarding(false);
  };

  const handleStoreChange = (storeId: string) => { ordiumClient.setStoreId(storeId); setSelectedStoreId(storeId); setKeyRefreshCounter(prev => prev + 1); };
  const handleStoresChanged = (items: Store[]) => {
    setStores(items);
    const active = items.find(item => item.id === selectedStoreId && item.is_active) || items.find(item => item.is_active);
    if (active) { ordiumClient.setStoreId(active.id); setSelectedStoreId(active.id); } else { ordiumClient.setStoreId(null); setSelectedStoreId(null); }
    if (items.length > 0) setStoreManagementOpen(false);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview':
        return t('dashboard.titles.overview', 'نظرة عامة');
      case 'orders':
        return t('dashboard.titles.orders', 'الطلبات والمخاطر');
      case 'network':
        return t('dashboard.titles.network', 'شبكة الهوية');
      case 'simulator':
        return t('dashboard.titles.simulator', 'محاكي الطلبات');
      case 'rules':
        return t('dashboard.titles.rules', 'قواعد المخاطر');
      case 'webhooks':
        return t('dashboard.titles.webhooks', 'Webhooks وسجل الإرسال');
      case 'apikeys':
        return t('dashboard.titles.apikeys', 'مفاتيح API');
      case 'usage':
        return t('dashboard.titles.usage', 'الاستخدام والحصص');
      default:
        return t('nav.console', 'لوحة التحكم');
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-0 bg-[#080B12] text-[#F8FAFC] overflow-hidden">
      {/* Sidebar (Desktop + Mobile Drawer) */}
      <DashboardSidebar
        activeTab={activeTab}
        onSelectTab={tab => setActiveTab(tab)}
        onExitToWebsite={onExitToWebsite}
        mobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          environment={environment}
          stores={stores}
          selectedStoreId={selectedStoreId}
          onStoreChange={handleStoreChange}
          onManageStores={() => setStoreManagementOpen(true)}
          onOpenSimulator={() => setActiveTab('simulator')}
          onExitToWebsite={onExitToWebsite}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          title={getTabTitle()}
          session={currentSession}
          onSessionUpdate={setCurrentSession}
          onLogout={onLogout}
        />

        <main className="flex-1 overflow-y-auto" key={`${selectedStoreId || "none"}-${keyRefreshCounter}`}>
          {storesLoading ? (
            <div className="min-h-full flex items-center justify-center text-xs text-[#64748B]">{t('dashboard.stores.loading', 'جارٍ تحميل المتاجر…')}</div>
          ) : selectedStoreId ? <>
          {activeTab === 'overview' && (
            <>
              {showOnboarding && (
                <MerchantOnboarding onNavigateTab={tab => setActiveTab(tab)} onDismiss={dismissOnboarding} />
              )}
              <OverviewView onNavigateTab={tab => setActiveTab(tab)} />
            </>
          )}
          {activeTab === 'orders' && (
            <OrdersView onOpenSimulator={() => setActiveTab('simulator')} />
          )}
          {activeTab === 'network' && <IdentityNetworkView />}
          {activeTab === 'simulator' && (
            <SimulatorView storeId={selectedStoreId} onOrderCreated={() => {}} />
          )}
          {activeTab === 'rules' && <RulesEngineView />}
          {activeTab === 'webhooks' && <WebhooksView />}
          {activeTab === 'apikeys' && <ApiKeysView environment={environment} />}
          {activeTab === 'usage' && <UsageView />}
          </> : (
            <div className="min-h-full flex items-center justify-center p-6 text-center">
              <div className="max-w-md"><p className="text-sm font-semibold text-white">{t('dashboard.stores.required_title', 'أنشئ متجرك أولًا')}</p><p className="text-xs text-[#64748B] mt-2">{t('dashboard.stores.required_desc', 'للبدء واستقبال الطلبات، يجب إنشاء متجر واحد على الأقل.')}</p></div>
            </div>
          )}
        </main>
      </div>

      {storeManagementOpen && (
        <StoreManagementModal
          stores={stores}
          onStoresChanged={handleStoresChanged}
          required={!storesLoading && !stores.some(item => item.is_active)}
          onClose={() => setStoreManagementOpen(false)}
        />
      )}
    </div>
  );
};
