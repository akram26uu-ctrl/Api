import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, Link2, PauseCircle, PlayCircle,
  Plug, ShieldCheck, Store, Trash2, Webhook,
} from 'lucide-react';
import { ordiumClient } from '../../lib/api/client';
import { CreatedIntegrationConnection, IntegrationConnection } from '../../lib/api/types';
import { Button } from '../common/Button';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { useLanguage } from '../../i18n/LanguageContext';

interface IntegrationsViewProps {
  storeId: string | null;
}

type IntegrationPlatform = 'custom' | 'woocommerce';

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

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ storeId }) => {
  const { t } = useLanguage();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<IntegrationPlatform>('custom');
  const [displayName, setDisplayName] = useState('');
  const [externalStoreId, setExternalStoreId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdConnection, setCreatedConnection] = useState<CreatedIntegrationConnection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationConnection | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
      setLoadError((error as Error)?.message || t('dashboard.integrations.load_error', 'تعذر تحميل روابط المتجر.'));
    } finally {
      setLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => { void fetchConnections(); }, [fetchConnections]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(current => current === id ? null : current), 1800);
    } catch {
      setErrorMessage(t('dashboard.integrations.copy_error', 'تعذر النسخ تلقائيًا. حدّد النص وانسخه يدويًا.'));
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!storeId || creating) return;
    const normalizedExternalId = externalStoreId.trim();
    const normalizedName = displayName.trim();
    if (!normalizedExternalId || !normalizedName) return;
    setCreating(true);
    setErrorMessage(null);
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
      setErrorMessage((error as Error)?.message || t('dashboard.integrations.create_error', 'تعذر إنشاء رابط المتجر.'));
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
      setErrorMessage((error as Error)?.message || t('dashboard.integrations.update_error', 'تعذر تحديث حالة الربط.'));
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
      setErrorMessage((error as Error)?.message || t('dashboard.integrations.delete_error', 'تعذر حذف الربط.'));
    } finally {
      setBusyId(null);
    }
  };

  const closeCreatedConnection = () => setCreatedConnection(null);

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <section className="dashboard-page-heading">
        <div className="relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#9D96FF] uppercase">
            <Plug className="h-4 w-4" />
            <span>{t('dashboard.integrations.eyebrow', 'ربط المتجر')}</span>
            <span className="rounded-full border border-[#52D9E8]/20 bg-[#52D9E8]/[0.08] px-2.5 py-1 text-[#52D9E8] tracking-normal">
              {t('dashboard.integrations.signed', 'اتصال موقّع وآمن')}
            </span>
          </div>
          <h2 className="mt-3 flex items-center gap-3">
            <Link2 className="h-6 w-6 shrink-0 text-[#52D9E8]" />
            {t('dashboard.integrations.title', 'اربط متجرك بـ ORDIUM')}
          </h2>
          <p className="mt-2 text-sm">
            {t('dashboard.integrations.subtitle', 'استقبل الطلبات الجديدة من WooCommerce أو من متجر مبرمج خصيصًا لك. اربط كل اتصال بمتجرك الحالي وتابع وصول الأحداث من هنا.')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#C7D2E0]">
              <Store className="h-3.5 w-3.5 text-[#52D9E8]" />
              {loading ? '—' : connections.length.toLocaleString()} {t('dashboard.integrations.connection_count', 'روابط')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-[#48D6A0]/20 bg-[#48D6A0]/[0.06] px-3 py-2 text-[#8AE7BD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#48D6A0]" />
              {loading ? '—' : connections.filter(item => item.is_active).length.toLocaleString()} {t('dashboard.integrations.active_count', 'مفعّلة')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#A5B1C3]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('dashboard.integrations.hmac', 'التحقق من توقيع الطلب')}
            </span>
          </div>
        </div>
      </section>

      {!storeId && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
          {t('dashboard.integrations.select_store', 'اختر متجرًا نشطًا أولًا من أعلى لوحة التحكم.')}
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">{errorMessage}</div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-xs underline">{t('common.close', 'إغلاق')}</button>
        </div>
      )}

      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-white">{t('dashboard.integrations.add_title', 'إضافة رابط جديد')}</h3>
          <p className="mt-1 text-sm text-[#A1AEC1]">{t('dashboard.integrations.add_desc', 'أنشئ عنوان استقبال خاصًا بهذا الاتصال. يظل سر التوقيع محفوظًا داخل ORDIUM ولا يظهر إلا عند الإنشاء.')}</p>
        </div>
        <form onSubmit={event => void handleCreate(event)} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="ordium-integration-platform" className="mb-2 block text-sm font-medium text-[#E6EDF6]">{t('dashboard.integrations.platform', 'نوع الربط')}</label>
            <select id="ordium-integration-platform" value={platform} onChange={event => setPlatform(event.target.value as IntegrationPlatform)} disabled={!storeId || creating} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#080B12] px-3 text-sm text-white focus:outline-none focus:border-[#52D9E8] focus:ring-2 focus:ring-[#52D9E8]/15">
              <option value="custom">{t('dashboard.integrations.custom', 'متجر مخصص أو مستقل')}</option>
              <option value="woocommerce">{t('dashboard.integrations.woocommerce', 'WooCommerce')}</option>
            </select>
            <p className="mt-1.5 text-xs leading-relaxed text-[#8492A6]">
              {platform === 'custom'
                ? t('dashboard.integrations.custom_hint', 'يناسب متجرًا خاصًا أو أي منصة يمكنها إرسال Webhook موقّع بصيغة ORDIUM القياسية.')
                : t('dashboard.integrations.woocommerce_hint', 'أنشئ Webhook في WooCommerce وحدد الحدث Order created، ثم استخدم عنوان الاستقبال والسر اللذين ستولدهما ORDIUM.')}
            </p>
          </div>
          <div>
            <label htmlFor="ordium-integration-name" className="mb-2 block text-sm font-medium text-[#E6EDF6]">{t('dashboard.integrations.display_name', 'اسم الاتصال')}</label>
            <input id="ordium-integration-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required minLength={2} maxLength={150} disabled={!storeId || creating} placeholder={t('dashboard.integrations.display_name_placeholder', 'مثال: المتجر الرئيسي')} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#080B12] px-3 text-sm text-white placeholder:text-[#66758A] focus:outline-none focus:border-[#52D9E8] focus:ring-2 focus:ring-[#52D9E8]/15" />
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="ordium-integration-external-id" className="mb-2 block text-sm font-medium text-[#E6EDF6]">{t('dashboard.integrations.external_id', 'معرّف المتجر في منصته')}</label>
            <input id="ordium-integration-external-id" value={externalStoreId} onChange={event => setExternalStoreId(event.target.value)} required minLength={1} maxLength={255} disabled={!storeId || creating} placeholder={platform === 'woocommerce' ? 'shop.example.com' : t('dashboard.integrations.external_id_placeholder', 'مثال: shop.example.com أو معرّف متجرك')} dir="ltr" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#080B12] px-3 text-sm text-white placeholder:text-[#66758A] focus:outline-none focus:border-[#52D9E8] focus:ring-2 focus:ring-[#52D9E8]/15" />
            <p className="mt-1.5 text-xs text-[#8492A6]">{t('dashboard.integrations.external_id_hint', 'استخدم قيمة ثابتة ومميزة لهذا المتجر، مثل النطاق الأساسي.')}</p>
          </div>
          <div className="lg:col-span-2 flex justify-end border-t border-white/[0.08] pt-4">
            <Button type="submit" disabled={!storeId || displayName.trim().length < 2 || !externalStoreId.trim()} isLoading={creating} leftIcon={<Plug className="h-4 w-4" />}>
              {t('dashboard.integrations.create', 'إنشاء رابط المتجر')}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{t('dashboard.integrations.list_title', 'روابط المتجر الحالية')}</h3>
            <p className="mt-1 text-sm text-[#A1AEC1]">{t('dashboard.integrations.list_desc', 'تظهر هنا الروابط الخاصة بالمتجر المختار فقط.')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchConnections()} disabled={loading || !storeId}>{t('dashboard.integrations.refresh', 'تحديث')}</Button>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-200">
            {loadError}
            <Button variant="outline" size="sm" className="ms-3" onClick={() => void fetchConnections()}>{t('dashboard.integrations.retry', 'إعادة المحاولة')}</Button>
          </div>
        )}

        {loading ? <LoadingState message={t('dashboard.integrations.loading', 'جارٍ تحميل روابط المتجر…')} /> :
          connections.length === 0 ? (
            <EmptyState
              title={t('dashboard.integrations.empty_title', 'لم تربط هذا المتجر بعد')}
              description={t('dashboard.integrations.empty_desc', 'أضف رابطًا أعلاه لتبدأ ORDIUM باستقبال الطلبات من هذا المتجر.')}
              icon={<Link2 className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-3">
              {connections.map(item => (
                <article key={item.id} className="dashboard-panel p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-sm font-semibold text-white">{item.display_name}</h4>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.is_active ? 'border-[#48D6A0]/25 bg-[#48D6A0]/[0.07] text-[#8AE7BD]' : 'border-white/10 bg-white/[0.04] text-[#A1AEC1]'}`}>
                          {item.is_active ? t('dashboard.integrations.active', 'مفعّل') : t('dashboard.integrations.paused', 'متوقف')}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] text-[#A1AEC1]" dir="ltr">{item.platform}</span>
                      </div>
                      <p className="mt-1 break-all text-xs text-[#A1AEC1]" dir="ltr">{item.external_store_id}</p>
                      <div className="mt-4">
                        <label className="mb-1.5 block text-[11px] font-medium text-[#8492A6]">{t('dashboard.integrations.receiver_url', 'عنوان استقبال الطلبات')}</label>
                        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#080B12] p-2" dir="ltr">
                          <code className="min-w-0 flex-1 break-all text-[11px] text-[#7DD3FC]">{item.webhook_url}</code>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => void copyText(item.webhook_url, `url-${item.id}`)} aria-label={t('dashboard.integrations.copy_url', 'نسخ العنوان')}>
                            {copied === `url-${item.id}` ? <CheckCircle2 className="h-4 w-4 text-[#48D6A0]" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-[#8492A6]">
                        {item.last_event_at
                          ? `${t('dashboard.integrations.last_received', 'آخر طلب مستلم')}: ${new Date(item.last_event_at).toLocaleString()}`
                          : t('dashboard.integrations.never_received', 'لم يصل طلب من هذا الاتصال بعد.')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" disabled={busyId === item.id} isLoading={busyId === item.id} onClick={() => void handleToggle(item)}>
                        {item.is_active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        {item.is_active ? t('dashboard.integrations.pause', 'إيقاف مؤقت') : t('dashboard.integrations.resume', 'إعادة التفعيل')}
                      </Button>
                      <Button variant="danger" size="sm" disabled={busyId === item.id} onClick={() => setDeleteTarget(item)}>
                        <Trash2 className="h-4 w-4" />
                        {t('dashboard.integrations.delete', 'حذف')}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>

      <section className="dashboard-panel p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#52D9E8]" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{t('dashboard.integrations.payload_title', 'متطلبات الطلب المستلم')}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#A1AEC1]">{t('dashboard.integrations.payload_desc', 'يجب أن تتضمن بيانات الطلب الاسم الأول والأخير، رقم هاتف جزائري، الولاية، البلدية، عنوان التوصيل، المبلغ الإجمالي الموجب، والعملة DZD. يجب تحويل حقول المنصات الأخرى إلى هذه الصيغة قبل الإرسال.')}</p>
          </div>
        </div>
        {platform === 'custom' && (
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-[#D9E4F2]">{t('dashboard.integrations.sample_payload', 'مثال لصيغة الطلب')}</h4>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyText(SAMPLE_PAYLOAD, 'sample')}>
                {copied === 'sample' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {t('dashboard.integrations.copy_sample', 'نسخ المثال')}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-xl border border-white/[0.08] bg-[#080B12] p-3 text-[11px] leading-relaxed text-[#B8C7D8]" dir="ltr">{SAMPLE_PAYLOAD}</pre>
            <p className="mt-2 text-xs leading-relaxed text-[#8492A6]">{t('dashboard.integrations.signing_hint', 'وقّع نص JSON الخام كما أرسلته باستخدام HMAC-SHA256 والسر الذي ظهر مرة واحدة. ضع التوقيع في X-ORDIUM-Signature وأرسل event: order.created.')}</p>
          </div>
        )}
        {platform === 'woocommerce' && (
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/10 p-4">
            <h4 className="text-sm font-semibold text-white">{t('dashboard.integrations.woocommerce_steps_title', 'إعداد WooCommerce')}</h4>
            <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm leading-relaxed text-[#A1AEC1]">
              <li>{t('dashboard.integrations.woocommerce_step1', 'من WooCommerce افتح Settings ثم Advanced ثم Webhooks.')}</li>
              <li>{t('dashboard.integrations.woocommerce_step2', 'أنشئ Webhook جديدًا واختر الحدث Order created.')}</li>
              <li>{t('dashboard.integrations.woocommerce_step3', 'انسخ عنوان الاستقبال والسر من مربع تفاصيل الاتصال بعد إنشائه.')}</li>
              <li>{t('dashboard.integrations.woocommerce_step4', 'ألصق العنوان والسر في WooCommerce، ثم احفظ وأرسل طلبًا تجريبيًا.')}</li>
            </ol>
          </div>
        )}
      </section>

      <Modal
        isOpen={Boolean(createdConnection)}
        onClose={closeCreatedConnection}
        title={t('dashboard.integrations.created_title', 'تم إنشاء رابط المتجر')}
        description={t('dashboard.integrations.created_desc', 'انسخ عنوان الاستقبال والسر الآن. لن يظهر السر مرة أخرى بعد إغلاق هذه النافذة.')}
        maxWidth="xl"
      >
        {createdConnection && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-sm leading-relaxed text-amber-100">
              {t('dashboard.integrations.secret_warning', 'احتفظ بالسر في إعدادات Webhook في متجرك. لا تشاركه ولا تضعه في كود المتصفح. لن نعرضه مجددًا.')}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#A1AEC1]">{t('dashboard.integrations.receiver_url', 'عنوان استقبال الطلبات')}</label>
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#080B12] p-2" dir="ltr">
                <code className="min-w-0 flex-1 break-all text-xs text-[#7DD3FC]">{createdConnection.webhook_url}</code>
                <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => void copyText(createdConnection.webhook_url, 'created-url')}>
                  {copied === 'created-url' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#A1AEC1]">{t('dashboard.integrations.webhook_secret', 'سر توقيع الطلبات')}</label>
              <div className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-[#080B12] p-2" dir="ltr">
                <code className="min-w-0 flex-1 break-all py-1 text-xs text-[#FCD34D]">{createdConnection.webhook_secret || t('dashboard.integrations.secret_unavailable', 'السر غير متاح')}</code>
                {createdConnection.webhook_secret && <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => void copyText(createdConnection.webhook_secret!, 'created-secret')}>
                  {copied === 'created-secret' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>}
              </div>
              {createdConnection.webhook_secret_note && <p className="mt-2 text-xs text-[#8492A6]">{createdConnection.webhook_secret_note}</p>}
            </div>
            <div className="flex justify-end border-t border-white/[0.08] pt-4">
              <Button onClick={closeCreatedConnection}>{t('dashboard.integrations.saved_close', 'نسخت التفاصيل، إغلاق')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t('dashboard.integrations.delete_title', 'حذف رابط المتجر؟')}
        description={t('dashboard.integrations.delete_desc', 'سيتم إيقاف استقبال الطلبات عبر هذا الرابط. تحتاج إلى إنشاء اتصال جديد لإعادة الربط.')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel', 'إلغاء')}</Button>
          <Button variant="danger" isLoading={Boolean(deleteTarget && busyId === deleteTarget.id)} disabled={!deleteTarget} onClick={() => void handleDelete()}>{t('dashboard.integrations.delete', 'حذف')}</Button>
        </div>
      </Modal>
    </div>
  );
};
