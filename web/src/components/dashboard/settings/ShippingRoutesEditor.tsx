import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Route as RouteIcon, Trash2 } from 'lucide-react';
import { shippingApi } from '../../../lib/api/shipping';
import type { CarrierAccount, ShippingRoute } from '../../../lib/api/types';
import { ALGERIAN_WILAYAS } from '../../../lib/algeriaData';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Button } from '../../common/Button';
import { Modal } from '../../common/Modal';
import { shippingErrorMessage } from '../shippingErrors';
import { isIntInRange } from './shippingSettingsShared';

const code2 = (n: number) => String(n).padStart(2, '0');

interface Draft { id: string | null; wilayas: string[]; carrier: string; fallback: string; priority: string }
const EMPTY: Draft = { id: null, wilayas: [], carrier: '', fallback: '', priority: '100' };

/** Per-wilaya carrier routing: which carrier (and fallback) handles which wilayas. */
export const ShippingRoutesEditor: React.FC<{ storeId: string }> = ({ storeId }) => {
  const { t, language } = useLanguage();
  const [routes, setRoutes] = useState<ShippingRoute[]>([]);
  const [accounts, setAccounts] = useState<CarrierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ShippingRoute | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const wilayaName = (w: typeof ALGERIAN_WILAYAS[number]) => language === 'ar' ? w.nameAr : language === 'fr' ? w.nameFr : w.nameEn;
  const usable = accounts.filter(account => account.status === 'active');
  const accountName = (id: string | null) => accounts.find(account => account.id === id)?.display_name ?? '—';

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [routeList, carriers] = await Promise.all([shippingApi.listRoutes(), shippingApi.listCarriers()]);
      setRoutes(routeList); setAccounts(carriers.accounts);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [storeId]);
  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setDraft({ ...EMPTY, carrier: usable[0]?.id ?? '' }); setFormError(''); };
  const openEdit = (route: ShippingRoute) => {
    setDraft({ id: route.id, wilayas: route.wilaya_codes, carrier: route.carrier_account_id, fallback: route.fallback_carrier_account_id ?? '', priority: String(route.priority) });
    setFormError('');
  };
  const toggleWilaya = (code: string) => setDraft(prev => prev && ({ ...prev, wilayas: prev.wilayas.includes(code) ? prev.wilayas.filter(c => c !== code) : [...prev.wilayas, code].sort() }));

  const saveRoute = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const priority = draft.priority.trim() === '' ? NaN : Number(draft.priority);
    if (!draft.carrier) { setFormError(t('settings.shipping.routes.carrier_required', 'اختر شركة التوصيل.')); return; }
    if (draft.fallback && draft.fallback === draft.carrier) { setFormError(t('settings.shipping.routes.fallback_same', 'شركة الاحتياط يجب أن تختلف عن الأساسية.')); return; }
    if (!isIntInRange(priority, 0, 100000)) { setFormError(t('settings.shipping.routes.priority_invalid', 'الأولوية عدد صحيح بين 0 و100000.')); return; }
    const payload = { wilaya_codes: draft.wilayas, carrier_account_id: draft.carrier, fallback_carrier_account_id: draft.fallback || null, priority };
    setSaving(true); setFormError('');
    try {
      if (draft.id) await shippingApi.updateRoute(draft.id, payload); else await shippingApi.createRoute(payload);
      setDraft(null);
      await load();
      setMessage({ kind: 'success', text: t('settings.shipping.routes.saved', 'تم حفظ المسار.') });
    } catch (error) {
      const raw = (error as { message?: string })?.message;
      setFormError(raw === 'fallback_same_as_primary' ? t('settings.shipping.routes.fallback_same', 'شركة الاحتياط يجب أن تختلف عن الأساسية.')
        : raw === 'carrier_account_invalid' ? t('settings.shipping.routes.carrier_invalid', 'شركة التوصيل المختارة غير صالحة.')
          : shippingErrorMessage(error, t));
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try { await shippingApi.deleteRoute(target.id); await load(); setMessage({ kind: 'success', text: t('settings.shipping.routes.deleted', 'تم حذف المسار.') }); }
    catch (error) { setMessage({ kind: 'error', text: shippingErrorMessage(error, t) }); }
  };

  const summary = (codes: string[]) => codes.length > 6 ? `${codes.slice(0, 6).join(' · ')} +${codes.length - 6}` : codes.join(' · ');

  return (
    <div className="settings-card space-y-4">
      <div className="settings-row">
        <div className="min-w-0">
          <p className="settings-card-title">{t('settings.shipping.routes.title', 'مسارات الشحن حسب الولاية')}</p>
          <p className="settings-hint mt-1">{t('settings.shipping.routes.hint', 'حدّد أي شركة توصيل تتولى أي ولايات. مسار بلا ولايات يشمل كل ولاية ليس لها مسار خاص. الأقل رقمًا في الأولوية يُطبَّق أولًا.')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={openNew} disabled={usable.length === 0} leftIcon={<Plus className="w-3.5 h-3.5" />}>{t('settings.shipping.routes.add', 'إضافة مسار')}</Button>
      </div>

      {loading ? <div className="h-16 animate-pulse" role="status" aria-label={t('common.loading', 'جارٍ التحميل…')} />
        : loadError ? <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.shipping.routes.load_error', 'تعذر تحميل المسارات.')}</p>
          : routes.length > 0 ? (
            <ul className="settings-list">
              {routes.map(route => (
                <li key={route.id} className="settings-list-row flex-wrap">
                  <span className="settings-list-icon" aria-hidden="true"><RouteIcon className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-semibold text-[var(--ordium-text)]">{accountName(route.carrier_account_id)}</p>
                    <p className="text-xs text-[var(--ordium-subtle)] mt-0.5 tabular-nums">
                      {route.wilaya_codes.length ? summary(route.wilaya_codes) : t('settings.shipping.routes.all_other', 'كل الولايات الأخرى')}
                      {route.fallback_carrier_account_id && <> · {t('settings.shipping.routes.fallback_short', 'احتياط')}: {accountName(route.fallback_carrier_account_id)}</>}
                      {' · '}{t('settings.shipping.routes.priority', 'الأولوية')} {route.priority}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(route)} leftIcon={<Pencil className="w-3.5 h-3.5" />}>{t('settings.shipping.routes.edit', 'تعديل')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(route)} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>{t('common.delete', 'حذف')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="py-4 text-center text-sm text-[var(--ordium-muted)]">{usable.length ? t('settings.shipping.routes.empty', 'لا توجد مسارات. ستُرسل كل الطلبات عبر الشركة الافتراضية.') : t('settings.shipping.routes.need_carrier', 'اربط شركة توصيل أولًا لتتمكن من إضافة مسارات.')}</p>}
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`settings-feedback settings-feedback--${message.kind}`}>{message.text}</p>}

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('settings.shipping.routes.edit_title', 'تعديل المسار') : t('settings.shipping.routes.add_title', 'مسار جديد')} maxWidth="lg">
        {draft && (
          <form onSubmit={event => void saveRoute(event)} className="space-y-4" noValidate>
            <fieldset>
              <legend className="settings-label mb-1.5">{t('settings.shipping.routes.wilayas', 'الولايات')} <span className="tabular-nums">({draft.wilayas.length})</span></legend>
              <p className="settings-hint mb-2">{t('settings.shipping.routes.wilayas_hint', 'اتركها فارغة ليشمل المسار كل الولايات الأخرى.')}</p>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, wilayas: ALGERIAN_WILAYAS.map(w => code2(w.code)) })}>{t('settings.shipping.routes.select_all', 'تحديد الكل')}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, wilayas: [] })}>{t('settings.shipping.routes.clear', 'مسح')}</Button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-[var(--ordium-radius-sm)] border border-[var(--ordium-border-strong)] p-1 grid sm:grid-cols-2">
                {ALGERIAN_WILAYAS.map(w => {
                  const value = code2(w.code);
                  return (
                    <label key={value} className="settings-check">
                      <input type="checkbox" checked={draft.wilayas.includes(value)} onChange={() => toggleWilaya(value)} />
                      <span className="text-sm text-[var(--ordium-text)]"><span className="tabular-nums text-[var(--ordium-subtle)]">{value}</span> · {wilayaName(w)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="route-carrier" className="settings-label mb-1.5">{t('settings.shipping.routes.carrier', 'شركة التوصيل')}</label>
                <select id="route-carrier" className="settings-input w-full" value={draft.carrier} onChange={event => setDraft({ ...draft, carrier: event.target.value })}>
                  {usable.map(account => <option key={account.id} value={account.id}>{account.display_name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="route-fallback" className="settings-label mb-1.5">{t('settings.shipping.routes.fallback', 'شركة الاحتياط')}</label>
                <select id="route-fallback" className="settings-input w-full" value={draft.fallback} onChange={event => setDraft({ ...draft, fallback: event.target.value })}>
                  <option value="">{t('settings.shipping.routes.no_fallback', 'بدون احتياط')}</option>
                  {usable.filter(account => account.id !== draft.carrier).map(account => <option key={account.id} value={account.id}>{account.display_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="route-priority" className="settings-label mb-1.5">{t('settings.shipping.routes.priority', 'الأولوية')}</label>
              <input id="route-priority" type="number" inputMode="numeric" min={0} max={100000} className="settings-input w-28 tabular-nums" value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })} />
            </div>
            {formError && <p role="alert" className="settings-feedback settings-feedback--error">{formError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('common.cancel', 'إلغاء')}</Button>
              <Button type="submit" isLoading={saving}>{t('settings.shipping.routes.save', 'حفظ المسار')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('settings.shipping.routes.delete_title', 'حذف المسار؟')} description={t('settings.shipping.routes.delete_desc', 'ستعود هذه الولايات إلى الشركة الافتراضية.')}>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>{t('common.cancel', 'إلغاء')}</Button>
          <Button variant="danger" onClick={() => void remove()}>{t('settings.shipping.routes.delete_confirm', 'نعم، احذف المسار')}</Button>
        </div>
      </Modal>
    </div>
  );
};
