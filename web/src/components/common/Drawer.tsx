/** ORDIUM accessible, RTL-aware slide-over drawer. */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, description, width = 'lg', children }) => {
  const { isRTL, t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;
  const widthClasses = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-2xl' }[width];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <button type="button" tabIndex={-1} onClick={() => onCloseRef.current()} aria-label={t('common.close', 'إغلاق')} className="ordium-drawer-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" />
      <div className={`fixed inset-y-0 ${isRTL ? 'left-0' : 'right-0'} flex max-w-full ${isRTL ? 'pr-3 sm:pr-10' : 'pl-3 sm:pl-10'}`}>
        <div ref={panelRef} tabIndex={-1} className={`ordium-drawer-panel ${isRTL ? 'ordium-drawer-from-left' : 'ordium-drawer-from-right'} w-screen ${widthClasses} bg-[#0D1320] ${isRTL ? 'border-r' : 'border-l'} border-white/10 shadow-2xl flex flex-col outline-none`} role="dialog" aria-modal="true" aria-labelledby="ordium-drawer-title" aria-describedby={description ? 'ordium-drawer-description' : undefined}>
          <div className="p-4 sm:p-5 border-b border-white/5 flex items-start justify-between gap-4">
            <div className="min-w-0"><h3 id="ordium-drawer-title" className="text-sm font-bold text-white font-mono">{title}</h3>{description && <p id="ordium-drawer-description" className="text-xs text-[#A1AEC1] mt-1 leading-relaxed">{description}</p>}</div>
            <button type="button" onClick={() => onCloseRef.current()} aria-label={t('common.close', 'إغلاق')} className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg text-[#A1AEC1] hover:text-white hover:bg-white/5 shrink-0"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-6">{children}</div>
        </div>
      </div>
    </div>, document.body,
  );
};
