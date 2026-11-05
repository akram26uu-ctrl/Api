/** ORDIUM authenticated merchant workspace. */
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AuthSession, Environment, Store } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { DashboardSidebar, DashboardTab } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { MerchantOnboarding } from './MerchantOnboarding';
import { useLanguage } from '../../i18n/LanguageContext';
import { StoreManagementModal } from './StoreManagementModal';
import { EmptyState } from '../common/EmptyState';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { isSettingsSection, SettingsSection } from './settings/SettingsView';

const OverviewView = lazy(() => import('./OverviewView').then(m => ({ default: m.OverviewView })));
const OrdersView = lazy(() => import('./OrdersView').then(m => ({ default: m.OrdersView })));
const ConfirmationView = lazy(() => import('./ConfirmationView').then(m => ({ default: m.ConfirmationView })));
const IdentityNetworkView = lazy(() => import('./IdentityNetworkView').then(m => ({ default: m.IdentityNetworkView })));
const SimulatorView = lazy(() => import('./SimulatorView').then(m => ({ default: m.SimulatorView })));
const SettingsView = lazy(() => import('./settings/SettingsView').then(m => ({ default: m.SettingsView })));
const IntegrationsView = lazy(() => import('./IntegrationsView').then(m => ({ default: m.IntegrationsView })));
const ShipmentsView = lazy(() => import('./ShipmentsView').then(m => ({ default: m.ShipmentsView })));
const RulesEngineView = lazy(() => import('./RulesEngineView').then(m => ({ default: m.RulesEngineView })));

interface DashboardLayoutProps {
  session: AuthSession;
  onLogout: () => void;
}

const DASHBOARD_TABS: DashboardTab[] = ['overview', 'confirmation', 'orders', 'pending', 'shipments', 'inventory', 'integrations', 'network', 'rules', 'simulator', 'settings'];
const isDashboardTab = (value: string): value is DashboardTab => DASHBOARD_TABS.includes(value as DashboardTab);

/** A place in the dashboard: a tab, plus a settings section when the tab is settings. */
export type DashboardRoute = DashboardTab | `settings/${SettingsSection}`;
interface ParsedRoute { tab: DashboardTab; section: SettingsSection | null }

// Pages that moved into Settings keep their old links working.
// Older links keep working: pages that briefly lived in Settings, and the old tab ids.
const LEGACY_ROUTES: Record<string, ParsedRoute> = {
  'settings/integrations': { tab: 'integrations', section: null },
  'settings/risk': { tab: 'rules', section: null },
  'settings/confirmation': { tab: 'confirmation', section: null },
  webhooks: { tab: 'settings', section: 'webhooks' },
  apikeys: { tab: 'settings', section: 'api-keys' },
  usage: { tab: 'settings', section: 'usage' },
};

