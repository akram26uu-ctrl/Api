/**
 * ORDIUM Developer Section
 * "Built for developers."
 * Technical code samples with syntax highlighting and API docs CTA.
 */

import React from 'react';
import { ArrowRight, ArrowLeft, Terminal, CheckCircle2, Code2, Copy } from 'lucide-react';
import { Button } from '../common/Button';
import { CodeBlock } from '../common/CodeBlock';
import { useLanguage } from '../../i18n/LanguageContext';

interface DeveloperSectionProps {
  onViewDocs: () => void;
}

export const DeveloperSection: React.FC<DeveloperSectionProps> = ({ onViewDocs }) => {
  const { t, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Samples mirror the real API contract (api/app/schemas/order.py): DZD only, Algerian phone format.
  const curlCode = `curl -X POST https://api.ordium.dev/api/v1/orders \\
  -H "Authorization: Bearer ordium_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 6f1c2a4e-0b7d-4c1e-9a55-2f8e1d3b7c90" \\
  -d '{
    "external_order_id": "ORD-77402",
    "first_name": "Karim",
    "last_name": "Bensalem",
    "phone": "0550123456",
    "wilaya": "16 - Algiers",
    "commune": "Sidi M'\''Hamed",
    "address": "12 Rue Didouche Mourad",
    "total_amount": 14200.00,
    "currency": "DZD",
    "items": [
      { "product_name": "Wireless Headphones", "sku": "WH-200", "quantity": 1, "unit_price": 14200.00 }
    ]
  }'`;

  const responseCode = `{
  "order_id": "3f6c9a52-1d0e-4b7a-9c31-8e2f5a7d4b10",
  "external_order_id": "ORD-77402",
  "status": "pending",
  "environment": "live",
  "risk": {
    "assessment_id": "b2d7e1c4-5a96-4f3e-8d20-7c1a9e6f3b58",
    "score": 55,
    "decision": "review",
    "model_version": "rules-v4",
    "rules_version": "2026-09-global-reputation-v4",
    "risk_profile_version": 1,
    "execution_time_ms": 41.7,
    "events": [
      { "event_type": "phone_reused", "score_impact": 25, "event_data": null },
      { "event_type": "vpn_detected", "score_impact": 30, "event_data": null }
    ]
  },
  "items": [ ... ]
}`;

  const tsCode = `// Node.js 18+ (built-in fetch). Keep the API key on your server only.
const response = await fetch('https://api.ordium.dev/api/v1/orders', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.ORDIUM_API_KEY}\`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    external_order_id: order.id,
    first_name: order.customer.firstName,
    last_name: order.customer.lastName,
    phone: order.customer.phone,      // e.g. 0550123456 or +213550123456
    wilaya: order.shipping.wilaya,
    commune: order.shipping.commune,
    address: order.shipping.address,
    total_amount: order.total,
    currency: 'DZD',
  }),
});

if (!response.ok) throw new Error(\`ORDIUM error \${response.status}\`);
const { risk } = await response.json();

if (risk.decision === 'reject') {
  // Hold the order for manual confirmation before shipping.
}`;

  return (
    <section className="py-24 border-t border-white/5 bg-[#080B12] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#22D3EE]">
            <Code2 className="w-3.5 h-3.5" />
            <span>{t('developer.badge', 'DEVELOPER EXPERIENCE FIRST')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {t('developer.title', 'Built for developers.')}
          </h2>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            {t('developer.subtitle', 'One clean REST request. Instant JSON response with transparent risk scores, actionable decisions, and categorized event signals.')}
          </p>
        </div>

        {/* Code Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Request */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] px-1">
              <span>{t('developer.request_payload', 'REQUEST PAYLOAD')}</span>
              <span className="text-[#22D3EE]" dir="ltr">POST /api/v1/orders</span>
            </div>
            <CodeBlock
              tabs={[
                { label: 'cURL', code: curlCode, language: 'bash' },
                { label: 'TypeScript', code: tsCode, language: 'typescript' }
              ]}
              title={t('developer.request_title', 'HTTP request')}
            />
          </div>

          {/* Response */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] px-1">
              <span>{t('developer.eval_response', 'EVALUATION RESPONSE (HTTP 201 CREATED)')}</span>
              <span className="text-[#10B981]" dir="ltr">risk.decision</span>
            </div>
            <CodeBlock
              code={responseCode}
              language="json"
              title={t('developer.response_title', 'Response body')}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={onViewDocs}
            rightIcon={<ArrowIcon className="w-4 h-4" />}
          >
            {t('developer.view_full_docs', 'View Full API Reference')}
          </Button>
        </div>

      </div>
    </section>
  );
};
