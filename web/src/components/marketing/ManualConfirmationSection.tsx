import React from 'react';
import { ClipboardCheck, MessageCircle, PhoneCall, History, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

/** Commercial explanation of ORDIUM's human-led order confirmation workflow. */
export const ManualConfirmationSection: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const steps = [
    { icon: <ClipboardCheck className="w-5 h-5" />, title: t('manual_confirmation_home.step1_title', 'راجع الطلب'), text: t('manual_confirmation_home.step1_text', 'اعرض رقم الطلب والمنتج ومعلومات العميل الضرورية في مكان واحد.') },
    { icon: <MessageCircle className="w-5 h-5" />, title: t('manual_confirmation_home.step2_title', 'تواصل مع العميل يدويًا'), text: t('manual_confirmation_home.step2_text', 'افتح رسالة واتساب جاهزة أو اتصل بالعميل بنفسك؛ لا تُرسل الرسائل أو تُجرى المكالمات تلقائيًا.') },
    { icon: <History className="w-5 h-5" />, title: t('manual_confirmation_home.step3_title', 'سجّل النتيجة'), text: t('manual_confirmation_home.step3_text', 'دوّن نتيجة التواصل لتتابع الطلبات المؤكدة وما يزال قيد المتابعة.') },
  ];

  return (
    <section className="relative py-20 sm:py-24 border-y border-white/5 bg-gradient-to-b from-[#0A101B] via-[#0D1320] to-[#080B12]" aria-labelledby="manual-confirmation-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-300 mb-5">
            <PhoneCall className="w-3.5 h-3.5" />
            {t('manual_confirmation_home.badge', 'تأكيد الطلبات بمساعدة فريقك')}
          </div>
          <h2 id="manual-confirmation-title" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {t('manual_confirmation_home.title', 'حوّل الطلبات الجديدة إلى طلبات مؤكدة، بخطوات واضحة')}
          </h2>
          <p className="mt-5 text-sm sm:text-base leading-7 text-[#94A3B8] max-w-2xl mx-auto">
            {t('manual_confirmation_home.subtitle', 'نظّم متابعة الطلبات من لوحة واحدة، وسجّل محاولات التواصل ونتائجها لتحصل على صورة واضحة عن سير العمل.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {steps.map((step, index) => (
            <article key={step.title} className="relative rounded-2xl border border-white/10 bg-[#0D1320]/90 p-6 sm:p-7 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-11 h-11 rounded-xl border border-emerald-300/20 bg-emerald-300/10 flex items-center justify-center text-emerald-300">{step.icon}</div>
                <span className="text-xs font-semibold text-[#64748B]">{t('manual_confirmation_home.step_label', 'الخطوة')} {index + 1}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm leading-6 text-[#94A3B8]">{step.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 sm:mt-8 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-300/10 flex items-center justify-center text-emerald-300 shrink-0"><History className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">{t('manual_confirmation_home.metrics_title', 'متابعة الأداء من واقع النشاط المسجّل')}</h3>
            <p className="mt-1 text-xs sm:text-sm leading-6 text-[#94A3B8]">{t('manual_confirmation_home.metrics_text', 'تابع الطلبات التي لم تبدأ متابعتها، والطلبات قيد التأكيد، ومعدل التأكيد المحسوب من الطلبات التي سُجّلت لها محاولة تواصل.')}</p>
          </div>
          <ArrowRight className={`w-5 h-5 text-emerald-300 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
        </div>
      </div>
    </section>
  );
};
