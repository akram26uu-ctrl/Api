/** ORDIUM Shipment status badge. Icon + text carry the meaning; colour only reinforces it. */
import React from 'react';
import { CheckCircle2, Clock, PackageCheck, Truck, Navigation, AlertTriangle, RotateCcw, XCircle, Ban } from 'lucide-react';
import type { ShipmentStatus } from '../../lib/api/types';
import { useLanguage } from '../../i18n/LanguageContext';

export const SUCCESS = 'bg-[var(--ordium-success)]/12 text-[var(--ordium-success)] border-[var(--ordium-success)]/30';
export const WARNING = 'bg-[var(--ordium-warning)]/12 text-[var(--ordium-warning)] border-[var(--ordium-warning)]/30';
export const DANGER = 'bg-[var(--ordium-danger)]/12 text-[var(--ordium-danger)] border-[var(--ordium-danger)]/30';
export const SIGNAL = 'bg-[var(--ordium-signal)]/12 text-[var(--ordium-signal)] border-[var(--ordium-signal)]/30';
export const MUTED = 'bg-white/5 text-[var(--ordium-muted)] border-white/10';

export const SHIPMENT_STATUS_STYLES: Record<ShipmentStatus, { icon: typeof Clock; className: string; fallback: string }> = {
  pending_dispatch: { icon: Clock, className: MUTED, fallback: 'قيد الإرسال' },
  accepted: { icon: PackageCheck, className: MUTED, fallback: 'استلمته الشركة' },
  picked_up: { icon: Truck, className: SIGNAL, fallback: 'تم الاستلام من المتجر' },
  in_transit: { icon: Truck, className: SIGNAL, fallback: 'في الطريق' },
  out_for_delivery: { icon: Navigation, className: WARNING, fallback: 'مع عون التوصيل' },
  delivery_attempt_failed: { icon: AlertTriangle, className: WARNING, fallback: 'فشلت محاولة التسليم' },
  delivered: { icon: CheckCircle2, className: SUCCESS, fallback: 'سُلِّمت' },
  returning: { icon: RotateCcw, className: DANGER, fallback: 'في طريق الإرجاع' },
  returned: { icon: RotateCcw, className: DANGER, fallback: 'مرتجعة' },
  dispatch_failed: { icon: XCircle, className: DANGER, fallback: 'لم تُرسل' },
  cancelled: { icon: Ban, className: MUTED, fallback: 'ملغاة' },
};

export const ShipmentStatusBadge: React.FC<{ status: ShipmentStatus }> = ({ status }) => {
  const { t } = useLanguage();
  const style = SHIPMENT_STATUS_STYLES[status] ?? SHIPMENT_STATUS_STYLES.pending_dispatch;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border whitespace-nowrap ${style.className}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{t(`shipping.status.${status}`, style.fallback)}</span>
    </span>
  );
};
