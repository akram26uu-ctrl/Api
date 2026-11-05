/**
 * ORDIUM REST API reference. Request execution is intentionally handled by the dedicated Simulator.
 * Contract details (key prefix, signature header, payload canonicalization) mirror the API service.
 */

import React, { useState } from 'react';
import { Shield, Code, ListTree, Info } from 'lucide-react';
import { CodeBlock } from '../common/CodeBlock';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from '../marketing/Bidi';

type Method = 'GET' | 'POST' | 'PATCH';
interface Endpoint { id: string; method: Method; path: string; title: string; scope?: string }

const METHOD_STYLE: Record<Method, string> = {
  GET: 'text-[#48D6A0] bg-[#48D6A0]/10 border-[#48D6A0]/25',
  POST: 'text-[#52D9E8] bg-[#52D9E8]/10 border-[#52D9E8]/25',
  PATCH: 'text-[#F5C465] bg-[#F5C465]/10 border-[#F5C465]/25',
};

export const DocsPage: React.FC = () => {
  const { t, isRTL } = useLanguage();
  // /developers shows this reference under the developer section's h1, so the title steps down a level.
  const PageTitle = typeof window !== 'undefined' && window.location.pathname === '/developers' ? 'h2' : 'h1';
  const [activeEndpoint, setActiveEndpoint] = useState('create_order');

  const endpointsList: Endpoint[] = [
    { id: 'create_order', method: 'POST', path: '/api/v1/orders', title: t('pages.docs.ep.create_order', 'Create & evaluate order'), scope: 'orders:write' },
    { id: 'get_orders', method: 'GET', path: '/api/v1/orders', title: t('pages.docs.ep.get_orders', 'List orders'), scope: 'orders:read' },
    { id: 'get_order', method: 'GET', path: '/api/v1/orders/{id}', title: t('pages.docs.ep.get_order', 'Retrieve order & risk'), scope: 'orders:read' },
    { id: 'confirmation_metrics', method: 'GET', path: '/api/v1/order-confirmations/metrics', title: t('pages.docs.ep.confirmation_metrics', 'Order confirmation metrics'), scope: 'orders:read' },
    { id: 'confirmation_history', method: 'GET', path: '/api/v1/orders/{id}/confirmation-attempts', title: t('pages.docs.ep.confirmation_history', 'Confirmation history'), scope: 'orders:read' },
    { id: 'confirmation_record', method: 'POST', path: '/api/v1/orders/{id}/confirmation-attempts', title: t('pages.docs.ep.confirmation_record', 'Record confirmation attempt'), scope: 'orders:write' },
    { id: 'order_outcome', method: 'POST', path: '/api/v1/orders/{id}/outcome', title: t('pages.docs.ep.order_outcome', 'Record order outcome') },
    { id: 'risk_profile_get', method: 'GET', path: '/api/v1/risk-profile', title: t('pages.docs.ep.risk_profile_get', 'Read risk profile') },
    { id: 'risk_profile_patch', method: 'PATCH', path: '/api/v1/risk-profile', title: t('pages.docs.ep.risk_profile_patch', 'Update risk profile') },
    { id: 'risk_metrics', method: 'GET', path: '/api/v1/metrics/summary', title: t('pages.docs.ep.risk_metrics', 'Risk metrics summary') },
    { id: 'risk_performance', method: 'GET', path: '/api/v1/metrics/risk-performance', title: t('pages.docs.ep.risk_performance', 'Risk performance') },
    { id: 'risk_calibration', method: 'GET', path: '/api/v1/metrics/risk-calibration', title: t('pages.docs.ep.risk_calibration', 'Risk calibration') },
    { id: 'risk_attribution', method: 'GET', path: '/api/v1/metrics/risk-attribution', title: t('pages.docs.ep.risk_attribution', 'Risk attribution') },
    { id: 'risk_backtest', method: 'GET', path: '/api/v1/metrics/risk-backtest', title: t('pages.docs.ep.risk_backtest', 'Risk backtest') },
    { id: 'risk_quality', method: 'GET', path: '/api/v1/metrics/risk-quality', title: t('pages.docs.ep.risk_quality', 'Risk quality') },
    { id: 'identity_graph', method: 'GET', path: '/api/v1/identity-graph', title: t('pages.docs.ep.identity_graph', 'Identity graph') },
    { id: 'risk_features', method: 'GET', path: '/api/v1/risk-features', title: t('pages.docs.ep.risk_features', 'Risk feature registry') },
    { id: 'api_keys', method: 'GET', path: '/api/v1/api-keys', title: t('pages.docs.ep.api_keys', 'List API keys') },
    { id: 'api_key_create', method: 'POST', path: '/api/v1/api-keys', title: t('pages.docs.ep.api_key_create', 'Create API key') },
    { id: 'webhooks', method: 'POST', path: '/api/v1/webhooks', title: t('pages.docs.ep.webhooks', 'Create webhook subscription') },
    { id: 'webhook_list', method: 'GET', path: '/api/v1/webhooks', title: t('pages.docs.ep.webhook_list', 'List webhooks') },
    { id: 'notifications', method: 'GET', path: '/api/v1/notifications', title: t('pages.docs.ep.notifications', 'List notifications') },
    { id: 'audit', method: 'GET', path: '/api/v1/audit-logs', title: t('pages.docs.ep.audit', 'Audit log') },
  ];
  const active = endpointsList.find(e => e.id === activeEndpoint) ?? endpointsList[0];

  const statusCodes = [
    { code: '200 / 201', tone: 'text-[#48D6A0]', desc: t('pages.docs.status_ok', 'Request succeeded; 201 when an order is created and evaluated') },
    { code: '401', tone: 'text-[#FB7185]', desc: t('pages.docs.status_401', 'Missing, invalid or revoked API key') },
    { code: '403', tone: 'text-[#FB7185]', desc: t('pages.docs.status_403', 'The key lacks the scope required by this route') },
    { code: '409', tone: 'text-[#F5C465]', desc: t('pages.docs.status_409', 'The request conflicts with the current state of the resource') },
    { code: '422', tone: 'text-[#F5C465]', desc: t('pages.docs.status_422', 'Validation failed, or an Idempotency-Key was reused with a different body') },
    { code: '429', tone: 'text-[#F5C465]', desc: t('pages.docs.status_429', 'Rate limit or usage quota exceeded; retry later') },
  ];

  const webhookVerificationCode = `import crypto from 'node:crypto';

// Express example: read the RAW body (do not re-serialize the parsed JSON).
// app.post('/webhooks/ordium', express.raw({ type: 'application/json' }), handler)

// Header format: X-ORDIUM-Signature: t=<unix_timestamp>,v1=<hex_hmac_sha256>
export function verifyOrdiumWebhook(rawBody: Buffer, signatureHeader: string, webhookSecret: string): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => part.trim().split('=', 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;

  // Replay protection: reject timestamps older than 5 minutes.
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(\`\${timestamp}.\${rawBody.toString('utf8')}\`)
    .digest('hex');

  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

  return (
    <div className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-10 border-b border-white/[0.08] pb-8 space-y-4">
          <PageTitle className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight rtl:tracking-normal">{t('pages.docs.title', 'Developer API Reference')}</PageTitle>
          <p className="text-base text-[#A5B1C3] max-w-[68ch] leading-relaxed">
            {bidiIsolate(t('pages.docs.subtitle', 'Integrate order-risk evaluation and manual order confirmation through an authenticated REST API with store-scoped credentials, auditable contact attempts, confirmation metrics, and signed webhooks.'), isRTL)}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
            <nav aria-labelledby="docs-endpoints-heading">
              <h2 id="docs-endpoints-heading" className="flex items-center gap-2 text-sm font-semibold text-white">
                <ListTree aria-hidden="true" className="w-4 h-4 text-[#52D9E8]" />
                {t('pages.docs.endpoints', 'API endpoints')}
              </h2>
              <ul className="mt-3 space-y-1 max-h-[26rem] lg:max-h-[34rem] overflow-y-auto pe-1" dir="ltr">
                {endpointsList.map(ep => {
                  const isActive = active.id === ep.id;
                  return (
                    <li key={ep.id}>
                      <button
                        type="button"
                        onClick={() => setActiveEndpoint(ep.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`w-full min-h-10 text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-colors flex items-center gap-2 ${
                          isActive ? 'bg-[#0D1320] text-white border border-[#22D3EE]/40' : 'text-[#A5B1C3] border border-transparent hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className={`shrink-0 w-12 text-center rounded border px-1 py-0.5 text-xs font-bold ${METHOD_STYLE[ep.method]}`}>{ep.method}</span>
                        <span className="truncate">{ep.path}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <section className="ordium-card p-4 space-y-3" aria-labelledby="docs-auth-heading">
              <h2 id="docs-auth-heading" className="font-semibold text-sm text-white flex items-center gap-2">
                <Shield aria-hidden="true" className="w-4 h-4 text-[#52D9E8]" />
                {t('pages.docs.auth_title', 'Authentication')}
              </h2>
              <p className="text-sm text-[#A5B1C3] leading-relaxed">{bidiIsolate(t('pages.docs.auth_desc', 'Send your store API key as a Bearer token in the Authorization header on every request. Keys start with ordium_live_ or ordium_test_.'), isRTL)}</p>
              <code dir="ltr" className="block font-mono text-xs p-2.5 rounded-lg bg-black/40 text-[#52D9E8] select-all break-all">Authorization: Bearer ordium_live_...</code>
            </section>

            <section className="ordium-card p-4 space-y-2" aria-labelledby="docs-headers-heading">
              <h2 id="docs-headers-heading" className="font-semibold text-sm text-white">{t('pages.docs.headers_title', 'Standard headers')}</h2>
              <dl dir="ltr" className="font-mono text-xs space-y-1.5 text-[#A5B1C3]">
                <div><dt className="inline text-white">Content-Type: </dt><dd className="inline">application/json</dd></div>
                <div><dt className="inline text-white">Idempotency-Key: </dt><dd className="inline">&lt;uuid&gt; <span className="text-[var(--ordium-subtle)]">(optional, POST /orders)</span></dd></div>
                <div><dt className="inline text-white">Accept: </dt><dd className="inline">application/json</dd></div>
              </dl>
            </section>
          </aside>

          <div className="lg:col-span-8 xl:col-span-9 space-y-8">
            <section className="ordium-card p-5 sm:p-6 space-y-6" aria-labelledby="docs-endpoint-title">
              <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-white/[0.06]" dir="ltr">
                <span className={`px-2.5 py-1 rounded-md border font-mono font-bold text-sm ${METHOD_STYLE[active.method]}`}>{active.method}</span>
                <code className="text-white text-sm sm:text-base font-mono font-semibold break-all">{active.path}</code>
              </div>

              <div className="space-y-3">
                <h2 id="docs-endpoint-title" className="text-lg font-bold text-white">{active.title}</h2>
                {active.scope && (
                  <p className="text-sm text-[#A5B1C3]">
                    {t('pages.docs.required_scope', 'Required scope:')}{' '}
                    <code dir="ltr" className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-[#52D9E8]">{active.scope}</code>
                  </p>
                )}
                <p className="flex items-start gap-2 text-sm text-[#A5B1C3] leading-relaxed">
                  <Info aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-[#52D9E8]" />
                  <span className="max-w-[68ch]">{bidiIsolate(t('mkt.docs.general_note', 'كل البيانات محصورة بحسابك وبيئتك والمتجر المحدد. تُضبط حدود الطلبات من إعدادات API. التأكيد اليدوي يسجل ما يقوم به فريقك؛ والتأكيد التلقائي عبر واتساب يُرسل رسالة واحدة من رقم ORDIUM بعد تفعيله.'), isRTL)}</span>
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">{t('pages.docs.status_title', 'Expected response codes')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {statusCodes.map(item => (
                    <div key={item.code} className="py-2.5 border-t border-white/[0.06]">
                      <span dir="ltr" className={`font-mono font-bold text-sm ${item.tone}`}>{item.code}</span>
                      <p className="text-sm text-[#A5B1C3] mt-1 leading-relaxed">{bidiIsolate(item.desc, isRTL)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="ordium-card p-5 sm:p-6 space-y-4" aria-labelledby="docs-webhook-heading">
              <div className="flex items-center gap-2">
                <Code aria-hidden="true" className="w-4 h-4 text-[#958AFF]" />
                <h2 id="docs-webhook-heading" className="text-base font-bold text-white">{bidiIsolate(t('pages.docs.webhook_title', 'Webhook signature verification (HMAC-SHA256)'), isRTL)}</h2>
              </div>
              <p className="text-sm text-[#A5B1C3] leading-relaxed max-w-[68ch]">
                {bidiIsolate(t('pages.docs.webhook_desc', 'ORDIUM signs every webhook with your endpoint secret and sends the signature in the X-ORDIUM-Signature header as t=<timestamp>,v1=<signature>. The signed string is the timestamp, a dot, and the exact request body. Verify it against the raw body before trusting the event.'), isRTL)}
              </p>
              <ul dir="ltr" className="flex flex-wrap gap-2 text-xs font-mono">
                {['X-ORDIUM-Signature', 'X-ORDIUM-Event', 'X-ORDIUM-Event-ID', 'X-ORDIUM-Delivery-ID'].map(header => (
                  <li key={header} className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-[#C7D0DD]">{header}</li>
                ))}
              </ul>
              <CodeBlock code={webhookVerificationCode} language="typescript" title={t('pages.docs.webhook_code_title', 'Node.js webhook verifier')} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
