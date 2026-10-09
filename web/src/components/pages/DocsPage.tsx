/**
 * ORDIUM REST API reference. Request execution is intentionally handled by the dedicated Simulator.
 */

import React, { useState } from 'react';
import { Terminal, Shield, Code } from 'lucide-react';
import { CodeBlock } from '../common/CodeBlock';

export const DocsPage: React.FC = () => {
  const [activeEndpoint, setActiveEndpoint] = useState('create_order');

  const endpointsList = [
    { id: 'create_order', method: 'POST', path: '/api/v1/orders', title: 'Create & Ingest Order' },
    { id: 'get_orders', method: 'GET', path: '/api/v1/orders', title: 'List Orders' },
    { id: 'get_order', method: 'GET', path: '/api/v1/orders/{id}', title: 'Retrieve Order & Risk' },
    { id: 'confirmation_metrics', method: 'GET', path: '/api/v1/order-confirmations/metrics', title: 'Order Confirmation Metrics' },
    { id: 'confirmation_history', method: 'GET', path: '/api/v1/orders/{id}/confirmation-attempts', title: 'Confirmation History' },
    { id: 'confirmation_record', method: 'POST', path: '/api/v1/orders/{id}/confirmation-attempts', title: 'Record Confirmation Attempt' },
    { id: 'order_outcome', method: 'POST', path: '/api/v1/orders/{id}/outcome', title: 'Record Order Outcome' },
    { id: 'risk_profile_get', method: 'GET', path: '/api/v1/risk-profile', title: 'Read Risk Profile' },
    { id: 'risk_profile_patch', method: 'PATCH', path: '/api/v1/risk-profile', title: 'Update Risk Profile' },
    { id: 'risk_metrics', method: 'GET', path: '/api/v1/metrics/summary', title: 'Risk Metrics Summary' },
    { id: 'risk_performance', method: 'GET', path: '/api/v1/metrics/risk-performance', title: 'Risk Performance' },
    { id: 'risk_calibration', method: 'GET', path: '/api/v1/metrics/risk-calibration', title: 'Risk Calibration' },
    { id: 'risk_attribution', method: 'GET', path: '/api/v1/metrics/risk-attribution', title: 'Risk Attribution' },
    { id: 'risk_backtest', method: 'GET', path: '/api/v1/metrics/risk-backtest', title: 'Risk Backtest' },
    { id: 'risk_quality', method: 'GET', path: '/api/v1/metrics/risk-quality', title: 'Risk Quality' },
    { id: 'identity_graph', method: 'GET', path: '/api/v1/identity-graph', title: 'Identity Graph' },
    { id: 'risk_features', method: 'GET', path: '/api/v1/risk-features', title: 'Risk Feature Registry' },
    { id: 'api_keys', method: 'GET', path: '/api/v1/api-keys', title: 'List API Keys' },
    { id: 'api_key_create', method: 'POST', path: '/api/v1/api-keys', title: 'Create API Key' },
    { id: 'webhooks', method: 'POST', path: '/api/v1/webhooks', title: 'Create Webhook Subscription' },
    { id: 'webhook_list', method: 'GET', path: '/api/v1/webhooks', title: 'List Webhooks' },
    { id: 'notifications', method: 'GET', path: '/api/v1/notifications', title: 'List الإشعارات' },
    { id: 'audit', method: 'GET', path: '/api/v1/audit-logs', title: 'Audit Log' },
  ];

  const webhookVerificationCode = `import crypto from 'crypto';

// Verify incoming ORDIUM webhook signature in Express/Node.js
export function verifyOrdiumWebhook(payloadString, signatureHeader, webhookSecret) {
  const [timestampPart, sigPart] = signatureHeader.split(',');
  const timestamp = timestampPart.split('=')[1];
  const signature = sigPart.split('=')[1];

  // Example replay protection for your consumer: reject stale timestamps
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  const signedPayload = \`\${timestamp}.\${payloadString}\`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}`;

  return (
    <div className="py-12 bg-[#080B12] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-12 border-b border-white/10 pb-8 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#22D3EE]">
            <Terminal className="w-4 h-4" />
            <span>ORDIUM REST API SPECIFICATION v1.5</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Developer API Reference
          </h1>
          <p className="text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Integrate order-risk evaluation and manual order confirmation through an authenticated REST API with store-scoped credentials, auditable contact attempts, confirmation metrics, and cryptographic webhook signing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Navigation: Endpoints List */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <span className="text-xs font-mono uppercase text-[#94A3B8] font-semibold tracking-wider">
                API Endpoints
              </span>
              <div className="mt-3 space-y-1">
                {endpointsList.map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => setActiveEndpoint(ep.id as any)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between gap-2 ${
                      activeEndpoint === ep.id
                        ? 'bg-[#0D1320] text-white border border-[#22D3EE]/40 font-semibold'
                        : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="truncate">
                      <span className={`font-bold mr-2 ${ep.method === 'POST' ? 'text-[#22D3EE]' : 'text-[#10B981]'}`}>
                        {ep.method}
                      </span>
                      <span>{ep.path}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Authentication Guide */}
            <div className="p-4 rounded-xl bg-[#0D1320] border border-white/10 space-y-3 text-xs">
              <div className="font-bold text-white font-mono flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Authentication</span>
              </div>
              <p className="text-[#94A3B8] leading-relaxed">
                Provide your API key in the Authorization header as a Bearer token on all requests:
              </p>
              <div className="font-mono text-[11px] p-2 rounded bg-black/40 text-[#22D3EE] select-all break-all">
                Authorization: Bearer ord_live_...
              </div>
            </div>

            {/* Required Headers */}
            <div className="p-4 rounded-xl bg-[#0D1320] border border-white/10 space-y-2 text-xs">
              <div className="font-bold text-white font-mono">Standard Headers</div>
              <div className="font-mono text-[11px] space-y-1 text-[#94A3B8]">
                <div><span className="text-white">Content-Type:</span> application/json</div>
                <div><span className="text-white">Idempotency-Key:</span> &lt;uuid&gt; (Optional)</div>
                <div><span className="text-white">Accept:</span> application/json</div>
              </div>
            </div>
          </div>

          {/* Right Column: Endpoint Specification & Interactive Runner */}
          <div className="lg:col-span-9 space-y-8">
            
            {/* Active Endpoint Overview */}
            <div className="bg-[#0D1320] border border-white/10 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3 font-mono">
                  <span className="px-2.5 py-1 rounded bg-[#22D3EE]/20 text-[#22D3EE] font-bold text-sm">
                    {endpointsList.find(e => e.id === activeEndpoint)?.method}
                  </span>
                  <span className="text-white text-base font-bold">
                    {endpointsList.find(e => e.id === activeEndpoint)?.path}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/15 px-2.5 py-1 rounded border border-[#10B981]/30">
                  Live API rate limits are controlled by the API configuration
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  {endpointsList.find(e => e.id === activeEndpoint)?.title}
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Order confirmation routes require the orders:read or orders:write scope. Metrics are scoped to the authenticated merchant, environment, and selected store. The confirmation workflow records staff actions only; WhatsApp messages and phone calls are not sent automatically.
                </p>
              </div>

              {/* Status Codes Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">رموز الاستجابة المتوقعة</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-[#10B981] font-bold">201 Created</span>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">تم قبول الطلب وتقييمه</p>
                  </div>
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-[#F59E0B] font-bold">400 Bad Request</span>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Malformed JSON</p>
                  </div>
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-[#EF4444] font-bold">401 Unauthorized</span>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Invalid/revoked key</p>
                  </div>
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-[#F59E0B] font-bold">429 Rate Limit</span>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Exceeded quotas</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Webhook Signature Verification Guide */}
            <div className="bg-[#0D1320] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-[#6C5CE7]" />
                <h3 className="text-sm font-bold text-white font-mono">Webhook Signature Verification (HMAC-SHA256)</h3>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                ORDIUM signs all outgoing webhook payloads using HMAC-SHA256 with your endpoint secret. Always verify the signature header to prevent spoofing:
              </p>
              <CodeBlock
                code={webhookVerificationCode}
                language="typescript"
                title="Node.js Webhook Verifier"
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
