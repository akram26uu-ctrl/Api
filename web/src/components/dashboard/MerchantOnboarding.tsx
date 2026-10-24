import React, { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, KeyRound, Webhook, Store, Rocket } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import { DashboardTab } from './DashboardSidebar';

interface MerchantOnboardingProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onDismiss: () => void;
  onManageStores: () => void;
}

type StepAction = { kind: 'tab'; tab: DashboardTab } | { kind: 'stores' } | { kind: 'complete' };

/** Existing product capabilities arranged as a concise activation checklist. */
export const MerchantOnboarding: React.FC<MerchantOnboardingProps> = ({ onNavigateTab, onDismiss, onManageStores }) => {
  const { t, isRTL, language } = useLanguage();
  const [step, setStep] = useState(0);
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const localized = (ar: string, en: string, fr: string) => language === 'ar' ? ar : language === 'fr' ? fr : en;

  const steps: { icon: React.ReactNode; title: string; text: string; action: string; target: StepAction }[] = [
    { icon: <FlaskConical className="w-5 h-5" />, title: localized('اختبر في بيئة تجريبية', 'Start in the sandbox', 'Commencez dans le sandbox'), text: localized('أنشئ طلبًا تجريبيًا وراجع قرار المخاطر قبل ربط متجرك.', 'Create a test order and review its risk decision before connecting your store.', 'Créez une commande test et examinez sa décision de risque avant de connecter votre boutique.'), action: t('dashboard.sidebar.simulator', 'طلب تجريبي'), target: { kind: 'tab', tab: 'simulator' } },
    { icon: <KeyRound className="w-5 h-5" />, title: t('dashboard.sidebar.apikeys', 'إعدادات الربط'), text: localized('أنشئ مفتاح API واحتفظ به في مكان آمن لتطبيقاتك.', 'Create an API key and store it securely for your application.', 'Créez une clé API et conservez-la en toute sécurité pour votre application.'), action: t('dashboard.sidebar.apikeys', 'إعدادات الربط'), target: { kind: 'tab', tab: 'apikeys' } },
    { icon: <Webhook className="w-5 h-5" />, title: t('dashboard.sidebar.webhooks', 'تكاملات المتجر'), text: localized('اضبط وجهة Webhook وتحقق من تسليم الأحداث.', 'Configure a webhook destination and verify event delivery.', 'Configurez une destination webhook et vérifiez la livraison des événements.'), action: t('dashboard.sidebar.webhooks', 'تكاملات المتجر'), target: { kind: 'tab', tab: 'webhooks' } },
    { icon: <Store className="w-5 h-5" />, title: localized('اربط متجرك', 'Connect your store', 'Connectez votre boutique'), text: localized('راجع بيانات المتجر وإعدادات المنصة من إدارة المتاجر.', 'Review store details and platform settings in store management.', 'Vérifiez les informations et les paramètres de la boutique dans sa gestion.'), action: t('dashboard.header.manage_stores', 'إدارة المتاجر'), target: { kind: 'stores' } },
    { icon: <Rocket className="w-5 h-5" />, title: localized('انتقل إلى الإنتاج', 'Move to production', 'Passez en production'), text: localized('بعد نجاح الاختبارات، راجع الاستخدام وابدأ متابعة الطلبات الحقيقية.', 'After successful tests, review usage and start monitoring live orders.', 'Après des tests réussis, consultez l’utilisation et suivez les commandes réelles.'), action: localized('إكمال الإعداد', 'Complete setup', 'Terminer la configuration'), target: { kind: 'complete' } },
  ];
  const current = steps[step];

  const runAction = () => {
    if (current.target.kind === 'tab') onNavigateTab(current.target.tab);
    if (current.target.kind === 'stores') onManageStores();
    if (current.target.kind === 'complete') onDismiss();
  };

  return (
    <section className="mx-4 sm:mx-6 mt-4 rounded-2xl border border-[#43D9E8]/15 bg-gradient-to-br from-[#0D1320] to-[#10182A] shadow-xl overflow-hidden" aria-label={t('onboarding.title', 'إعداد المتجر')}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#52D9E8] mb-1">{t('onboarding.eyebrow', 'البدء')}</div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{localized('جهّز مساحة عمل ORDIUM', 'Set up your ORDIUM workspace', 'Configurez votre espace ORDIUM')}</h2>
            <p className="text-xs sm:text-sm text-[#A1AEC1] mt-1 max-w-2xl">{localized('خمس خطوات عملية من الاختبار إلى الإنتاج، باستخدام إعداداتك الحالية.', 'Five practical steps from testing to production, using your existing settings.', 'Cinq étapes pratiques, du test à la production, avec vos paramètres existants.')}</p>
          </div>
          <button type="button" onClick={onDismiss} className="min-h-11 px-2 text-xs text-[#A1AEC1] hover:text-white shrink-0">{t('onboarding.skip', 'إخفاء')}</button>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2" aria-label={t('onboarding.progress', 'تقدم الإعداد')}>
          {steps.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined} aria-label={`${index + 1}. ${item.title}`} className={`min-h-11 text-start ${index <= step ? 'opacity-100' : 'opacity-60'}`}>
              <div className={`h-1 rounded-full ${index <= step ? 'bg-[#52D9E8]' : 'bg-white/10'}`} />
              <span className="hidden sm:block mt-2 text-[10px] text-[#A1AEC1] truncate">{index + 1}. {item.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-[#080B12]/60 border border-white/5">
          <div className="w-11 h-11 rounded-xl bg-[#52D9E8]/10 border border-[#52D9E8]/20 flex items-center justify-center text-[#52D9E8] shrink-0">{current.icon}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{current.title}</div><p className="text-xs text-[#A1AEC1] mt-1 leading-relaxed">{current.text}</p></div>
          <Button variant="primary" size="sm" onClick={runAction} rightIcon={<Arrow className="w-3.5 h-3.5" />}>{current.action}</Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="min-h-11 px-2 text-xs text-[#A1AEC1] hover:text-white disabled:opacity-30 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5 rtl-mirror" />{t('onboarding.previous', 'السابق')}</button>
          {step < steps.length - 1 ? <button type="button" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} className="min-h-11 px-2 text-xs text-[#52D9E8] hover:underline flex items-center gap-1">{t('onboarding.next', 'التالي')}<ChevronRight className="w-3.5 h-3.5 rtl-mirror" /></button> : <button type="button" onClick={onDismiss} className="min-h-11 px-2 text-xs text-[#52D9E8] hover:underline flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t('onboarding.done', 'إنهاء')}</button>}
        </div>
      </div>
    </section>
  );
};