const parseRoute = (raw: string): ParsedRoute => {
  const clean = raw.replace(/^#\/?/, '');
  if (clean in LEGACY_ROUTES) return LEGACY_ROUTES[clean];
  const [head, sub] = clean.split('/');
  if (head in LEGACY_ROUTES) return LEGACY_ROUTES[head];
  if (head === 'settings') return { tab: 'settings', section: isSettingsSection(sub) ? sub : null };
  return { tab: isDashboardTab(head) ? head : 'overview', section: null };
};
const routeFromHash = (): ParsedRoute => typeof window === 'undefined' ? { tab: 'overview', section: null } : parseRoute(window.location.hash);
const routeToHash = ({ tab, section }: ParsedRoute) => tab === 'settings' && section ? `#/settings/${section}` : `#/${tab}`;

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ session, onLogout }) => {
  const { t } = useLanguage();
  const [currentSession, setCurrentSession] = useState<AuthSession>(session);
  useEffect(() => setCurrentSession(session), [session]);
  const [route, setRoute] = useState<ParsedRoute>(routeFromHash);
  const activeTab = route.tab;
  const [environment] = useState<Environment>('live');
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeManagementOpen, setStoreManagementOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(ordiumClient.getStoreId());
  const [keyRefreshCounter, setKeyRefreshCounter] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const navigateTab = useCallback((target: DashboardRoute) => {
    const next = parseRoute(target);
    setRoute(next);
    const hash = routeToHash(next);
    if (typeof window !== 'undefined' && window.location.hash !== hash) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
    document.querySelector('.dashboard-main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Rewrite legacy links (#/rules, #/apikeys, …) to their Settings address once.
  useEffect(() => {
    const hash = routeToHash(routeFromHash());
    if (window.location.hash && window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }, []);

  useEffect(() => {
    const syncTab = () => setRoute(routeFromHash());
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
      case 'overview': return t('dashboard.sidebar.overview', 'نظرة عامة');
      case 'confirmation': return t('dashboard.sidebar.confirmation_page', 'التأكيد');
      case 'orders': return t('dashboard.sidebar.orders', 'الطلبات');
      case 'pending': return t('dashboard.sidebar.pending', 'بانتظار القرار');
      case 'shipments': return t('dashboard.sidebar.shipments', 'الشحنات');
      case 'inventory': return t('dashboard.sidebar.inventory', 'المخزون');
      case 'network': return t('dashboard.titles.network', 'تحليل المخاطر');
      case 'simulator': return t('dashboard.titles.simulator', 'طلب تجريبي');
      case 'integrations': return t('dashboard.sidebar.integrations', 'ربط المتجر');
      case 'rules': return t('dashboard.sidebar.rules', 'قواعد المخاطر');
      case 'settings': return t('settings.title', 'الإعدادات');
      default: return t('nav.console', 'لوحة التحكم');
    }
  };

  const viewFallback = <div className="dashboard-content" role="status"><div className="dashboard-panel h-40 animate-pulse" aria-label={t('common.loading', 'جارٍ التحميل…')} /></div>;

  return (
    <div className="dashboard-shell flex h-[100dvh] min-h-0 text-[var(--ordium-text)] overflow-hidden">
      <DashboardSidebar activeTab={activeTab} onSelectTab={navigateTab} mobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader environment={environment} stores={stores} selectedStoreId={selectedStoreId} onStoreChange={handleStoreChange} onManageStores={() => navigateTab('settings/stores')} onOpenAccountSettings={() => navigateTab('settings/account')} onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} title={getTabTitle()} session={currentSession} onLogout={onLogout} />
        <main className="dashboard-main flex-1 overflow-y-auto" key={`${selectedStoreId || 'none'}-${keyRefreshCounter}`}>
          {storesLoading ? (
            <div className="min-h-full flex items-center justify-center text-sm text-[var(--ordium-muted)]" role="status">{t('dashboard.stores.loading', 'جارٍ تحميل المتاجر…')}</div>
          ) : selectedStoreId ? (
            <Suspense fallback={viewFallback}>
              <ErrorBoundary resetKey={activeTab}>
              <div className="dashboard-page-enter" key={activeTab}>
                {activeTab === 'overview' && <>{showOnboarding && <MerchantOnboarding onNavigate={navigateTab} onDismiss={dismissOnboarding} />}<OverviewView onNavigateTab={navigateTab} /></>}
                {activeTab === 'confirmation' && <ConfirmationView onOpenOrders={() => navigateTab('orders')} />}
                {activeTab === 'orders' && <OrdersView storeName={stores.find(store => store.id === selectedStoreId)?.name} onOpenSimulator={() => navigateTab('simulator')} onOpenConfirmation={() => navigateTab('confirmation')} />}
                {(activeTab === 'pending' || activeTab === 'inventory') && <div className="dashboard-content"><EmptyState title={getTabTitle()} description={t('shipping.coming_soon', 'هذه الصفحة قيد الإعداد وستتوفر قريبًا.')} /></div>}
                {activeTab === 'shipments' && <ShipmentsView environment={environment} onNavigate={navigateTab} />}
                {activeTab === 'integrations' && <IntegrationsView storeId={selectedStoreId} />}
                {activeTab === 'network' && <IdentityNetworkView />}
                {activeTab === 'rules' && <RulesEngineView />}
                {activeTab === 'simulator' && <SimulatorView storeId={selectedStoreId} onOrderCreated={() => navigateTab('orders')} />}
                {activeTab === 'settings' && <SettingsView section={route.section} onSelectSection={section => navigateTab(section ? `settings/${section}` : 'settings')} session={currentSession} onSessionUpdate={setCurrentSession} stores={stores} selectedStoreId={selectedStoreId} onStoresChanged={handleStoresChanged} environment={environment} />}
              </div>
              </ErrorBoundary>
            </Suspense>
          ) : (
            <div className="min-h-full flex items-center justify-center p-6 text-center"><div className="max-w-md"><p className="text-sm font-semibold text-white">{t('dashboard.stores.required_title', 'أنشئ متجرك أولًا')}</p><p className="text-sm text-[var(--ordium-muted)] mt-2">{t('dashboard.stores.required_desc', 'للبدء واستقبال الطلبات، يجب إنشاء متجر واحد على الأقل.')}</p></div></div>
          )}
        </main>
      </div>
      {storeManagementOpen && !storesLoading && !stores.some(item => item.is_active) && <StoreManagementModal stores={stores} onStoresChanged={handleStoresChanged} />}
    </div>
  );
};
