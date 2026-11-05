import React from 'react';
import { Info, Package } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Button } from '../../common/Button';
import { Switch } from './Switch';
import { LoadingCard, NoStoreNotice, NumberField, SaveBar, SwitchRow, isIntInRange, useShippingSettingsForm, SharedEnvironmentsHint } from './shippingSettingsShared';

const FIELDS = ['out_of_stock_policy', 'low_stock_days', 'reserve_on_accept', 'disable_product_when_out'] as const;

export const StockSettingsPanel: React.FC<{ storeId: string; onNavigate?: (target: 'inventory') => void }> = ({ storeId, onNavigate }) => {
  const { t } = useLanguage();
  const { settings, patch, dirty, save, saving, feedback, loading, loadError } = useShippingSettingsForm(storeId, [...FIELDS]);

  if (!storeId) return <NoStoreNotice />;
  if (loading) return <LoadingCard />;
  if (loadError || !settings) return <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.shipping.load_error', 'تعذر تحميل إعدادات الشحن. حدّث الصفحة للمحاولة مجددًا.')}</p>;

  const policies = [
    { value: 'hold' as const, label: t('settings.shipping.stock.policy_hold', 'أوقف الطلب'), hint: t('settings.shipping.stock.policy_hold_hint', 'يبقى الطلب في قائمة القرارات المعلّقة حتى تقرّر أنت.') },
    { value: 'backorder' as const, label: t('settings.shipping.stock.policy_backorder', 'اقبله كطلب مسبق'), hint: t('settings.shipping.stock.policy_backorder_hint', 'يُقبل الطلب ويُشحن حين يتوفر المخزون.') },
    { value: 'other_warehouse' as const, label: t('settings.shipping.stock.policy_other', 'اسحب من مستودع آخر'), hint: t('settings.shipping.stock.policy_other_hint', 'إن لم يتوفر المنتج لدى الشركة الأساسية يُجرَّب مستودع شركة الاحتياط المحددة في المسار.') },
  ];

  return (
    <div className="space-y-6">
      <fieldset className="settings-card space-y-1" disabled={saving}>
        <legend className="settings-card-title mb-3">{t('settings.shipping.stock.policy', 'عند نفاد المنتج')}</legend>
        {policies.map(option => (
          <label key={option.value} className="settings-check">
            <input type="radio" name="out-of-stock-policy" value={option.value} checked={settings.out_of_stock_policy === option.value} onChange={() => patch({ out_of_stock_policy: option.value })} />
            <span>
              <span className="block text-sm text-[var(--ordium-text)]">{option.label}</span>
              <span className="settings-hint">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="settings-card">
        <NumberField id="stock-low-days" label={t('settings.shipping.stock.low_days', 'تنبيه المخزون المنخفض')} hint={t('settings.shipping.stock.low_days_hint', 'ننبّهك حين يكفي المخزون الحالي أقل من هذا العدد من الأيام حسب وتيرة البيع.')} unit={t('settings.shipping.unit_days', 'يوم')} min={1} max={60} value={settings.low_stock_days} onChange={value => patch({ low_stock_days: value })} disabled={saving} />
      </div>

      <div className="settings-card space-y-5">
        <SwitchRow id="stock-reserve-label" title={t('settings.shipping.stock.reserve', 'احجز المخزون عند قبول الطلب')} hint={t('settings.shipping.stock.reserve_hint', 'تُحجز الكمية من لحظة القبول حتى لا تُباع لطلب آخر.')}>
          <Switch checked={settings.reserve_on_accept} onChange={value => patch({ reserve_on_accept: value })} labelledBy="stock-reserve-label" disabled={saving} />
        </SwitchRow>
        <SwitchRow id="stock-disable-label" title={t('settings.shipping.stock.disable_when_out', 'أوقف المنتج في متجرك عند النفاد')} hint={t('settings.shipping.stock.disable_when_out_hint', 'يُخفى المنتج من المتجر تلقائيًا حتى يتوفر من جديد.')}>
          <Switch checked={settings.disable_product_when_out} onChange={value => patch({ disable_product_when_out: value })} labelledBy="stock-disable-label" disabled={saving} />
        </SwitchRow>
      </div>

      <div className="settings-note">
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <p>{t('settings.shipping.stock.location_note', 'مكان تخزين كل منتج يُحدَّد من صفحة المخزون.')}</p>
          {onNavigate && <Button variant="outline" size="sm" onClick={() => onNavigate('inventory')} leftIcon={<Package className="w-3.5 h-3.5" />}>{t('settings.shipping.stock.open_inventory', 'افتح صفحة المخزون')}</Button>}
        </div>
      </div>

      <SharedEnvironmentsHint />

      <SaveBar feedback={feedback} dirty={dirty} saving={saving} invalid={!isIntInRange(settings.low_stock_days, 1, 60)} onSave={() => void save()} label={t('settings.shipping.stock.save', 'حفظ إعدادات المخزون')} />
    </div>
  );
};
