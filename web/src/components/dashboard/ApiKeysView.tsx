/**
 * ORDIUM API Keys Management View
 */

import React, { useState, useEffect } from 'react';
import { ApiKey, Environment } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { LoadingState, EmptyState } from '../common/EmptyState';
import { useLanguage } from '../../i18n/LanguageContext';
import { Key, Plus, Copy, Check, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ApiKeysViewProps {
  environment: Environment;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({ environment }) => {
  const { t, isRTL } = useLanguage();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const fetchKeys = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ordiumClient.getApiKeys();
      setKeys(data.filter(k => k.environment === environment));
    } catch (err: any) {
      setKeys([]);
      setLoadError(err?.message || 'Unable to load API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [environment]);

  const handleCreate = async () => {
    if (!newKeyName) return;
    try {
      const created = await ordiumClient.createApiKey(newKeyName, environment);
      setKeys(prev => [created, ...prev]);
      setCreatedSecret(created.secret || 'ord_key_secret_revealed_once');
      setIsCreateModalOpen(false);
      setNewKeyName('');
    } catch (err: any) {
      setErrorMessage(`Failed to create API key: ${err.message}`);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await ordiumClient.revokeApiKey(keyId);
      setKeys(prev => prev.map(k => (k.id === keyId ? { ...k, status: 'revoked' } : k)));
      setRevokeTarget(null);
    } catch (err: any) {
      setErrorMessage(`Failed to revoke key: ${err.message}`);
    }
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0D1320] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-start">
        <div>
          <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
            <Key className="w-4 h-4 text-[#22D3EE]" />
            <span>{t('dashboard.apikeys.title', 'مفاتيح API')}</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            {t('dashboard.apikeys.subtitle', 'Authenticate checkout evaluations and webhook subscriptions securely with scoped tokens.')}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('dashboard.apikeys.create_key', 'إنشاء مفتاح')}
        </Button>
      </div>

      {/* One-Time Secret Reveal Modal */}
      <Modal
        isOpen={Boolean(createdSecret)}
        onClose={() => setCreatedSecret(null)}
        title={t('dashboard.apikeys.secret_token', 'تم إنشاء مفتاح API')}
        description={t('dashboard.apikeys.secret_modal_desc', 'Please copy your secret key right now. For security purposes, you will never see it again.')}
      >
        <div className="space-y-4 text-xs font-mono text-start">
          <div className="p-3.5 bg-[#080B12] border border-[#22D3EE]/40 rounded-xl text-[#22D3EE] font-bold break-all select-all flex items-center justify-between gap-3" dir="ltr">
            <span>{createdSecret}</span>
            <button
              onClick={copySecret}
              className="p-1.5 rounded hover:bg-white/10 text-white shrink-0"
              title="t('dashboard.apikeys.copy', 'نسخ المفتاح')"
            >
              {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[11px] leading-relaxed">
            ⚠ {t('dashboard.apikeys.warning', 'Do not commit this key into public client-side JavaScript or version control repositories.')}
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreatedSecret(null)}
            className="w-full justify-center"
          >
            {t('dashboard.apikeys.saved_key_btn', 'I Have Saved My Secret Key')}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(errorMessage)}
        onClose={() => setErrorMessage(null)}
        title={t('common.error', 'تعذر تنفيذ العملية')}
      >
        <p className="text-sm text-[#CBD5E1]">{errorMessage}</p>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setErrorMessage(null)}>OK</Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title={t('dashboard.apikeys.revoke', 'إلغاء مفتاح API')}
        description={t('dashboard.apikeys.revoke_confirm', 'Are you sure you want to revoke this API key? Any applications relying on it will immediately fail.')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setRevokeTarget(null)}>إلغاء</Button>
          <Button variant="danger" size="sm" onClick={() => revokeTarget && void handleRevoke(revokeTarget.id)}>Revoke</Button>
        </div>
      </Modal>

      {loadError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300 flex items-center justify-between gap-3"><span>{loadError}</span><Button variant="outline" size="sm" onClick={() => void fetchKeys()}>إعادة المحاولة</Button></div>}

      {/* Keys Table */}
      {loading ? (
        <LoadingState message={t('dashboard.apikeys.loading', 'Fetching API credentials...')} />
      ) : keys.length === 0 ? (
        <EmptyState
          title={`${t('dashboard.apikeys.empty_title', 'لا توجد مفاتيح')}`}
          description={t('dashboard.apikeys.empty_desc', 'Generate an API key to begin authenticating checkout endpoints.')}
          actionText={t('dashboard.apikeys.create_key', 'إنشاء مفتاح')}
          onAction={() => setIsCreateModalOpen(true)}
          icon={<Key className="w-8 h-8 text-[#94A3B8]" />}
        />
      ) : (
        <div className="bg-[#0D1320] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-start border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 bg-[#080B12]/60 text-[11px] text-[#94A3B8] uppercase">
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.key_name', 'الاسم')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.secret_token', 'المفتاح')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.created', 'تاريخ الإنشاء')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.last_used', 'آخر استخدام')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.col_status', 'Status')}</th>
                <th className="py-3 px-4 text-end">{t('dashboard.apikeys.col_actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-bold text-white text-start">{k.name}</td>
                  <td className="py-3 px-4 text-[#22D3EE] select-all font-mono text-start" dir="ltr">
                    {k.key_prefix}...
                  </td>
                  <td className="py-3 px-4 text-[#94A3B8] text-start">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-[#94A3B8] text-start">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : t('dashboard.apikeys.never', 'Never')}
                  </td>
                  <td className="py-3 px-4 text-start">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        k.status === 'active'
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : 'bg-[#EF4444]/20 text-[#EF4444]'
                      }`}
                    >
                      {k.status === 'active' ? t('dashboard.apikeys.active', 'نشط') : t('dashboard.apikeys.revoked', 'ملغى')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-end">
                    {k.status === 'active' && (
                      <button
                        onClick={() => setRevokeTarget(k)}
                        className="text-[#94A3B8] hover:text-[#EF4444] p-1 rounded hover:bg-white/5 transition-colors"
                        title={t('dashboard.apikeys.revoke', 'إلغاء المفتاح')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={`${t('dashboard.apikeys.create_key', 'إنشاء مفتاح')}`}
        description={t('dashboard.apikeys.modal_desc', 'Provide a descriptive name to identify where this credential is used.')}
      >
        <div className="space-y-4 text-xs font-mono text-start">
          <div>
            <label className="text-[#94A3B8] block mb-1">{t('dashboard.apikeys.key_name', 'اسم المفتاح / الوصف')}</label>
            <input
              type="text"
              placeholder="e.g., Shopify Checkout Backend, Cloudflare Worker"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              className="w-full bg-[#080B12] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#22D3EE]"
            />
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              {t('dashboard.common.cancel', 'إلغاء')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreate}>
              {t('dashboard.apikeys.generate_btn', 'Generate Key')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
