import React, { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, MessageCircle, Store, Rocket } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import type { DashboardRoute } from './DashboardLayout';

interface MerchantOnboardingProps {
  onNavigate: (route: DashboardRoute) => void;
  onDismiss: () => void;
}

type StepAction = { kind: 'route'; route: DashboardRoute } | { kind: 'complete' };

/** Existing product capabilities arranged as a concise activation checklist. */
export const MerchantOnboarding: React.FC<MerchantOnboardingProps> = ({ onNavigate, onDismiss }) => {
  const { t, isRTL, language } = useLanguage();
  const [step, setStep] = useState(0);
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const localized = (ar: string, en: string, fr: string) => language === 'ar' ? ar : language === 'fr' ? fr : en;

  // A merchant's path to value: try it, connect the store, let customers confirm, go live.
  const steps: { icon: React.ReactNode; title: string; text: string; action: string; target: StepAction }[] = [
    { icon: <FlaskConical className="w-5 h-5" />, title: localized('جرّب بطلب تجريبي', 'Try a test order', 'Essayez une commande test'), text: localized('أنشئ طلبًا تجريبيًا وشاهد كيف يقيّم Ordium مخاطره، دون أن يُحتسب من باقتك.', 'Create a test order and see how Ordium scores it. It does not count toward your plan.', 'Créez une commande test et voyez comment Ordium l’évalue. Elle n’est pas décomptée de votre forfait.'), action: localized('إنشاء طلب تجريبي', 'Create a test order', 'Créer une commande test'), target: { kind: 'route', route: 'simulator' } },
    { icon: <Store className="w-5 h-5" />, title: localized('اربط متجرك', 'Connect your store', 'Connectez votre boutique'), text: localized('اربط Shopify أو YouCan أو WooCommerce لتصل الطلبات الجديدة تلقائيًا.', 'Connect Shopify, YouCan or WooCommerce so new orders arrive automatically.', 'Connectez Shopify, YouCan ou WooCommerce pour recevoir les commandes automatiquement.'), action: localized('ربط المتجر', 'Connect store', 'Connecter la boutique'), target: { kind: 'route', route: 'integrations' } },
    { icon: <MessageCircle className="w-5 h-5" />, title: localized('فعّل تأكيد واتساب', 'Turn on WhatsApp confirmation', 'Activez la confirmation WhatsApp'), text: localized('يصل الزبون طلب تأكيد بضغطة زر، فتقلّ الطلبات الوهمية والمرتجعات.', 'Customers confirm with one tap, so fewer fake orders and returns.', 'Le client confirme en un clic : moins de fausses commandes et de retours.'), action: localized('إعداد التأكيد', 'Set up confirmation', 'Configurer la confirmation'), target: { kind: 'route', route: 'confirmation' } },
    { icon: <Rocket className="w-5 h-5" />, title: localized('تابع طلباتك', 'Follow your orders', 'Suivez vos commandes'), text: localized('من صفحة الطلبات ترى قرار كل طلبية وردّ الزبون عليها.', 'The orders page shows each decision and the customer’s reply.', 'La page commandes montre chaque décision et la réponse du client.'), action: localized('إنهاء الإعداد', 'Finish setup', 'Terminer'), target: { kind: 'complete' } },
  ];
  const current = steps[step];

  const runAction = () => {
    if (current.target.kind === 'route') onNavigate(current.target.route);
    if (current.target.kind === 'complete') onDismiss();
  };

  return (
    <section className="mx-4 sm:mx-6 mt-4 rounded-2xl border border-[var(--ordium-signal)]/15 bg-gradient-to-br from-[var(--ordium-surface)] to-[#10182A] shadow-xl overflow-hidden" aria-label={t('onboarding.title', 'إعداد المتجر')}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ordium-signal)] mb-1">{t('onboarding.eyebrow', 'البدء')}</div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{localized('جهّز مساحة عمل ORDIUM', 'Set up your ORDIUM workspace', 'Configurez votre espace ORDIUM')}</h2>
            <p className="text-xs sm:text-sm text-[var(--ordium-muted)] mt-1 max-w-2xl">{localized('أربع خطوات من أول طلب تجريبي إلى متابعة طلباتك الحقيقية.', 'Four steps from your first test order to following real orders.', 'Quatre étapes, de la première commande test au suivi des vraies commandes.')}</p>
          </div>
          <button type="button" onClick={onDismiss} className="min-h-11 px-2 text-xs text-[var(--ordium-muted)] hover:text-white shrink-0">{t('onboarding.skip', 'إخفاء')}</button>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2" aria-label={t('onboarding.progress', 'تقدم الإعداد')}>
          {steps.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined} aria-label={`${index + 1}. ${item.title}`} className={`min-h-11 text-start ${index <= step ? 'opacity-100' : 'opacity-80'}`}>
              <div className={`h-1 rounded-full ${index <= step ? 'bg-[var(--ordium-signal)]' : 'bg-white/10'}`} />
              <span className="hidden sm:block mt-2 text-xs text-[var(--ordium-muted)] truncate">{index + 1}. {item.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-[var(--ordium-canvas)]/60 border border-white/5">
          <div className="w-11 h-11 rounded-xl bg-[var(--ordium-signal)]/10 border border-[var(--ordium-signal)]/20 flex items-center justify-center text-[var(--ordium-signal)] shrink-0">{current.icon}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{current.title}</div><p className="text-xs text-[var(--ordium-muted)] mt-1 leading-relaxed">{current.text}</p></div>
          <Button variant="primary" size="sm" onClick={runAction} rightIcon={<Arrow className="w-3.5 h-3.5" />}>{current.action}</Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="min-h-11 px-2 text-xs text-[var(--ordium-muted)] hover:text-white disabled:opacity-30 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5 rtl-mirror" />{t('onboarding.previous', 'السابق')}</button>
          {step < steps.length - 1 ? <button type="button" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} className="min-h-11 px-2 text-xs text-[var(--ordium-signal)] hover:underline flex items-center gap-1">{t('onboarding.next', 'التالي')}<ChevronRight className="w-3.5 h-3.5 rtl-mirror" /></button> : <button type="button" onClick={onDismiss} className="min-h-11 px-2 text-xs text-[var(--ordium-signal)] hover:underline flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t('onboarding.done', 'إنهاء')}</button>}
        </div>
      </div>
    </section>
  );
};
