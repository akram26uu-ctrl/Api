/**
 * ORDIUM identity section: what each order is compared against, with one example of a phone
 * number linked to several earlier orders. On /intelligence this section carries the page h1.
 */

import { LazyFraudNetwork3D as FraudNetwork3D } from '../3d/lazy';
import { Model3DPanel } from './Model3DPanel';
import React from 'react';
import { Smartphone, MapPin, Cpu, Globe, History, Package, Phone } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

interface IdentitySectionProps {
  /** Render the section title as the page heading (used on /intelligence). */
  asPageHeading?: boolean;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({ asPageHeading }) => {
  const { t, isRTL } = useLanguage();
  const isPage = asPageHeading ?? (typeof window !== 'undefined' && window.location.pathname === '/intelligence');
  const Title = isPage ? 'h1' : 'h2';

  const checks = [
    { icon: Smartphone, title: t('mkt.identity.phone_t', 'رقم الهاتف'), desc: t('mkt.identity.phone_d', 'الرقم نفسه في عدة طلبات، وما حدث لطلباته السابقة: تأكيد أو رفض أو إرجاع.') },
    { icon: MapPin, title: t('mkt.identity.address_t', 'عنوان التوصيل'), desc: t('mkt.identity.address_d', 'العنوان نفسه بأسماء وأرقام هاتف مختلفة.') },
    { icon: Cpu, title: t('mkt.identity.device_t', 'الجهاز'), desc: t('mkt.identity.device_d', 'الهاتف أو الحاسوب نفسه يرسل طلبات بأسماء مختلفة.') },
    { icon: Globe, title: t('mkt.identity.network_t', 'الاتصال'), desc: t('mkt.identity.network_d', 'استخدام VPN أو بروكسي أو Tor، وعناوين IP ذات سمعة سيئة.') },
    { icon: History, title: t('mkt.identity.history_t', 'سجل العميل'), desc: t('mkt.identity.history_d', 'كم مرة ألغى العميل طلبًا أو رفض طردًا أو أعاده من قبل.') },
    { icon: Package, title: t('mkt.identity.size_t', 'حجم الطلب'), desc: t('mkt.identity.size_d', 'كمية أو مبلغ أعلى بكثير من المعتاد في متجرك.') },
  ];

  const linkedOrders = [
    { id: '1012', status: t('mkt.identity.g_delivered', 'سُلِّم'), tone: 'text-[var(--ordium-success)]', dot: 'bg-[var(--ordium-success)]' },
    { id: '1019', status: t('mkt.identity.g_refused', 'رُفض عند التسليم'), tone: 'text-[var(--ordium-danger)]', dot: 'bg-[var(--ordium-danger)]' },
    { id: '1031', status: t('mkt.identity.g_refused', 'رُفض عند التسليم'), tone: 'text-[var(--ordium-danger)]', dot: 'bg-[var(--ordium-danger)]' },
    { id: '1042', status: t('mkt.identity.g_new', 'طلب جديد · للمراجعة'), tone: 'text-[var(--ordium-warning)]', dot: 'bg-[var(--ordium-warning)]', current: true },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 sm:mb-14 text-start">
          <Title className={`${isPage ? 'text-3xl sm:text-5xl' : 'text-3xl sm:text-4xl'} font-extrabold text-white tracking-tight rtl:tracking-normal text-balance`}>
            {t('mkt.identity.title', 'طلب واحد يبدو عاديًا، والروابط بين الطلبات تكشف الحقيقة')}
          </Title>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[65ch] text-pretty">
            {t('mkt.identity.subtitle', 'تقارن ORDIUM رقم الهاتف والعنوان والجهاز والاتصال في كل طلب بطلباتك السابقة، فتظهر الطلبات الوهمية المتكررة والعملاء الذين يرفضون الطرود.')}
          </p>
        </div>

        <Model3DPanel className="mb-10" caption={t('mkt.model.network_caption', 'توضيح: طلبات وهواتف وأجهزة مترابطة، والمجموعة المشبوهة مميّزة.')}>
          <FraudNetwork3D highlightCluster={true} />
        </Model3DPanel>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <figure className="lg:col-span-5 rounded-2xl border border-white/10 bg-[var(--ordium-surface)] p-5 sm:p-6 text-start">
            <div className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--ordium-signal)]/35 bg-[var(--ordium-signal)]/[0.07] px-3.5 py-2.5">
              <Phone aria-hidden="true" className="w-4 h-4 text-[var(--ordium-signal)]" />
              <span className="text-sm text-[var(--ordium-muted)]">{t('mkt.identity.g_phone', 'رقم الهاتف نفسه')}</span>
              <span dir="ltr" className="text-sm font-semibold text-white tabular-nums">0550 12 34 56</span>
            </div>
            <ul className="mt-2 ms-5 border-s border-white/15 ps-0">
              {linkedOrders.map(order => (
                <li key={order.id} className="relative flex items-center gap-3 ps-6 py-2.5">
                  <span aria-hidden="true" className="absolute start-0 top-1/2 h-px w-4 bg-white/15" />
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${order.dot}`} />
                  <span className={`text-sm ${order.current ? 'font-semibold text-white' : 'text-[#D5DCE6]'}`}>
                    {t('mkt.identity.g_order', 'طلب رقم')} <span dir="ltr" className="tabular-nums">{order.id}</span>
                  </span>
                  <span className={`ms-auto text-sm ${order.tone}`}>{order.status}</span>
                </li>
              ))}
            </ul>
            <figcaption className="mt-4 pt-4 border-t border-white/[0.07] text-sm text-[var(--ordium-subtle)] leading-relaxed">
              {t('mkt.identity.g_caption', 'مثال: الرقم نفسه في أربعة طلبات، رُفض منها طردان.')}
            </figcaption>
          </figure>

          <ul className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10 text-start">
            {checks.map(check => {
              const Icon = check.icon;
              return (
                <li key={check.title} className="flex items-start gap-3 py-4 border-t border-white/[0.07]">
                  <Icon aria-hidden="true" className="w-4 h-4 mt-1 shrink-0 text-[var(--ordium-signal)]" />
                  <div>
                    <h3 className="text-base font-semibold text-white">{check.title}</h3>
                    <p className="mt-1 text-sm text-[var(--ordium-muted)] leading-relaxed">{bidiIsolate(check.desc, isRTL)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};
