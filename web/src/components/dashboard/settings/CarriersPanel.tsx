import React, { useCallback, useEffect, useState } from 'react';
import { Info, Link2, Plug, Power, ShieldCheck, Trash2, Truck } from 'lucide-react';
import { shippingApi } from '../../../lib/api/shipping';
import type { AvailableCarrier, CarrierAccount } from '../../../lib/api/types';
import type { Environment } from '../../../lib/api/types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Button } from '../../common/Button';
import { Modal } from '../../common/Modal';
import { shippingErrorMessage } from '../shippingErrors';
import { LoadingCard, NoStoreNotice } from './shippingSettingsShared';

interface CarriersPanelProps {
  storeId: string;
  environment: Environment;
  /** Called after the set of linked carriers changed, so the section status can refresh. */
  onChanged?: () => void;
}

const statusTone: Record<string, string> = { active: 'settings-status--ok', error: 'settings-status--attention', disabled: 'settings-status--off' };

export const CarriersPanel: React.FC<CarriersPanelProps> = ({ storeId, environment, onChanged }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [accounts, setAccounts] = useState<CarrierAccount[]>([]);
  const [available, setAvailable] = useState<AvailableCarrier[]>([]);
  const [loading, setLoading] = useState(!!storeId);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CarrierAccount | null>(null);

  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [linking, setLinking] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true); setLoadError(false);
    try {
      const result = await shippingApi.listCarriers();
      setAccounts(result.accounts); setAvailable(result.available);
      setCode(prev => result.available.some(item => item.code === prev) ? prev : (result.available[0]?.code ?? ''));
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [storeId, environment]);

  useEffect(() => { void load(); }, [load]);

  if (!storeId) return <NoStoreNotice />;
  if (loading) return <LoadingCard />;
  if (loadError) return <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.shipping.carriers.load_error', 'تعذر تحميل شركات التوصيل. حدّث الصفحة للمحاولة مجددًا.')}</p>;

  const sandbox = environment === 'test';
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const statusLabel = (status: string) =>
    status === 'active' ? t('settings.shipping.carriers.status_active', 'متصلة')
      : status === 'error' ? t('settings.shipping.carriers.status_error', 'خطأ في الاتصال')
        : t('settings.shipping.carriers.status_disabled', 'متوقفة');

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key); setMessage(null);
    try { await action(); await load(); onChanged?.(); setMessage({ kind: 'success', text: success }); }
    catch (error) { setMessage({ kind: 'error', text: shippingErrorMessage(error, t) }); }
    finally { setBusy(null); }
  };

  const link = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code) return;
    if (!displayName.trim() || !apiId.trim() || !apiToken.trim()) { setFormError(t('settings.shipping.carriers.fields_required', 'أدخل الاسم ومعرّف API ورمز API.')); return; }
    setLinking(true); setFormError(''); setMessage(null);
    try {
      await shippingApi.linkCarrier({ carrier_code: code, display_name: displayName.trim(), credentials: { api_id: apiId.trim(), api_token: apiToken.trim() } });
      setDisplayName(''); setApiId(''); setApiToken('');
      await load(); onChanged?.();
      setMessage({ kind: 'success', text: t('settings.shipping.carriers.linked', 'تم ربط شركة التوصيل.') });
    } catch (error) { setFormError(shippingErrorMessage(error, t)); }
    finally { setLinking(false); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    await run(`delete-${target.id}`, () => shippingApi.deleteCarrier(target.id), t('settings.shipping.carriers.deleted', 'تم حذف الربط.'));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {accounts.length > 0 ? (
          <ul className="settings-list">
            {accounts.map(account => {
              const synced = formatDate(account.last_sync_at);
              return (
                <li key={account.id} className="settings-list-row flex-wrap">
                  <span className="settings-list-icon" aria-hidden="true"><Truck className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-semibold text-[var(--ordium-text)] truncate">{account.display_name}</p>
                    <p className="text-xs text-[var(--ordium-subtle)] mt-0.5">
                      {account.carrier_code} · {account.environment === 'live' ? t('common.live', 'LIVE') : t('common.sandbox', 'SANDBOX')}
                      {synced && <> · {t('settings.shipping.carriers.last_sync', 'آخر مزامنة')} {synced}</>}
                    </p>
                    {account.last_error && <p className="settings-feedback settings-feedback--error">{account.last_error}</p>}
                  </div>
                  <span className={`settings-status ${statusTone[account.status] ?? 'settings-status--neutral'}`}>{statusLabel(account.status)}</span>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="md" isLoading={busy === `test-${account.id}`} onClick={() => void run(`test-${account.id}`, () => shippingApi.testCarrier(account.id), t('settings.shipping.carriers.test_ok', 'الاتصال سليم.'))} leftIcon={<Plug className="w-3.5 h-3.5" />}>{t('settings.shipping.carriers.test', 'اختبار الاتصال')}</Button>
                    {account.status !== 'disabled' && (
                      <Button variant="ghost" size="md" isLoading={busy === `disable-${account.id}`} onClick={() => void run(`disable-${account.id}`, () => shippingApi.disableCarrier(account.id), t('settings.shipping.carriers.disabled_ok', 'تم إيقاف الربط.'))} leftIcon={<Power className="w-3.5 h-3.5" />}>{t('settings.shipping.carriers.disable', 'إيقاف')}</Button>
                    )}
                    <Button variant="ghost" size="md" isLoading={busy === `delete-${account.id}`} onClick={() => setToDelete(account)} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>{t('common.delete', 'حذف')}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="py-6 text-center text-sm text-[var(--ordium-muted)]">{t('settings.shipping.carriers.empty', 'لم تربط أي شركة توصيل بعد.')}</p>}
        {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`settings-feedback settings-feedback--${message.kind}`}>{message.text}</p>}
      </div>

      {available.length === 0 ? (
        <p className="settings-note"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t('settings.shipping.carriers.none_available', 'لا توجد شركات توصيل متاحة بعد')}</p>
      ) : (
        <form onSubmit={event => void link(event)} className="settings-card space-y-4" noValidate>
          <p className="settings-card-title">{t('settings.shipping.carriers.link_title', 'ربط شركة توصيل')}</p>
          {sandbox && <p className="settings-note"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t('settings.shipping.carriers.sandbox_hint', 'أنت في بيئة التجربة: يجب أن يبدأ رمز API بـ test_.')}</p>}
          <div>
            <label htmlFor="carrier-code" className="settings-label mb-1.5">{t('settings.shipping.carriers.carrier', 'شركة التوصيل')}</label>
            <select id="carrier-code" className="settings-input w-full" value={code} onChange={event => setCode(event.target.value)}>
              {available.map(item => <option key={item.code} value={item.code}>{item.display_name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="carrier-name" className="settings-label mb-1.5">{t('settings.shipping.carriers.display_name', 'اسم العرض')}</label>
            <input id="carrier-name" className="settings-input w-full" value={displayName} maxLength={150} onChange={event => setDisplayName(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="carrier-api-id" className="settings-label mb-1.5">{t('settings.shipping.carriers.api_id', 'معرّف API')}</label>
              <input id="carrier-api-id" className="settings-input w-full" dir="ltr" autoComplete="off" value={apiId} onChange={event => setApiId(event.target.value)} />
            </div>
            <div>
              <label htmlFor="carrier-api-token" className="settings-label mb-1.5">{t('settings.shipping.carriers.api_token', 'رمز API')}</label>
              <input id="carrier-api-token" type="password" className="settings-input w-full" dir="ltr" autoComplete="new-password" value={apiToken} onChange={event => setApiToken(event.target.value)} aria-describedby="carrier-secret-hint" />
            </div>
          </div>
          <p id="carrier-secret-hint" className="settings-hint flex items-start gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t('settings.shipping.carriers.secret_hint', 'يُحفظ المفتاح مشفّرًا ولا يُعرض مجددًا بعد الحفظ.')}</p>
          {formError && <p role="alert" className="settings-feedback settings-feedback--error">{formError}</p>}
          <div className="settings-actions">
            <Button type="submit" isLoading={linking} leftIcon={<Link2 className="w-4 h-4" />}>{t('settings.shipping.carriers.link', 'ربط')}</Button>
          </div>
        </form>
      )}

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('settings.shipping.carriers.delete_title', 'حذف ربط شركة التوصيل؟')} description={t('settings.shipping.carriers.delete_desc', 'سيُحذف الربط ومفاتيحه المحفوظة. لا يمكن حذفه إن كانت عليه شحنات نشطة أو مسارات.')}>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="md" onClick={() => setToDelete(null)}>{t('common.cancel', 'إلغاء')}</Button>
          <Button variant="danger" size="md" onClick={() => void confirmDelete()}>{t('settings.shipping.carriers.delete_confirm', 'نعم، احذف الربط')}</Button>
        </div>
      </Modal>
    </div>
  );
};
