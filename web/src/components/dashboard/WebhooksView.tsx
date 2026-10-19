/**
 * ORDIUM Webhooks Management View
 */

import React, { useState, useEffect } from 'react';
import { WebhookEndpoint, WebhookDelivery } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { LoadingState, EmptyState } from '../common/EmptyState';
import { useLanguage } from '../../i18n/LanguageContext';
import { Webhook, Plus, Send, CheckCircle2, AlertCircle, Copy, Trash2, Shield } from 'lucide-react';

export const WebhooksView: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['order.risk_assessed', 'order.outcome.updated']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Test dispatch
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Disable flow
  const [disableTarget, setDisableTarget] = useState<WebhookEndpoint | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ordiumClient.getWebhooks();
      setEndpoints(data);
    } catch (err: any) {
      setEndpoints([]);
      setLoadError(err?.message || 'Unable to load webhooks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleCreateWebhook = async () => {
    if (!newUrl) return;
    try {
      const created = await ordiumClient.createWebhook({
        url: newUrl,
        events: newEvents
      });
      setEndpoints(prev => [created, ...prev]);
      setCreatedSecret(created.secret || 'whsec_test_secret_revealed_once');
      setIsCreateModalOpen(false);
      setNewUrl('');
    } catch (err: any) {
      setErrorMessage(`Failed to create webhook: ${err.message}`);
    }
  };

  const handleTestDispatch = async (endpointId: string) => {
    setTestStatus('جارٍ إرسال الحمولة…');
    try {
      const delivery = await ordiumClient.testWebhook(endpointId);
      setTestStatus(`Delivered successfully: HTTP ${delivery.status_code} (${delivery.duration_ms}ms)`);
      fetchWebhooks();
    } catch (err: any) {
      setTestStatus(`Delivery failed: ${err.message}`);
    }
    setTimeout(() => setTestStatus(null), 4000);
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setIsDisabling(true);
    setDisableError(null);
    try {
      await ordiumClient.deleteWebhook(disableTarget.id);
      setEndpoints(prev => prev.map(item => (item.id === disableTarget.id ? { ...item, status: 'disabled' as const } : item)));
      setDisableTarget(null);
    } catch (err: any) {
      setDisableError(err?.message || t('dashboard.webhooks.disable_error', 'Could not disable the webhook. Please retry.'));
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      {/* Top Banner */}
      <div className="dashboard-panel p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-start">
        <div>
          <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
            <Webhook className="w-4 h-4 text-[#22D3EE]" />
            <span>{t('dashboard.webhooks.title', 'اشتراكات Webhook وتوجيه الأحداث')}</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            {t('dashboard.webhooks.subtitle', 'Receive automated real-time notifications for order evaluations, flagged syndicates, and chargebacks.')}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('dashboard.webhooks.add_endpoint', 'Add Endpoint')}
        </Button>
      </div>

      {testStatus && (
        <div className="p-3 rounded-xl bg-[#0D1320] border border-[#22D3EE]/40 text-xs font-mono text-[#22D3EE] flex items-center gap-2 animate-in fade-in">
          <Send className="w-4 h-4" />
          <span>{testStatus}</span>
        </div>
      )}

      <Modal
        isOpen={Boolean(errorMessage)}
        onClose={() => setErrorMessage(null)}
        title={t('dashboard.common.error', 'Action failed')}
      >
        <p className="text-sm text-[#CBD5E1]">{errorMessage}</p>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setErrorMessage(null)}>OK</Button>
        </div>
      </Modal>

      {/* Secret Reveal Modal */}
      <Modal
        isOpen={Boolean(createdSecret)}
        onClose={() => setCreatedSecret(null)}
        title={t('dashboard.webhooks.secret_modal_title', 'تم إنشاء سر توقيع Webhook')}
        description={t('dashboard.webhooks.secret_modal_desc', 'Store this secret securely. It will not be shown again.')}
      >
        <div className="space-y-4 text-xs font-mono text-start">
          <p className="text-[#94A3B8]">
            {t('dashboard.webhooks.secret_hint', 'Use this secret to verify incoming HTTP request signatures using HMAC-SHA256:')}
          </p>
          <div className="p-3 bg-[#080B12] border border-white/10 rounded-xl text-[#22D3EE] break-all select-all flex items-center justify-between gap-2" dir="ltr">
            <span>{createdSecret}</span>
            <button
              onClick={() => navigator.clipboard.writeText(createdSecret || '')}
              className="p-1 hover:text-white"
              title="Copy"
            >
              <Copy className="w-4 h-4 shrink-0" />
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreatedSecret(null)}
            className="w-full justify-center mt-2"
          >
            {t('dashboard.webhooks.saved_secret_btn', 'I Have Saved This Secret')}
          </Button>
        </div>
      </Modal>

      {loadError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300 flex items-center justify-between gap-3"><span>{loadError}</span><Button variant="outline" size="sm" onClick={() => void fetchWebhooks()}>Retry</Button></div>}

      {/* Endpoints List */}
      {loading ? (
        <LoadingState message={t('dashboard.webhooks.loading', 'جارٍ تحميل Webhooks المسجلة…')} />
      ) : endpoints.length === 0 ? (
        <EmptyState
          title={t('dashboard.webhooks.empty_title', 'لا توجد Webhooks مهيأة')}
          description={t('dashboard.webhooks.empty_desc', 'Register your first HTTPS URL to stream risk signals and decisions directly into your backend or order management platform.')}
          actionText={t('dashboard.webhooks.add_endpoint', 'Add Webhook Endpoint')}
          onAction={() => setIsCreateModalOpen(true)}
          icon={<Webhook className="w-8 h-8 text-[#94A3B8]" />}
        />
      ) : (
        <div className="space-y-4">
          {endpoints.map(ep => (
            <div
              key={ep.id}
              className="dashboard-panel p-4 sm:p-5 space-y-4 text-start"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      ep.status === 'active' ? 'bg-[#10B981] animate-pulse' : 'bg-[#EF4444]'
                    }`}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono" dir="ltr">{ep.url}</h3>
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      {t('dashboard.apikeys.created', 'Created')} {new Date(ep.created_at).toLocaleDateString()} · {t('dashboard.webhooks.failure_rate', 'Failure rate')}: {ep.failure_rate}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestDispatch(ep.id)}
                    leftIcon={<Send className="w-3.5 h-3.5 text-[#22D3EE]" />}
                  >
                    {t('dashboard.webhooks.send_test', 'Send Test Ping')}
                  </Button>
                  {ep.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setDisableTarget(ep); setDisableError(null); }}
                      className="text-red-300 border-red-500/30 hover:bg-red-500/10"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      {t('dashboard.webhooks.disable', 'Disable Webhook')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Subscribed events */}
              <div className="pt-3 border-t border-white/5 flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-[#94A3B8] text-[11px]">{t('dashboard.webhooks.subscribed_events', 'Subscribed Events:')}</span>
                {ep.events.map(ev => (
                  <span key={ev} className="px-2 py-0.5 rounded bg-white/5 text-[#22D3EE] text-[11px]" dir="ltr">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disable Confirmation Modal */}
      <Modal
        isOpen={Boolean(disableTarget)}
        onClose={() => { if (!isDisabling) setDisableTarget(null); }}
        title={t('dashboard.webhooks.disable_title', 'Disable Webhook')}
        description={t('dashboard.webhooks.disable_confirm', 'Event delivery to this endpoint will stop immediately. You can create a new endpoint later.')}
      >
        <div className="space-y-4 text-xs font-mono text-start">
          <div className="p-3 bg-[#080B12] border border-white/10 rounded-xl text-[#22D3EE] break-all" dir="ltr">
            {disableTarget?.url}
          </div>
          {disableError && <p className="text-red-300" role="alert">{disableError}</p>}
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDisableTarget(null)} disabled={isDisabling}>
              {t('dashboard.common.cancel', 'إلغاء')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isDisabling}
              onClick={() => void handleDisable()}
              className="!bg-red-500 hover:!bg-red-600 text-white"
            >
              {t('dashboard.webhooks.disable', 'Disable Webhook')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('dashboard.webhooks.modal_title', 'Add Webhook Endpoint')}
        description={t('dashboard.webhooks.modal_desc', 'Enter the destination URL to receive signed event dispatches.')}
      >
        <div className="space-y-4 text-xs font-mono text-start">
          <div>
            <label className="text-[#94A3B8] block mb-1">{t('dashboard.webhooks.url_label', 'Destination URL (HTTPS Required)')}</label>
            <input
              type="url"
              placeholder="https://api.yourstore.com/webhooks/ordium"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#22D3EE]"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-[#94A3B8] block mb-2">{t('dashboard.webhooks.subscribe_events', 'Subscribe to Events')}</label>
            <div className="space-y-2">
              {[
                { id: 'order.risk_assessed', label: 'order.risk_assessed (Risk assessment completed)' },
                { id: 'order.outcome.updated', label: 'order.outcome.updated (Delivery / outcome recorded)' },
                { id: '*', label: '* (Wildcard: All webhook events)' }
              ].map(ev => (
                <label key={ev.id} className="flex items-center gap-2 cursor-pointer text-white">
                  <input
                    type="checkbox"
                    checked={newEvents.includes(ev.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setNewEvents([...newEvents, ev.id]);
                      } else {
                        setNewEvents(newEvents.filter(x => x !== ev.id));
                      }
                    }}
                    className="rounded bg-[#080B12] border-white/20 text-[#22D3EE] focus:ring-0"
                  />
                  <span dir="ltr">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              {t('dashboard.common.cancel', 'إلغاء')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateWebhook}>
              {t('dashboard.webhooks.create_btn', 'Create Webhook')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
