import React from 'react';
import { LazySecurityShield3D as SecurityShield3D } from '../3d/lazy';
import { Model3DPanel } from '../marketing/Model3DPanel';
import { Lock, Key, EyeOff, FileCheck, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from '../marketing/Bidi';

export const SecurityPage: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const pillars = [
    { icon: <Lock className="w-4 h-4 text-[#52D9E8]" />, title: t('pages.security.p1_title', 'Merchant and environment isolation'), desc: t('pages.security.p1_desc', 'API queries are scoped by merchant and by environment (live traffic vs. simulator). Dashboard credentials are kept server-side and reach the browser only through the authenticated control-plane session.') },
    { icon: <Key className="w-4 h-4 text-[#958AFF]" />, title: t('pages.security.p2_title', 'Credential protection'), desc: t('pages.security.p2_desc', 'API credentials are stored as SHA-256 hashes in the API database. Dashboard session credentials are encrypted before storage in the control-plane database.') },
    { icon: <EyeOff className="w-4 h-4 text-[#48D6A0]" />, title: t('pages.security.p3_title', 'No card-number ingestion'), desc: t('pages.security.p3_desc', 'The current order schema accepts commerce metadata and does not accept PAN or CVV fields. Do not send payment-card credentials to ORDIUM.') },
    { icon: <FileCheck className="w-4 h-4 text-[#F5C465]" />, title: t('pages.security.p4_title', 'Auditable security controls'), desc: t('pages.security.p4_desc', 'Scoped API keys, request IDs, audit records, idempotency handling, signed webhooks, rate limits, and tenant/environment boundaries are implemented controls. This MVP does not claim compliance certifications.') },
  ];
  const safeguards = [
    t('pages.security.s1', 'Scoped API-key permissions and merchant isolation'),
    t('pages.security.s2', 'Live traffic isolated from the simulator, enforced by the API credential'),
    t('pages.security.s3', 'Webhook HMAC-SHA256 signing with event and delivery identifiers'),
    t('pages.security.s4', 'Idempotency protection for order ingestion'),
    t('pages.security.s5', 'Rate limiting and request IDs for API operations'),
  ];

  return (
    <div className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center max-w-3xl mx-auto mb-14 space-y-5">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight text-balance">{t('pages.security.title', 'Security controls that match the current implementation.')}</h1>
          <p className="text-base text-[#A5B1C3] leading-relaxed max-w-[68ch] mx-auto">{bidiIsolate(t('pages.security.subtitle', 'ORDIUM uses tenant-scoped authorization, credential hashing and encryption, request tracing, and signed webhooks. This page deliberately avoids claiming certifications, retention guarantees, or cryptographic properties that are not implemented and independently verified.'), isRTL)}</p>
        </header>

        <Model3DPanel className="mb-12" caption={t('mkt.model.security_caption', 'توضيح: بيانات كل متجر معزولة، والاتصال مشفّر وموقّع.')}>
          <SecurityShield3D />
        </Model3DPanel>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start text-start">
          <section className="lg:col-span-5 space-y-4" aria-labelledby="security-safeguards">
            <h2 id="security-safeguards" className="text-2xl font-bold text-white">{t('pages.security.safeguards_title', 'Operational safeguards')}</h2>
            <ul className="space-y-3">
              {safeguards.map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#E2E8F0] leading-relaxed">
                  <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-[#48D6A0] shrink-0" />
                  <span>{bidiIsolate(item, isRTL)}</span>
                </li>
              ))}
            </ul>
          </section>
          <dl className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10">
            {pillars.map(p => (
              <div key={p.title} className="py-4 border-t border-white/[0.07]">
                <dt className="flex items-center gap-2.5 text-base font-semibold text-white"><span aria-hidden="true">{p.icon}</span>{p.title}</dt>
                <dd className="mt-1.5 text-sm text-[#A5B1C3] leading-relaxed">{bidiIsolate(p.desc, isRTL)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
};
