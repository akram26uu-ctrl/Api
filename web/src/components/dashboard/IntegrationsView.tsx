import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, KeyRound, Link2, PauseCircle, PlayCircle,
  Plug, ShieldCheck, Store, Trash2, Code2, ShoppingBag, Globe, Boxes, BookOpen,
} from 'lucide-react';
import { ordiumClient } from '../../lib/api/client';
import { CreatedIntegrationConnection, IntegrationConnection, IntegrationPlatform } from '../../lib/api/types';
import { Button } from '../common/Button';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { useLanguage } from '../../i18n/LanguageContext';

interface IntegrationsViewProps {
  storeId: string | null;
}

const SAMPLE_PAYLOAD = `{
  "event": "order.created",
  "event_id": "delivery-123",
  "data": {
    "id": "STORE-ORDER-123",
    "customer": {
      "first_name": "Ali",
      "last_name": "Bena",
      "phone": "0550123456"
    },
    "shipping_address": {
      "wilaya": "Alger",
      "commune": "Bab El Oued",
      "address": "12 Rue Exemple"
    },
    "total_price": "4200.00",
    "currency": "DZD",
    "items": [
      { "name": "Product", "sku": "SKU-001", "quantity": 2, "unit_price": "2100.00" }
    ]
  }
}`;

const SHOPIFY_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const normalizeShopifyDomain = (value: string) => value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

