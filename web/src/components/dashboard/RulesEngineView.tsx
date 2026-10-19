import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordiumClient } from '../../lib/api/client';

type Profile = Record<string, any>;

const RULES = [
  ['high_cancel_rate_score', 'سجل الإلغاء المرتفع', 'التاريخ السابق للإلغاءات'],
  ['phone_reuse_score', 'إعادة استخدام الهاتف', 'تكرار الهاتف بين الطلبات'],
  ['device_reuse_score', 'إعادة استخدام الجهاز', 'تكرار بصمة الجهاز'],
  ['address_reuse_score', 'إعادة استخدام العنوان', 'تكرار عنوان الشحن'],
  ['multiple_customers_same_phone_score', 'عملاء متعددون / هاتف', 'أكثر من هوية مرتبطة بالهاتف'],
  ['multiple_phones_same_device_score', 'هواتف متعددة / جهاز', 'عدة هواتف على بصمة واحدة'],
  ['high_order_frequency_score', 'تسارع الطلبات', 'عدد مرتفع خلال نافذة زمنية قصيرة'],
  ['high_ip_frequency_score', 'تكرار عنوان IP', 'نشاط متكرر من نفس الشبكة'],
  ['multiple_customers_same_ip_score', 'عملاء متعددون / IP', 'عدة هويات من عنوان واحد'],
  ['new_device_score', 'جهاز جديد', 'جهاز جديد لدى عميل معروف'],
  ['vpn_score', 'إشارة VPN', 'شبكة VPN مكتشفة'],
  ['proxy_score', 'إشارة Proxy', 'Proxy مكتشف'],
] as const;

