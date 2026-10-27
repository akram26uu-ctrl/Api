/** ORDIUM accessible modal and drawer primitives. */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  // Keep callbacks current without restarting the focus-management effect when
  // parents pass inline handlers. Restarting it on each keystroke steals focus
  // from controlled inputs and makes mobile keyboards collapse after one char.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ?.focus();
    }, 0);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ) as HTMLElement[];
      const focusable = focusableElements.filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      previousFocus.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain px-3 py-[max(12px,env(safe-area-inset-top))] sm:p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        className="fixed inset-0 bg-[#080B12]/85 backdrop-blur-md"
        aria-hidden="true"
        onMouseDown={() => onCloseRef.current()}
      />
      <div
        ref={dialogRef}
        className={`relative z-10 my-auto w-full ${widthMap[maxWidth]} max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain bg-[#0D1320] border border-white/10 rounded-2xl shadow-2xl p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ordium-modal-title"
      >
        <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-white/[0.08]">
          <div className="min-w-0">
            <h3 id="ordium-modal-title" className="text-lg font-bold text-white tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-sm leading-relaxed text-[#A5B1C3] mt-1.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close"
            className="inline-flex items-center justify-center min-w-10 min-h-10 text-[#A5B1C3] hover:text-white transition-colors rounded-xl hover:bg-white/5 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, width = 'lg' }) => {
  if (!isOpen) return null;
  const widthMap = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-[#080B12]/75 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className={`w-screen ${widthMap[width]} bg-[#0D1320] border-l border-white/10 shadow-2xl flex flex-col`} role="dialog" aria-modal="true" aria-label={title}>
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight font-mono">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="text-[#A5B1C3] hover:text-white p-1.5 rounded-lg hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
