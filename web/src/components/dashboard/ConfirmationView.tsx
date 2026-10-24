import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { OrderConfirmationMetrics } from './OrderConfirmationMetrics';
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
          <h2>{t('dashboard.confirmation_metrics.title', 'مؤشرات تأكيد الطلبات')}</h2>
          <p className="mt-2 text-sm">{t('dashboard.confirmation_metrics.subtitle', 'تُحسب النسبة من الطلبات التي سُجّلت لها محاولة تأكيد واحدة على الأقل، وتُعرض الطلبات الجديدة منفصلة.')}</p>
        </div>
        <div className="relative z-10 shrink-0">
          <Button variant="outline" onClick={onOpenOrders} rightIcon={<ArrowIcon className="w-4 h-4" />}>
            {t('dashboard.sidebar.orders', 'الطلبات والتأكيد')}
          </Button>
        </div>
      </section>
      <OrderConfirmationMetrics />
    </div>
  );
};
