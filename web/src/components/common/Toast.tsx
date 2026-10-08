/**
 * ORDIUM Notification Toast
 */

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-[#0D1320] border border-white/10 shadow-2xl animate-in slide-in-from-bottom-2 duration-150"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" />}

          <div className="flex-1 text-xs">
            <div className="font-semibold text-white">{toast.title}</div>
            {toast.message && <div className="text-[#94A3B8] mt-0.5">{toast.message}</div>}
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-[#94A3B8] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
