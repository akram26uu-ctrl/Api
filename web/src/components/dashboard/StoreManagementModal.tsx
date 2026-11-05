import React from 'react';
import { Store } from '../../lib/api/types';
import { useLanguage } from '../../i18n/LanguageContext';
import { StoresPanel } from './settings/StoresPanel';

interface Props {
  stores: Store[];
  onStoresChanged: (stores: Store[]) => void;
}

/** First-run gate: a workspace needs one active store before anything else works.
 *  Day-to-day store management lives in Settings → Stores. */
export const StoreManagementModal: React.FC<Props> = ({ stores, onStoresChanged }) => {
  const { t, isRTL } = useLanguage();
  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <section role="dialog" aria-modal="true" aria-labelledby="ordium-first-store-title" className="w-full max-w-lg rounded-[var(--ordium-radius-lg)] border border-[var(--ordium-border-strong)] bg-[var(--ordium-surface)] shadow-2xl p-5 sm:p-7">
        <h2 id="ordium-first-store-title" className="text-lg font-bold text-[var(--ordium-text)]">{t('dashboard.stores.required_title', 'أنشئ متجرك أولًا')}</h2>
        <p className="text-sm text-[var(--ordium-muted)] mt-1.5 mb-5">{t('dashboard.stores.required_desc', 'للبدء واستقبال الطلبات، يجب إنشاء متجر واحد على الأقل.')}</p>
        <StoresPanel stores={stores} onStoresChanged={onStoresChanged} required />
      </section>
    </div>
  );
};
