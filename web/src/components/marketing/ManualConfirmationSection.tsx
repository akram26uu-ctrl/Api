import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

/** Order confirmation as it works today (manual, from the dashboard) and once automatic WhatsApp is on. */
export const ManualConfirmationSection: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const today = [t('mkt.confirm.today_s1', 'افتح الطلب: المنتج والمبلغ والعنوان ودرجة الخطر في مكان واحد.'), t('mkt.confirm.today_s2', 'افتح رسالة واتساب جاهزة أو اتصل بالعميل بنفسك.'), t('mkt.confirm.today_s3', 'سجّل النتيجة: مؤكَّد، ملغى، أو لا رد.')];

  return (
    <section className="relative py-20 sm:py-24 border-t border-white/5" aria-labelledby="manual-confirmation-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 sm:mb-14 text-start">
          <h2 id="manual-confirmation-title" className="text-3xl sm:text-4xl font-extrabold tracking-tight rtl:tracking-normal text-white text-balance">
            {t('mkt.confirm.title', 'أكّد الطلب قبل أن تشحنه')}
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-[var(--ordium-muted)] max-w-[65ch] text-pretty">
            {t('mkt.confirm.subtitle', 'تواصل مع العميل من صفحة الطلب، وسجّل رده، واشحن ما تأكد فقط.')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start text-start">
          <div className="lg:col-span-6">
            <h3 className="text-lg font-semibold text-white">{t('mkt.confirm.today_title', 'اليوم: من لوحة التحكم')}</h3>
            <ol className="mt-4">
              {today.map((step, idx) => (
                <li key={step} className="flex items-start gap-4 py-3.5 border-t border-white/[0.07] first:border-t-0">
                  <span aria-hidden="true" className="mt-0.5 w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-semibold text-[var(--ordium-muted)] tabular-nums shrink-0">{idx + 1}</span>
                  <p className="text-base text-[#D5DCE6] leading-relaxed max-w-[60ch]">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-[var(--ordium-subtle)] leading-relaxed max-w-[62ch]">{t('mkt.confirm.metrics', 'تعرض لوحة التحكم الطلبات التي تنتظر أول تواصل، والطلبات قيد التأكيد، ومعدل التأكيد المحسوب من الطلبات التي سُجّلت لها محاولة تواصل.')}</p>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-[#8FD9B6]/20 bg-[#8FD9B6]/[0.04] p-6 sm:p-7">
            <div className="flex items-center gap-2.5">
              <MessageCircle aria-hidden="true" className="w-5 h-5 text-[#8FD9B6]" />
              <h3 className="text-lg font-semibold text-white">{t('mkt.confirm.auto_title', 'التأكيد التلقائي عبر واتساب')}</h3>
            </div>
            <p className="mt-2 text-sm font-medium text-[#8FD9B6]">{bidiIsolate(t('mkt.confirm.auto_status', 'جاهز · يُفعَّل عند تفعيل رقم ORDIUM'), isRTL)}</p>
            <p className="mt-4 text-base text-[#D5DCE6] leading-relaxed max-w-[60ch]">{bidiIsolate(t('mkt.confirm.auto_desc', 'يتلقى العميل رسالة واحدة من رقم ORDIUM فيها زرّا «تأكيد» و«إلغاء»، ويُسجَّل رده على الطلب مباشرة. لا تحتاج إلى ربط رقمك الخاص.'), isRTL)}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
