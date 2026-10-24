/** ORDIUM authenticated merchant workspace. */
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AuthSession, Environment, Store } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { DashboardSidebar, DashboardTab } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { MerchantOnboarding } from './MerchantOnboarding';
import { useLanguage } from '../../i18n/LanguageContext';
import { StoreManagementModal } from './StoreManagementModal';

const OverviewView = lazy(() => import('./OverviewView').then(m => ({ default: m.OverviewView })));
const OrdersView = lazy(() => import('./OrdersView').then(m => ({ default: m.OrdersView })));
const ConfirmationView = lazy(() => import('./ConfirmationView').then(m => ({ default: m.ConfirmationView })));
const IdentityNetworkView = lazy(() => import('./IdentityNetworkView').then(m => ({ default: m.IdentityNetworkView })));
const SimulatorView = lazy(() => import('./SimulatorView').then(m => ({ default: m.SimulatorView })));
const RulesEngineView = lazy(() => import('./RulesEngineView').then(m => ({ default: m.RulesEngineView })));
const WebhooksView = lazy(() => import('./WebhooksView').then(m => ({ default: m.WebhooksView })));
const ApiKeysView = lazy(() => import('./ApiKeysView').then(m => ({ default: m.ApiKeysView })));
const UsageView = lazy(() => import('./UsageView').then(m => ({ default: m.UsageView })));

interface DashboardLayoutProps {
  session: AuthSession;
  onLogout: () => void;
}

