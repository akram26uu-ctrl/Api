import React from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Home, LockKeyhole, SearchX, ServerCrash, ShieldAlert, TimerReset } from 'lucide-react';

interface ErrorPageProps { statusCode: number; onNavigate: (path: string) => void; }

const COPY: Record<number, { title: string; description: string; action: string }> = {
  403: { title: 'الوصول غير مسموح', description: 'ليس لديك الإذن للوصول إلى هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، سجّل الدخول بالحساب الصحيح أو تواصل مع فريق ORDIUM.', action: 'العودة إلى الرئيسية' },
  404: { title: 'لم نعثر على هذه الصفحة', description: 'قد يكون الرابط غير صحيح أو انتهت صلاحية الصفحة. تحقق من الرابط أو ارجع إلى موقع ORDIUM.', action: 'العودة إلى الرئيسية' },
  429: { title: 'طلبات كثيرة جدًا', description: 'وصلت إلى حد الطلبات المسموح به مؤقتًا. انتظر قليلًا ثم حاول مرة أخرى.', action: 'العودة إلى الرئيسية' },
  500: { title: 'حدث خطأ داخلي', description: 'واجه ORDIUM مشكلة غير متوقعة. لم نفقد طلبك عمدًا؛ حاول مجددًا بعد قليل.', action: 'العودة إلى الرئيسية' },
  503: { title: 'الخدمة غير متاحة مؤقتًا', description: 'نعمل على استعادة الخدمة. حاول مرة أخرى بعد قليل.', action: 'العودة إلى الرئيسية' },
};

export const ErrorPage: React.FC<ErrorPageProps> = ({ statusCode, onNavigate }) => {
  const copy = COPY[statusCode] || COPY[404];
  const Icon = statusCode === 403 ? LockKeyhole : statusCode === 404 ? SearchX : statusCode === 429 ? TimerReset : statusCode >= 500 ? ServerCrash : ShieldAlert;
  return (
    <main dir="rtl" className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex items-center justify-center px-5 py-12 relative overflow-hidden">
      <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-[#6C5CE7]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#22D3EE]/10 blur-3xl pointer-events-none" />
      <section className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0D1320]/95 p-8 sm:p-12 text-center shadow-2xl">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#22D3EE]/25 bg-[#22D3EE]/10">
          <Icon className="h-8 w-8 text-[#22D3EE]" />
        </div>
        <p className="font-mono text-xs tracking-[0.35em] text-[#22D3EE]">ORDIUM / SYSTEM RESPONSE</p>
        <p className="mt-5 font-mono text-6xl font-extrabold tracking-tight text-white">{statusCode}</p>
        <h1 className="mt-5 text-2xl sm:text-3xl font-bold">{copy.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-8 text-[#94A3B8]">{copy.description}</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button type="button" onClick={() => onNavigate('/')} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#22D3EE] px-5 py-3 text-sm font-bold text-[#061018] hover:bg-[#67E8F9]">
            <Home className="h-4 w-4" /> {copy.action}
          </button>
          <button type="button" onClick={() => onNavigate('/login')} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
            تسجيل الدخول <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-8 text-[11px] font-mono text-[#64748B]">ORDIUM RISK INTELLIGENCE · {statusCode}</p>
      </section>
    </main>
  );
};
