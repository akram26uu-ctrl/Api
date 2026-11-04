/**
 * ORDIUM Platform page: how an order is scored and confirmed, with one example order history.
 */

import React from 'react';
import { MessageCircle, PhoneCall, Inbox, Gauge, Send, CheckCircle2, Truck, PackageCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PipelineSection } from '../marketing/PipelineSection';
import { bidiIsolate } from '../marketing/Bidi';

export const PlatformPage: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const facts = [
    { label: t('pages.platform.f1_label', 'زمن التقييم'), desc: t('pages.platform.f1_desc', 'تعرض لوحة التحكم زمن التقييم المقاس عند توفر بيانات قياس محفوظة.') },
    { label: t('pages.platform.f2_label', 'حدود الطلبات'), desc: t('pages.platform.f2_desc', 'تتحكم بيئة API النشطة وإعدادات التاجر في حدود الطلبات.') },
    { label: t('pages.platform.f3_label', 'تتبّع القرار'), desc: t('pages.platform.f3_desc', 'تكشف التقييمات المحفوظة أحداث المخاطر وإصدار القواعد وإصدار الملف التعريفي وسياق الهوية المتاح للمراجعة.') },
  ];
  const timeline = [
    { icon: Inbox, time: '10:42', text: t('mkt.platform.tl1', 'وصل الطلب رقم 1042 من متجر Shopify') },
    { icon: Gauge, time: '10:42', text: t('mkt.platform.tl2', 'الدرجة 68 · للمراجعة · 3 أسباب'), tone: 'text-[var(--ordium-warning)]' },
    { icon: Send, time: '10:43', text: t('mkt.platform.tl3', 'أُرسلت رسالة تأكيد عبر واتساب') },
    { icon: CheckCircle2, time: '11:05', text: t('mkt.platform.tl4', 'أكّد العميل الطلب'), tone: 'text-[var(--ordium-success)]' },
    { icon: Truck, time: '14:30', text: t('mkt.platform.tl5', 'شُحن الطرد') },
    { icon: PackageCheck, time: '', text: t('mkt.platform.tl6', 'سُلِّم · النتيجة تُستعمل لضبط الدرجات'), tone: 'text-[var(--ordium-success)]' },
  ];

  return (
    <div className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <header className="max-w-3xl mb-12 sm:mb-14 text-start">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight rtl:tracking-normal text-balance">{t('mkt.platform.title', 'كيف تقيّم ORDIUM طلباتك وتؤكدها')}</h1>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[65ch] text-pretty">{t('mkt.platform.subtitle', 'كل طلب يحصل على درجة مع أسبابها، ثم يُؤكَّد مع العميل، وتُسجَّل نتيجته. كل خطوة محفوظة على الطلب ويمكنك مراجعتها لاحقًا.')}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start mb-16 text-start">
          <div className="lg:col-span-6 space-y-8">
            <section aria-labelledby="platform-manual">
              <div className="flex items-center gap-2.5">
                <PhoneCall aria-hidden="true" className="w-5 h-5 text-[var(--ordium-signal)]" />
                <h2 id="platform-manual" className="text-xl font-semibold text-white">{t('mkt.platform.manual_title', 'التأكيد اليدوي، متاح اليوم')}</h2>
              </div>
              <p className="mt-3 text-base text-[var(--ordium-muted)] leading-relaxed max-w-[62ch]">{t('mkt.platform.manual_desc', 'من صفحة الطلب افتح رسالة واتساب جاهزة أو اتصل بالعميل بنفسك، ثم سجّل النتيجة على الطلب.')}</p>
            </section>
            <section aria-labelledby="platform-auto" className="pt-8 border-t border-white/[0.07]">
              <div className="flex items-center gap-2.5">
                <MessageCircle aria-hidden="true" className="w-5 h-5 text-[#8FD9B6]" />
                <h2 id="platform-auto" className="text-xl font-semibold text-white">{t('mkt.platform.auto_title', 'التأكيد التلقائي عبر واتساب، جاهز')}</h2>
              </div>
              <p className="mt-3 text-base text-[var(--ordium-muted)] leading-relaxed max-w-[62ch]">{bidiIsolate(t('mkt.platform.auto_desc', 'رسالة واحدة من رقم ORDIUM فيها زرّا «تأكيد» و«إلغاء»، ويُسجَّل رد العميل على الطلب. تعمل هذه الميزة عند تفعيل رقم ORDIUM؛ لا تحتاج إلى ربط رقمك الخاص.'), isRTL)}</p>
            </section>
            <section aria-labelledby="platform-metrics" className="pt-8 border-t border-white/[0.07]">
              <h2 id="platform-metrics" className="text-xl font-semibold text-white">{t('pages.platform.metrics_title', 'مؤشرات التأكيد وسجل التدقيق')}</h2>
              <p className="mt-3 text-base text-[var(--ordium-muted)] leading-relaxed max-w-[62ch]">{t('pages.platform.metrics_desc', 'تابع الطلبات المؤكدة، والطلبات التي تنتظر أول تواصل، والعمل الجاري، والإلغاءات، ومحاولات التواصل.')}</p>
            </section>
          </div>

          <figure className="lg:col-span-6 rounded-2xl border border-white/10 bg-[var(--ordium-surface)] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <figcaption className="text-base font-semibold text-white">{t('mkt.platform.tl_title', 'سجل طلب واحد، خطوة بخطوة')}</figcaption>
              <span className="rounded-md border border-white/15 px-2.5 py-0.5 text-xs font-medium text-[var(--ordium-muted)]">{t('mkt.platform.tl_example', 'مثال توضيحي')}</span>
            </div>
            <ol className="mt-6 border-s border-white/12">
              {timeline.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <li key={idx} className="relative flex items-start gap-3 ps-6 pb-5 last:pb-0">
                    <span aria-hidden="true" className="absolute -start-[13px] top-0 w-[26px] h-[26px] rounded-full border border-white/15 bg-[var(--ordium-surface)] flex items-center justify-center">
                      <Icon className={`w-3.5 h-3.5 ${step.tone ?? 'text-[var(--ordium-muted)]'}`} />
                    </span>
                    <span className={`flex-1 text-sm leading-relaxed ${step.tone ?? 'text-[#D5DCE6]'}`}>{bidiIsolate(step.text, isRTL)}</span>
                    {idx < timeline.length - 1 && <span dir="ltr" className="shrink-0 text-xs text-[var(--ordium-subtle)] tabular-nums">{step.time}</span>}
                  </li>
                );
              })}
            </ol>
          </figure>
        </div>

        <section aria-labelledby="platform-facts" className="mb-4 text-start">
          <h2 id="platform-facts" className="text-xl font-semibold text-white">{t('mkt.platform.facts_title', 'ما يمكنك التحقق منه')}</h2>
          <dl className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-10">
            {facts.map(fact => (
              <div key={fact.label} className="py-4 border-t border-white/[0.07]">
                <dt className="text-base font-semibold text-white">{fact.label}</dt>
                <dd className="mt-1 text-sm text-[var(--ordium-muted)] leading-relaxed max-w-[60ch]">{bidiIsolate(fact.desc, isRTL)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <PipelineSection />
    </div>
  );
};
