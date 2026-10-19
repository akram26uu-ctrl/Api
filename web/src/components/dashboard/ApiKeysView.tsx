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
  const [newScopes, setNewScopes] = useState<string[]>(['orders:read', 'orders:write', 'outcomes:write']);
  const [isCreating, setIsCreating] = useState(false);
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
    const name = newKeyName.trim();
    if (!name || !newScopes.length || isCreating) return;
    setIsCreating(true);
    try {
      const created = await ordiumClient.createApiKey(name, environment, newScopes);
      setKeys(prev => [created, ...prev]);
      setCreatedSecret(created.secret || 'ord_key_secret_revealed_once');
      setIsCreateModalOpen(false);
      setNewKeyName('');
      setNewScopes(['orders:read', 'orders:write', 'outcomes:write']);
    } catch (err: any) {
      setErrorMessage(`Failed to create API key: ${err.message}`);
    } finally {
      setIsCreating(false);
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
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <section className="dashboard-page-heading">
        <div className="relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#9d96ff] uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('dashboard.apikeys.eyebrow', 'إدارة الوصول')}</span>
            <span className="rounded-full border border-[#48D6A0]/25 bg-[#48D6A0]/10 px-2.5 py-1 text-[#48D6A0] tracking-normal">
              {environment === 'live' ? t('dashboard.apikeys.live_badge', 'LIVE · الإنتاج') : t('dashboard.apikeys.test_badge', 'TEST · الاختبار')}
            </span>
          </div>
          <h2 className="mt-3 flex items-center gap-3">
            <Key className="h-6 w-6 shrink-0 text-[#52D9E8]" />
            {t('dashboard.apikeys.title', 'مفاتيح API')}
          </h2>
          <p className="mt-2 text-sm">
            {t('dashboard.apikeys.subtitle', 'أنشئ بيانات اعتماد واضحة الاسم وبأقل صلاحيات لازمة، وراجع استخدامها وألغِ أي مفتاح لم تعد تحتاج إليه.')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#C7D2E0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#52D9E8]" />
              {loading ? '—' : keys.length.toLocaleString()} {t('dashboard.apikeys.summary_total', 'مفتاح إجمالًا')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-[#48D6A0]/20 bg-[#48D6A0]/[0.06] px-3 py-2 text-[#8AE7BD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#48D6A0]" />
              {loading ? '—' : keys.filter(key => key.status === 'active').length.toLocaleString()} {t('dashboard.apikeys.summary_active', 'مفعّل')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[#A5B1C3]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('dashboard.apikeys.summary_scoped', 'صلاحيات قابلة للتحديد')}
            </span>
          </div>
        </div>
        <div className="relative z-10 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('dashboard.apikeys.create_key', 'إنشاء مفتاح')}
          </Button>
        </div>
      </section>

      {/* One-Time Secret Reveal Modal */}
      <Modal
        isOpen={Boolean(createdSecret)}
        onClose={() => setCreatedSecret(null)}
        title={t('dashboard.apikeys.secret_token', 'تم إنشاء مفتاح API')}
        description={t('dashboard.apikeys.secret_modal_desc', 'Please copy your secret key right now. For security purposes, you will never see it again.')}
      >
        <div className="space-y-4 text-xs font-mono text-start">
          <div className="p-3.5 bg-[#080B12] border border-[#43D9E8]/30 rounded-xl text-[#67E8F9] font-bold break-all select-all flex items-center justify-between gap-3" dir="ltr">
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
        <div className="dashboard-panel overflow-hidden">
          <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-start border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#101827] text-[11px] text-[#A1AEC1] uppercase">
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.key_name', 'الاسم')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.secret_token', 'المفتاح')}</th>
                <th className="py-3 px-4 text-start">{t('dashboard.apikeys.scopes', 'الصلاحيات')}</th>
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
                  <td className="py-3 px-4 text-start">
                    <div className="flex min-w-[160px] max-w-[280px] flex-wrap gap-1.5">
                      {(k.scopes || []).map(scope => (
                        <span key={scope} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-[#B9C6D7]" dir="ltr">{scope}</span>
                      ))}
                    </div>
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
          </table></div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('dashboard.apikeys.create_modal_title', 'إنشاء مفتاح API جديد')}
        description={t('dashboard.apikeys.modal_desc', 'سمِّ المفتاح وحدد الصلاحيات التي يحتاجها التكامل فقط. يمكنك إلغاء المفتاح لاحقًا.')}
        maxWidth="xl"
      >
        <form
          className="space-y-5 text-start"
          onSubmit={event => { event.preventDefault(); void handleCreate(); }}
        >
          <div className="rounded-xl border border-[#52D9E8]/15 bg-[#52D9E8]/[0.045] p-3.5 text-sm leading-relaxed text-[#B8C7D8]">
            <div className="mb-1.5 flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#52D9E8]" />
              {t('dashboard.apikeys.least_privilege_title', 'اختر أقل صلاحيات لازمة')}
            </div>
            {t('dashboard.apikeys.least_privilege_desc', 'لا تمنح المفتاح صلاحيات إدارة المفاتيح أو Webhooks إلا إذا كان التكامل يحتاجها فعلًا.')}
          </div>

          <div>
            <label htmlFor="ordium-api-key-name" className="mb-2 block text-sm font-semibold text-[#E6EDF6]">
              {t('dashboard.apikeys.key_name', 'اسم المفتاح / الوصف')}
            </label>
            <input
              id="ordium-api-key-name"
              name="keyName"
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('dashboard.apikeys.name_placeholder', 'مثال: تكامل متجر Shopify')}
              value={newKeyName}
              onChange={event => setNewKeyName(event.target.value)}
              className="w-full min-h-12 rounded-xl border border-white/10 bg-[#080B12] px-4 py-3 text-sm text-white placeholder:text-[#718096] focus:outline-none focus:border-[#52D9E8] focus:ring-2 focus:ring-[#52D9E8]/15"
              dir={isRTL ? 'rtl' : 'auto'}
            />
            <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-[#718096]">
              <span>{t('dashboard.apikeys.name_hint', 'استخدم اسمًا يوضح مكان استخدام هذا المفتاح.')}</span>
              <span className="shrink-0 tabular-nums">{newKeyName.length}/100</span>
            </div>
          </div>

          <fieldset className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-semibold text-[#E6EDF6]">{t('dashboard.apikeys.scopes', 'صلاحيات المفتاح')}</legend>
              <span className="text-[11px] text-[#A5B1C3]">{newScopes.length} {t('dashboard.apikeys.selected_scopes', 'محددة')}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { id: 'orders:read', label: 'قراءة الطلبات', desc: 'عرض الطلبات وتفاصيلها' },
                { id: 'orders:write', label: 'إرسال الطلبات', desc: 'إنشاء طلبات للتقييم' },
                { id: 'outcomes:write', label: 'تحديث النتائج', desc: 'إرسال نتيجة التأكيد أو التسليم' },
                { id: 'metrics:read', label: 'قراءة المؤشرات', desc: 'الوصول إلى ملخص الأداء' },
                { id: 'risk_profile:read', label: 'قراءة ملف المخاطر', desc: 'عرض إعدادات ملف المخاطر' },
                { id: 'risk_profile:write', label: 'تعديل ملف المخاطر', desc: 'تغيير إعدادات ملف المخاطر' },
                { id: 'risk_features:read', label: 'قراءة إشارات المخاطر', desc: 'الاطلاع على ميزات التقييم' },
                { id: 'webhooks:manage', label: 'إدارة Webhooks', desc: 'إنشاء وإدارة نقاط الإشعار' },
                { id: 'keys:manage', label: 'إدارة المفاتيح', desc: 'إنشاء المفاتيح وإلغاؤها' },
                { id: 'audit:read', label: 'قراءة سجل التدقيق', desc: 'عرض أنشطة التدقيق' }
              ].map(scope => {
                const checked = newScopes.includes(scope.id);
                return (
                  <label key={scope.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-[#786BFF]/45 bg-[#786BFF]/[0.09]' : 'border-white/[0.09] bg-black/10 hover:border-white/20'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={event => setNewScopes(prev => event.target.checked ? [...prev, scope.id] : prev.filter(item => item !== scope.id))}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-[#080B12] text-[#786BFF] focus:ring-2 focus:ring-[#52D9E8]/40"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#E6EDF6]">{scope.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#8D9AAF]">{scope.desc}</span>
                      <code className="mt-1.5 inline-block text-[10px] text-[#52D9E8]" dir="ltr">{scope.id}</code>
                    </span>
                  </label>
                );
              })}
            </div>
            {!newScopes.length && (
              <p className="text-xs text-amber-300" role="alert">{t('dashboard.apikeys.scope_required', 'اختر صلاحية واحدة على الأقل.')}</p>
            )}
          </fieldset>

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="md" onClick={() => setIsCreateModalOpen(false)}>
              {t('dashboard.common.cancel', 'إلغاء')}
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isCreating} disabled={!newKeyName.trim() || newKeyName.trim().length < 2 || !newScopes.length}>
              {t('dashboard.apikeys.generate_btn', 'إنشاء المفتاح')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
