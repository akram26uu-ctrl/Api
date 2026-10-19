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
  const [isCreating, setIsCreating] = useState(false);
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
    const url = newUrl.trim();
    if (!url || !newEvents.length || isCreating) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      setErrorMessage(t('dashboard.webhooks.invalid_url', 'أدخل عنوان URL صحيحًا يبدأ بـ https://.'));
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      setErrorMessage(t('dashboard.webhooks.https_required', 'يجب أن يستخدم Webhook عنوان HTTPS آمنًا.'));
      return;
    }

    setIsCreating(true);
    try {
      const created = await ordiumClient.createWebhook({ url, events: newEvents });
      setEndpoints(prev => [created, ...prev]);
      setCreatedSecret(created.secret || 'whsec_test_secret_revealed_once');
      setIsCreateModalOpen(false);
      setNewUrl('');
      setNewEvents(['order.risk_assessed', 'order.outcome.updated']);
    } catch (err: any) {
      setErrorMessage('Failed to create webhook: ' + err.message);
    } finally {
      setIsCreating(false);
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
      <section className="dashboard-page-heading">
        <div className="relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#9D96FF] uppercase">
            <Webhook className="h-4 w-4" />
            <span>{t('dashboard.webhooks.eyebrow', 'تسليم الأحداث')}</span>
            <span className="rounded-full border border-[#52D9E8]/20 bg-[#52D9E8]/[0.08] px-2.5 py-1 text-[#52D9E8] tracking-normal">
              {t('dashboard.webhooks.signed_delivery', 'HMAC · توقيع آمن')}
            </span>
          </div>
          <h2 className="mt-3 flex items-center gap-3">
            <Send className="h-6 w-6 shrink-0 text-[#52D9E8]" />
            {t('dashboard.webhooks.title', 'Webhooks · توجيه الأحداث')}
          </h2>
          <p className="mt-2 text-sm">
            {t('dashboard.webhooks.subtitle', 'أرسل إشعارات موقّعة إلى أنظمتك عند تقييم الطلبات أو تحديث نتائجها. اختبر كل نقطة اتصال وتابع حالتها من هنا.')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#C7D2E0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#52D9E8]" />
              {loading ? '—' : endpoints.length.toLocaleString()} {t('dashboard.webhooks.summary_total', 'نقطة اتصال')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-[#48D6A0]/20 bg-[#48D6A0]/[0.06] px-3 py-2 text-[#8AE7BD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#48D6A0]" />
              {loading ? '—' : endpoints.filter(ep => ep.status === 'active').length.toLocaleString()} {t('dashboard.webhooks.summary_active', 'نشطة')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#A5B1C3]">
              <Shield className="h-3.5 w-3.5" />
              {t('dashboard.webhooks.summary_signature', 'توقيع HMAC-SHA256')}
            </span>
          </div>
        </div>
        <div className="relative z-10 shrink-0">
          <Button variant="primary" size="md" onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            {t('dashboard.webhooks.add_endpoint', 'إضافة نقطة اتصال')}
          </Button>
        </div>
      </section>

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
              className="dashboard-panel relative overflow-hidden p-4 sm:p-6 space-y-5 text-start"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                      ep.status === 'active' ? 'bg-[#10B981] animate-pulse' : 'bg-[#EF4444]'
                    }`}
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-white font-mono break-all" dir="ltr">{ep.url}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#94A3B8]">
                      {t('dashboard.apikeys.created', 'Created')} {new Date(ep.created_at).toLocaleDateString()} · {t('dashboard.webhooks.failure_rate', 'Failure rate')}: {ep.failure_rate}%
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center sm:w-auto"
                    onClick={() => handleTestDispatch(ep.id)}
                    leftIcon={<Send className="w-3.5 h-3.5 text-[#22D3EE]" />}
                  >
                    {t('dashboard.webhooks.send_test', 'Send Test Ping')}
                  </Button>
                  {ep.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center sm:w-auto"
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
              <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#94A3B8] text-[11px]">{t('dashboard.webhooks.subscribed_events', 'Subscribed Events:')}</span>
                {ep.events.map(ev => (
                  <span key={ev} className="rounded-lg border border-[#52D9E8]/15 bg-[#52D9E8]/[0.06] px-2.5 py-1 text-[#78E3EC] text-[11px] font-mono" dir="ltr">
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
        title={t('dashboard.webhooks.modal_title', 'إضافة Webhook جديد')}
        description={t('dashboard.webhooks.modal_desc', 'اختر عنوان HTTPS والأحداث التي تريد إرسالها إلى نظامك.')}
        maxWidth="lg"
      >
        <form className="space-y-5 text-start" onSubmit={event => { event.preventDefault(); void handleCreateWebhook(); }}>
          <div className="rounded-xl border border-[#52D9E8]/15 bg-[#52D9E8]/[0.045] p-3.5 text-sm leading-relaxed text-[#B8C7D8]">
            <div className="mb-1.5 flex items-center gap-2 font-semibold text-white">
              <Shield className="h-4 w-4 text-[#52D9E8]" />
              {t('dashboard.webhooks.signed_delivery', 'تسليم آمن للأحداث')}
            </div>
            {t('dashboard.webhooks.signing_hint', 'سيُعرض سر التوقيع مرة واحدة بعد الإنشاء. خزّنه في خادمك واستخدمه للتحقق من توقيع HMAC-SHA256.')}
          </div>
          <div>
            <label htmlFor="ordium-webhook-url" className="mb-2 block text-sm font-semibold text-[#E6EDF6]">
              {t('dashboard.webhooks.url_label', 'عنوان الوجهة (HTTPS)')}
            </label>
            <input
              id="ordium-webhook-url"
              name="webhookUrl"
              type="url"
              required
              autoComplete="url"
              spellCheck={false}
              placeholder="https://api.yourstore.com/webhooks/ordium"
              value={newUrl}
              onChange={event => setNewUrl(event.target.value)}
              className="w-full min-h-12 rounded-xl border border-white/10 bg-[#080B12] px-4 py-3 text-sm text-white placeholder:text-[#718096] focus:outline-none focus:border-[#52D9E8] focus:ring-2 focus:ring-[#52D9E8]/15"
              dir="ltr"
            />
            <p className="mt-1.5 text-[11px] text-[#718096]">{t('dashboard.webhooks.https_hint', 'استخدم نقطة HTTPS عامة يمكن لخوادم ORDIUM الوصول إليها.')}</p>
          </div>
          <fieldset className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-semibold text-[#E6EDF6]">{t('dashboard.webhooks.subscribe_events', 'الأحداث المراد استقبالها')}</legend>
              <span className="text-[11px] text-[#A5B1C3]">{newEvents.length} {t('dashboard.webhooks.events_selected', 'أحداث محددة')}</span>
            </div>
            <div className="space-y-2">
              {[
                { id: 'order.risk_assessed', title: 'تقييم مخاطر الطلب', desc: 'يصل عند انتهاء تقييم الطلب', code: 'order.risk_assessed' },
                { id: 'order.outcome.updated', title: 'تحديث نتيجة الطلب', desc: 'يصل عند تسجيل نتيجة التأكيد أو التسليم', code: 'order.outcome.updated' },
                { id: '*', title: 'كل الأحداث المتاحة', desc: 'اشترك في جميع أنواع الأحداث المدعومة', code: '*' }
              ].map(ev => {
                const checked = newEvents.includes(ev.id);
                return (
                  <label key={ev.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors " + (checked ? 'border-[#52D9E8]/30 bg-[#52D9E8]/[0.06]' : 'border-white/[0.09] bg-black/10 hover:border-white/20')}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={event => setNewEvents(prev => {
                        if (event.target.checked) return ev.id === '*' ? ['*'] : [...prev.filter(item => item !== '*'), ev.id].filter((item, index, all) => all.indexOf(item) === index);
                        return prev.filter(item => item !== ev.id);
                      })}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-[#080B12] text-[#52D9E8] focus:ring-2 focus:ring-[#52D9E8]/40"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#E6EDF6]">{ev.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#8D9AAF]">{ev.desc}</span>
                      <code className="mt-1.5 inline-block text-[10px] text-[#52D9E8]" dir="ltr">{ev.code}</code>
                    </span>
                  </label>
                );
              })}
            </div>
            {!newEvents.length && <p className="text-xs text-amber-300" role="alert">{t('dashboard.webhooks.event_required', 'اختر حدثًا واحدًا على الأقل.')}</p>}
          </fieldset>
          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="md" onClick={() => setIsCreateModalOpen(false)}>
              {t('dashboard.common.cancel', 'إلغاء')}
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isCreating} disabled={!newUrl.trim() || !newEvents.length}>
              {t('dashboard.webhooks.create_btn', 'إنشاء Webhook')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
