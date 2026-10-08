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

  const curlCode = `curl -X POST https://api.ordium.io/api/v1/orders \\
  -H "Authorization: Bearer ord_live_41c8f9024..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "order_number": "ORD-77402",
    "amount": 1420.00,
    "currency": "USD",
    "customer": {
      "name": "Arthur Vance",
      "email": "a.vance99@temp-inbox.net",
      "phone": "+14155550199",
      "ip_address": "185.220.101.44",
      "device_id": "dev_fingerprint_8f0a"
    },
    "shipping_address": {
      "street1": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "postal_code": "97477",
      "country": "US"
    },
    "items": [
      { "sku": "LAP-MBP-16", "name": "MacBook Pro 16", "price": 1420.00, "quantity": 1 }
    ]
  }'`;

  const responseCode = `{
  "id": "ord_98a72b1",
  "order_number": "ORD-77402",
  "amount": 1420.00,
  "currency": "USD",
  "status": "flagged",
  "risk": {
    "score": 82,
    "decision": "REJECT",
    "evaluated_at": "2026-09-14T10:35:00Z",
    "execution_time_ms": 38,
    "confidence": 0.94,
    "rules_version": "ordium-rules-v2.4",
    "signals": [
      {
        "code": "NETWORK_REPUTATION",
        "name": "Network Reputation",
        "severity": "critical",
        "weight": 40,
        "description": "IP mapped directly to active Tor exit node registry"
      },
      {
        "code": "DEVICE_REUSE",
        "name": "Device Reuse",
        "severity": "critical",
        "weight": 32,
        "description": "Hardware fingerprint dev_8f0a observed across 3 distinct cards in 2h"
      }
    ],
    "events": [
      { "type": "SIGNAL_INGESTION", "timestamp": "2026-09-14T10:35:00.010Z" },
      { "type": "DECISION_FINALIZED", "timestamp": "2026-09-14T10:35:00.038Z" }
    ]
  }
}`;

  const tsCode = `import { OrdiumClient } from '@ordium/sdk';

const ordium = new OrdiumClient({
  apiKey: process.env.ORDIUM_API_KEY
});

// Evaluate order risk through the ORDIUM API
const assessment = await ordium.orders.evaluate({
  orderNumber: 'ORD-77402',
  amount: 1420.00,
  currency: 'USD',
  customer: {
    email: 'customer@domain.com',
    ipAddress: req.ip,
    deviceId: req.headers['x-device-id']
  }
});

if (assessment.risk.decision === 'REJECT') {
  // Gracefully decline order before payment settlement
  return res.status(403).json({ error: 'Order declined due to high risk' });
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
              title="HTTP Client Request"
            />
          </div>

          {/* Response */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] px-1">
              <span>{t('developer.eval_response', 'EVALUATION RESPONSE (HTTP 201 CREATED)')}</span>
              <span className="text-[#10B981]" dir="ltr">RISK: ASSESSED</span>
            </div>
            <CodeBlock
              code={responseCode}
              language="json"
              title="risk.score & risk.decision"
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