export const RulesEngineView: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(draft), [profile, draft]);

  const load = async () => {
    setLoading(true); setError(null); setSaved(false);
    try {
      const data = await ordiumClient.getRiskProfile();
      setProfile(data); setDraft(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.rules.load_error', 'تعذر تحميل ملف المخاطر.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const setValue = (key: string, value: number) => {
    setDraft(prev => prev ? { ...prev, [key]: Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) } : prev);
    setSaved(false);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const payload = Object.fromEntries(
        Object.keys(draft)
          .filter(k => k.endsWith('_score') || k === 'review_threshold' || k === 'reject_threshold')
          .map(k => [k, draft[k]])
      );
      const data = await ordiumClient.updateRiskProfile(payload);
      setProfile(data); setDraft(data); setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.rules.save_error', 'تعذر حفظ الإعدادات.'));
    } finally { setSaving(false); }
  };

  const signalCount = RULES.length;
  const enabledSignals = RULES.filter(([key]) => Number(draft?.[key] ?? 0) > 0).length;
  const thresholdValid = draft ? Number(draft.review_threshold) < Number(draft.reject_threshold) : true;

  if (loading) return <div className="p-6 text-sm text-[#94A3B8]">{t('dashboard.rules.loading', 'جارٍ تحميل محرك القواعد…')}</div>;
  if (!draft) return <div className="p-6"><div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-white">{error || t('dashboard.rules.unavailable', 'ملف المخاطر غير متاح.')}</div></div>;

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="dashboard-panel relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-20 -end-10 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center text-violet-300 shrink-0"><SlidersHorizontal className="w-5 h-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">{t('dashboard.rules.title', 'محرك القواعد')}</h2>
                <span className="rounded-full border border-[#22D3EE]/15 bg-[#22D3EE]/5 px-2.5 py-1 text-[10px] font-semibold text-[#67E8F9]">{signalCount} {t('dashboard.rules.signals', 'إشارات')}</span>
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8] max-w-2xl leading-relaxed">{t('dashboard.rules.subtitle', 'اضبط مساهمة إشارات المخاطر وعتبات القرار. التغييرات تحفظ على ملف حسابك وتدخل في التقييمات الجديدة فقط.')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saved && <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" />{t('dashboard.rules.saved', 'تم الحفظ')}</span>}
            {dirty && <span className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">{t('dashboard.rules.unsaved', 'تغييرات غير محفوظة')}</span>}
            <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => setDraft(profile)} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>{t('dashboard.rules.reset', 'إعادة الضبط')}</Button>
            <Button variant="primary" size="sm" disabled={!dirty || saving || !thresholdValid} isLoading={saving} onClick={() => void save()} leftIcon={<Save className="w-3.5 h-3.5" />}>{t('dashboard.rules.save', 'حفظ التغييرات')}</Button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">{error}</div>}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="dashboard-panel p-5">
          <div className="flex items-center gap-2 text-[#22D3EE]"><Gauge className="w-4 h-4" /><span className="text-xs font-semibold text-white">{t('dashboard.rules.decision_model', 'منطق القرار')}</span></div>
          <div className="mt-4 flex items-end gap-2"><span className="text-3xl font-bold text-white">{draft.review_threshold}</span><span className="pb-1 text-xs text-[#64748B]">REVIEW</span><span className="mx-1 pb-1 text-[#334155]">→</span><span className="text-3xl font-bold text-white">{draft.reject_threshold}</span><span className="pb-1 text-xs text-[#64748B]">REJECT</span></div>
          {!thresholdValid && <div className="mt-3 text-[11px] text-red-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{t('dashboard.rules.threshold_invalid', 'يجب أن تكون REVIEW أقل من REJECT.')}</div>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0D1320] p-5">
          <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="w-4 h-4" /><span className="text-xs font-semibold text-white">{t('dashboard.rules.active_signals', 'الإشارات المفعلة')}</span></div>
          <div className="mt-3 text-3xl font-bold text-white">{enabledSignals}<span className="text-sm font-medium text-[#64748B]"> / {signalCount}</span></div>
          <p className="mt-1 text-[11px] text-[#64748B]">{t('dashboard.rules.zero_note', 'القيمة 0 تعطل مساهمة الإشارة.')}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0D1320] p-5">
          <div className="text-xs font-semibold text-white">{t('dashboard.rules.max_score', 'الحد الأقصى للدرجة')}</div>
          <div className="mt-3 text-3xl font-bold text-[#22D3EE]">{draft.max_score}<span className="text-sm text-[#64748B]"> / 100</span></div>
          <p className="mt-1 text-[11px] text-[#64748B]">{t('dashboard.rules.max_score_note', 'يتم قص الدرجة النهائية عند هذا الحد.')}</p>
        </div>
      </section>

      <section className="dashboard-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-4">
          <div><h3 className="text-sm font-semibold text-white">{t('dashboard.rules.signal_weights', 'أوزان إشارات المخاطر')}</h3><p className="mt-1 text-[11px] text-[#64748B]">{t('dashboard.rules.signal_weights_desc', 'كل قيمة تمثل مقدار مساهمة الإشارة في درجة المخاطر عند تحققها.')}</p></div>
          <span className="hidden sm:inline text-[10px] text-[#64748B] font-mono">0 — 100</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
          {RULES.map(([key, label, description]) => {
            const value = Number(draft[key] ?? 0);
            return <div key={key} className="bg-[#101827]/65 p-4 sm:p-5 hover:bg-[#142033] transition-colors">
              <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-white">{label}</div><div className="mt-1 text-[10px] text-[#64748B]">{description}</div></div><span className={`min-w-10 text-center rounded-lg border px-2 py-1 text-xs font-bold ${value === 0 ? 'border-white/10 text-[#64748B]' : 'border-[#22D3EE]/15 bg-[#22D3EE]/5 text-[#67E8F9]'}`}>{value}</span></div>
              <div className="mt-4 flex items-center gap-3"><input aria-label={label} type="range" min={0} max={100} value={value} onChange={e => setValue(key, Number(e.target.value))} className="flex-1 accent-cyan-400" /><input aria-label={`${label} value`} type="number" min={0} max={100} value={value} onChange={e => setValue(key, Number(e.target.value))} className="w-16 min-h-11 rounded-lg bg-[#080B12] border border-white/[0.12] px-2 py-2 text-center text-sm text-white font-mono focus:outline-none focus:border-[#43D9E8] focus:ring-2 focus:ring-[#43D9E8]/15" /></div>
            </div>;
          })}
        </div>
      </section>
    </div>
  );
};
