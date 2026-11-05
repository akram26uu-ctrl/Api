import React from 'react';
import { Info } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Switch } from './Switch';
import { ShippingRoutesEditor } from './ShippingRoutesEditor';
import { LoadingCard, NoStoreNotice, NumberField, SaveBar, SwitchRow, isIntInRange, useShippingSettingsForm } from './shippingSettingsShared';

const FIELDS = ['auto_dispatch', 'dispatch_trigger', 'hold_minutes', 'confirmation_timeout_hours', 'retry_max', 'retry_interval_minutes', 'fallback_enabled'] as const;

export const DispatchSettingsPanel: React.FC<{ storeId: string }> = ({ storeId }) => {
  const { t } = useLanguage();
  const { settings, patch, dirty, save, saving, feedback, loading, loadError } = useShippingSettingsForm(storeId, [...FIELDS]);

  if (!storeId) return <NoStoreNotice />;
  if (loading) return <LoadingCard />;
  if (loadError || !settings) return <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.shipping.load_error', 'تعذر تحميل إعدادات الشحن. حدّث الصفحة للمحاولة مجددًا.')}</p>;

  const invalid = !isIntInRange(settings.hold_minutes, 0, 1440) || !isIntInRange(settings.confirmation_timeout_hours, 1, 168)
    || !isIntInRange(settings.retry_max, 0, 20) || !isIntInRange(settings.retry_interval_minutes, 1, 1440);
  const triggers = [
    { value: 'after_confirmation' as const, label: t('settings.shipping.dispatch.trigger_confirmed', 'بعد تأكيد الطلب'), hint: t('settings.shipping.dispatch.trigger_confirmed_hint', 'يُرسل الطرد عندما يؤكد الزبون الطلب.') },
    { value: 'on_allow' as const, label: t('settings.shipping.dispatch.trigger_allow', 'عند قبول الطلب'), hint: t('settings.shipping.dispatch.trigger_allow_hint', 'يُرسل الطرد فور أن يقيّم Ordium الطلب كمقبول، دون انتظار تأكيد الزبون.') },
  ];

  return (
    <div className="space-y-6">
      <p className="settings-note"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t('settings.shipping.dispatch.order_note', 'نوع التوصيل والسعر ورسوم التوصيل تأتي من كل طلبية ولا تُضبط هنا.')}</p>

      <div className="settings-card">
        <SwitchRow id="ship-auto-label" title={t('settings.shipping.dispatch.auto', 'أرسل الطرود تلقائيًا')} hint={t('settings.shipping.dispatch.auto_hint', 'تُنشأ الشحنة وتُرسل إلى شركة التوصيل دون تدخّلك. الطلبات التي تحتاج مراجعة أو المرفوضة لا تُرسل أبدًا دون قرارك.')}>
          <Switch checked={settings.auto_dispatch} onChange={value => patch({ auto_dispatch: value })} labelledBy="ship-auto-label" disabled={saving} />
        </SwitchRow>
      </div>

      <fieldset className={`settings-card space-y-1 ${settings.auto_dispatch ? '' : 'is-muted'}`} disabled={saving || !settings.auto_dispatch}>
        <legend className="settings-card-title mb-3">{t('settings.shipping.dispatch.trigger', 'متى يُرسل الطرد؟')}</legend>
        {triggers.map(option => (
          <label key={option.value} className="settings-check">
            <input type="radio" name="dispatch-trigger" value={option.value} checked={settings.dispatch_trigger === option.value} onChange={() => patch({ dispatch_trigger: option.value })} />
            <span>
              <span className="block text-sm text-[var(--ordium-text)]">{option.label}</span>
              <span className="settings-hint">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className={`settings-card grid gap-5 sm:grid-cols-2 ${settings.auto_dispatch ? '' : 'is-muted'}`}>
        <NumberField id="ship-hold" label={t('settings.shipping.dispatch.hold_minutes', 'مهلة الانتظار قبل الإرسال')} hint={t('settings.shipping.dispatch.hold_minutes_hint', 'تأخير الإرسال بعد قبول الطلب، يمنحك وقتًا لإلغائه قبل خروج الطرد. 0 = فورًا.')} unit={t('settings.shipping.unit_minutes', 'دقيقة')} min={0} max={1440} value={settings.hold_minutes} onChange={value => patch({ hold_minutes: value })} disabled={saving || !settings.auto_dispatch} />
        <NumberField id="ship-timeout" label={t('settings.shipping.dispatch.timeout_hours', 'مهلة انتظار تأكيد الزبون')} hint={t('settings.shipping.dispatch.timeout_hours_hint', 'بعدها يبقى الطلب في قائمة القرارات المعلّقة.')} unit={t('settings.shipping.unit_hours', 'ساعة')} min={1} max={168} value={settings.confirmation_timeout_hours} onChange={value => patch({ confirmation_timeout_hours: value })} disabled={saving} />
      </div>

      <div className="settings-card space-y-5">
        <p className="settings-card-title">{t('settings.shipping.dispatch.failure_title', 'عند فشل الإرسال')}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="ship-retry-max" label={t('settings.shipping.dispatch.retry_max', 'عدد المحاولات')} hint={t('settings.shipping.dispatch.retry_max_hint', 'كم مرة نعيد المحاولة تلقائيًا. 0 = لا إعادة.')} min={0} max={20} value={settings.retry_max} onChange={value => patch({ retry_max: value })} disabled={saving} />
          <NumberField id="ship-retry-interval" label={t('settings.shipping.dispatch.retry_interval', 'الفاصل بين المحاولات')} unit={t('settings.shipping.unit_minutes', 'دقيقة')} min={1} max={1440} value={settings.retry_interval_minutes} onChange={value => patch({ retry_interval_minutes: value })} disabled={saving} />
        </div>
        <SwitchRow id="ship-fallback-label" title={t('settings.shipping.dispatch.fallback', 'استعمل شركة الاحتياط')} hint={t('settings.shipping.dispatch.fallback_hint', 'إن فشلت المحاولات مع الشركة الأساسية يُرسل الطرد عبر شركة الاحتياط المحددة في المسار.')}>
          <Switch checked={settings.fallback_enabled} onChange={value => patch({ fallback_enabled: value })} labelledBy="ship-fallback-label" disabled={saving} />
        </SwitchRow>
      </div>

      <SaveBar feedback={feedback} dirty={dirty} saving={saving} invalid={invalid} onSave={() => void save()} label={t('settings.shipping.dispatch.save', 'حفظ إعدادات الإرسال')} />

      <ShippingRoutesEditor storeId={storeId} />
    </div>
  );
};
