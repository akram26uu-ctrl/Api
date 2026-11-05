/**
 * ORDIUM explainable decision: one example order whose score is the sum of the reasons shown.
 */

import React from 'react';
import { RiskBadge } from '../common/RiskBadge';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

export const ExplainableCard: React.FC = () => {
  const { t, isRTL } = useLanguage();

  // Impacts add up to the score shown (82), as in a real assessment.
  const reasons = [
    { text: t('mkt.explain.r1', 'رُفض طردان سابقان لهذا الرقم'), impact: 30 },
    { text: t('mkt.explain.r2', 'الجهاز نفسه استُعمل بثلاثة أسماء مختلفة هذا الأسبوع'), impact: 25 },
    { text: t('mkt.explain.r3', '4 طلبات من الرقم نفسه خلال ساعتين'), impact: 15 },
    { text: t('mkt.explain.r4', 'الاتصال عبر VPN'), impact: 12 },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5 text-start">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight rtl:tracking-normal text-balance">
            {t('mkt.explain.title', 'كل درجة تأتي مع أسبابها')}
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[60ch] text-pretty">
            {t('mkt.explain.subtitle', 'ترى أي إشارة رفعت الدرجة وبكم، ويمكنك تغيير وزن كل إشارة وحدود المراجعة والرفض.')}
          </p>
        </div>

        <figure className="lg:col-span-7 rounded-2xl border border-white/10 bg-[var(--ordium-surface)] p-5 sm:p-7 text-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-md border border-white/15 px-2.5 py-0.5 text-xs font-medium text-[var(--ordium-muted)]">{t('mkt.hero.example', 'مثال توضيحي')}</span>
            <span className="text-sm text-[var(--ordium-muted)]">{t('mkt.explain.order_line', 'طلب رقم 1057 · قسنطينة · 12400 دج · الدفع عند الاستلام')}</span>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-white/[0.07]">
            <p dir="ltr" className="shrink-0 tabular-nums text-[var(--ordium-danger)] rtl:text-end">
              <span className="text-5xl font-extrabold">82</span><span className="text-base text-[var(--ordium-subtle)]"> / 100</span>
            </p>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge decision="REJECT" size="md" />
                <h3 className="text-base font-semibold text-white">{t('mkt.explain.verdict_title', 'أعلى من حد الرفض')}</h3>
              </div>
              <p className="text-sm text-[var(--ordium-muted)] leading-relaxed max-w-[60ch]">{t('mkt.explain.verdict_desc', 'الدرجة 82 وحد الرفض في هذا المتجر 80. يبقى الطلب معلّقًا، ويمكنك تأكيده مع العميل وقبوله إن أردت.')}</p>
            </div>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-white">{t('mkt.explain.reasons_title', 'لماذا 82؟')}</h3>
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {reasons.map(reason => (
              <li key={reason.impact} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <span className="text-[#D5DCE6] leading-snug">{bidiIsolate(reason.text, isRTL)}</span>
                <span dir="ltr" className="shrink-0 tabular-nums font-semibold text-[var(--ordium-warning)]">+{reason.impact}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <span className="font-semibold text-white">{t('mkt.explain.total', 'المجموع')}</span>
              <span dir="ltr" className="shrink-0 tabular-nums font-bold text-white">82</span>
            </li>
          </ul>
          <figcaption className="mt-4 text-sm text-[var(--ordium-subtle)]">{t('mkt.explain.weights', 'يمكنك تغيير وزن كل إشارة من إعدادات المخاطر.')}</figcaption>
        </figure>
      </div>
    </section>
  );
};
