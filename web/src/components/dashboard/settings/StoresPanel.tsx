import React, { useState } from 'react';
import { Building2, Plus, Power, RefreshCw } from 'lucide-react';
import { Store } from '../../../lib/api/types';
import { ordiumClient } from '../../../lib/api/client';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Button } from '../../common/Button';
import { LoadingState } from '../../common/EmptyState';

interface StoresPanelProps {
  stores: Store[];
  onStoresChanged: (stores: Store[]) => void;
  /** First-run mode: only the create form, no list actions. */
  required?: boolean;
  onCreated?: () => void;
}

/** Create, list, enable and disable stores. Used by Settings and by the first-run dialog. */
export const StoresPanel: React.FC<StoresPanelProps> = ({ stores, onStoresChanged, required = false, onCreated }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true); setError('');
    try { onStoresChanged(await ordiumClient.getStores()); }
    catch (e) { setError(e instanceof Error ? e.message : t('dashboard.stores.load_error', 'تعذر تحميل المتاجر.')); }
    finally { setLoading(false); }
  };

  const create = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError(t('dashboard.stores.name_required', 'أدخل اسم المتجر.')); return; }
    setCreating(true); setError('');
    try {
      const created = await ordiumClient.createStore(trimmed);
      onStoresChanged([...stores, created]);
      setName('');
      onCreated?.();
    } catch (e) { setError(e instanceof Error ? e.message : t('dashboard.stores.create_error', 'تعذر إنشاء المتجر.')); }
    finally { setCreating(false); }
  };

  const toggle = async (store: Store) => {
    if (store.is_active && stores.filter(item => item.is_active).length <= 1) {
      setError(t('dashboard.stores.keep_one_active', 'يجب أن يبقى متجر واحد نشطًا على الأقل.'));
      return;
    }
    setError(''); setPendingId(store.id);
    try {
      const updated = await ordiumClient.updateStore(store.id, { name: store.name, is_active: !store.is_active });
      onStoresChanged(stores.map(item => item.id === updated.id ? updated : item));
    } catch (e) { setError(e instanceof Error ? e.message : t('dashboard.stores.update_error', 'تعذر تحديث المتجر.')); }
    finally { setPendingId(null); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="settings-card" noValidate>
        <label htmlFor="ordium-new-store" className="settings-card-title">{t('dashboard.stores.create_title', 'إضافة متجر')}</label>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            id="ordium-new-store"
            autoFocus={required}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('dashboard.stores.name_placeholder', 'اسم المتجر')}
            aria-invalid={!!error && name.trim().length < 2}
            aria-describedby={error ? 'ordium-store-error' : undefined}
            className="settings-input flex-1"
          />
          <Button type="submit" variant="primary" isLoading={creating} leftIcon={<Plus className="w-4 h-4" />}>{t('dashboard.stores.create', 'إنشاء المتجر')}</Button>
        </div>
        {error && <p id="ordium-store-error" role="alert" className="mt-3 text-xs text-[var(--ordium-danger)]">{error}</p>}
      </form>

      {!required && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--ordium-muted)]">{t('dashboard.stores.count_label', 'متاجرك')} <span className="text-[var(--ordium-text)] font-semibold tabular-nums">{stores.length.toLocaleString(locale)}</span></p>
            <Button variant="ghost" size="sm" onClick={() => void refresh()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>{t('common.refresh', 'تحديث')}</Button>
          </div>
          {loading ? <LoadingState message={t('dashboard.stores.loading', 'جارٍ تحميل المتاجر…')} /> : stores.length > 0 ? (
            <ul className="settings-list">
              {stores.map(store => (
                <li key={store.id} className="settings-list-row">
                  <span className="settings-list-icon" aria-hidden="true"><Building2 className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--ordium-text)] truncate">{store.name}</p>
                    <p className="text-xs text-[var(--ordium-subtle)] mt-0.5">
                      {(store.order_count || 0).toLocaleString(locale)} {t('dashboard.stores.orders_suffix', 'طلبية')}
                    </p>
                  </div>
                  <span className={`settings-status ${store.is_active ? 'settings-status--ok' : 'settings-status--off'}`}>
                    {store.is_active ? t('dashboard.stores.active', 'نشط') : t('dashboard.stores.inactive', 'متوقف')}
                  </span>
                  <Button variant="ghost" size="sm" isLoading={pendingId === store.id} onClick={() => void toggle(store)} leftIcon={<Power className="w-3.5 h-3.5" />}>
                    {store.is_active ? t('dashboard.stores.disable', 'إيقاف') : t('dashboard.stores.enable', 'تفعيل')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : <p className="py-8 text-center text-sm text-[var(--ordium-muted)]">{t('dashboard.stores.empty', 'لا توجد متاجر بعد. أنشئ متجرك الأول أعلاه.')}</p>}
        </div>
      )}
    </div>
  );
};
