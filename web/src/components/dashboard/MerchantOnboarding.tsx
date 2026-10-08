import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, KeyRound, Send, Webhook } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import { DashboardTab } from './DashboardSidebar';

interface MerchantOnboardingProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onDismiss: () => void;
}

export const MerchantOnboarding: React.FC<MerchantOnboardingProps> = ({ onNavigateTab, onDismiss }) => {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState(0);
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const steps = [
    { icon: <FlaskConical className="w-5 h-5" />, title: t('onboarding.step1.title', 'ابدأ بالمحاكي'), text: t('onboarding.step1.text', 'استخدم Simulator لفحص التكامل قبل ربط حركة الطلبات الفعلية.'), action: t('onboarding.step1.action', 'فتح المحاكي'), tab: 'simulator' as DashboardTab },
    { icon: <Send className="w-5 h-5" />, title: t('onboarding.step2.title', 'شغّل أول تقييم'), text: t('onboarding.step2.text', 'أرسل طلبًا تجريبيًا من Simulator ثم راجع درجة المخاطر والقرار الذي يعيده ORDIUM.'), action: t('onboarding.step2.action', 'تشغيل طلب تجريبي'), tab: 'simulator' as DashboardTab },
    { icon: <KeyRound className="w-5 h-5" />, title: t('onboarding.step3.title', 'إنشاء مفتاح تكامل'), text: t('onboarding.step3.text', 'بعد التحقق من التكامل، أنشئ مفتاح API مقيّدًا بالمتجر. يظهر السر مرة واحدة فقط عند الإنشاء.'), action: t('onboarding.step3.action', 'فتح مفاتيح API'), tab: 'apikeys' as DashboardTab },
    { icon: <Webhook className="w-5 h-5" />, title: t('onboarding.step4.title', 'ربط Webhooks'), text: t('onboarding.step4.text', 'أضف عنوان Webhook لاستقبال أحداث ORDIUM ومراقبة التسليم من لوحة التحكم.'), action: t('onboarding.step4.action', 'إعداد Webhooks'), tab: 'webhooks' as DashboardTab },
  ];
  const current = steps[step];

  const goToStepAction = () => {
    onDismiss();
    onNavigateTab(current.tab);
  };

  return (
    <section className="mx-4 sm:mx-6 mt-4 rounded-2xl border border-[#22D3EE]/20 bg-gradient-to-br from-[#0D1320] to-[#10182A] shadow-xl overflow-hidden" aria-label={t('onboarding.title', 'Workspace setup')}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#22D3EE] mb-1">{t('onboarding.eyebrow', 'البدء')}</div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('onboarding.title', 'إعداد مساحة عمل ORDIUM')}</h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-2xl">{t('onboarding.subtitle', 'مسار مختصر من إنشاء الحساب إلى التحقق من التكامل عبر المحاكي، دون التأثير على حركة الطلبات الفعلية.')}</p>
          </div>
          <button type="button" onClick={onDismiss} className="text-xs text-[#64748B] hover:text-white shrink-0">{t('onboarding.skip', 'تخطي الآن')}</button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2" aria-label={t('onboarding.progress', 'تقدم الإعداد')}>
          {steps.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setStep(index)} className={`text-start ${index <= step ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`h-1 rounded-full ${index <= step ? 'bg-[#22D3EE]' : 'bg-white/10'}`} />
              <span className="block mt-2 text-[10px] font-mono text-[#94A3B8] truncate">{index + 1}. {item.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-[#080B12]/60 border border-white/5">
          <div className="w-11 h-11 rounded-xl bg-[#22D3EE]/10 border border-[#22D3EE]/20 flex items-center justify-center text-[#22D3EE] shrink-0">{current.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{current.title}</div>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{current.text}</p>
          </div>
          <Button variant="primary" size="sm" onClick={goToStepAction} rightIcon={<Arrow className="w-3.5 h-3.5" />}>{current.action}</Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="text-xs text-[#94A3B8] hover:text-white disabled:opacity-30 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" />{t('onboarding.previous', 'السابق')}</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} className="text-xs text-[#22D3EE] hover:underline flex items-center gap-1">{t('onboarding.next', 'التالي')}<ChevronRight className="w-3.5 h-3.5" /></button>
          ) : (
            <button type="button" onClick={onDismiss} className="text-xs text-emerald-400 hover:underline flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t('onboarding.done', 'إنهاء الإعداد')}</button>
          )}
        </div>
      </div>
    </section>
  );
};
