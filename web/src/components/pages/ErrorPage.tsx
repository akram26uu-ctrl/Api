import React from 'react';
import { ArrowLeft, ArrowRight, Home, LockKeyhole, SearchX, ServerCrash, ShieldAlert, TimerReset } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface ErrorPageProps {
  statusCode: number;
  onNavigate: (path: string) => void;
  /** Rendered inside the public site shell (navbar/footer already present). */
  embedded?: boolean;
}

const DEFAULT_COPY: Record<number, { title: string; description: string }> = {
  403: { title: 'Access denied', description: "You don't have permission to view this page. If you think this is a mistake, sign in with the correct account or contact the ORDIUM team." },
  404: { title: "We couldn't find this page", description: 'The link may be incorrect or the page may no longer exist. Check the address or go back to the ORDIUM website.' },
  429: { title: 'Too many requests', description: 'You have temporarily reached the request limit. Wait a moment, then try again.' },
  500: { title: 'Internal error', description: 'ORDIUM ran into an unexpected problem. Please try again in a moment.' },
  503: { title: 'Service temporarily unavailable', description: 'We are restoring the service. Please try again shortly.' },
};

export const ErrorPage: React.FC<ErrorPageProps> = ({ statusCode, onNavigate, embedded = false }) => {
  const { t, isRTL } = useLanguage();
  const code = DEFAULT_COPY[statusCode] ? statusCode : 404;
  const copy = DEFAULT_COPY[code];
  const Icon = code === 403 ? LockKeyhole : code === 404 ? SearchX : code === 429 ? TimerReset : code >= 500 ? ServerCrash : ShieldAlert;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const Root = embedded ? 'section' : 'main';

  return (
    <Root className={`${embedded ? 'py-20' : 'min-h-screen'} bg-[#080B12] text-[#F8FAFC] flex items-center justify-center px-5 py-12 relative overflow-hidden`}>
      <div aria-hidden="true" className="absolute -top-32 -start-20 w-96 h-96 rounded-full bg-[#6C5CE7]/10 blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-32 -end-20 w-96 h-96 rounded-full bg-[#22D3EE]/10 blur-3xl pointer-events-none" />
      <div className="ordium-auth-card relative w-full max-w-xl p-8 sm:p-12 text-center">
        <div aria-hidden="true" className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#22D3EE]/25 bg-[#22D3EE]/10">
          <Icon className="h-8 w-8 text-[#22D3EE]" />
        </div>
        <p className="font-mono text-xs tracking-[0.3em] text-[#52D9E8]">{t('errors.eyebrow', 'ORDIUM / SYSTEM RESPONSE')}</p>
        <p className="mt-5 font-mono text-6xl font-extrabold tracking-tight text-white" aria-hidden="true">{code}</p>
        <h1 className="mt-5 text-2xl sm:text-3xl font-bold">
          <span className="sr-only">{code} — </span>{t(`errors.${code}.title`, copy.title)}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#A5B1C3]">{t(`errors.${code}.description`, copy.description)}</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button type="button" onClick={() => onNavigate('/')} className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#22D3EE] px-5 py-3 text-sm font-bold text-[#061018] hover:bg-[#67E8F9] transition-colors">
            <Home aria-hidden="true" className="h-4 w-4" /> {t('errors.back_home', 'Back to home')}
          </button>
          <button type="button" onClick={() => onNavigate('/login')} className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
            {t('nav.sign_in', 'Sign In')} <Arrow aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Root>
  );
};
