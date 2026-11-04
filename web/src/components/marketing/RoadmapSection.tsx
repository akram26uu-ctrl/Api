/**
 * ORDIUM roadmap: what works today and what comes next, as one ordered timeline.
 */

import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

type Stage = 'now' | 'rollout' | 'later';

const STAGE_STYLE: Record<Stage, { dot: string; label: string }> = {
  now: { dot: 'bg-[var(--ordium-success)]', label: 'text-[var(--ordium-success)]' },
  rollout: { dot: 'bg-[var(--ordium-signal)]', label: 'text-[var(--ordium-signal)]' },
  later: { dot: 'bg-white/30', label: 'text-[var(--ordium-muted)]' },
};

export const RoadmapSection: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const stageLabel: Record<Stage, string> = {
    now: t('mkt.roadmap.now', 'يعمل الآن'),
    rollout: t('mkt.roadmap.rollout', 'قيد الإطلاق'),
    later: t('mkt.roadmap.later', 'لاحقًا'),
  };
  const stages: { title: string; desc: string; stage: Stage }[] = [
    { title: t('mkt.roadmap.p1_t', 'قواعد مخاطر واضحة'), desc: t('mkt.roadmap.p1_d', 'قواعد يمكن قراءتها، مع حدود مراجعة ورفض تضبطها بنفسك.'), stage: 'now' },
    { title: t('mkt.roadmap.p2_t', 'إشارات الهاتف والجهاز والاتصال'), desc: t('mkt.roadmap.p2_d', 'تكرار الطلبات، والأجهزة المستعملة بعدة أسماء، واستخدام VPN أو بروكسي أو Tor.'), stage: 'now' },
    { title: t('mkt.roadmap.p3_t', 'ربط الطلبات ببعضها'), desc: t('mkt.roadmap.p3_d', 'ربط الهاتف والعنوان والجهاز وعنوان IP لاكتشاف مجموعات الطلبات الوهمية.'), stage: 'now' },
    { title: t('mkt.roadmap.p4_t', 'نتائج التوصيل'), desc: t('mkt.roadmap.p4_d', 'ربط ما حدث فعلًا (سُلِّم، رُفض، أُرجع) بالدرجات لقياس دقتها وضبطها.'), stage: 'rollout' },
    { title: t('mkt.roadmap.p5_t', 'نماذج تتعلم من نتائجك'), desc: t('mkt.roadmap.p5_d', 'تُدرَّب فقط على نتائج توصيل متحقق منها، عندما يتوفر منها ما يكفي.'), stage: 'later' },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5 text-start">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight rtl:tracking-normal text-balance">
            {t('mkt.roadmap.title', 'ما يعمل اليوم، وما يأتي بعده')}
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[60ch] text-pretty">
            {t('mkt.roadmap.subtitle', 'قواعد واضحة يمكنك قراءتها وتعديلها، لا ذكاء اصطناعي غامض. نضيف التعلّم الآلي فقط عندما تتوفر نتائج توصيل حقيقية كافية لتدريبه.')}
          </p>
        </div>

        <ol className="lg:col-span-7 border-s border-white/12 text-start">
          {stages.map(item => {
            const style = STAGE_STYLE[item.stage];
            return (
              <li key={item.title} className="relative ps-7 pb-7 last:pb-0">
                <span aria-hidden="true" className={`absolute -start-[5px] top-2 w-2.5 h-2.5 rounded-full ${style.dot}`} />
                <p className={`text-xs font-semibold ${style.label}`}>{stageLabel[item.stage]}</p>
                <h3 className="mt-1 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-[var(--ordium-muted)] leading-relaxed max-w-[60ch]">{bidiIsolate(item.desc, isRTL)}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
