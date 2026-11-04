import React, { useEffect, useState } from 'react';
import { Info, Save } from 'lucide-react';
import { ordiumClient } from '../../../lib/api/client';
import { ConfirmationDecision, ConfirmationSettings } from '../../../lib/api/types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Button } from '../../common/Button';
import { Switch } from './Switch';

const DECISIONS: ConfirmationDecision[] = ['allow', 'review', 'reject'];

export const ConfirmationSettingsPanel: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<ConfirmationSettings | null>(null);
  const [saved, setSaved] = useState<ConfirmationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    ordiumClient.getConfirmationSettings()
      .then(value => { if (active) { setSettings(value); setSaved(value); } })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const patch = (changes: Partial<ConfirmationSettings>) => { setSettings(prev => prev ? { ...prev, ...changes } : prev); setFeedback(null); };
  const toggleDecision = (decision: ConfirmationDecision) => {
    if (!settings) return;
    patch({ decisions: settings.decisions.includes(decision) ? settings.decisions.filter(d => d !== decision) : [...settings.decisions, decision] });
  };

  if (loading) return <div className="settings-card h-48 animate-pulse" role="status" aria-label={t('common.loading', 'جارٍ التحميل…')} />;
  if (loadError || !settings) return <p className="settings-feedback settings-feedback--error" role="alert">{t('settings.confirmation.load_error', 'تعذر تحميل إعدادات التأكيد. حدّث الصفحة للمحاولة مجددًا.')}</p>;

  const noDecision = settings.decisions.length === 0;
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const decisionCopy: Record<ConfirmationDecision, { label: string; hint: string }> = {
    allow: { label: t('settings.confirmation.allow', 'الطلبات المقبولة'), hint: t('settings.confirmation.allow_hint', 'طلبات بلا إشارات خطر. التأكيد يقلّل المرتجعات.') },
    review: { label: t('settings.confirmation.review', 'الطلبات التي تحتاج مراجعة'), hint: t('settings.confirmation.review_hint', 'ردّ الزبون يحسم الشك بدل الاتصال به يدويًا.') },
    reject: { label: t('settings.confirmation.reject', 'الطلبات المرفوضة'), hint: t('settings.confirmation.reject_hint', 'غالبًا لا داعي لمراسلتها. فعّلها فقط إن كنت تراجع المرفوض يدويًا.') },
  };

  const save = async () => {
    if (noDecision) return;
    setSaving(true); setFeedback(null);
    try {
      const result = await ordiumClient.updateConfirmationSettings({ whatsapp_enabled: settings.whatsapp_enabled, decisions: settings.decisions, auto_update_status: settings.auto_update_status });
      setSettings(result); setSaved(result);
      setFeedback({ kind: 'success', text: t('settings.confirmation.saved', 'تم حفظ إعدادات التأكيد.') });
      onSaved?.();
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error && error.message ? error.message : t('settings.confirmation.save_error', 'لم تُحفظ الإعدادات. أعد المحاولة.') });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {!settings.provider_configured && (
        <p className="settings-note"><Info className="w-4 h-4 shrink-0" aria-hidden="true" />{t('settings.confirmation.provider_pending', 'رقم واتساب الخاص بـ Ordium قيد التفعيل. احفظ إعداداتك الآن، وستبدأ الرسائل فور تفعيله.')}</p>
      )}

      <div className="settings-card">
        <div className="settings-row">
          <div className="min-w-0">
            <p id="wa-enabled-label" className="settings-card-title">{t('settings.confirmation.enable', 'أرسل رسالة تأكيد لكل طلبية')}</p>
            <p className="settings-hint mt-1">{t('settings.confirmation.enable_hint', 'تصل الزبون رسالة فيها رقم الطلبية والمبلغ وزرّان: تأكيد وإلغاء.')}</p>
          </div>
          <Switch checked={settings.whatsapp_enabled} onChange={value => patch({ whatsapp_enabled: value })} labelledBy="wa-enabled-label" disabled={saving} />
        </div>
      </div>

      <fieldset className={`settings-card space-y-1 ${settings.whatsapp_enabled ? '' : 'is-muted'}`} disabled={saving}>
        <legend className="settings-card-title mb-3">{t('settings.confirmation.decisions', 'أي الطلبيات تصلها الرسالة؟')}</legend>
        {DECISIONS.map(decision => (
          <label key={decision} className="settings-check">
            <input type="checkbox" checked={settings.decisions.includes(decision)} onChange={() => toggleDecision(decision)} />
            <span>
              <span className="block text-sm text-[var(--ordium-text)]">{decisionCopy[decision].label}</span>
              <span className="settings-hint">{decisionCopy[decision].hint}</span>
            </span>
          </label>
        ))}
        {noDecision && <p className="settings-feedback settings-feedback--error mt-2" role="alert">{t('settings.confirmation.decisions_required', 'اختر نوعًا واحدًا على الأقل.')}</p>}
      </fieldset>

      <div className={`settings-card ${settings.whatsapp_enabled ? '' : 'is-muted'}`}>
        <div className="settings-row">
          <div className="min-w-0">
            <p id="wa-auto-label" className="settings-card-title">{t('settings.confirmation.auto_update', 'حدّث حالة الطلبية من ردّ الزبون')}</p>
            <p className="settings-hint mt-1">{t('settings.confirmation.auto_update_hint', 'زر التأكيد يجعلها «مؤكَّدة» وزر الإلغاء يجعلها «ملغاة». إن أوقفته يُسجَّل الرد فقط وتقرّر أنت.')}</p>
          </div>
          <Switch checked={settings.auto_update_status} onChange={value => patch({ auto_update_status: value })} labelledBy="wa-auto-label" disabled={saving} />
        </div>
      </div>

      <div className="settings-actions">
        {feedback ? <p role={feedback.kind === 'error' ? 'alert' : 'status'} className={`settings-feedback settings-feedback--${feedback.kind}`}>{feedback.text}</p>
          : dirty ? <p className="settings-hint">{t('settings.unsaved', 'لديك تغييرات غير محفوظة.')}</p> : null}
        <Button onClick={() => void save()} isLoading={saving} disabled={!dirty || noDecision} leftIcon={<Save className="w-4 h-4" />}>{t('settings.confirmation.save', 'حفظ إعدادات التأكيد')}</Button>
      </div>
    </div>
  );
};
