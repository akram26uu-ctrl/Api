/**
 * ORDIUM Developer Section
 * "Built for developers."
 * Technical code samples with syntax highlighting and API docs CTA.
 */

import React from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../common/Button';
import { CodeBlock } from '../common/CodeBlock';
import { useLanguage } from '../../i18n/LanguageContext';
import { bidiIsolate } from './Bidi';

interface DeveloperSectionProps {
  onViewDocs: () => void;
}

export const DeveloperSection: React.FC<DeveloperSectionProps> = ({ onViewDocs }) => {
  const { t, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  // On /developers this section opens the page, so it carries the h1 (the API reference below steps down to h2).
  const Title = typeof window !== 'undefined' && window.location.pathname === '/developers' ? 'h1' : 'h2';

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
  // Hold the order and confirm it with the customer before shipping.
}`;

  return (
    <section className="py-20 sm:py-24 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="max-w-3xl mb-12 sm:mb-14 text-start">
          <Title className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight rtl:tracking-normal text-balance">
            {t('mkt.dev.title', 'لمتجرك الخاص: طلب API واحد')}
          </Title>
          <p className="mt-5 text-base sm:text-lg text-[var(--ordium-muted)] leading-relaxed max-w-[65ch] text-pretty">
            {bidiIsolate(t('mkt.dev.subtitle', 'تُربط متاجر Shopify أو YouCan أو WooCommerce من لوحة التحكم مباشرة. إذا كان متجرك مبنيًا خصيصًا، أرسل كل طلب إلى API واحصل على الدرجة والقرار والأسباب في الرد.'), isRTL)}
          </p>
        </div>

        {/* Code Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Request */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--ordium-muted)] px-1">
              <span>{t('mkt.dev.request', 'الطلب المُرسل')}</span>
              <code className="font-mono text-xs text-[var(--ordium-signal)]" dir="ltr">POST /api/v1/orders</code>
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
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--ordium-muted)] px-1">
              <span>{t('mkt.dev.response', 'الرد (HTTP 201)')}</span>
              <code className="font-mono text-xs text-[var(--ordium-success)]" dir="ltr">risk.decision</code>
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
            {t('mkt.dev.cta', 'مرجع API الكامل')}
          </Button>
        </div>

      </div>
    </section>
  );
};
