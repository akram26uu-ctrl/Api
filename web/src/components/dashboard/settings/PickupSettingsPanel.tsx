import React from 'react';
import { Info } from 'lucide-react';
import { ALGERIAN_WILAYAS } from '../../../lib/algeriaData';
import type { ShippingSettings } from '../../../lib/api/types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { LoadingCard, NoStoreNotice, SaveBar, useShippingSettingsForm, SharedEnvironmentsHint } from './shippingSettingsShared';

const FIELDS = ['pickup_name', 'pickup_wilaya', 'pickup_commune', 'pickup_phone', 'label_size'] as const;

export const PickupSettingsPanel: React.FC<{ storeId: string }> = ({ storeId }) => {
  const { t, language } = useLanguage();
  const { settings, patch, dirty, save, saving, feedback, loading, loadError } = useShippingSettingsForm(storeId, [...FIELDS]);

  if (!storeId) return <NoStoreNotice />;
  if (loading) return <LoadingCard />;
  if (loadError || !settings) return <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.shipping.load_error', 'تعذر تحميل إعدادات الشحن. حدّث الصفحة للمحاولة مجددًا.')}</p>;

  const wilayaName = (w: typeof ALGERIAN_WILAYAS[number]) => language === 'ar' ? w.nameAr : language === 'fr' ? w.nameFr : w.nameEn;
  // The API stores the wilaya as free text; accept a code or a known name and show the matching option.
  const current = ALGERIAN_WILAYAS.find(w => [String(w.code).padStart(2, '0'), w.nameAr, w.nameFr, w.nameEn].includes(settings.pickup_wilaya ?? ''));
  const phone = settings.pickup_phone ?? '';
  const phoneInvalid = phone !== '' && !/^[0-9+\s().-]{8,32}$/.test(phone);
  const sizes: { value: ShippingSettings['label_size']; label: string }[] = [
    { value: 'a6', label: t('settings.shipping.pickup.size_a6', 'A6 — ملصق واحد') },
    { value: 'a4_4', label: t('settings.shipping.pickup.size_a4_4', 'A4 — 4 ملصقات في الصفحة') },
    { value: 'a4_1', label: t('settings.shipping.pickup.size_a4_1', 'A4 — ملصق واحد في الصفحة') },
  ];

  return (
    <div className="space-y-6">
      <p className="settings-note"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t('settings.shipping.pickup.note', 'تنطبق هذه البيانات على الطرود التي تجهّزها بنفسك وتسلّمها لشركة التوصيل.')}</p>

      <div className="settings-card space-y-4">
        <div>
          <label htmlFor="pickup-name" className="settings-label mb-1.5">{t('settings.shipping.pickup.name', 'اسم نقطة الاستلام')}</label>
          <input id="pickup-name" className="settings-input w-full" maxLength={150} value={settings.pickup_name ?? ''} disabled={saving} onChange={event => patch({ pickup_name: event.target.value || null })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pickup-wilaya" className="settings-label mb-1.5">{t('settings.shipping.pickup.wilaya', 'الولاية')}</label>
            <select id="pickup-wilaya" className="settings-input w-full" value={current ? String(current.code).padStart(2, '0') : ''} disabled={saving}
              onChange={event => { const w = ALGERIAN_WILAYAS.find(item => String(item.code).padStart(2, '0') === event.target.value); patch({ pickup_wilaya: w ? String(w.code).padStart(2, '0') : null }); }}>
              <option value="">{t('common.select', 'اختر')}</option>
              {ALGERIAN_WILAYAS.map(w => <option key={w.code} value={String(w.code).padStart(2, '0')}>{String(w.code).padStart(2, '0')} · {wilayaName(w)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pickup-commune" className="settings-label mb-1.5">{t('settings.shipping.pickup.commune', 'البلدية')}</label>
            <input id="pickup-commune" className="settings-input w-full" maxLength={100} value={settings.pickup_commune ?? ''} disabled={saving} onChange={event => patch({ pickup_commune: event.target.value || null })} />
          </div>
        </div>
        <div>
          <label htmlFor="pickup-phone" className="settings-label mb-1.5">{t('settings.shipping.pickup.phone', 'هاتف نقطة الاستلام')}</label>
          <input id="pickup-phone" type="tel" dir="ltr" className="settings-input w-full sm:w-64" maxLength={32} value={phone} disabled={saving} aria-invalid={phoneInvalid} aria-describedby={phoneInvalid ? 'pickup-phone-error' : undefined} onChange={event => patch({ pickup_phone: event.target.value || null })} />
          {phoneInvalid && <p id="pickup-phone-error" role="alert" className="settings-feedback settings-feedback--error mt-1">{t('settings.shipping.pickup.phone_invalid', 'أدخل رقم هاتف صالحًا.')}</p>}
        </div>
      </div>

      <fieldset className="settings-card space-y-1" disabled={saving}>
        <legend className="settings-card-title mb-3">{t('settings.shipping.pickup.label_size', 'حجم ملصق الشحن')}</legend>
        {sizes.map(option => (
          <label key={option.value} className="settings-check">
            <input type="radio" name="label-size" value={option.value} checked={settings.label_size === option.value} onChange={() => patch({ label_size: option.value })} />
            <span className="text-sm text-[var(--ordium-text)]">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <SharedEnvironmentsHint />

      <SaveBar feedback={feedback} dirty={dirty} saving={saving} invalid={phoneInvalid} onSave={() => void save()} label={t('settings.shipping.pickup.save', 'حفظ بيانات الاستلام')} />
    </div>
  );
};
