import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { ordiumClient } from '../../lib/api/client';
import { DashboardNotification, Environment } from '../../lib/api/types';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../common/Button';

interface NotificationsCenterProps {
  environment: Environment;
}

const iconFor = (severity: DashboardNotification['severity']) => {
  if (severity === 'critical') return <ShieldAlert className="w-4 h-4 text-red-400" />;
  if (severity === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (severity === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  return <Info className="w-4 h-4 text-cyan-400" />;
};


type Translate = (key: string, fallback?: string) => string;

const fill = (template: string, values: Record<string, unknown>) =>
  template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '—'));

/** Alerts are stored with English text; show them in the merchant's language
 *  from their type and metadata, falling back to the stored text. */
export function localizeNotification(item: DashboardNotification, t: Translate): { title: string; message: string } {
  const meta = item.metadata ?? {};
  const order = meta.external_order_id ?? '—';
  const type = item.notification_type || '';
  if (type === 'order.risk.review' || type === 'order.risk.reject') {
    const kind = type.endsWith('reject') ? 'reject' : 'review';
    return {
      title: t(`dashboard.notifications.types.risk_${kind}.title`, item.title),
      message: fill(t(`dashboard.notifications.types.risk_${kind}.message`, item.message), { order, score: meta.score }),
    };
  }
  if (type.startsWith('order.confirmation.')) {
    const outcome = String(meta.outcome ?? type.split('.').pop() ?? '');
    return {
      title: t(`dashboard.notifications.types.confirmation.title`, item.title),
      message: fill(t('dashboard.notifications.types.confirmation.message', item.message), {
        order,
        outcome: t(`dashboard.notifications.outcomes.${outcome}`, outcome),
        channel: t(`dashboard.notifications.channels.${meta.channel}`, String(meta.channel ?? '')),
      }),
    };
  }
  if (type === 'integration.order_rejected') {
    const reason = String(meta.reason ?? '');
    return {
      title: t('dashboard.notifications.types.store_rejected.title', item.title),
      message: fill(t('dashboard.notifications.types.store_rejected.message', item.message), {
        order,
        platform: meta.platform,
        reason: t(`dashboard.notifications.reasons.${reason}`, reason),
      }),
    };
  }
  return { title: item.title, message: item.message };
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({ environment }) => {
  const { t, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await ordiumClient.getNotifications(25);
      setItems(result.data);
      setUnreadCount(result.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.notifications.load_error', 'Unable to load notifications.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [environment]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    const timer = window.setInterval(() => void load(), 30000);
    return () => { document.removeEventListener('mousedown', onPointer); window.clearInterval(timer); };
  }, [open, environment]);

  const markRead = async (item: DashboardNotification) => {
    if (item.read_at) return;
    try {
      const updated = await ordiumClient.markNotificationRead(item.id);
      setItems(current => current.map(row => row.id === updated.id ? updated : row));
      setUnreadCount(count => Math.max(0, count - 1));
    } catch { /* keep the item unread and allow retry */ }
  };

  const markAll = async () => {
    if (!unreadCount) return;
    try {
      await ordiumClient.markAllNotificationsRead();
      setItems(current => current.map(item => ({ ...item, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.notifications.read_error', 'Unable to update notifications.'));
    }
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={t('dashboard.notifications.open', 'فتح الإشعارات')}
        aria-expanded={open}
        className="relative p-2 rounded-xl text-[var(--ordium-muted)] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--ordium-danger-fill)] text-xs font-bold text-white flex items-center justify-center border-2 border-[var(--ordium-canvas)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-full mt-2 z-[80] ${isRTL ? 'left-0' : 'right-0'} w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-white/10 bg-[var(--ordium-surface)]/98 shadow-2xl shadow-black/50 backdrop-blur-xl`}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{t('dashboard.notifications.title', 'الإشعارات')}</h2>
              <p className="text-xs text-[#8A97AB] mt-0.5">{t('dashboard.notifications.subtitle', 'Merchant workspace')}</p>
            </div>
            <Button variant="ghost" size="sm" disabled={!unreadCount} onClick={() => void markAll()}>
              {t('dashboard.notifications.mark_all', 'Mark all read')}
            </Button>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--ordium-subtle)]">{t('dashboard.notifications.loading', 'جارٍ تحميل الإشعارات…')}</div>
            ) : error && items.length === 0 ? (
              <div className="p-6 text-center"><p className="text-xs text-red-300">{error}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>{t('common.retry', 'Retry')}</Button></div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center"><Bell className="w-7 h-7 mx-auto text-[#334155]" /><p className="mt-3 text-sm text-white">{t('dashboard.notifications.empty', 'You are all caught up.')}</p><p className="mt-1 text-xs text-[var(--ordium-subtle)]">{t('dashboard.notifications.empty_desc', 'Actionable risk alerts will appear here.')}</p></div>
            ) : items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => void markRead(item)}
                className={`w-full text-start px-4 py-3.5 border-b border-white/5 hover:bg-white/[0.03] transition-colors ${item.read_at ? 'opacity-65' : 'bg-white/[0.015]'}`}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">{iconFor(item.severity)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-white">{localizeNotification(item, t).title}</p>{!item.read_at && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />}</div>
                    <p className="text-xs leading-relaxed text-[var(--ordium-muted)] mt-1">{localizeNotification(item, t).message}</p>
                    <p className="text-xs text-[#475569] font-mono mt-2">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
