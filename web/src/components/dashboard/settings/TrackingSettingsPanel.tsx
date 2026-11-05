import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Switch } from './Switch';
import { LoadingCard, NoStoreNotice, SaveBar, SwitchRow, useShippingSettingsForm } from './shippingSettingsShared';

const FIELDS = ['notify_on_hold', 'notify_on_failure', 'notify_on_low_stock'] as const;

export const TrackingSettingsPanel: React.FC<{ storeId: string }> = ({ storeId }) => {
  const { t } = useLanguage();
  const { settings, patch, dirty, save, saving, feedback, loading, loadError } = useShippingSettingsForm(storeId, [...FIELDS]);

  if (!storeId) return <NoStoreNotice />;
  if (loading) return <LoadingCard />;
  if (loadError || !settings) return <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.shipping.load_error', 'تعذر تحميل إعدادات الشحن. حدّث الصفحة للمحاولة مجددًا.')}</p>;

  const rows = [
    { key: 'notify_on_hold' as const, id: 'notify-hold-label', title: t('settings.shipping.tracking.on_hold', 'عند توقف طلب بانتظار قرارك'), hint: t('settings.shipping.tracking.on_hold_hint', 'تنبيه حين يدخل طلب قائمة القرارات المعلّقة: مراجعة أو نفاد مخزون أو منتج غير مربوط.') },
    { key: 'notify_on_failure' as const, id: 'notify-failure-label', title: t('settings.shipping.tracking.on_failure', 'عند فشل إرسال أو توصيل'), hint: t('settings.shipping.tracking.on_failure_hint', 'تنبيه حين يفشل إرسال الطرد إلى شركة التوصيل أو تفشل محاولة التسليم.') },
    { key: 'notify_on_low_stock' as const, id: 'notify-low-label', title: t('settings.shipping.tracking.on_low_stock', 'عند انخفاض المخزون'), hint: t('settings.shipping.tracking.on_low_stock_hint', 'تنبيه حين يقارب منتج النفاد حسب مهلة المخزون المنخفض.') },
  ];

  return (
    <div className="space-y-6">
      <div className="settings-card space-y-5">
        {rows.map(row => (
          <SwitchRow key={row.key} id={row.id} title={row.title} hint={row.hint}>
            <Switch checked={settings[row.key]} onChange={value => patch({ [row.key]: value })} labelledBy={row.id} disabled={saving} />
          </SwitchRow>
        ))}
      </div>
      <SaveBar feedback={feedback} dirty={dirty} saving={saving} onSave={() => void save()} label={t('settings.shipping.tracking.save', 'حفظ التنبيهات')} />
    </div>
  );
};
