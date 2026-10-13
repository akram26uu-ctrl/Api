import React from 'react';
import { ArrowLeft, ArrowRight, Home, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export interface ErrorPageProps {
  code: 404 | 500;
  onHome?: () => void;
  onRetry?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({ code, onHome, onRetry }) => {
  const { isRTL } = useLanguage();
  const isNotFound = code === 404;
  const title = isRTL
    ? (isNotFound ? 'هذه الصفحة غير موجودة' : 'حدث خطأ غير متوقع')
    : (isNotFound ? 'This page is not here' : 'Something went wrong');
  const description = isRTL
    ? (isNotFound
      ? 'قد يكون الرابط غير صحيح أو أن الصفحة نُقلت. يمكنك العودة إلى ORDIUM ومتابعة عملك.'
      : 'تعذّر إكمال طلبك هذه المرة. أعد المحاولة، أو ارجع إلى الصفحة الرئيسية.')
    : (isNotFound
      ? 'The link may be incorrect or the page may have moved. Head back to ORDIUM and continue where you left off.'
      : 'ORDIUM could not complete this request. Try again, or return to the home page.');
  const homeLabel = isRTL ? 'العودة للرئيسية' : 'Back to home';
  const retryLabel = isRTL ? 'إعادة المحاولة' : 'Try again';
  const DirectionArrow = isRTL ? ArrowRight : ArrowLeft;
  const StatusIcon = isNotFound ? ShieldAlert : ShieldCheck;

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080B12] px-5 py-12 text-[#F8FAFC]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22D3EE]/[0.07] blur-[110px]" />
        <div className="absolute left-[15%] top-[18%] h-48 w-48 rounded-full bg-[#6C5CE7]/10 blur-[90px]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <section className="relative z-10 w-full max-w-xl text-center">
        <a href="/" onClick={event => { if (onHome) { event.preventDefault(); onHome(); } }} className="mb-12 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-[#0D1320]/80 px-4 py-2 text-sm font-semibold tracking-[0.2em] text-white transition hover:border-[#22D3EE]/40">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#6C5CE7] text-[#061018]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          ORDIUM
        </a>

        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#22D3EE]/20 bg-[#0D1320] shadow-[0_0_60px_rgba(34,211,238,0.08)]">
          <StatusIcon className="h-9 w-9 text-[#22D3EE]" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <p className="font-mono text-sm tracking-[0.45em] text-[#22D3EE]">ERROR / {code}</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#94A3B8] sm:text-base">{description}</p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:border-[#22D3EE]/40 hover:bg-white/[0.06]">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {retryLabel}
            </button>
          )}
          <button type="button" onClick={onHome ?? (() => { window.location.assign('/'); })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#22D3EE] to-[#6C5CE7] px-5 py-3 text-sm font-bold text-[#061018] shadow-lg shadow-[#22D3EE]/10 transition hover:brightness-110">
            <Home className="h-4 w-4" aria-hidden="true" />
            {homeLabel}
            <DirectionArrow className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-12 font-mono text-[10px] tracking-[0.24em] text-[#475569]">ORDIUM · RISK INTELLIGENCE INFRASTRUCTURE</p>
      </section>
    </main>
  );
};
