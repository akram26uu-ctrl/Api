import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { OrderConfirmationMetrics } from './OrderConfirmationMetrics';
import { ConfirmationSettingsPanel } from './settings/ConfirmationSettingsPanel';
import { useLanguage } from '../../i18n/LanguageContext';

interface ConfirmationViewProps {
  onOpenOrders: () => void;
}

/** Dedicated confirmation workspace; order operations stay in the orders queue. */
export const ConfirmationView: React.FC<ConfirmationViewProps> = ({ onOpenOrders }) => {
  const { t, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <section className="dashboard-page-heading">
        <div className="relative z-10 min-w-0">
          <h2>{t('dashboard.sidebar.confirmation_page', 'التأكيد')}</h2>
          <p className="mt-2 text-sm">{t('dashboard.confirmation_metrics.subtitle', 'تُحسب النسبة من الطلبات التي سُجّلت لها محاولة تأكيد واحدة على الأقل، وتُعرض الطلبات الجديدة منفصلة.')}</p>
        </div>
        <div className="relative z-10 shrink-0 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenOrders} rightIcon={<ArrowIcon className="w-4 h-4" />}>
            {t('dashboard.sidebar.orders', 'الطلبات')}
          </Button>
        </div>
      </section>
      <OrderConfirmationMetrics />
      <section className="space-y-4" aria-labelledby="whatsapp-settings-title">
        <div>
          <h2 id="whatsapp-settings-title" className="text-base font-semibold text-[var(--ordium-text)]">{t('settings.confirmation.title', 'التأكيد التلقائي عبر واتساب')}</h2>
          <p className="mt-1 text-sm text-[var(--ordium-muted)] max-w-[62ch]">{t('settings.confirmation.desc', 'رسالة واتساب يرسلها Ordium للزبون بعد كل طلبية ليؤكدها أو يلغيها بضغطة زر.')}</p>
        </div>
        <ConfirmationSettingsPanel />
      </section>
    </div>
  );
};
