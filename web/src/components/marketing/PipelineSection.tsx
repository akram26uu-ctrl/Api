/**
 * ORDIUM pipeline section: the checks every order goes through, in order, in merchant language.
 */

import { LazyRiskScanner3D as RiskScanner3D } from '../3d/lazy';
import { Model3DPanel } from './Model3DPanel';
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

export const PipelineSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const steps = [
    { title: t('mkt.pipeline.s1_t', 'يصل الطلب'), desc: t('mkt.pipeline.s1_d', 'من Shopify أو YouCan أو WooCommerce، أو من متجرك الخاص عبر API، لحظة طلب العميل.') },
    { title: t('mkt.pipeline.s2_t', 'يُربط بطلباتك السابقة'), desc: t('mkt.pipeline.s2_d', 'مقارنة رقم الهاتف والعنوان والجهاز بالطلبات السابقة.') },
    { title: t('mkt.pipeline.s3_t', 'يُفحص السلوك'), desc: t('mkt.pipeline.s3_d', 'عدة طلبات في وقت قصير، أو كمية أو مبلغ غير معتاد.') },
    { title: t('mkt.pipeline.s4_t', 'يُفحص الاتصال'), desc: t('mkt.pipeline.s4_d', 'استخدام VPN أو بروكسي أو Tor، وعناوين IP ذات سمعة سيئة.') },
    { title: t('mkt.pipeline.s5_t', 'تُطبَّق قواعدك'), desc: t('mkt.pipeline.s5_d', 'لكل إشارة الوزن الذي حددته في ملف المخاطر الخاص بمتجرك.') },
    { title: t('mkt.pipeline.s6_t', 'درجة من 0 إلى 100'), desc: t('mkt.pipeline.s6_d', 'مع الأسباب التي رفعتها، بكلمات واضحة.') },
    { title: t('mkt.pipeline.s7_t', 'قرار واضح'), desc: t('mkt.pipeline.s7_d', 'قبول أو مراجعة أو رفض حسب حدودك (افتراضيًا: مراجعة من 50، ورفض من 80). يبقى القرار الأخير لك.') },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-24 text-start">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight rtl:tracking-normal text-balance">
            {t('mkt.pipeline.title', 'من طلب جديد إلى قرار واضح')}
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[60ch] text-pretty">
            {t('mkt.pipeline.subtitle', 'يمر كل طلب بالفحوص نفسها وبالترتيب نفسه، فتعرف بالضبط لماذا حصل على درجته.')}
          </p>
          <Model3DPanel className="mt-8" caption={t('mkt.model.scanner_caption', 'توضيح: الطلب يمر على فحوص المخاطر واحدًا بعد الآخر.')}>
            <RiskScanner3D />
          </Model3DPanel>
        </div>

        <ol className="lg:col-span-7 text-start">
            {steps.map((step, idx) => (
              <li key={step.title} className="flex items-start gap-4 py-3.5 border-t border-white/[0.07] first:border-t-0">
                <span aria-hidden="true" className="mt-0.5 w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-semibold text-[var(--ordium-muted)] tabular-nums shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--ordium-muted)] leading-relaxed max-w-[60ch]">{bidiIsolate(step.desc, isRTL)}</p>
                </div>
              </li>
            ))}
          </ol>
      </div>
    </section>
  );
};
