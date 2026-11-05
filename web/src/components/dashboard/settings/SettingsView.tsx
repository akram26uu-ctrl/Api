/**
 * ORDIUM settings — every configurable part of the workspace in one place.
 * The section list shows each section's live state so a merchant can see at a
 * glance what is set up, what is off and what needs attention.
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, BellRing, Boxes, Building2, ChevronLeft, ChevronRight, Key, MapPin, Send, Truck, UserCircle2, Webhook } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { ordiumClient } from '../../../lib/api/client';
import { shippingApi } from '../../../lib/api/shipping';
import { inventoryApi } from '../../../lib/api/inventory';
import { AuthSession, Environment, Store } from '../../../lib/api/types';
import { ErrorBoundary } from '../../common/ErrorBoundary';

const StoresPanel = lazy(() => import('./StoresPanel').then(m => ({ default: m.StoresPanel })));
const CarriersPanel = lazy(() => import('./CarriersPanel').then(m => ({ default: m.CarriersPanel })));
const DispatchSettingsPanel = lazy(() => import('./DispatchSettingsPanel').then(m => ({ default: m.DispatchSettingsPanel })));
const StockSettingsPanel = lazy(() => import('./StockSettingsPanel').then(m => ({ default: m.StockSettingsPanel })));
const PickupSettingsPanel = lazy(() => import('./PickupSettingsPanel').then(m => ({ default: m.PickupSettingsPanel })));
const TrackingSettingsPanel = lazy(() => import('./TrackingSettingsPanel').then(m => ({ default: m.TrackingSettingsPanel })));
const AccountSettingsPanel = lazy(() => import('./AccountSettingsPanel').then(m => ({ default: m.AccountSettingsPanel })));
const UsageView = lazy(() => import('../UsageView').then(m => ({ default: m.UsageView })));
const ApiKeysView = lazy(() => import('../ApiKeysView').then(m => ({ default: m.ApiKeysView })));
const WebhooksView = lazy(() => import('../WebhooksView').then(m => ({ default: m.WebhooksView })));

export const SETTINGS_SECTIONS = ['stores', 'carriers', 'dispatch', 'stock', 'pickup', 'tracking', 'account', 'usage', 'api-keys', 'webhooks'] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number];
export const isSettingsSection = (value: string | undefined): value is SettingsSection =>
  !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);

type Tone = 'ok' | 'off' | 'attention' | 'neutral';
interface SectionStatus { text: string; tone: Tone }

interface SettingsViewProps {
  section: SettingsSection | null;
  onSelectSection: (section: SettingsSection | null) => void;
  session: AuthSession;
  onSessionUpdate: (session: AuthSession) => void;
  stores: Store[];
  selectedStoreId: string;
  onStoresChanged: (stores: Store[]) => void;
  environment: Environment;
  /** Jump to another dashboard tab (used by the stock panel to open Inventory). */
  onNavigate?: (target: 'inventory') => void;
}

const toneClass: Record<Tone, string> = {
  ok: 'settings-status--ok',
  off: 'settings-status--off',
  attention: 'settings-status--attention',
  neutral: 'settings-status--neutral',
};

