/** ORDIUM Inventory: stock per location, deposits to carrier warehouses and the movement history. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Plus, Trash2, Link2, ChevronLeft, ChevronRight, Package, Warehouse, Store, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Pencil, PackagePlus } from 'lucide-react';
import type { CarrierAccount, CarrierWarehouse, Deposit, Movement, MovementPage, Product, StockRow, UnmappedProduct } from '../../lib/api/types';
import { inventoryApi } from '../../lib/api/inventory';
import { shippingApi } from '../../lib/api/shipping';
import { OrdiumApiError } from '../../lib/api/client';
import { Button } from '../common/Button';
import { EmptyState, LoadingState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { SUCCESS, WARNING, DANGER, MUTED } from './ShipmentStatusBadge';
import { shippingErrorMessage } from './shippingErrors';
import { useLanguage } from '../../i18n/LanguageContext';

const TABS = ['products', 'deposits', 'movements'] as const;
type Tab = typeof TABS[number];
type StockStatus = StockRow['status'];
const NEXT: Record<Deposit['status'], 'counting' | 'received' | null> = { in_transit: 'counting', counting: 'received', received: null };
const MERCHANT = 'merchant';
const inputCls = 'w-full bg-[var(--ordium-surface-raised)] border border-white/[0.12] rounded-xl px-4 py-3 min-h-11 text-sm text-white';
const selectCls = 'bg-[var(--ordium-surface)] border border-white/10 rounded-xl px-3 min-h-11 text-xs font-mono text-white';
const BADGES: Record<StockStatus, { icon: typeof Package; cls: string; fallback: string }> = {
  ok: { icon: CheckCircle2, cls: SUCCESS, fallback: 'متوفر' },
  low: { icon: AlertTriangle, cls: WARNING, fallback: 'مخزون منخفض' },
  out: { icon: XCircle, cls: DANGER, fallback: 'نافد' },
  merchant: { icon: Store, cls: MUTED, fallback: 'عندي' },
  unmapped: { icon: Link2, cls: WARNING, fallback: 'غير مربوط' },
};

interface Loc { key: string; name: string; accountId: string | null; warehouseId: string | null }
interface Line { sku: string; quantity: string }
interface ProductForm { id: string | null; name: string; sku: string; fulfillment: 'carrier' | 'merchant'; weight: string }
const emptyProduct: ProductForm = { id: null, name: '', sku: '', fulfillment: 'merchant', weight: '' };

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div><label htmlFor={id} className="block text-xs font-semibold text-[var(--ordium-muted)] mb-1.5">{label}</label>{children}</div>
);

export const InventoryView: React.FC = () => {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-DZ' : 'en-GB';
  const [tab, setTab] = useState<Tab>('products');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedProduct[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [accounts, setAccounts] = useState<CarrierAccount[]>([]);
  const [warehouses, setWarehouses] = useState<Array<CarrierWarehouse & { accountId: string }>>([]);
  const [movements, setMovements] = useState<MovementPage | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSku, setLinkSku] = useState<UnmappedProduct | null>(null);
  const [linkMode, setLinkMode] = useState<'existing' | 'new'>('existing');
  const [linkProductId, setLinkProductId] = useState('');
  const [linkAccount, setLinkAccount] = useState('');
  const [linkNewName, setLinkNewName] = useState('');
  const [linkFulfillment, setLinkFulfillment] = useState<'carrier' | 'merchant'>('carrier');
  const [depositOpen, setDepositOpen] = useState(false);
  const [depWarehouse, setDepWarehouse] = useState('');
  const [depRef, setDepRef] = useState('');
  const [depLines, setDepLines] = useState<Line[]>([{ sku: '', quantity: '' }]);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const notify = useCallback((type: ToastMessage['type'], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 6000);
  }, []);
  const errText = useCallback((err: unknown) => {
    const raw = (err as Partial<OrdiumApiError> | undefined)?.message || '';
    if (['sku_already_exists', 'sku_required', 'invalid_deposit_transition', 'store_id_required'].includes(raw)) return t(`inventory.errors.${raw}`, raw);
    return shippingErrorMessage(err, t);
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, p, u, d, c, m] = await Promise.all([
        inventoryApi.getStock(), inventoryApi.listProducts(), inventoryApi.listUnmapped(), inventoryApi.listDeposits(),
        shippingApi.listCarriers(), inventoryApi.listMovements({ page, limit: 20 }),
      ]);
      setStock(s); setProducts(p); setUnmapped(u); setDeposits(d); setAccounts(c.accounts); setMovements(m);
      const lists = await Promise.all(c.accounts.map(a => shippingApi.listWarehouses(a.id).then(ws => ws.map(w => ({ ...w, accountId: a.id }))).catch(() => [])));
      setWarehouses(lists.flat().filter(w => w.is_active));
    } catch (err) { setError(errText(err)); }
    finally { setLoading(false); }
  }, [page, errText]);
  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    try { await inventoryApi.getStock({ refresh: true }); notify('success', t('inventory.sync_done', 'اكتملت مزامنة المخزون')); await load(); }
    catch (err) { notify('error', t('inventory.sync_failed', 'تعذرت المزامنة'), errText(err)); }
    finally { setSyncing(false); }
  };

  const locs: Loc[] = useMemo(() => [
    ...warehouses.map(w => ({ key: w.id, name: w.name, accountId: w.accountId, warehouseId: w.id })),
    { key: MERCHANT, name: t('inventory.with_me', 'عندي'), accountId: null, warehouseId: null },
  ], [warehouses, t]);
  const locTotals = useMemo(() => {
    const totals: Record<string, { onHand: number; reserved: number }> = {};
    for (const row of stock) for (const l of row.locations) {
      const key = l.warehouse_id ?? MERCHANT;
      const cur = totals[key] ?? { onHand: 0, reserved: 0 };
      totals[key] = { onHand: cur.onHand + l.on_hand, reserved: cur.reserved + l.reserved };
    }
    return totals;
  }, [stock]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter(r => (!q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))
      && (location === 'all' || r.locations.some(l => (l.warehouse_id ?? MERCHANT) === location)));
  }, [stock, query, location]);
  const nameOf = useMemo(() => Object.fromEntries(products.map(p => [p.id, p.name])), [products]);
  const whName = useCallback((id: string | null) => id ? (warehouses.find(w => w.id === id)?.name ?? '—') : t('inventory.with_me', 'عندي'), [warehouses, t]);
  const num = (n: number) => n.toLocaleString(locale);
  const when = (v: string) => new Date(v).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  const advance = async (d: Deposit) => {
    const next = NEXT[d.status]; if (!next) return;
    setBusy(d.id);
    try { await inventoryApi.setDepositStatus(d.id, next); notify('success', t('inventory.deposit_updated', 'تم تحديث حالة الإيداع')); await load(); }
    catch (err) { notify('error', t('inventory.deposit_failed', 'تعذر تحديث الإيداع'), errText(err)); }
    finally { setBusy(null); }
  };

  const openLink = (u: UnmappedProduct) => {
    setLinkSku(u); setLinkMode('existing'); setLinkProductId(products[0]?.id ?? ''); setLinkAccount(accounts[0]?.id ?? '');
    setLinkNewName(u.name); setLinkFulfillment('carrier'); setFormError(null); setLinkOpen(true);
  };
  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSku?.sku) return;
    setSaving(true); setFormError(null);
    try {
      let productId = linkProductId;
      if (linkMode === 'new') productId = (await inventoryApi.createProduct({ sku: linkSku.sku, name: linkNewName.trim(), fulfillment: linkFulfillment })).id;
      if (linkMode === 'existing' || linkFulfillment === 'carrier') {
        if (!productId || !linkAccount) { setFormError(t('inventory.link.missing', 'اختر المنتج وحساب شركة التوصيل')); return; }
        await inventoryApi.linkProduct(productId, { carrier_account_id: linkAccount, external_product_id: linkSku.sku });
      }
      notify('success', t('inventory.link.done', 'تم ربط المنتج'));
      setLinkOpen(false); await load();
    } catch (err) { setFormError(errText(err)); }
    finally { setSaving(false); }
  };

  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    setSaving(true); setFormError(null);
    const weight = form.weight.trim() === '' ? null : Math.max(0, Math.round(Number(form.weight)));
    try {
      if (form.id) await inventoryApi.updateProduct(form.id, { name: form.name.trim(), fulfillment: form.fulfillment, weight_grams: weight });
      else await inventoryApi.createProduct({ sku: form.sku.trim(), name: form.name.trim(), fulfillment: form.fulfillment, weight_grams: weight });
      notify('success', t('inventory.product.saved', 'تم حفظ المنتج'));
      setForm(null); await load();
    } catch (err) { setFormError(errText(err)); }
    finally { setSaving(false); }
  };

  const openDeposit = () => { setDepWarehouse(warehouses[0]?.id ?? ''); setDepRef(''); setDepLines([{ sku: '', quantity: '' }]); setFormError(null); setDepositOpen(true); };
  const submitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wh = warehouses.find(w => w.id === depWarehouse);
    const lines = depLines.map(l => ({ sku: l.sku.trim(), quantity: Math.floor(Number(l.quantity)) })).filter(l => l.sku && l.quantity > 0);
    if (!wh || lines.length === 0) { setFormError(t('inventory.deposit.invalid', 'اختر مستودعًا وأضف سطرًا واحدًا على الأقل بكمية صحيحة')); return; }
    setSaving(true); setFormError(null);
    try {
      await inventoryApi.createDeposit({ carrier_account_id: wh.accountId, warehouse_id: wh.id, reference: depRef.trim() || `DEP-${Date.now().toString(36).toUpperCase()}`, lines });
      notify('success', t('inventory.deposit.created', 'سُجّل الإيداع'));
      setDepositOpen(false); setTab('deposits'); await load();
    } catch (err) { setFormError(errText(err)); }
    finally { setSaving(false); }
  };
  const setLine = (i: number, patch: Partial<Line>) => setDepLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const Badge = ({ status }: { status: StockStatus }) => {
    const b = BADGES[status] ?? BADGES.ok; const Icon = b.icon;
    return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border whitespace-nowrap ${b.cls}`}><Icon className="w-3.5 h-3.5" aria-hidden="true" /><span>{t(`inventory.status.${status}`, b.fallback)}</span></span>;
  };
  const formErr = formError && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-white">{formError}</div>;

  const hasProducts = stock.length > 0;
  const showProductsEmpty = !loading && !error && tab === 'products' && filtered.length === 0;

  return (
    <div className="dashboard-content space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white">{t('inventory.title', 'المخزون')}</h2>
          <p className="text-sm text-[var(--ordium-muted)] mt-1 leading-relaxed max-w-2xl">{t('inventory.description', 'كميات منتجاتك في مستودعات شركات التوصيل وعندك، وحركة كل قطعة.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="md" isLoading={syncing} onClick={() => void sync()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>{t('inventory.sync_now', 'مزامنة الآن')}</Button>
          <Button variant="outline" size="md" onClick={() => { setForm({ ...emptyProduct }); setFormError(null); }} leftIcon={<PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />}>{t('inventory.add_product', 'إضافة منتج')}</Button>
          <Button variant="primary" size="md" disabled={warehouses.length === 0} onClick={openDeposit} leftIcon={<Warehouse className="w-3.5 h-3.5" aria-hidden="true" />}>{t('inventory.deposit_to_warehouse', 'إيداع في مستودع')}</Button>
        </div>
      </div>

      {unmapped.length > 0 && (
        <div role="alert" className="rounded-2xl border border-[var(--ordium-warning)]/30 bg-[var(--ordium-warning)]/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[var(--ordium-warning)] shrink-0" aria-hidden="true" />{t('inventory.unmapped_alert', 'منتجات في طلباتك غير مربوطة بالمخزون')}: <span className="font-bold tabular-nums">{num(unmapped.length)}</span></p>
          <Button variant="outline" size="md" onClick={() => openLink(unmapped[0])} leftIcon={<Link2 className="w-3.5 h-3.5" aria-hidden="true" />}>{t('inventory.link_products', 'ربط المنتجات')}</Button>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h3 className="text-sm font-semibold text-white">{t('inventory.load_error', 'تعذر تحميل المخزون')}</h3><p className="text-xs text-[var(--ordium-muted)] mt-2">{error}</p>
          <Button className="mt-4" variant="outline" size="md" onClick={() => void load()}>{t('common.retry', 'إعادة المحاولة')}</Button>
        </div>
      ) : loading && !movements ? <LoadingState message={t('inventory.loading', 'جارٍ تحميل المخزون…')} /> : (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" aria-label={t('inventory.locations', 'المواقع')} role="list">
          {locs.map(l => {
            const tot = locTotals[l.key] ?? { onHand: 0, reserved: 0 };
            const Icon = l.key === MERCHANT ? Store : Warehouse;
            return (
              <div role="listitem" key={l.key} className="dashboard-panel p-4">
                <div className="flex items-center gap-2 text-xs text-[var(--ordium-muted)]"><Icon className="w-4 h-4 text-[var(--ordium-signal)]" aria-hidden="true" /><span className="truncate" dir="auto">{l.name}</span></div>
                <p className="text-2xl font-bold text-white tabular-nums mt-2">{num(tot.onHand)}</p>
                <p className="text-xs text-[var(--ordium-subtle)] mt-0.5">{t('inventory.reserved', 'محجوز')}: <span className="tabular-nums">{num(tot.reserved)}</span></p>
              </div>
            );
          })}
        </div>

        <div role="tablist" aria-label={t('inventory.tabs_label', 'أقسام المخزون')} className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[var(--ordium-surface)] p-1 w-full md:w-fit">
          {TABS.map(key => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 px-3.5 rounded-lg text-sm font-semibold ${tab === key ? 'bg-[var(--ordium-surface-raised)] text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>{t(`inventory.tab.${key}`, key)}</button>
          ))}
        </div>

        {tab === 'products' && hasProducts && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ordium-subtle)]" aria-hidden="true" />
              <input aria-label={t('inventory.search_label', 'البحث في المنتجات')} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('inventory.search_placeholder', 'ابحث باسم المنتج أو SKU…')} className={`${inputCls} ps-10`} />
            </div>
            <select aria-label={t('inventory.location_filter', 'الموقع')} value={location} onChange={e => setLocation(e.target.value)} className={selectCls}>
              <option value="all">{t('inventory.all_locations', 'كل المواقع')}</option>
              {locs.map(l => <option key={l.key} value={l.key}>{l.name}</option>)}
            </select>
          </div>
        )}

        {tab === 'products' && (showProductsEmpty ? (
          <EmptyState icon={<Package className="w-8 h-8" />} title={hasProducts ? t('inventory.empty.no_match', 'لا منتجات مطابقة') : t('inventory.empty.title', 'لا منتجات بعد')}
            description={hasProducts ? t('inventory.empty.no_match_desc', 'غيّر البحث أو الموقع.') : t('inventory.empty.desc', 'عند ربط شركة توصيل نستورد مخزونك منها تلقائيًا. أو أضف منتجًا تحتفظ به في متجرك.')}
            actionText={hasProducts ? undefined : t('inventory.add_product', 'إضافة منتج')} onAction={hasProducts ? undefined : () => { setForm({ ...emptyProduct }); setFormError(null); }} />
        ) : (
          <div className={`dashboard-panel overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <table className="ordium-stack-table w-full text-sm text-start">
              <thead><tr className="text-xs text-[var(--ordium-muted)]">
                <th scope="col" className="p-3 text-start">{t('inventory.col.product', 'المنتج')}</th>
                <th scope="col" className="p-3 text-start">{t('inventory.col.where', 'أين')}</th>
                <th scope="col" className="p-3 text-start">{t('inventory.col.available', 'متاح')}</th>
                <th scope="col" className="p-3 text-start">{t('inventory.col.reserved', 'محجوز')}</th>
                <th scope="col" className="p-3 text-start">{t('inventory.col.inbound', 'قادم')}</th>
                <th scope="col" className="p-3 text-start">{t('inventory.col.status', 'الحالة')}</th>
                <th scope="col" className="p-3"><span className="sr-only">{t('inventory.col.actions', 'إجراءات')}</span></th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(r => (
                  <tr key={r.product_id}>
                    <td data-label={t('inventory.col.product', 'المنتج')} className="p-3"><div className="font-semibold text-white" dir="auto">{r.name}</div><div className="text-xs font-mono text-[var(--ordium-subtle)]" dir="ltr">{r.sku}</div></td>
                    <td data-label={t('inventory.col.where', 'أين')} className="p-3"><div className="flex flex-wrap gap-1.5">{r.locations.length === 0 ? '—' : r.locations.map((l, i) => <span key={i} className={`text-xs px-2 py-0.5 rounded-md border ${MUTED}`}><span dir="auto">{whName(l.warehouse_id)}</span> <span className="font-mono tabular-nums">{num(l.on_hand)}</span></span>)}</div></td>
                    <td data-label={t('inventory.col.available', 'متاح')} className="p-3 font-bold text-white tabular-nums">{num(r.total_available)}</td>
                    <td data-label={t('inventory.col.reserved', 'محجوز')} className="p-3 tabular-nums text-[var(--ordium-muted)]">{num(r.total_reserved)}</td>
                    <td data-label={t('inventory.col.inbound', 'قادم')} className="p-3 tabular-nums text-[var(--ordium-muted)]">{num(r.total_inbound)}</td>
                    <td data-label={t('inventory.col.status', 'الحالة')} className="p-3"><Badge status={r.status} /></td>
                    <td className="p-3"><button type="button" aria-label={`${t('inventory.edit_product', 'تعديل المنتج')} ${r.name}`} onClick={() => { const p = products.find(x => x.id === r.product_id); if (p) { setForm({ id: p.id, name: p.name, sku: p.sku, fulfillment: p.fulfillment, weight: p.weight_grams == null ? '' : String(p.weight_grams) }); setFormError(null); } }} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-[var(--ordium-muted)] hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--ordium-signal)]"><Pencil className="w-4 h-4" aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === 'deposits' && (deposits.length === 0 ? (
          <EmptyState icon={<Warehouse className="w-8 h-8" />} title={t('inventory.deposits.empty_title', 'لا إيداعات بعد')} description={t('inventory.deposits.empty_desc', 'سجّل إيداعًا عندما ترسل بضاعة إلى مستودع شركة التوصيل.')} />
        ) : (
          <div className="dashboard-panel overflow-hidden"><ul className="divide-y divide-white/5">
            {deposits.map(d => {
              const next = NEXT[d.status];
              return (
                <li key={d.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3 text-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-sm font-semibold text-white font-mono" dir="ltr">{d.reference}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${d.status === 'received' ? SUCCESS : d.status === 'counting' ? WARNING : MUTED}`}>{t(`inventory.deposit_status.${d.status}`, d.status)}</span></div>
                    <p className="text-xs text-[var(--ordium-muted)] mt-1"><span dir="auto">{whName(d.warehouse_id)}</span> · {when(d.created_at)} · {d.lines.map(l => `${l.sku} ×${num(l.quantity)}`).join('، ')}</p>
                  </div>
                  {next && <Button variant="outline" size="md" isLoading={busy === d.id} onClick={() => void advance(d)} rightIcon={<ArrowRight className="w-3.5 h-3.5 rtl:-scale-x-100" aria-hidden="true" />}>{t(`inventory.mark_${next}`, next)}</Button>}
                </li>
              );
            })}
          </ul></div>
        ))}

        {tab === 'movements' && ((movements?.data.length ?? 0) === 0 ? (
          <EmptyState icon={<RefreshCw className="w-8 h-8" />} title={t('inventory.movements.empty_title', 'لا حركات بعد')} description={t('inventory.movements.empty_desc', 'تظهر هنا كل زيادة أو نقصان في المخزون.')} />
        ) : (
          <div className="dashboard-panel overflow-hidden">
            <ul className="divide-y divide-white/5">
              {movements!.data.map((m: Movement) => (
                <li key={m.id} className="p-4 flex items-center gap-4 text-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white" dir="auto">{nameOf[m.product_id] ?? '—'} <span className="text-[var(--ordium-muted)]">· {t(`inventory.reason.${m.reason}`, m.reason)}</span></p>
                    <p className="text-xs text-[var(--ordium-subtle)] mt-0.5"><span dir="auto">{whName(m.warehouse_id)}</span> · {when(m.occurred_at)}</p>
                  </div>
                  <span dir="ltr" className={`font-mono font-bold tabular-nums ${m.delta >= 0 ? 'text-[var(--ordium-success)]' : 'text-[var(--ordium-danger)]'}`}>{m.delta > 0 ? '+' : ''}{num(m.delta)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <Button variant="outline" size="md" disabled={page <= 1} onClick={() => setPage(p => p - 1)} leftIcon={<ChevronLeft aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('shipping.prev_page', 'السابق')}</Button>
              <span className="text-xs font-mono text-[var(--ordium-subtle)]">{page} / {movements?.pagination.total_pages ?? 1}</span>
              <Button variant="outline" size="md" disabled={page >= (movements?.pagination.total_pages ?? 1)} onClick={() => setPage(p => p + 1)} rightIcon={<ChevronRight aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />}>{t('shipping.next_page', 'التالي')}</Button>
            </div>
          </div>
        ))}
      </>)}

      <Modal isOpen={linkOpen} onClose={() => setLinkOpen(false)} title={t('inventory.link.title', 'ربط منتج غير مربوط')} description={t('inventory.link.desc', 'اربط المنتج الظاهر في الطلبات بمنتج من مخزونك أو أنشئ منتجًا جديدًا.')}>
        <form onSubmit={e => void submitLink(e)} className="space-y-4">
          <Field id="inv-link-sku" label={t('inventory.link.unmapped', 'المنتج غير المربوط')}>
            <select id="inv-link-sku" className={inputCls} value={linkSku?.sku ?? ''} onChange={e => { const u = unmapped.find(x => x.sku === e.target.value); if (u) { setLinkSku(u); setLinkNewName(u.name); } }}>
              {unmapped.map((u, i) => <option key={`${u.sku}-${i}`} value={u.sku ?? ''} disabled={!u.sku}>{u.name}{u.sku ? ` (${u.sku})` : ''}</option>)}
            </select>
          </Field>
          {!linkSku?.sku && <p className="text-xs text-[var(--ordium-warning)]">{t('inventory.link.no_sku', 'هذا المنتج بلا SKU في الطلب ولا يمكن ربطه من هنا.')}</p>}
          <div role="radiogroup" aria-label={t('inventory.link.mode', 'طريقة الربط')} className="flex gap-1 rounded-xl border border-white/10 bg-[var(--ordium-surface)] p-1">
            {(['existing', 'new'] as const).map(m => <button key={m} type="button" role="radio" aria-checked={linkMode === m} onClick={() => setLinkMode(m)} className={`flex-1 min-h-11 px-3 rounded-lg text-sm font-semibold ${linkMode === m ? 'bg-[var(--ordium-surface-raised)] text-white' : 'text-[var(--ordium-muted)] hover:text-white'}`}>{t(`inventory.link.mode_${m}`, m)}</button>)}
          </div>
          {linkMode === 'existing' ? (
            <Field id="inv-link-product" label={t('inventory.link.product', 'منتج من مخزونك')}>
              <select id="inv-link-product" className={inputCls} value={linkProductId} onChange={e => setLinkProductId(e.target.value)}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </Field>
          ) : (<>
            <Field id="inv-link-name" label={t('inventory.product.name', 'اسم المنتج')}><input id="inv-link-name" required className={inputCls} value={linkNewName} onChange={e => setLinkNewName(e.target.value)} dir="auto" /></Field>
            <Field id="inv-link-ful" label={t('inventory.product.fulfillment', 'مكان الحفظ')}>
              <select id="inv-link-ful" className={inputCls} value={linkFulfillment} onChange={e => setLinkFulfillment(e.target.value as 'carrier' | 'merchant')}>
                <option value="carrier">{t('inventory.fulfillment.carrier', 'عند شركة التوصيل')}</option><option value="merchant">{t('inventory.fulfillment.merchant', 'عندي')}</option>
              </select>
            </Field>
          </>)}
          {(linkMode === 'existing' || linkFulfillment === 'carrier') && (
            <Field id="inv-link-account" label={t('inventory.link.account', 'شركة التوصيل')}>
              <select id="inv-link-account" className={inputCls} value={linkAccount} onChange={e => setLinkAccount(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            </Field>
          )}
          {formErr}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setLinkOpen(false)}>{t('common.cancel', 'إلغاء')}</Button>
            <Button type="submit" variant="primary" size="md" isLoading={saving} disabled={!linkSku?.sku}>{t('inventory.link.submit', 'ربط')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={depositOpen} onClose={() => setDepositOpen(false)} title={t('inventory.deposit.title', 'إيداع في مستودع')} description={t('inventory.deposit.desc', 'سجّل البضاعة التي أرسلتها إلى مستودع شركة التوصيل.')}>
        <form onSubmit={e => void submitDeposit(e)} className="space-y-4">
          <Field id="inv-dep-wh" label={t('inventory.deposit.warehouse', 'المستودع')}>
            <select id="inv-dep-wh" className={inputCls} value={depWarehouse} onChange={e => setDepWarehouse(e.target.value)}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </Field>
          <Field id="inv-dep-ref" label={t('inventory.deposit.reference', 'المرجع (اختياري)')}><input id="inv-dep-ref" className={inputCls} value={depRef} onChange={e => setDepRef(e.target.value)} dir="ltr" autoComplete="off" /></Field>
          <fieldset className="space-y-2"><legend className="text-xs font-semibold text-[var(--ordium-muted)] mb-1.5">{t('inventory.deposit.lines', 'الأسطر')}</legend>
            {depLines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input list="inv-skus" aria-label={t('inventory.deposit.sku', 'SKU')} placeholder="SKU" className={`${inputCls} font-mono flex-1 min-w-0`} dir="ltr" value={l.sku} onChange={e => setLine(i, { sku: e.target.value })} />
                <input type="number" min={1} inputMode="numeric" aria-label={t('inventory.deposit.quantity', 'الكمية')} placeholder="0" className={`${inputCls} w-24 shrink-0`} dir="ltr" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} />
                <button type="button" disabled={depLines.length === 1} aria-label={t('inventory.deposit.remove_line', 'حذف السطر')} onClick={() => setDepLines(ls => ls.filter((_, idx) => idx !== i))} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-[var(--ordium-muted)] hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--ordium-signal)]"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
              </div>
            ))}
            <datalist id="inv-skus">{products.map(p => <option key={p.id} value={p.sku}>{p.name}</option>)}</datalist>
            <Button type="button" variant="outline" size="md" onClick={() => setDepLines(ls => [...ls, { sku: '', quantity: '' }])} leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}>{t('inventory.deposit.add_line', 'إضافة سطر')}</Button>
          </fieldset>
          {formErr}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setDepositOpen(false)}>{t('common.cancel', 'إلغاء')}</Button>
            <Button type="submit" variant="primary" size="md" isLoading={saving}>{t('inventory.deposit.submit', 'تسجيل الإيداع')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? t('inventory.product.edit_title', 'تعديل المنتج') : t('inventory.product.add_title', 'إضافة منتج')} description={t('inventory.product.desc', 'منتج تحتفظ به في متجرك أو تعدّل بياناته.')}>
        {form && <form onSubmit={e => void submitProduct(e)} className="space-y-4">
          <Field id="inv-p-name" label={t('inventory.product.name', 'اسم المنتج')}><input id="inv-p-name" required className={inputCls} dir="auto" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field id="inv-p-sku" label="SKU"><input id="inv-p-sku" required disabled={Boolean(form.id)} className={`${inputCls} font-mono disabled:opacity-60`} dir="ltr" autoComplete="off" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field id="inv-p-ful" label={t('inventory.product.fulfillment', 'مكان الحفظ')}>
            <select id="inv-p-ful" className={inputCls} value={form.fulfillment} onChange={e => setForm({ ...form, fulfillment: e.target.value as 'carrier' | 'merchant' })}>
              <option value="merchant">{t('inventory.fulfillment.merchant', 'عندي')}</option><option value="carrier">{t('inventory.fulfillment.carrier', 'عند شركة التوصيل')}</option>
            </select>
          </Field>
          <Field id="inv-p-weight" label={t('inventory.product.weight', 'الوزن بالغرام (اختياري)')}><input id="inv-p-weight" type="number" min={0} inputMode="numeric" className={inputCls} dir="ltr" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></Field>
          {formErr}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setForm(null)}>{t('common.cancel', 'إلغاء')}</Button>
            <Button type="submit" variant="primary" size="md" isLoading={saving}>{t('common.save', 'حفظ')}</Button>
          </div>
        </form>}
      </Modal>
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(x => x.id !== id))} />
    </div>
  );
};