const DASHBOARD_TABS: DashboardTab[] = ['overview', 'confirmation', 'orders', 'network', 'simulator', 'rules', 'webhooks', 'apikeys', 'usage'];
const isDashboardTab = (value: string): value is DashboardTab => DASHBOARD_TABS.includes(value as DashboardTab);
const tabFromHash = (): DashboardTab => {
  if (typeof window === 'undefined') return 'overview';
  const value = window.location.hash.replace(/^#\/?/, '');
  return isDashboardTab(value) ? value : 'overview';
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ session, onLogout }) => {
  const { t } = useLanguage();
  const [currentSession, setCurrentSession] = useState<AuthSession>(session);
  useEffect(() => setCurrentSession(session), [session]);
  const [activeTab, setActiveTab] = useState<DashboardTab>(tabFromHash);
  const [environment] = useState<Environment>('live');
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeManagementOpen, setStoreManagementOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(ordiumClient.getStoreId());
  const [keyRefreshCounter, setKeyRefreshCounter] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const navigateTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && tabFromHash() !== tab) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#/${tab}`);
    }
    document.querySelector('.dashboard-main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const syncTab = () => setActiveTab(tabFromHash());
    window.addEventListener('hashchange', syncTab);
    window.addEventListener('popstate', syncTab);
    return () => {
      window.removeEventListener('hashchange', syncTab);
      window.removeEventListener('popstate', syncTab);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setStoresLoading(true);
    void ordiumClient.getStores().then(items => {
      if (!mounted) return;
      setStores(items);
      const active = items.find(item => item.id === selectedStoreId && item.is_active) || items.find(item => item.is_active);
      if (active) { ordiumClient.setStoreId(active.id); setSelectedStoreId(active.id); }
      else { ordiumClient.setStoreId(null); setSelectedStoreId(null); }
      setStoreManagementOpen(items.every(item => !item.is_active));
    }).catch(() => {
      if (mounted) { setStores([]); setStoreManagementOpen(true); }
    }).finally(() => { if (mounted) setStoresLoading(false); });
    return () => { mounted = false; };
  }, []);

  const onboardingStorageKey = `ordium:onboarding:${currentSession.organization?.id ?? currentSession.user.id}`;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return window.localStorage.getItem(onboardingStorageKey) !== 'complete'; }
    catch { return true; }
  });
  const dismissOnboarding = () => {
    try { window.localStorage.setItem(onboardingStorageKey, 'complete'); } catch { /* Storage may be restricted. */ }
    setShowOnboarding(false);
  };

  const handleStoreChange = (storeId: string) => {
    ordiumClient.setStoreId(storeId);
    setSelectedStoreId(storeId);
    setKeyRefreshCounter(prev => prev + 1);
  };
  const handleStoresChanged = (items: Store[]) => {
    setStores(items);
    const active = items.find(item => item.id === selectedStoreId && item.is_active) || items.find(item => item.is_active);
    if (active) { ordiumClient.setStoreId(active.id); setSelectedStoreId(active.id); }
    else { ordiumClient.setStoreId(null); setSelectedStoreId(null); }
    if (items.length > 0) setStoreManagementOpen(false);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview': return t('dashboard.titles.overview', 'ملخص المتجر');
      case 'confirmation': return t('dashboard.confirmation_metrics.title', 'مؤشرات تأكيد الطلبات');
      case 'orders': return t('dashboard.titles.orders', 'الطلبات والتأكيد');
      case 'network': return t('dashboard.titles.network', 'تحليل المخاطر');
      case 'simulator': return t('dashboard.titles.simulator', 'طلب تجريبي');
      case 'rules': return t('dashboard.titles.rules', 'قواعد المخاطر');
      case 'webhooks': return t('dashboard.titles.webhooks', 'تكاملات المتجر');
      case 'apikeys': return t('dashboard.titles.apikeys', 'إعدادات الربط');
      case 'usage': return t('dashboard.titles.usage', 'الاستخدام');
      default: return t('nav.console', 'لوحة التحكم');
    }
  };

  const viewFallback = <div className="dashboard-content" role="status"><div className="dashboard-panel h-40 animate-pulse" aria-label={t('common.loading', 'جارٍ التحميل…')} /></div>;

  return (
    <div className="dashboard-shell flex h-[100dvh] min-h-0 text-[#F1F5F9] overflow-hidden">
      <DashboardSidebar activeTab={activeTab} onSelectTab={navigateTab} mobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader environment={environment} stores={stores} selectedStoreId={selectedStoreId} onStoreChange={handleStoreChange} onManageStores={() => setStoreManagementOpen(true)} onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} title={getTabTitle()} session={currentSession} onSessionUpdate={setCurrentSession} onLogout={onLogout} />
        <main className="dashboard-main flex-1 overflow-y-auto" key={`${selectedStoreId || 'none'}-${keyRefreshCounter}`}>
          {storesLoading ? (
            <div className="min-h-full flex items-center justify-center text-sm text-[#A1AEC1]" role="status">{t('dashboard.stores.loading', 'جارٍ تحميل المتاجر…')}</div>
          ) : selectedStoreId ? (
            <Suspense fallback={viewFallback}>
              <div className="dashboard-page-enter" key={activeTab}>
                {activeTab === 'overview' && <>{showOnboarding && <MerchantOnboarding onNavigateTab={navigateTab} onDismiss={dismissOnboarding} onManageStores={() => setStoreManagementOpen(true)} />}<OverviewView onNavigateTab={navigateTab} /></>}
                {activeTab === 'confirmation' && <ConfirmationView onOpenOrders={() => navigateTab('orders')} />}
                {activeTab === 'orders' && <OrdersView onOpenSimulator={() => navigateTab('simulator')} />}
                {activeTab === 'network' && <IdentityNetworkView />}
                {activeTab === 'simulator' && <SimulatorView storeId={selectedStoreId} onOrderCreated={() => navigateTab('orders')} />}
                {activeTab === 'rules' && <RulesEngineView />}
                {activeTab === 'webhooks' && <WebhooksView />}
                {activeTab === 'apikeys' && <ApiKeysView environment={environment} />}
                {activeTab === 'usage' && <UsageView />}
              </div>
            </Suspense>
          ) : (
            <div className="min-h-full flex items-center justify-center p-6 text-center"><div className="max-w-md"><p className="text-sm font-semibold text-white">{t('dashboard.stores.required_title', 'أنشئ متجرك أولًا')}</p><p className="text-sm text-[#A1AEC1] mt-2">{t('dashboard.stores.required_desc', 'للبدء واستقبال الطلبات، يجب إنشاء متجر واحد على الأقل.')}</p></div></div>
          )}
        </main>
      </div>
      {storeManagementOpen && <StoreManagementModal stores={stores} onStoresChanged={handleStoresChanged} required={!storesLoading && !stores.some(item => item.is_active)} onClose={() => setStoreManagementOpen(false)} />}
    </div>
  );
};