/** Reads each section's state once per visit; failures simply hide that status. */
function useSectionStatuses(stores: Store[], t: (k: string, f: string) => string, locale: string, storeId: string, environment: Environment) {
  const [statuses, setStatuses] = useState<Partial<Record<SettingsSection, SectionStatus>>>({});
  const refresh = useCallback(() => {
    const set = (key: SettingsSection, value: SectionStatus) => setStatuses(prev => ({ ...prev, [key]: value }));
    const fmt = (n: number) => n.toLocaleString(locale);
    void ordiumClient.getUsage().then(u => {
      const pct = Math.round(u.percent_used || 0);
      set('usage', { text: `${fmt(pct)}%`, tone: pct >= 90 ? 'attention' : 'neutral' });
    }).catch(() => undefined);
    if (storeId) {
      void shippingApi.listCarriers().then(({ accounts }) => {
        const active = accounts.filter(account => account.status === 'active').length;
        set('carriers', active
          ? { text: `${fmt(active)} ${t('settings.shipping.status.connected', 'متصلة')}`, tone: 'ok' }
          : { text: t('settings.status.none', 'لا يوجد'), tone: 'off' });
      }).catch(() => undefined);
      void inventoryApi.getStock().then(rows => {
        const low = rows.filter(row => row.is_low).length;
        if (low) set('stock', { text: `${fmt(low)} ${t('settings.shipping.status.low', 'منخفض')}`, tone: 'attention' });
        else setStatuses(prev => { const { stock: _drop, ...rest } = prev; return rest; });
      }).catch(() => undefined);
    } else {
      setStatuses(prev => { const { carriers: _c, stock: _s, ...rest } = prev; return rest; });
    }
    void ordiumClient.getApiKeys().then(keys => {
      const active = keys.filter(key => key.status === 'active');
      set('api-keys', { text: fmt(active.length), tone: 'neutral' });
    }).catch(() => undefined);
    void ordiumClient.getWebhooks().then(hooks => {
      set('webhooks', hooks.length ? { text: fmt(hooks.length), tone: 'neutral' } : { text: t('settings.status.none', 'لا يوجد'), tone: 'off' });
    }).catch(() => undefined);
  }, [t, locale, storeId, environment]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeStores = stores.filter(store => store.is_active).length;
  const merged: Partial<Record<SettingsSection, SectionStatus>> = {
    ...statuses,
    stores: { text: `${activeStores.toLocaleString(locale)} ${t('settings.status.active', 'نشط')}`, tone: activeStores ? 'neutral' : 'attention' },
  };
  return { statuses: merged, refresh };
}

export const SettingsView: React.FC<SettingsViewProps> = ({ section, onSelectSection, session, onSessionUpdate, stores, selectedStoreId, onStoresChanged, environment, onNavigate }) => {
  const { t, isRTL, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const { statuses, refresh } = useSectionStatuses(stores, t, locale, selectedStoreId, environment);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;

  const groups = useMemo(() => [
    {
      id: 'store', label: t('settings.group.store', 'المتجر'), items: [
        { id: 'stores' as const, icon: Building2, label: t('settings.stores.title', 'المتاجر'), description: t('settings.stores.desc', 'أنشئ متاجرك وفعّلها أو أوقفها. لكل متجر طلباته ومفاتيحه وإحصاءاته.') },
      ],
    },
    {
      id: 'shipping', label: t('settings.group.shipping', 'الشحن'), items: [
        { id: 'carriers' as const, icon: Truck, label: t('settings.shipping.carriers.title', 'شركات التوصيل'), description: t('settings.shipping.carriers.desc', 'اربط حسابات شركات التوصيل التي تشحن عبرها طلباتك.') },
        { id: 'dispatch' as const, icon: Send, label: t('settings.shipping.dispatch.title', 'الإرسال والمسارات'), description: t('settings.shipping.dispatch.desc', 'متى تُرسل الطرود، وماذا يحدث عند الفشل، وأي شركة تتولى أي ولاية.') },
        { id: 'stock' as const, icon: Boxes, label: t('settings.shipping.stock.title', 'المخزون'), description: t('settings.shipping.stock.desc', 'ماذا تفعل عند نفاد منتج، وتنبيه المخزون المنخفض، وحجز الكميات.') },
        { id: 'pickup' as const, icon: MapPin, label: t('settings.shipping.pickup.title', 'نقطة الاستلام والملصقات'), description: t('settings.shipping.pickup.desc', 'عنوان استلام الطرود التي تجهّزها بنفسك وحجم ملصق الشحن.') },
        { id: 'tracking' as const, icon: BellRing, label: t('settings.shipping.tracking.title', 'التتبع والتنبيهات'), description: t('settings.shipping.tracking.desc', 'اختر الأحداث التي تريد أن ننبّهك إليها.') },
      ],
    },
    {
      id: 'account', label: t('settings.group.account', 'الحساب'), items: [
        { id: 'account' as const, icon: UserCircle2, label: t('settings.account.title', 'الملف الشخصي والأمان'), description: t('settings.account.desc', 'بياناتك وبيانات نشاطك، كلمة المرور والجلسات المفتوحة.') },
        { id: 'usage' as const, icon: BarChart3, label: t('settings.usage.title', 'الاستخدام والباقة'), description: t('settings.usage.desc', 'عدد الطلبات المقيَّمة هذا الشهر مقارنةً بحصة باقتك.') },
      ],
    },
    {
      id: 'developers', label: t('settings.group.developers', 'للمطوّرين'), items: [
        { id: 'api-keys' as const, icon: Key, label: t('settings.api_keys.title', 'مفاتيح API'), description: t('settings.api_keys.desc', 'مفاتيح يستعملها نظامك لإرسال الطلبات إلى Ordium. أعطِ كل مفتاح أقل صلاحية يحتاجها.') },
        { id: 'webhooks' as const, icon: Webhook, label: t('settings.webhooks.title', 'Webhooks'), description: t('settings.webhooks.desc', 'نرسل إلى نظامك إشعارًا موقّعًا عند تقييم طلب أو تأكيده أو تحديث نتيجته.') },
      ],
    },
  ], [t]);

  const allItems = groups.flatMap(group => group.items);
  // Desktop always shows a section; phones show the list until one is chosen.
  const current = allItems.find(item => item.id === section) ?? null;
  const shown = current ?? allItems[0];

  // Rules and usage carry their own save/plan toolbar, so they keep their header.
  const ownHeader = shown.id === 'usage';

  const renderSection = () => {
    switch (shown.id) {
      case 'stores': return <StoresPanel stores={stores} onStoresChanged={(items) => { onStoresChanged(items); refresh(); }} />;
      case 'carriers': return <CarriersPanel key={`${selectedStoreId}-${environment}`} storeId={selectedStoreId} environment={environment} onChanged={refresh} />;
      case 'dispatch': return <DispatchSettingsPanel key={selectedStoreId} storeId={selectedStoreId} />;
      case 'stock': return <StockSettingsPanel key={selectedStoreId} storeId={selectedStoreId} onNavigate={onNavigate} />;
      case 'pickup': return <PickupSettingsPanel key={selectedStoreId} storeId={selectedStoreId} />;
      case 'tracking': return <TrackingSettingsPanel key={selectedStoreId} storeId={selectedStoreId} />;
      case 'account': return <AccountSettingsPanel session={session} onSessionUpdate={onSessionUpdate} />;
      case 'usage': return <UsageView />;
      case 'api-keys': return <ApiKeysView environment={environment} />;
      case 'webhooks': return <WebhooksView />;
    }
  };

  const nav = (
    <nav className="settings-nav" aria-label={t('settings.title', 'الإعدادات')}>
      {groups.map(group => (
        <div key={group.id} className="settings-nav-group" role="group" aria-labelledby={`settings-group-${group.id}`}>
          <h3 id={`settings-group-${group.id}`} className="settings-nav-group-label">{group.label}</h3>
          <ul>
            {group.items.map(item => {
              const Icon = item.icon;
              const status = statuses[item.id];
              const active = item.id === shown.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`settings-nav-item ${active ? 'is-active' : ''} ${current ? '' : 'is-list'}`}
                  >
                    <Icon className="settings-nav-icon" aria-hidden="true" />
                    <span className="settings-nav-label">{item.label}</span>
                    {status && <span className={`settings-status ${toneClass[status.tone]}`}>{status.text}</span>}
                    <ForwardChevron className="settings-nav-chevron lg:hidden" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="dashboard-content settings-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`settings-layout ${current ? 'has-selection' : ''}`}>
        <aside className="settings-sidebar">
          <div className="settings-title">
            <h2>{t('settings.title', 'الإعدادات')}</h2>
            <p>{t('settings.subtitle', 'كل ما يخص متجرك وحسابك وربط أنظمتك في مكان واحد.')}</p>
          </div>
          {nav}
        </aside>

        <section className="settings-pane" aria-labelledby="settings-section-title">
          <button type="button" className="settings-back lg:hidden" onClick={() => onSelectSection(null)}>
            <BackIcon className="w-4 h-4" aria-hidden="true" />
            {t('settings.title', 'الإعدادات')}
          </button>
          <header className={`settings-section-header ${ownHeader ? 'sr-only' : ''}`}>
            <h2 id="settings-section-title">{shown.label}</h2>
            <p>{shown.description}</p>
          </header>
          <div className={`settings-section-body ${ownHeader ? 'keeps-own-header' : ''}`}>
            <ErrorBoundary resetKey={shown.id}>
              <Suspense fallback={<div className="dashboard-panel h-40 animate-pulse" role="status" aria-label={t('common.loading', 'جارٍ التحميل…')} />}>
                {renderSection()}
              </Suspense>
            </ErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
};
