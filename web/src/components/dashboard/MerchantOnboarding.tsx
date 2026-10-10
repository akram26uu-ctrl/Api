import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, MessageCircle, BarChart3 } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import { DashboardTab } from './DashboardSidebar';

interface MerchantOnboardingProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onDismiss: () => void;
}

/** First-run guidance for merchants, focused on orders and manual confirmation. */
export const MerchantOnboarding: React.FC<MerchantOnboardingProps> = ({ onNavigateTab, onDismiss }) => {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState(0);
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const steps = [
    { icon: <ClipboardCheck className="w-5 h-5" />, title: t('onboarding.commercial.step1_title', 'راجع الطلبات الجديدة'), text: t('onboarding.commercial.step1_text', 'ابدأ من قائمة الطلبات لمراجعة تفاصيل الطلب والمنتج ومعلومات العميل الضرورية.'), action: t('onboarding.commercial.step1_action', 'عرض الطلبات'), tab: 'orders' as DashboardTab },
    { icon: <MessageCircle className="w-5 h-5" />, title: t('onboarding.commercial.step2_title', 'تواصل وسجّل النتيجة'), text: t('onboarding.commercial.step2_text', 'اتصل بالعميل يدويًا أو جهّز رسالة واتساب وراجعها قبل إرسالها، ثم سجّل نتيجة التواصل.'), action: t('onboarding.commercial.step2_action', 'متابعة الطلبات'), tab: 'orders' as DashboardTab },
    { icon: <BarChart3 className="w-5 h-5" />, title: t('onboarding.commercial.step3_title', 'تابع أداء التأكيد'), text: t('onboarding.commercial.step3_text', 'راقب الطلبات التي لم تبدأ متابعتها، والطلبات قيد التأكيد، والنتائج المسجلة.'), action: t('onboarding.commercial.step3_action', 'عرض الملخص'), tab: 'overview' as DashboardTab },
  ];
  const current = steps[step];

  const goToStepAction = () => {
    onDismiss();
    onNavigateTab(current.tab);
  };

  return (
    <section className="mx-4 sm:mx-6 mt-4 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-[#0D1320] to-[#10182A] shadow-xl overflow-hidden" aria-label={t('onboarding.title', 'إعداد المتجر')}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-1">{t('onboarding.eyebrow', 'البدء')}</div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('onboarding.title', 'ابدأ بإدارة طلبات متجرك')}</h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-2xl">{t('onboarding.subtitle', 'خطوات عملية لمراجعة الطلبات وتسجيل نتائج التأكيد ومتابعة الأداء.')}</p>
          </div>
          <button type="button" onClick={onDismiss} className="text-xs text-[#64748B] hover:text-white shrink-0">{t('onboarding.skip', 'إخفاء')}</button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label={t('onboarding.progress', 'تقدم الإعداد')}>
          {steps.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setStep(index)} className={`text-start ${index <= step ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`h-1 rounded-full ${index <= step ? 'bg-emerald-300' : 'bg-white/10'}`} />
              <span className="block mt-2 text-[10px] text-[#94A3B8] truncate">{index + 1}. {item.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-[#080B12]/60 border border-white/5">
          <div className="w-11 h-11 rounded-xl bg-emerald-300/10 border border-emerald-300/20 flex items-center justify-center text-emerald-300 shrink-0">{current.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{current.title}</div>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{current.text}</p>
          </div>
          <Button variant="primary" size="sm" onClick={goToStepAction} rightIcon={<Arrow className="w-3.5 h-3.5" />}>{current.action}</Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="text-xs text-[#94A3B8] hover:text-white disabled:opacity-30 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" />{t('onboarding.previous', 'السابق')}</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} className="text-xs text-emerald-300 hover:underline flex items-center gap-1">{t('onboarding.next', 'التالي')}<ChevronRight className="w-3.5 h-3.5" /></button>
          ) : (
            <button type="button" onClick={onDismiss} className="text-xs text-emerald-300 hover:underline flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t('onboarding.done', 'إنهاء')}</button>
          )}
        </div>
      </div>
    </section>
  );
};
