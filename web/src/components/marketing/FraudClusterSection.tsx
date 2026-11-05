/**
 * ORDIUM linked-orders section: how three unremarkable orders become one visible group
 * once their shared address and device are linked. Example data, labelled as such.
 */

import { LazySecurityShield3D as SecurityShield3D } from '../3d/lazy';
import { Model3DPanel } from './Model3DPanel';
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export const FraudClusterSection: React.FC = () => {
  const { t } = useLanguage();

  const steps = [
    { title: t('mkt.cluster.s1_t', 'الطلب الأول يبدو طبيعيًا'), desc: t('mkt.cluster.s1_d', 'اسم جديد، ورقم جزائري صحيح، وعنوان كامل. لا شيء لافت.') },
    { title: t('mkt.cluster.s2_t', 'الطلبات التالية تشترك في التفاصيل'), desc: t('mkt.cluster.s2_d', 'خلال ساعتين يصل طلبان آخران بأسماء وأرقام مختلفة، لكن من الجهاز نفسه وإلى العنوان نفسه.') },
    { title: t('mkt.cluster.s3_t', 'تجمعها ORDIUM وترفع درجتها'), desc: t('mkt.cluster.s3_d', 'تظهر الطلبات المرتبطة معًا وترتفع درجتها، فتتأكد مع العميل قبل شحن أي منها.') },
  ];
  const orders = [
    { id: '2201', name: 'Amine K.', phone: '0661 20 45 18', time: '14:02' },
    { id: '2207', name: 'Yacine M.', phone: '0770 88 13 02', time: '14:51' },
    { id: '2210', name: 'Sofiane B.', phone: '0552 47 90 36', time: '15:37' },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 sm:mb-14 text-start">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight rtl:tracking-normal text-balance">
            {t('mkt.cluster.title', 'الطلبات الوهمية نادرًا ما تأتي وحدها')}
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[65ch] text-pretty">
            {t('mkt.cluster.subtitle', 'قد يمر طلب واحد من كل الفحوص. لكن عندما تربط ORDIUM أرقام الهواتف والعناوين والأجهزة بين الطلبات، يظهر النمط.')}
          </p>
        </div>

        <Model3DPanel className="mb-10" caption={t('mkt.model.shield_caption', 'توضيح: الطلبات المرتبطة بمجموعة مشبوهة تُوقف قبل الشحن.')}>
          <SecurityShield3D />
        </Model3DPanel>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <figure className="lg:col-span-6 rounded-2xl border border-white/10 bg-[var(--ordium-surface)] p-5 sm:p-6 text-start">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md border border-white/15 px-2.5 py-0.5 text-xs font-medium text-[var(--ordium-muted)]">{t('mkt.hero.example', 'مثال توضيحي')}</span>
              <span className="text-sm font-semibold text-[var(--ordium-warning)]">{t('mkt.cluster.v_group', 'مجموعة مرتبطة · 3 طلبات')}</span>
            </div>
            <ul className="mt-3">
              {orders.map(order => (
                <li key={order.id} className="py-4 border-t border-white/[0.07] first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-white" dir="ltr">#{order.id} · {order.name}</span>
                    <span className="text-xs text-[var(--ordium-subtle)] tabular-nums" dir="ltr">{order.time}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-[var(--ordium-subtle)]">{t('mkt.cluster.v_phone', 'الهاتف')}</dt>
                    <dd className="text-[#D5DCE6] tabular-nums"><span dir="ltr">{order.phone}</span></dd>
                    <dt className="text-[var(--ordium-subtle)]">{t('mkt.cluster.v_address', 'العنوان')}</dt>
                    <dd className="text-[var(--ordium-signal)]">{t('mkt.cluster.v_address_value', 'حي 500 مسكن، العمارة C، البليدة')}</dd>
                    <dt className="text-[var(--ordium-subtle)]">{t('mkt.cluster.v_device', 'الجهاز')}</dt>
                    <dd className="text-[var(--ordium-signal)]">{t('mkt.cluster.v_device_value', 'الجهاز نفسه')}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            <figcaption className="mt-4 text-sm text-[var(--ordium-subtle)] leading-relaxed">{t('mkt.cluster.v_caption', 'مثال: ثلاثة طلبات بأسماء وأرقام مختلفة، من الجهاز نفسه وإلى العنوان نفسه خلال ساعتين.')}</figcaption>
          </figure>

          <div className="lg:col-span-6 text-start">
            <ol>
              {steps.map((step, idx) => (
                <li key={step.title} className="flex items-start gap-4 py-5 border-t border-white/[0.07] first:border-t-0 first:pt-0">
                  <span aria-hidden="true" className="mt-0.5 w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-semibold text-[var(--ordium-muted)] tabular-nums shrink-0">{idx + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                    <p className="mt-1.5 text-sm sm:text-base text-[var(--ordium-muted)] leading-relaxed max-w-[60ch]">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 pt-5 border-t border-white/[0.07] text-sm text-[var(--ordium-muted)] leading-relaxed max-w-[60ch]">
              {t('mkt.cluster.outcome', 'نتائج التوصيل التي تسجلها (سُلِّم، رُفض، أُرجع) تُستعمل لضبط الدرجات في متجرك.')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
