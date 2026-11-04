/**
 * ORDIUM home hero: the merchant's problem in words, and the real product moment beside it —
 * one example cash-on-delivery order, its score and reasons, and the WhatsApp confirmation it triggers.
 * Everything in the visual is an illustrative example and is labelled as such.
 */

import React from 'react';
import { ArrowRight, ArrowLeft, Check, X, MessageCircle, MapPin } from 'lucide-react';
import { Button } from '../common/Button';
import { RiskBadge } from '../common/RiskBadge';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

interface HeroSectionProps {
  onStart: () => void;
  onExploreApi: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onStart, onExploreApi }) => {
  const { t, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const reasons = [
    { text: t('mkt.hero.reason1', 'رُفض طردان سابقان لهذا الرقم في متجرك'), impact: 30 },
    { text: t('mkt.hero.reason2', '3 طلبات من الرقم نفسه خلال 24 ساعة'), impact: 20 },
    { text: t('mkt.hero.reason3', 'الكمية أعلى بكثير من طلباتك المعتادة'), impact: 18 },
  ];

  return (
    <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">

          <div className="lg:col-span-6 text-start">
            <h1 className="text-[2.125rem] leading-[1.15] sm:text-[2.75rem] lg:text-[3.25rem] lg:leading-[1.1] font-extrabold text-white tracking-[-0.02em] rtl:tracking-normal rtl:leading-[1.3] text-balance max-w-[20ch]">
              {t('mkt.hero.title', 'اعرف أيّ طلب سيُرفض قبل أن تشحنه')}
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[var(--ordium-muted)] max-w-[60ch] leading-relaxed text-pretty">
              {bidiIsolate(t('mkt.hero.subtitle', 'الطرود المرفوضة والطلبات الوهمية والمرتجعات وساعات الاتصال للتأكيد تستنزف كل متجر يعمل بالدفع عند الاستلام. تقيّم ORDIUM كل طلب، وتشرح سبب التقييم بكلمات واضحة، ثم تؤكد الطلب مع العميل عبر واتساب قبل الشحن.'), isRTL)}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button variant="primary" size="lg" onClick={onStart} rightIcon={<ArrowIcon aria-hidden="true" className="w-4 h-4" />} className="w-full sm:w-auto justify-center">
                {t('mkt.hero.cta_primary', 'افتح لوحة التحكم')}
              </Button>
              <Button variant="outline" size="lg" onClick={onExploreApi} className="w-full sm:w-auto justify-center">
                {t('mkt.hero.cta_secondary', 'دليل الربط التقني')}
              </Button>
            </div>
          </div>

          <figure className="lg:col-span-6 w-full max-w-xl mx-auto lg:max-w-none" aria-label={t('mkt.hero.example', 'مثال توضيحي')}>
            <div className="relative">
              <span className="absolute -top-3 start-5 z-10 rounded-md border border-white/15 bg-[var(--ordium-canvas)] px-2.5 py-0.5 text-xs font-medium text-[var(--ordium-muted)]">
                {t('mkt.hero.example', 'مثال توضيحي')}
              </span>

              {/* Order card */}
              <div className="rounded-2xl border border-white/12 bg-[var(--ordium-surface)] p-5 sm:p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)] text-start">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-white">{t('mkt.hero.order', 'طلب رقم 1042')}</p>
                    <p className="mt-1 text-sm text-[var(--ordium-muted)]">{t('mkt.hero.customer', 'كريم ب.')}</p>
                  </div>
                  <RiskBadge decision="REVIEW" size="md" />
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-white/[0.07] py-4 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--ordium-subtle)]">{t('mkt.hero.wilaya_label', 'الولاية')}</dt>
                    <dd className="mt-1 flex items-center gap-1 font-medium text-white"><MapPin aria-hidden="true" className="w-3.5 h-3.5 text-[var(--ordium-subtle)] shrink-0" />{t('mkt.hero.wilaya_value', 'وهران')}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--ordium-subtle)]">{t('mkt.hero.amount_label', 'المبلغ')}</dt>
                    <dd className="mt-1 font-medium text-white tabular-nums whitespace-nowrap">{t('mkt.hero.amount_value', '8900 دج')}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--ordium-subtle)]">{t('mkt.hero.score_label', 'درجة الخطر')}</dt>
                    <dd className="mt-1 font-semibold text-[var(--ordium-warning)] tabular-nums" dir="ltr"><span className="text-lg">68</span><span className="text-xs text-[var(--ordium-subtle)]"> / 100</span></dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-[var(--ordium-subtle)]">{t('mkt.hero.payment', 'الدفع عند الاستلام')}</p>

                <p className="mt-4 text-sm font-semibold text-white">{t('mkt.hero.reasons_title', 'لماذا 68؟')}</p>
                <ul className="mt-2 space-y-2">
                  {reasons.map(reason => (
                    <li key={reason.impact} className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="text-[#D5DCE6] leading-snug">{reason.text}</span>
                      <span dir="ltr" className="shrink-0 tabular-nums text-sm font-semibold text-[var(--ordium-warning)]">+{reason.impact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hand-off */}
              <div className="flex items-center gap-3 ps-8 py-3" aria-hidden="true">
                <span className="h-8 w-px bg-gradient-to-b from-white/20 to-[var(--ordium-signal)]/60" />
                <span className="text-xs text-[var(--ordium-muted)]">{t('mkt.hero.sent', 'رسالة تأكيد إلى العميل عبر واتساب')}</span>
              </div>

              {/* WhatsApp confirmation, as the customer sees it */}
              <div className="ms-auto w-full sm:w-[88%] rounded-2xl border border-white/10 bg-[#111B21] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)] text-start">
                <p className="flex items-center gap-2 text-xs font-medium text-[#8FD9B6]">
                  <MessageCircle aria-hidden="true" className="w-4 h-4" />
                  <span>WhatsApp</span>
                  <span className="text-[var(--ordium-subtle)]">·</span>
                  <span className="text-[var(--ordium-muted)]">{bidiIsolate(t('mkt.hero.wa_sender', 'ORDIUM · تأكيد الطلب'), isRTL)}</span>
                </p>
                <div className="mt-3 rounded-xl rounded-ss-sm bg-[#202C33] overflow-hidden">
                  <p className="px-4 py-3 text-sm leading-relaxed text-[#E9EDEF]">{t('mkt.hero.wa_message', 'مرحبًا كريم، استلمنا طلبك رقم 1042 بمبلغ 8900 دج للتوصيل إلى وهران. هل تؤكد الطلب؟')}</p>
                  <div className="grid grid-cols-2 border-t border-white/[0.08] text-sm font-medium">
                    <span className="flex min-h-11 items-center justify-center gap-1.5 text-[#53BDEB]"><Check aria-hidden="true" className="w-4 h-4" />{t('mkt.hero.wa_confirm', 'تأكيد الطلب')}</span>
                    <span className="flex min-h-11 items-center justify-center gap-1.5 border-s border-white/[0.08] text-[#53BDEB]"><X aria-hidden="true" className="w-4 h-4" />{t('mkt.hero.wa_cancel', 'إلغاء الطلب')}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--ordium-muted)]">{t('mkt.hero.after', 'يُسجَّل ردّ العميل على الطلب: مؤكَّد أو ملغى.')}</p>
              </div>
            </div>

            <figcaption className="mt-5 text-sm text-[var(--ordium-subtle)] leading-relaxed max-w-[62ch]">
              {bidiIsolate(t('mkt.hero.note', 'التأكيد التلقائي عبر واتساب جاهز ويُفعَّل عند تفعيل رقم ORDIUM. إلى ذلك الحين، تؤكد من لوحة التحكم عبر واتساب أو الهاتف.'), isRTL)}
            </figcaption>
          </figure>

        </div>
      </div>
    </section>
  );
};
