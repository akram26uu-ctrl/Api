import React, { useState } from 'react';
import { Building2, Plus, Power, RefreshCw, X } from 'lucide-react';
import { Store } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../common/Button';
import { LoadingState } from '../common/EmptyState';

interface Props {
  stores: Store[];
  onStoresChanged: (stores: Store[]) => void;
  required?: boolean;
  onClose?: () => void;
}

export const StoreManagementModal: React.FC<Props> = ({ stores, onStoresChanged, required = false, onClose }) => {
  const { t, isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true); setError('');
    try { onStoresChanged(await ordiumClient.getStores()); }
    catch (e) { setError(e instanceof Error ? e.message : t('dashboard.stores.load_error', 'تعذر تحميل المتاجر.')); }
    finally { setLoading(false); }
  };

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError(t('dashboard.stores.name_required', 'أدخل اسم المتجر.')); return; }
    setCreating(true); setError('');
    try {
      const created = await ordiumClient.createStore(trimmed);
      onStoresChanged([...stores, created]);
      setName('');
      if (!required) onClose?.();
    } catch (e) { setError(e instanceof Error ? e.message : t('dashboard.stores.create_error', 'تعذر إنشاء المتجر.')); }
    finally { setCreating(false); }
  };

  const toggle = async (store: Store) => {
    if (store.is_active && stores.filter(item => item.is_active).length <= 1) {
      setError(t('dashboard.stores.keep_one_active', 'يجب أن يبقى متجر واحد نشطًا على الأقل.'));
      return;
    }
    setError('');
    try {
      const updated = await ordiumClient.updateStore(store.id, { name: store.name, is_active: !store.is_active });
      onStoresChanged(stores.map(item => item.id === updated.id ? updated : item));
    } catch (e) { setError(e instanceof Error ? e.message : t('dashboard.stores.update_error', 'تعذر تحديث المتجر.')); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0D1320] shadow-2xl">
        <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-white/5 bg-[#0D1320]/98 backdrop-blur-xl flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#22D3EE] font-mono">{t('dashboard.stores.eyebrow', 'إدارة المتاجر')}</p>
            <h2 className="text-lg font-bold text-white mt-1">{required ? t('dashboard.stores.required_title', 'أنشئ متجرك أولًا') : t('dashboard.stores.title', 'المتاجر')}</h2>
            <p className="text-xs text-[#94A3B8] mt-1">{required ? t('dashboard.stores.required_desc', 'للبدء واستقبال الطلبات، يجب إنشاء متجر واحد على الأقل.') : t('dashboard.stores.subtitle', 'افصل الطلبات والمفاتيح والإحصائيات لكل متجر داخل حسابك نفسه.')}</p>
          </div>
          {!required && onClose && <button onClick={onClose} className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5" aria-label={t('common.close', 'إغلاق')}><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-[#080B12] p-4">
            <div className="flex items-center gap-2 mb-3"><Plus className="w-4 h-4 text-[#22D3EE]"/><h3 className="text-sm font-semibold text-white">{t('dashboard.stores.create_title', 'إضافة متجر')}</h3></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input autoFocus={required} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create(); }} placeholder={t('dashboard.stores.name_placeholder', 'اسم المتجر')} className="flex-1 rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50" />
              <Button variant="primary" isLoading={creating} onClick={() => void create()}>{t('dashboard.stores.create', 'إنشاء المتجر')}</Button>
            </div>
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          </div>

          {!required && <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#64748B]">{stores.length.toLocaleString()} {t('dashboard.stores.count_suffix', 'متجر')}</p><Button variant="outline" size="sm" onClick={() => void refresh()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>{t('common.refresh', 'تحديث')}</Button></div>}

          {loading ? <LoadingState message={t('dashboard.stores.loading', 'جارٍ تحميل المتاجر…')} /> : stores.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stores.map(store => (
                <div key={store.id} className="rounded-2xl border border-white/10 bg-[#080B12] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#22D3EE]/10 border border-[#22D3EE]/20 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5 text-[#22D3EE]"/></div>
                      <div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{store.name}</p><p className="text-[10px] text-[#64748B] font-mono truncate">{store.slug}</p></div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full shrink-0 ${store.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-[#64748B]'}`}>{store.is_active ? t('dashboard.stores.active','نشط') : t('dashboard.stores.inactive','متوقف')}</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                    <span className="text-xs text-[#94A3B8]">{t('dashboard.stores.orders','الطلبات')} <strong className="text-white">{(store.order_count || 0).toLocaleString()}</strong></span>
                    <Button variant="ghost" size="sm" onClick={() => void toggle(store)} leftIcon={<Power className="w-3.5 h-3.5"/>}>{store.is_active ? t('dashboard.stores.disable','تعطيل') : t('dashboard.stores.enable','تفعيل')}</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : !required ? <div className="py-10 text-center text-sm text-[#64748B]">{t('dashboard.stores.empty', 'لا توجد متاجر بعد.')}</div> : null}
        </div>
      </div>
    </div>
  );
};