interface PlatformInfo {
  id: IntegrationPlatform;
  icon: React.ReactNode;
  name: string;
  badge?: string;
  summary: string;
  externalLabel: string;
  externalPlaceholder: string;
  externalHint: string;
  steps: string[];
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ storeId }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<IntegrationPlatform>('shopify');
  const [displayName, setDisplayName] = useState('');
  const [externalStoreId, setExternalStoreId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdConnection, setCreatedConnection] = useState<CreatedIntegrationConnection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationConnection | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [secretTarget, setSecretTarget] = useState<IntegrationConnection | null>(null);
  const [secretValue, setSecretValue] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);

  const platforms: PlatformInfo[] = useMemo(() => [
    {
      id: 'shopify',
      icon: <ShoppingBag className="h-5 w-5" />,
      name: 'Shopify',
      summary: t('dashboard.integrations.shopify_summary', 'Receive new Shopify orders through a webhook you create in your Shopify admin.'),
      externalLabel: t('dashboard.integrations.shopify_domain_label', 'Shopify store domain'),
      externalPlaceholder: 'your-store.myshopify.com',
      externalHint: t('dashboard.integrations.shopify_domain_hint', 'Use the permanent *.myshopify.com domain (Shopify admin > Settings > Domains), not your custom domain.'),
      steps: [
        t('dashboard.integrations.shopify_step1', 'Create the connection here, then copy the order receiving URL.'),
        t('dashboard.integrations.shopify_step2', 'In Shopify admin open Settings > Notifications > Webhooks and click "Create webhook".'),
        t('dashboard.integrations.shopify_step3', 'Choose the event "Order creation", format JSON, paste the ORDIUM URL and save.'),
        t('dashboard.integrations.shopify_step4', 'Copy the signing secret Shopify shows in the Webhooks section ("Your webhooks will be signed with…").'),
        t('dashboard.integrations.shopify_step5', 'Back in ORDIUM, click "Add signing secret" on the connection, paste it and save. Then place a test order.'),
      ],
    },
    {
      id: 'youcan',
      icon: <Boxes className="h-5 w-5" />,
      name: 'YouCan',
      badge: t('dashboard.integrations.beta', 'Beta'),
      summary: t('dashboard.integrations.youcan_summary', 'Receive YouCan orders through a webhook. Support is in beta: send a test order and confirm it arrives.'),
      externalLabel: t('dashboard.integrations.youcan_id_label', 'YouCan store address'),
      externalPlaceholder: 'your-store.youcan.shop',
      externalHint: t('dashboard.integrations.external_id_hint', 'Use a stable value that uniquely identifies this store, such as its main domain.'),
      steps: [
        t('dashboard.integrations.youcan_step1', 'Create the connection here and copy the receiving URL and the signing secret.'),
        t('dashboard.integrations.youcan_step2', 'In your YouCan dashboard add a webhook for new orders and paste the ORDIUM URL.'),
        t('dashboard.integrations.youcan_step3', 'If YouCan shows its own signing secret, paste it here with "Add signing secret"; otherwise enter the ORDIUM secret in YouCan.'),
        t('dashboard.integrations.youcan_step4', 'Place a test order and check that "Last order received" updates below.'),
      ],
    },
    {
      id: 'woocommerce',
      icon: <Globe className="h-5 w-5" />,
      name: 'WooCommerce',
      summary: t('dashboard.integrations.woocommerce_hint', 'Create a webhook in WooCommerce with the Order created event, then use the receiving URL and secret ORDIUM generates.'),
      externalLabel: t('dashboard.integrations.woocommerce_domain_label', 'Store domain'),
      externalPlaceholder: 'shop.example.dz',
      externalHint: t('dashboard.integrations.external_id_hint', 'Use a stable value that uniquely identifies this store, such as its main domain.'),
      steps: [
        t('dashboard.integrations.woocommerce_step1', 'In WooCommerce open Settings > Advanced > Webhooks.'),
        t('dashboard.integrations.woocommerce_step2', 'Create a new webhook and choose the Order created topic.'),
        t('dashboard.integrations.woocommerce_step3', 'Copy the receiving URL and secret from the connection details once it is created.'),
        t('dashboard.integrations.woocommerce_step4', 'Paste the URL and secret in WooCommerce, save, then place a test order.'),
      ],
    },
    {
      id: 'custom',
      icon: <Code2 className="h-5 w-5" />,
      name: t('dashboard.integrations.custom_name', 'Custom store / own hosting'),
      summary: t('dashboard.integrations.custom_hint', 'For your own store or any platform that can send a signed webhook in the standard ORDIUM format.'),
      externalLabel: t('dashboard.integrations.external_id', 'Store identifier on its platform'),
      externalPlaceholder: t('dashboard.integrations.external_id_placeholder', 'e.g. shop.example.com or your store ID'),
      externalHint: t('dashboard.integrations.external_id_hint', 'Use a stable value that uniquely identifies this store, such as its main domain.'),
      steps: [
        t('dashboard.integrations.custom_step1', 'Create the connection and copy the receiving URL and signing secret.'),
        t('dashboard.integrations.custom_step2', 'When an order is created, POST the JSON below to the URL with event "order.created".'),
        t('dashboard.integrations.custom_step3', 'Sign the raw JSON body with HMAC-SHA256 using the secret and send it in the X-ORDIUM-Signature header.'),
      ],
    },
  ], [t]);
  const current = platforms.find(item => item.id === platform) ?? platforms[0];
  const platformName = (id: string) => platforms.find(item => item.id === id)?.name ?? id;

  const fetchConnections = useCallback(async () => {
    if (!storeId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const items = await ordiumClient.getIntegrationConnections();
      setConnections(items.filter(item => item.store_id === storeId));
    } catch (error) {
      setLoadError((error as Error)?.message || t('dashboard.integrations.load_error', 'Unable to load store connections.'));
    } finally {
      setLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => { void fetchConnections(); }, [fetchConnections]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(value => value === id ? null : value), 1800);
    } catch {
      setErrorMessage(t('dashboard.integrations.copy_error', 'Copy failed. Select the text and copy it manually.'));
    }
  };

  const externalIdError = platform === 'shopify' && externalStoreId.trim() && !SHOPIFY_DOMAIN.test(normalizeShopifyDomain(externalStoreId))
    ? t('dashboard.integrations.shopify_domain_invalid', 'Enter a domain ending in .myshopify.com')
    : null;

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!storeId || creating || externalIdError) return;
    const normalizedExternalId = platform === 'shopify' ? normalizeShopifyDomain(externalStoreId) : externalStoreId.trim();
    const normalizedName = displayName.trim();
    if (!normalizedExternalId || normalizedName.length < 2) return;
    setCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await ordiumClient.createIntegrationConnection({
        store_id: storeId,
        platform,
        external_store_id: normalizedExternalId,
        display_name: normalizedName,
      });
      setConnections(previous => [created, ...previous.filter(item => item.id !== created.id)]);
      setCreatedConnection(created);
      setDisplayName('');
      setExternalStoreId('');
    } catch (error) {
      setErrorMessage((error as Error)?.message || t('dashboard.integrations.create_error', 'Unable to create the store connection.'));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (item: IntegrationConnection) => {
    setBusyId(item.id);
    setErrorMessage(null);
    try {
      const updated = await ordiumClient.setIntegrationConnectionActive(item.id, !item.is_active);
      setConnections(previous => previous.map(connection => connection.id === item.id ? updated : connection));
    } catch (error) {
      setErrorMessage((error as Error)?.message || t('dashboard.integrations.update_error', 'Unable to update the connection status.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setErrorMessage(null);
    try {
      await ordiumClient.deleteIntegrationConnection(deleteTarget.id);
      setConnections(previous => previous.filter(connection => connection.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setErrorMessage((error as Error)?.message || t('dashboard.integrations.delete_error', 'Unable to delete the connection.'));
    } finally {
      setBusyId(null);
    }
  };

  const openSecretDialog = (item: IntegrationConnection) => {
    setCreatedConnection(null);
    setSecretTarget(item);
    setSecretValue('');
    setSecretError(null);
  };

  const handleSaveSecret = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!secretTarget || savingSecret) return;
    const value = secretValue.trim();
    if (value.length < 16) {
      setSecretError(t('dashboard.integrations.secret_too_short', 'The signing secret looks too short. Copy the full value from your store admin.'));
      return;
    }
    setSavingSecret(true);
    setSecretError(null);
    try {
      const updated = await ordiumClient.setIntegrationSigningSecret(secretTarget.id, value);
      setConnections(previous => previous.map(connection => connection.id === updated.id ? updated : connection));
      setSecretTarget(null);
      setSecretValue('');
      setSuccessMessage(t('dashboard.integrations.secret_saved', 'Signing secret saved. New orders from this store will now be accepted.'));
    } catch (error) {
      setSecretError((error as Error)?.message || t('dashboard.integrations.update_error', 'Unable to update the connection status.'));
    } finally {
      setSavingSecret(false);
    }
  };

  const fieldClass = 'min-h-12 w-full rounded-xl border border-white/10 bg-[var(--ordium-canvas)] px-3 text-sm text-white placeholder:text-[#66758A] focus:outline-none focus:border-[var(--ordium-signal)] focus:ring-2 focus:ring-[var(--ordium-signal)]/15 disabled:opacity-60';
  const pendingCount = connections.filter(item => item.signing_secret_configured === false).length;

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <section className="dashboard-page-heading">
        <div className="relative z-10 min-w-0">
          <h2 className="flex items-center gap-3">
            <Link2 aria-hidden="true" className="h-6 w-6 shrink-0 text-[var(--ordium-signal)]" />
            {t('dashboard.integrations.title', 'Connect your store to ORDIUM')}
          </h2>
          <p className="mt-2 text-sm">
            {t('dashboard.integrations.subtitle_all', 'Receive new orders automatically from Shopify, YouCan, WooCommerce or a store on your own hosting. Each connection is tied to the selected store and every delivery is signature-checked.')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#C7D2E0]">
              <Store aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ordium-signal)]" />
              {loading ? '—' : connections.length.toLocaleString(locale)} {t('dashboard.integrations.connection_count', 'connections')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--ordium-success)]/20 bg-[var(--ordium-success)]/[0.06] px-3 py-2 text-[#8AE7BD]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--ordium-success)]" />
              {loading ? '—' : connections.filter(item => item.is_active && item.signing_secret_configured !== false).length.toLocaleString(locale)} {t('dashboard.integrations.active_count', 'active')}
            </span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-amber-200">
                <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
                {pendingCount.toLocaleString(locale)} {t('dashboard.integrations.pending_count', 'awaiting signing secret')}
              </span>
            )}
          </div>
        </div>
      </section>

      {!storeId && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
          {t('dashboard.integrations.select_store', 'Select an active store at the top of the dashboard first.')}
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-200">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">{errorMessage}</div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-xs underline">{t('common.close', 'Close')}</button>
        </div>
      )}
      {successMessage && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 text-sm text-emerald-200">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">{successMessage}</div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-xs underline">{t('common.close', 'Close')}</button>
        </div>
      )}

      <section className="dashboard-panel p-4 sm:p-6" aria-labelledby="integration-add-title">
        <div className="mb-5">
          <h3 id="integration-add-title" className="text-base font-semibold text-white">{t('dashboard.integrations.add_title', 'Add a connection')}</h3>
          <p className="mt-1 text-sm text-[var(--ordium-muted)]">{t('dashboard.integrations.choose_platform', 'Choose where your store runs. ORDIUM shows the exact steps for that platform.')}</p>
        </div>

        <div role="radiogroup" aria-labelledby="integration-add-title" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {platforms.map(item => {
            const selected = item.id === platform;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!storeId || creating}
                onClick={() => { setPlatform(item.id); setExternalStoreId(''); }}
                className={`flex min-h-[7.5rem] flex-col items-start gap-2 rounded-2xl border p-4 text-start transition-colors disabled:opacity-60 ${
                  selected ? 'border-[var(--ordium-signal)]/60 bg-[var(--ordium-signal)]/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                }`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${selected ? 'border-[var(--ordium-signal)]/40 text-[var(--ordium-signal)]' : 'border-white/10 text-[var(--ordium-muted)]'}`} aria-hidden="true">{item.icon}</span>
                  {item.badge && <span className="rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-2 py-0.5 text-xs font-semibold text-violet-200">{item.badge}</span>}
                </span>
                <span className="text-sm font-semibold text-white">{item.name}</span>
                <span className="text-xs leading-relaxed text-[var(--ordium-muted)]">{item.summary}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <form onSubmit={event => void handleCreate(event)} className="space-y-4 lg:col-span-3" noValidate>
            <div>
              <label htmlFor="ordium-integration-external-id" className="mb-2 block text-sm font-medium text-[#E6EDF6]">{current.externalLabel}</label>
              <input
                id="ordium-integration-external-id"
                value={externalStoreId}
                onChange={event => setExternalStoreId(event.target.value)}
                required
                maxLength={255}
                disabled={!storeId || creating}
                placeholder={current.externalPlaceholder}
                dir="ltr"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={externalIdError ? true : undefined}
                aria-describedby="ordium-integration-external-hint"
                className={fieldClass}
              />
              <p id="ordium-integration-external-hint" className={`mt-1.5 text-xs leading-relaxed ${externalIdError ? 'text-rose-300' : 'text-[#8492A6]'}`}>{externalIdError || current.externalHint}</p>
            </div>
            <div>
              <label htmlFor="ordium-integration-name" className="mb-2 block text-sm font-medium text-[#E6EDF6]">{t('dashboard.integrations.display_name', 'Connection name')}</label>
              <input id="ordium-integration-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required minLength={2} maxLength={150} disabled={!storeId || creating} placeholder={t('dashboard.integrations.display_name_placeholder', 'e.g. Main store')} className={fieldClass} />
            </div>
            <div className="flex justify-end border-t border-white/[0.08] pt-4">
              <Button type="submit" disabled={!storeId || displayName.trim().length < 2 || !externalStoreId.trim() || Boolean(externalIdError)} isLoading={creating} leftIcon={<Plug aria-hidden="true" className="h-4 w-4" />}>
                {t('dashboard.integrations.create_for', 'Create connection')} · {current.name}
              </Button>
            </div>
          </form>

          <aside className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 lg:col-span-2" aria-labelledby="integration-steps-title">
            <h4 id="integration-steps-title" className="text-sm font-semibold text-white">{t('dashboard.integrations.steps_title', 'How to connect')} · {current.name}</h4>
            <ol className="mt-3 space-y-2.5">
              {current.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-[#C1CCDA]">
                  <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--ordium-signal)]/30 bg-[var(--ordium-signal)]/10 font-mono text-xs text-[var(--ordium-signal)]">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-[#8492A6]">{t('dashboard.integrations.requirements_short', 'Orders must be in DZD and include a customer name, an Algerian phone number and a delivery address.')}</p>
          </aside>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="integration-list-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="integration-list-title" className="text-base font-semibold text-white">{t('dashboard.integrations.list_title', 'Current store connections')}</h3>
            <p className="mt-1 text-sm text-[var(--ordium-muted)]">{t('dashboard.integrations.list_desc', 'Only connections for the selected store appear here.')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchConnections()} disabled={loading || !storeId}>{t('dashboard.integrations.refresh', 'Refresh')}</Button>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-200">
            {loadError}
            <Button variant="outline" size="sm" className="ms-3" onClick={() => void fetchConnections()}>{t('dashboard.integrations.retry', 'Retry')}</Button>
          </div>
        )}

        {loading ? <LoadingState message={t('dashboard.integrations.loading', 'Loading store connections…')} /> :
          connections.length === 0 ? (
            <EmptyState
              title={t('dashboard.integrations.empty_title', 'This store is not connected yet')}
              description={t('dashboard.integrations.empty_desc', 'Add a connection above so ORDIUM starts receiving orders from this store.')}
              icon={<Link2 className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-3">
              {connections.map(item => {
                const awaitingSecret = item.signing_secret_configured === false;
                const providerSigned = item.platform === 'shopify' || item.platform === 'youcan';
                return (
                  <article key={item.id} className={`dashboard-panel p-4 sm:p-5 ${awaitingSecret ? '!border-amber-400/30' : ''}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="break-words text-sm font-semibold text-white">{item.display_name}</h4>
                          {awaitingSecret ? (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-1 text-xs font-semibold text-amber-200">{t('dashboard.integrations.awaiting_secret', 'Awaiting signing secret')}</span>
                          ) : (
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${item.is_active ? 'border-[var(--ordium-success)]/25 bg-[var(--ordium-success)]/[0.07] text-[#8AE7BD]' : 'border-white/10 bg-white/[0.04] text-[var(--ordium-muted)]'}`}>
                              {item.is_active ? t('dashboard.integrations.active', 'Active') : t('dashboard.integrations.paused', 'Paused')}
                            </span>
                          )}
                          <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs text-[#C1CCDA]">{platformName(item.platform)}</span>
                        </div>
                        <p className="mt-1 break-all text-xs text-[var(--ordium-muted)]" dir="ltr">{item.external_store_id}</p>
                        {awaitingSecret && (
                          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-relaxed text-amber-100">
                            {t('dashboard.integrations.awaiting_secret_desc', 'Orders are rejected until you paste the signing secret your store platform shows after you create the webhook.')}
                          </p>
                        )}
                        <div className="mt-4">
                          <span className="mb-1.5 block text-xs font-medium text-[#8492A6]">{t('dashboard.integrations.receiver_url', 'Order receiving URL')}</span>
                          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[var(--ordium-canvas)] p-2" dir="ltr">
                            <code className="min-w-0 flex-1 break-all text-xs text-[#7DD3FC]">{item.webhook_url}</code>
                            <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => void copyText(item.webhook_url, `url-${item.id}`)} aria-label={t('dashboard.integrations.copy_url', 'Copy URL')}>
                              {copied === `url-${item.id}` ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[var(--ordium-success)]" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-[#8492A6]">
                          {item.last_event_at
                            ? `${t('dashboard.integrations.last_received', 'Last order received')}: ${new Date(item.last_event_at).toLocaleString(locale)}`
                            : t('dashboard.integrations.never_received', 'No order has arrived through this connection yet.')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {providerSigned && (
                          <Button variant={awaitingSecret ? 'primary' : 'outline'} size="sm" onClick={() => openSecretDialog(item)} leftIcon={<KeyRound aria-hidden="true" className="h-4 w-4" />}>
                            {awaitingSecret ? t('dashboard.integrations.add_secret', 'Add signing secret') : t('dashboard.integrations.replace_secret', 'Replace signing secret')}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" disabled={busyId === item.id} isLoading={busyId === item.id} onClick={() => void handleToggle(item)}>
                          {item.is_active ? <PauseCircle aria-hidden="true" className="h-4 w-4" /> : <PlayCircle aria-hidden="true" className="h-4 w-4" />}
                          {item.is_active ? t('dashboard.integrations.pause', 'Pause') : t('dashboard.integrations.resume', 'Resume')}
                        </Button>
                        <Button variant="danger" size="sm" disabled={busyId === item.id} onClick={() => setDeleteTarget(item)}>
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          {t('dashboard.integrations.delete', 'Delete')}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </section>

      <section className="dashboard-panel p-4 sm:p-6" aria-labelledby="integration-reqs-title">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ordium-signal)]" />
          <div className="min-w-0">
            <h3 id="integration-reqs-title" className="text-sm font-semibold text-white">{t('dashboard.integrations.payload_title', 'Requirements for received orders')}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ordium-muted)]">{t('dashboard.integrations.payload_desc_v2', 'Each order needs the customer name, an Algerian phone number (0550…, +213…), the delivery city and address, a positive total and the DZD currency. When the platform has no wilaya field, the city is used. Free items are ignored.')}</p>
          </div>
        </div>
        {platform === 'custom' && (
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-[#D9E4F2]">{t('dashboard.integrations.sample_payload', 'Sample order format')}</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => void copyText(SAMPLE_PAYLOAD, 'sample')}>
                  {copied === 'sample' ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                  {t('dashboard.integrations.copy_sample', 'Copy sample')}
                </Button>
              </div>
              <pre className="max-h-96 overflow-auto rounded-xl border border-white/[0.08] bg-[var(--ordium-canvas)] p-3 text-xs leading-relaxed text-[#B8C7D8]" dir="ltr">{SAMPLE_PAYLOAD}</pre>
              <p className="mt-2 text-xs leading-relaxed text-[#8492A6]">{t('dashboard.integrations.signing_hint', 'Sign the raw JSON body exactly as sent with HMAC-SHA256 and the secret shown once. Put the signature in X-ORDIUM-Signature and send event: order.created.')}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/10 p-4">
              <BookOpen aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#958AFF]" />
              <p className="text-sm leading-relaxed text-[#C1CCDA]">{t('dashboard.integrations.rest_alternative', 'Prefer a direct API call? Your server can send each order to POST https://api.ordium.dev/api/v1/orders with a store API key (see API keys and the developer docs) and receive the risk decision in the response.')}</p>
            </div>
          </div>
        )}
      </section>

      <Modal
        isOpen={Boolean(createdConnection)}
        onClose={() => setCreatedConnection(null)}
        title={t('dashboard.integrations.created_title', 'Store connection created')}
        description={createdConnection?.webhook_secret
          ? t('dashboard.integrations.created_desc', 'Copy the receiving URL and the secret now. The secret is not shown again after you close this window.')
          : t('dashboard.integrations.created_desc_provider', 'Copy the receiving URL into your store platform. Then add the signing secret the platform gives you.')}
        maxWidth="xl"
      >
        {createdConnection && (
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--ordium-muted)]">{t('dashboard.integrations.receiver_url', 'Order receiving URL')}</span>
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[var(--ordium-canvas)] p-2" dir="ltr">
                <code className="min-w-0 flex-1 break-all text-xs text-[#7DD3FC]">{createdConnection.webhook_url}</code>
                <Button variant="ghost" size="sm" className="shrink-0 px-2" aria-label={t('dashboard.integrations.copy_url', 'Copy URL')} onClick={() => void copyText(createdConnection.webhook_url, 'created-url')}>
                  {copied === 'created-url' ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {createdConnection.webhook_secret ? (
              <div>
                <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-sm leading-relaxed text-amber-100">
                  {t('dashboard.integrations.secret_warning', 'Keep the secret in your store webhook settings. Do not share it or put it in browser code. It will not be shown again.')}
                </div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--ordium-muted)]">{t('dashboard.integrations.webhook_secret', 'Order signing secret')}</span>
                <div className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-[var(--ordium-canvas)] p-2" dir="ltr">
                  <code className="min-w-0 flex-1 break-all py-1 text-xs text-[#FCD34D]">{createdConnection.webhook_secret}</code>
                  <Button variant="ghost" size="sm" className="shrink-0 px-2" aria-label={t('ui.copy', 'Copy')} onClick={() => void copyText(createdConnection.webhook_secret!, 'created-secret')}>
                    {copied === 'created-secret' ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <ol className="space-y-2 rounded-xl border border-white/[0.08] bg-black/10 p-4">
                {(platforms.find(item => item.id === createdConnection.platform)?.steps ?? []).slice(1).map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-[#C1CCDA]">
                    <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--ordium-signal)]/30 bg-[var(--ordium-signal)]/10 font-mono text-xs text-[var(--ordium-signal)]">{index + 2}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              {!createdConnection.webhook_secret && (
                <Button variant="outline" onClick={() => openSecretDialog(createdConnection)} leftIcon={<KeyRound aria-hidden="true" className="h-4 w-4" />}>
                  {t('dashboard.integrations.add_secret_now', 'I have the secret, add it now')}
                </Button>
              )}
              <Button onClick={() => setCreatedConnection(null)}>{t('dashboard.integrations.saved_close', 'I copied the details, close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(secretTarget)}
        onClose={() => setSecretTarget(null)}
        title={t('dashboard.integrations.secret_dialog_title', 'Add the store signing secret')}
        description={secretTarget?.platform === 'shopify'
          ? t('dashboard.integrations.secret_dialog_shopify', 'In Shopify admin open Settings > Notifications > Webhooks and copy the key under "Your webhooks will be signed with".')
          : t('dashboard.integrations.secret_dialog_generic', 'Paste the signing secret your store platform shows for this webhook.')}
      >
        <form onSubmit={event => void handleSaveSecret(event)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="ordium-integration-secret" className="mb-2 block text-sm font-medium text-[#E6EDF6]">{t('dashboard.integrations.webhook_secret', 'Order signing secret')}</label>
            <input
              id="ordium-integration-secret"
              type="password"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              value={secretValue}
              onChange={event => { setSecretValue(event.target.value); setSecretError(null); }}
              aria-invalid={secretError ? true : undefined}
              aria-describedby={secretError ? 'ordium-integration-secret-error' : undefined}
              className={`${fieldClass} font-mono`}
            />
            {secretError && <p id="ordium-integration-secret-error" role="alert" className="mt-1.5 text-xs text-rose-300">{secretError}</p>}
            <p className="mt-1.5 text-xs text-[#8492A6]">{t('dashboard.integrations.secret_storage_note', 'ORDIUM stores the secret encrypted and never shows it again.')}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSecretTarget(null)}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="submit" isLoading={savingSecret} disabled={!secretValue.trim()}>{t('dashboard.integrations.save_secret', 'Save secret')}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t('dashboard.integrations.delete_title', 'Delete this connection?')}
        description={t('dashboard.integrations.delete_desc', 'Orders will stop arriving through this connection. You will need to create a new one to reconnect.')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="danger" isLoading={Boolean(deleteTarget && busyId === deleteTarget.id)} disabled={!deleteTarget} onClick={() => void handleDelete()}>{t('dashboard.integrations.delete', 'Delete')}</Button>
        </div>
      </Modal>
    </div>
  );
};
