/**
 * Shared pieces of the shipping settings panels: the load/save hook for the
 * per-store ShippingSettings row, the "select a store" notice, the save bar and
 * a validated number field. Everything reuses the existing settings-* classes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Info, Save } from 'lucide-react';
import { shippingApi } from '../../../lib/api/shipping';
import type { ShippingSettings, ShippingSettingsUpdate } from '../../../lib/api/types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Button } from '../../common/Button';
import { shippingErrorMessage } from '../shippingErrors';

export type Feedback = { kind: 'success' | 'error'; text: string } | null;

export const isIntInRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

export const NoStoreNotice: React.FC = () => {
  const { t } = useLanguage();
  return (
    <p className="settings-note" role="status">
      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      {t('settings.shipping.select_store', 'اختر متجرًا نشطًا من أعلى لوحة التحكم أولًا، فإعدادات الشحن خاصة بكل متجر.')}
    </p>
  );
};

export const LoadingCard: React.FC = () => {
  const { t } = useLanguage();
  return <div className="settings-card h-48 animate-pulse" role="status" aria-label={t('common.loading', 'جارٍ التحميل…')} />;
};

/** Loads the store's shipping settings and saves only the fields a panel owns. */
export function useShippingSettingsForm(storeId: string, fields: (keyof ShippingSettingsUpdate)[]) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [saved, setSaved] = useState<ShippingSettings | null>(null);
  const [loading, setLoading] = useState(!!storeId);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fieldsRef = useRef(fields);

  useEffect(() => {
    if (!storeId) { setLoading(false); return; }
    let active = true;
    setLoading(true); setLoadError(false);
    shippingApi.getSettings()
      .then(value => { if (active) { setSettings(value); setSaved(value); } })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId]);

  const patch = useCallback((changes: Partial<ShippingSettings>) => {
    setSettings(prev => prev ? { ...prev, ...changes } : prev);
    setFeedback(null);
  }, []);

  const dirty = !!settings && !!saved && fieldsRef.current.some(key => settings[key] !== saved[key]);

  const save = async () => {
    if (!settings) return;
    const body: Record<string, unknown> = {};
    for (const key of fieldsRef.current) body[key] = settings[key];
    setSaving(true); setFeedback(null);
    try {
      const result = await shippingApi.updateSettings(body as ShippingSettingsUpdate);
      setSettings(result); setSaved(result);
      setFeedback({ kind: 'success', text: t('settings.shipping.saved', 'تم حفظ الإعدادات.') });
    } catch (error) {
      setFeedback({ kind: 'error', text: shippingErrorMessage(error, t) });
    } finally { setSaving(false); }
  };

  return { settings, patch, dirty, save, saving, feedback, loading, loadError };
}

interface SaveBarProps { feedback: Feedback; dirty: boolean; saving: boolean; invalid?: boolean; onSave: () => void; label: string }

export const SaveBar: React.FC<SaveBarProps> = ({ feedback, dirty, saving, invalid, onSave, label }) => {
  const { t } = useLanguage();
  return (
    <div className="settings-actions">
      {feedback ? <p role={feedback.kind === 'error' ? 'alert' : 'status'} className={`settings-feedback settings-feedback--${feedback.kind}`}>{feedback.text}</p>
        : dirty ? <p className="settings-hint">{t('settings.unsaved', 'لديك تغييرات غير محفوظة.')}</p> : null}
      <Button onClick={onSave} isLoading={saving} disabled={!dirty || invalid} leftIcon={<Save className="w-4 h-4" />}>{label}</Button>
    </div>
  );
};

interface SwitchRowProps { id: string; title: string; hint: string; children: React.ReactNode }
/** Title + hint on one side, a Switch on the other (same layout as the confirmation panel). */
export const SwitchRow: React.FC<SwitchRowProps> = ({ id, title, hint, children }) => (
  <div className="settings-row">
    <div className="min-w-0">
      <p id={id} className="settings-card-title">{title}</p>
      <p className="settings-hint mt-1">{hint}</p>
    </div>
    {children}
  </div>
);

interface NumberFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Integer input that keeps what the user typed and reports NaN while it is empty or invalid. */
export const NumberField: React.FC<NumberFieldProps> = ({ id, label, hint, value, min, max, unit, onChange, disabled }) => {
  const { t } = useLanguage();
  const [text, setText] = useState(String(value));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current && !Number.isNaN(value)) { setText(String(value)); lastEmitted.current = value; }
  }, [value]);
  const parsed = text.trim() === '' ? NaN : Number(text);
  const invalid = !isIntInRange(parsed, min, max);
  return (
    <div>
      <label htmlFor={id} className="settings-label mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={text}
          disabled={disabled}
          onChange={event => {
            const next = event.target.value;
            setText(next);
            const n = next.trim() === '' ? NaN : Number(next);
            lastEmitted.current = n;
            onChange(n);
          }}
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          className="settings-input w-28 tabular-nums"
        />
        {unit && <span className="text-sm text-[var(--ordium-muted)]">{unit}</span>}
      </div>
      <p id={`${id}-help`} className={invalid ? 'settings-feedback settings-feedback--error mt-1' : 'settings-hint mt-1'} role={invalid ? 'alert' : undefined}>
        {invalid ? t('settings.shipping.range_error', 'أدخل عددًا صحيحًا بين {min} و{max}.').replace('{min}', String(min)).replace('{max}', String(max)) : hint}
      </p>
    </div>
  );
};
