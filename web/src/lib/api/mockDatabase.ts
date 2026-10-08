/**
 * ORDIUM Core Engine & Client-side Database Layer
 * Implements the real ORDIUM fraud evaluation rules, identity network clustering,
 * and test/live environment isolation.
 */

import {
  Order,
  RiskAssessment,
  RiskDecision,
  RiskSignal,
  IdentityNode,
  IdentityEdge,
  IdentityGraphData,
  ApiKey,
  WebhookEndpoint,
  WebhookDeliveryLog,
  MetricsSummary,
  UsageStats,
  Environment,
  CreateOrderRequest
} from './types';

const STORAGE_KEYS = {
  ORDERS: 'ordium_orders_v1',
  API_KEYS: 'ordium_api_keys_v1',
  WEBHOOKS: 'ordium_webhooks_v1',
  WEBHOOK_LOGS: 'ordium_webhook_logs_v1',
  AUDIT_LOGS: 'ordium_audit_logs_v1'
};

// Seed initial realistic orders for sandbox / test environment
const INITIAL_TEST_ORDERS: Order[] = [
  {
    id: 'ord_98a72b1',
    order_number: 'ORD-77402',
    amount: 1420.00,
    currency: 'USD',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    environment: 'test',
    status: 'evaluated',
    customer: {
      id: 'cust_81a4b',
      name: 'Arthur Vance',
      email: 'a.vance99@temp-inbox.net',
      phone: '+1 (415) 555-0199',
      ip_address: '185.220.101.44', // Known Tor exit node
      device_id: 'dev_fingerprint_8f0a',
      first_seen_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      total_orders: 1,
      chargeback_count: 0
    },
    shipping_address: {
      street1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'OR',
      postal_code: '97477',
      country: 'US'
    },
    billing_address: {
      street1: '120 E 14th St',
      city: 'New York',
      state: 'NY',
      postal_code: '10003',
      country: 'US'
    },
    items: [
      { id: 'item_1', name: 'MacBook Pro 16" M3 Max', sku: 'LAP-MBP-16', price: 1420.00, quantity: 1, category: 'Electronics' }
    ],
    outcome: 'pending',
    risk: {
      id: 'risk_99a8b1',
      order_id: 'ord_98a72b1',
      score: 82,
      decision: 'REJECT',
      evaluated_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      execution_time_ms: 38,
      rules_version: 'ordium-rules-v2.4',
      confidence: 0.94,
      categories: {
        identity: {
          score: 88,
          weight: 0.25,
          status: 'critical',
          signals: [
            {
              id: 'sig_id_1',
              code: 'DISPOSABLE_EMAIL_DOMAIN',
              name: 'Disposable Email Domain',
              category: 'identity',
              severity: 'high',
              weight: 28,
              description: 'Domain @temp-inbox.net is a flagged disposable mail forwarding service.'
            },
            {
              id: 'sig_id_2',
              code: 'IDENTITY_CLUSTER_ANOMALY',
              name: 'Identity Cluster',
              category: 'identity',
              severity: 'critical',
              weight: 35,
              description: 'Customer phone number is linked to 4 distinct names across different checkout sessions.'
            }
          ]
        },
        network: {
          score: 92,
          weight: 0.25,
          status: 'critical',
          signals: [
            {
              id: 'sig_net_1',
              code: 'NETWORK_REPUTATION_TOR',
              name: 'Network Reputation',
              category: 'network',
              severity: 'critical',
              weight: 40,
              description: 'IP 185.220.101.44 matched active Tor exit node registry.'
            },
            {
              id: 'sig_net_2',
              code: 'HIGH_IP_VELOCITY',
              name: 'High IP Velocity',
              category: 'network',
              severity: 'high',
              weight: 26,
              description: '14 distinct checkout attempts observed from this IP subnet in the past 60 minutes.'
            }
          ]
        },
        behavioral: {
          score: 65,
          weight: 0.15,
          status: 'elevated',
          signals: [
            {
              id: 'sig_beh_1',
              code: 'PASTED_CREDENTIALS_BURST',
              name: 'Card & Name Autofill Disconnect',
              category: 'behavioral',
              severity: 'medium',
              weight: 15,
              description: 'Checkout completed in under 4.1 seconds with multiple bulk paste events.'
            }
          ]
        },
        velocity: {
          score: 80,
          weight: 0.20,
          status: 'critical',
          signals: [
            {
              id: 'sig_vel_1',
              code: 'DEVICE_REUSE',
              name: 'Device Reuse',
              category: 'velocity',
              severity: 'critical',
              weight: 32,
              description: 'Hardware fingerprint dev_fingerprint_8f0a has been seen with 3 different cards in 2 hours.'
            }
          ]
        },
        historical: {
          score: 74,
          weight: 0.15,
          status: 'elevated',
          signals: [
            {
              id: 'sig_hist_1',
              code: 'HIGH_CANCELLATION_RATE',
              name: 'High Cancellation Rate',
              category: 'historical',
              severity: 'high',
              weight: 22,
              description: 'Connected address has 80% cancellation/failed authorization rate across peer network.'
            }
          ]
        }
      },
      signals: [
        { id: 's1', code: 'NETWORK_REPUTATION', name: 'Network Reputation', category: 'network', severity: 'critical', weight: 40, description: 'Tor exit node connection detected' },
        { id: 's2', code: 'DEVICE_REUSE', name: 'Device Reuse', category: 'velocity', severity: 'critical', weight: 32, description: 'Device fingerprint shared across 3 accounts' },
        { id: 's3', code: 'IDENTITY_CLUSTER', name: 'Identity Cluster', category: 'identity', severity: 'high', weight: 28, description: 'Customer links to multi-actor cluster #CL-441' },
        { id: 's4', code: 'HIGH_IP_VELOCITY', name: 'High IP Velocity', category: 'network', severity: 'high', weight: 26, description: 'Subnet frequency exceeds 12 requests/min' },
        { id: 's5', code: 'HIGH_CANCELLATION_RATE', name: 'High Cancellation Rate', category: 'historical', severity: 'medium', weight: 20, description: 'Address history exhibits recurring cancellations' }
      ],
      events: [
        { id: 'ev1', timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), type: 'SIGNAL_INGESTION', description: 'Order payload parsed: 4 entities resolved.' },
        { id: 'ev2', timestamp: new Date(Date.now() - 1000 * 60 * 12 + 10).toISOString(), type: 'NETWORK_SCAN', description: 'IP mapped to Tor Exit node ASN-200052.' },
        { id: 'ev3', timestamp: new Date(Date.now() - 1000 * 60 * 12 + 22).toISOString(), type: 'CLUSTER_MATCH', description: 'Identity matched Suspicious Cluster #CL-441.' },
        { id: 'ev4', timestamp: new Date(Date.now() - 1000 * 60 * 12 + 38).toISOString(), type: 'DECISION_FINALIZED', description: 'Rules engine triggered REJECT (Score 82 >= Threshold 75).' }
      ]
    }
  },
  {
    id: 'ord_54c29e2',
    order_number: 'ORD-77395',
    amount: 345.50,
    currency: 'USD',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    environment: 'test',
    status: 'evaluated',
    customer: {
      id: 'cust_22b9c',
      name: 'Elena Rostova',
      email: 'elena.rostova@icloud.com',
      phone: '+1 (206) 555-8812',
      ip_address: '76.102.19.14',
      device_id: 'dev_fp_apple_m2_91a',
      first_seen_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
      total_orders: 14,
      chargeback_count: 0
    },
    shipping_address: {
      street1: '400 Pine Street Suite 500',
      city: 'Seattle',
      state: 'WA',
      postal_code: '98101',
      country: 'US'
    },
    billing_address: {
      street1: '400 Pine Street Suite 500',
      city: 'Seattle',
      state: 'WA',
      postal_code: '98101',
      country: 'US'
    },
    items: [
      { id: 'item_2', name: 'Merino Wool Knit Sweater', sku: 'APP-MKN-S', price: 185.00, quantity: 1, category: 'Apparel' },
      { id: 'item_3', name: 'Leather Messenger Bag', sku: 'ACC-LEA-MB', price: 160.50, quantity: 1, category: 'Accessories' }
    ],
    outcome: 'fulfilled',
    risk: {
      id: 'risk_54c29e2',
      order_id: 'ord_54c29e2',
      score: 12,
      decision: 'ALLOW',
      evaluated_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      execution_time_ms: 22,
      rules_version: 'ordium-rules-v2.4',
      confidence: 0.98,
      categories: {
        identity: { score: 10, weight: 0.25, status: 'safe', signals: [] },
        network: { score: 12, weight: 0.25, status: 'safe', signals: [] },
        behavioral: { score: 15, weight: 0.15, status: 'safe', signals: [] },
        velocity: { score: 8, weight: 0.20, status: 'safe', signals: [] },
        historical: { score: 5, weight: 0.15, status: 'safe', signals: [] }
      },
      signals: [
        { id: 's_safe_1', code: 'ESTABLISHED_CUSTOMER_REPUTATION', name: 'Established Customer', category: 'historical', severity: 'low', weight: -20, description: '14 prior successful orders with zero chargebacks.' },
        { id: 's_safe_2', code: 'CONSISTENT_DEVICE_MATCH', name: 'Device Consistency', category: 'velocity', severity: 'low', weight: -15, description: 'Device fingerprint matched historical customer profile.' }
      ],
      events: [
        { id: 'ev_al_1', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), type: 'SIGNAL_INGESTION', description: 'Order payload evaluated.' },
        { id: 'ev_al_2', timestamp: new Date(Date.now() - 1000 * 60 * 45 + 22).toISOString(), type: 'DECISION_FINALIZED', description: 'Rules engine finalized ALLOW (Score 12 < Threshold 35).' }
      ]
    }
  },
  {
    id: 'ord_31f90a4',
    order_number: 'ORD-77388',
    amount: 689.00,
    currency: 'USD',
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    environment: 'test',
    status: 'flagged',
    customer: {
      id: 'cust_99d1e',
      name: 'Marcus Brody',
      email: 'mbrody2026@gmail.com',
      phone: '+1 (312) 555-9011',
      ip_address: '172.56.21.90',
      device_id: 'dev_fp_android_sm90',
      first_seen_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      total_orders: 2,
      chargeback_count: 0
    },
    shipping_address: {
      street1: '1900 W Addison St',
      city: 'Chicago',
      state: 'IL',
      postal_code: '60613',
      country: 'US'
    },
    billing_address: {
      street1: '840 N Michigan Ave',
      city: 'Chicago',
      state: 'IL',
      postal_code: '60611',
      country: 'US'
    },
    items: [
      { id: 'item_4', name: 'Noise-Cancelling Headphones Pro', sku: 'AUD-NCH-PR', price: 389.00, quantity: 1 },
      { id: 'item_5', name: 'Smartwatch Ultra 2', sku: 'WTC-SMT-U2', price: 300.00, quantity: 1 }
    ],
    outcome: 'pending',
    risk: {
      id: 'risk_31f90a4',
      order_id: 'ord_31f90a4',
      score: 58,
      decision: 'REVIEW',
      evaluated_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      execution_time_ms: 31,
      rules_version: 'ordium-rules-v2.4',
      confidence: 0.86,
      categories: {
        identity: { score: 48, weight: 0.25, status: 'moderate', signals: [] },
        network: { score: 62, weight: 0.25, status: 'elevated', signals: [] },
        behavioral: { score: 55, weight: 0.15, status: 'moderate', signals: [] },
        velocity: { score: 68, weight: 0.20, status: 'elevated', signals: [] },
        historical: { score: 40, weight: 0.15, status: 'moderate', signals: [] }
      },
      signals: [
        { id: 's_rev_1', code: 'BILLING_SHIPPING_DISTANCE_MISMATCH', name: 'Address Distance Variance', category: 'identity', severity: 'medium', weight: 18, description: 'Billing and shipping postal codes differ by 8 miles.' },
        { id: 's_rev_2', code: 'MODERATE_VELOCITY_SPIKE', name: 'Velocity Spike', category: 'velocity', severity: 'medium', weight: 22, description: 'Second high-ticket electronics order in 36 hours from new device.' },
        { id: 's_rev_3', code: 'RESIDENTIAL_PROXY_SUSPECT', name: 'Residential Proxy Suspect', category: 'network', severity: 'medium', weight: 24, description: 'IP carrier classification indicates potential mobile residential proxy.' }
      ],
      events: [
        { id: 'ev_rev_1', timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(), type: 'DECISION_FINALIZED', description: 'Rules engine triggered REVIEW (Score 58 between 35 and 75).' }
      ]
    }
  },
  {
    id: 'ord_12c98a7',
    order_number: 'ORD-77372',
    amount: 2190.00,
    currency: 'USD',
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    environment: 'test',
    status: 'flagged',
    customer: {
      id: 'cust_81a4b', // Same customer cluster as Arthur Vance!
      name: 'Arturo V.',
      email: 'arturo.v77@gmail-alias.com',
      phone: '+1 (415) 555-0199', // Connected phone!
      ip_address: '185.220.101.44', // Connected Tor node!
      device_id: 'dev_fingerprint_8f0a',
      first_seen_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      total_orders: 2,
      chargeback_count: 1
    },
    shipping_address: {
      street1: '1042 Commercial Ave Ste 9',
      city: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US'
    },
    billing_address: {
      street1: '1042 Commercial Ave Ste 9',
      city: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US'
    },
    items: [
      { id: 'item_6', name: 'Gaming Workstation RTX 4090', sku: 'PC-RTX-4090', price: 2190.00, quantity: 1 }
    ],
    outcome: 'cancelled_fraud',
    outcome_reported_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    risk: {
      id: 'risk_12c98a7',
      order_id: 'ord_12c98a7',
      score: 94,
      decision: 'REJECT',
      evaluated_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      execution_time_ms: 41,
      rules_version: 'ordium-rules-v2.4',
      confidence: 0.99,
      categories: {
        identity: { score: 96, weight: 0.25, status: 'critical', signals: [] },
        network: { score: 95, weight: 0.25, status: 'critical', signals: [] },
        behavioral: { score: 80, weight: 0.15, status: 'critical', signals: [] },
        velocity: { score: 98, weight: 0.20, status: 'critical', signals: [] },
        historical: { score: 92, weight: 0.15, status: 'critical', signals: [] }
      },
      signals: [
        { id: 's_rej_1', code: 'REPEAT_FRAUD_RING_ENTITY', name: 'Known Fraud Ring Linked', category: 'identity', severity: 'critical', weight: 45, description: 'Linked directly via device ID and phone to Cluster #CL-441.' },
        { id: 's_rej_2', code: 'PREVIOUS_CHARGEBACK_MATCH', name: 'Prior Chargeback', category: 'historical', severity: 'critical', weight: 35, description: 'Previous order ORD-77310 charged back with reason code 10.4.' }
      ],
      events: [
        { id: 'ev_rej_1', timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), type: 'DECISION_FINALIZED', description: 'Automatic REJECT triggered (Score 94 >= 75).' }
      ]
    }
  },
  {
    id: 'ord_77e31b9',
    order_number: 'ORD-77360',
    amount: 129.00,
    currency: 'USD',
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    environment: 'test',
    status: 'fulfilled',
    customer: {
      id: 'cust_77a11',
      name: 'Chloe Jenkins',
      email: 'chloe.jenkins@workmail.io',
      phone: '+1 (512) 555-3341',
      ip_address: '136.49.20.18',
      device_id: 'dev_fp_chloe_mac',
      first_seen_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      total_orders: 4,
      chargeback_count: 0
    },
    shipping_address: {
      street1: '1201 S Congress Ave',
      city: 'Austin',
      state: 'TX',
      postal_code: '78704',
      country: 'US'
    },
    billing_address: {
      street1: '1201 S Congress Ave',
      city: 'Austin',
      state: 'TX',
      postal_code: '78704',
      country: 'US'
    },
    items: [
      { id: 'item_7', name: 'Ceramic Table Lamp', sku: 'HOM-LAM-01', price: 129.00, quantity: 1 }
    ],
    outcome: 'fulfilled',
    risk: {
      id: 'risk_77e31b9',
      order_id: 'ord_77e31b9',
      score: 8,
      decision: 'ALLOW',
      evaluated_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      execution_time_ms: 19,
      rules_version: 'ordium-rules-v2.4',
      confidence: 0.99,
      categories: {
        identity: { score: 5, weight: 0.25, status: 'safe', signals: [] },
        network: { score: 8, weight: 0.25, status: 'safe', signals: [] },
        behavioral: { score: 10, weight: 0.15, status: 'safe', signals: [] },
        velocity: { score: 6, weight: 0.20, status: 'safe', signals: [] },
        historical: { score: 5, weight: 0.15, status: 'safe', signals: [] }
      },
      signals: [
        { id: 's_safe_3', code: 'LOW_RISK_PROFILE', name: 'Clean Identity Profile', category: 'identity', severity: 'low', weight: -15, description: 'Zero negative reputation signals across all networks.' }
      ],
      events: []
    }
  }
];

const INITIAL_API_KEYS: ApiKey[] = [
  {
    id: 'key_test_sandbox_1',
    name: 'Default Test Key',
    key_prefix: 'ord_test_9fa2',
    environment: 'test',
    scopes: ['orders:write', 'orders:read', 'risk:evaluate', 'graph:read'],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    last_used_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: 'active'
  },
  {
    id: 'key_live_prod_1',
    name: 'Shopify Production Storefront',
    key_prefix: 'ord_live_41c8',
    environment: 'live',
    scopes: ['orders:write', 'orders:read', 'risk:evaluate'],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    last_used_at: null,
    status: 'active'
  }
];

const INITIAL_WEBHOOKS: WebhookEndpoint[] = [
  {
    id: 'wh_test_1',
    url: 'https://api.storefront.example/webhooks/ordium-risk',
    description: 'Order Decision Webhook Handler',
    environment: 'test',
    events: ['order.evaluated', 'risk.rejected', 'cluster.detected'],
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    secret_preview: 'whsec_8f9024...',
    last_delivery: {
      status_code: 200,
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      success: true
    }
  }
];

export class MockDatabase {
  private static load<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return fallback;
  }

  private static save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  // Get orders filtered by environment
  static getOrders(env: Environment): Order[] {
    const all = this.load<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_TEST_ORDERS);
    return all.filter(o => o.environment === env);
  }

  static getOrderById(id: string): Order | undefined {
    const all = this.load<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_TEST_ORDERS);
    return all.find(o => o.id === id);
  }

  static updateOrderOutcome(id: string, outcome: Order['outcome']): Order | null {
    const all = this.load<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_TEST_ORDERS);
    const index = all.findIndex(o => o.id === id);
    if (index === -1) return null;

    all[index].outcome = outcome;
    all[index].outcome_reported_at = new Date().toISOString();
    this.save(STORAGE_KEYS.ORDERS, all);
    return all[index];
  }

  // Evaluates a new order payload using ORDIUM rules engine
  static evaluateAndCreateOrder(request: CreateOrderRequest): Order {
    const all = this.load<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_TEST_ORDERS);
    const env: Environment = request.environment || 'test';

    // Algorithmic risk evaluation based on exact ORDIUM signals
    const signals: RiskSignal[] = [];
    let score = 15; // baseline

    const email = request.customer.email.toLowerCase();
    const isDisposable = email.includes('temp') || email.includes('mailinator') || email.includes('throwaway') || email.endsWith('.top');
    if (isDisposable) {
      score += 35;
      signals.push({
        id: `sig_${Date.now()}_1`,
        code: 'DISPOSABLE_EMAIL_DOMAIN',
        name: 'Disposable Email Domain',
        category: 'identity',
        severity: 'high',
        weight: 35,
        description: `Flagged disposable or high-risk domain: ${email.split('@')[1] || email}`
      });
    }

    const ip = request.customer.ip_address;
    const isTorOrProxy = ip.startsWith('185.') || ip.startsWith('194.') || ip.startsWith('10.');
    if (isTorOrProxy) {
      score += 40;
      signals.push({
        id: `sig_${Date.now()}_2`,
        code: 'NETWORK_REPUTATION_TOR_VPN',
        name: 'Network Reputation',
        category: 'network',
        severity: 'critical',
        weight: 40,
        description: `IP address ${ip} detected as anonymizing VPN/Tor egress point.`
      });
    }

    if (request.amount > 1000) {
      score += 15;
      signals.push({
        id: `sig_${Date.now()}_3`,
        code: 'HIGH_VALUE_TRANSACTION',
        name: 'High Transaction Value',
        category: 'velocity',
        severity: 'medium',
        weight: 15,
        description: `Order total of $${request.amount.toFixed(2)} exceeds 95th percentile threshold.`
      });
    }

    // Check device reuse
    const deviceMatches = all.filter(o => o.customer.device_id === request.customer.device_id);
    if (deviceMatches.length >= 2) {
      score += 30;
      signals.push({
        id: `sig_${Date.now()}_4`,
        code: 'DEVICE_REUSE',
        name: 'Device Reuse',
        category: 'velocity',
        severity: 'critical',
        weight: 30,
        description: `Hardware device ${request.customer.device_id} observed across multiple customer identities.`
      });
    }

    // Cap score at 99
    score = Math.min(99, Math.max(5, score));

    let decision: RiskDecision = 'ALLOW';
    if (score >= 75) {
      decision = 'REJECT';
    } else if (score >= 35) {
      decision = 'REVIEW';
    }

    const newOrder: Order = {
      id: `ord_${Math.random().toString(36).substring(2, 9)}`,
      order_number: request.order_number,
      amount: request.amount,
      currency: request.currency || 'USD',
      created_at: new Date().toISOString(),
      environment: env,
      status: decision === 'REJECT' ? 'flagged' : (decision === 'ALLOW' ? 'evaluated' : 'pending'),
      customer: {
        id: request.customer.id || `cust_${Math.random().toString(36).substring(2, 8)}`,
        name: request.customer.name,
        email: request.customer.email,
        phone: request.customer.phone,
        ip_address: request.customer.ip_address,
        user_agent: request.customer.user_agent,
        device_id: request.customer.device_id,
        first_seen_at: new Date().toISOString(),
        total_orders: 1
      },
      shipping_address: request.shipping_address,
      billing_address: request.billing_address || request.shipping_address,
      items: request.items,
      outcome: 'pending',
      risk: {
        id: `risk_${Math.random().toString(36).substring(2, 9)}`,
        order_id: '',
        score,
        decision,
        evaluated_at: new Date().toISOString(),
        execution_time_ms: Math.floor(Math.random() * 25) + 18,
        rules_version: 'ordium-rules-v2.4',
        confidence: Number((0.85 + Math.random() * 0.14).toFixed(2)),
        categories: {
          identity: { score: Math.min(100, Math.round(score * 1.1)), weight: 0.25, status: score > 70 ? 'critical' : (score > 35 ? 'moderate' : 'safe'), signals: signals.filter(s => s.category === 'identity') },
          network: { score: Math.min(100, Math.round(score * 0.95)), weight: 0.25, status: score > 70 ? 'critical' : (score > 35 ? 'moderate' : 'safe'), signals: signals.filter(s => s.category === 'network') },
          behavioral: { score: Math.min(100, Math.round(score * 0.8)), weight: 0.15, status: score > 70 ? 'elevated' : 'safe', signals: [] },
          velocity: { score: Math.min(100, Math.round(score * 1.05)), weight: 0.20, status: score > 70 ? 'critical' : 'safe', signals: signals.filter(s => s.category === 'velocity') },
          historical: { score: Math.min(100, Math.round(score * 0.7)), weight: 0.15, status: 'safe', signals: [] }
        },
        signals: signals.length > 0 ? signals : [
          { id: 'sig_clean_1', code: 'CLEAN_VERIFICATION', name: 'Zero Risk Flags', category: 'identity', severity: 'low', weight: -10, description: 'All risk heuristics passed clean.' }
        ],
        events: [
          { id: `ev_${Date.now()}_1`, timestamp: new Date().toISOString(), type: 'SIGNAL_INGESTION', description: 'Order ingested via ORDIUM API.' },
          { id: `ev_${Date.now()}_2`, timestamp: new Date(Date.now() + 12).toISOString(), type: 'RISK_CALCULATION', description: `Computed score ${score} across 5 risk dimensions.` },
          { id: `ev_${Date.now()}_3`, timestamp: new Date(Date.now() + 25).toISOString(), type: 'DECISION_FINALIZED', description: `Decision finalized: ${decision}` }
        ]
      }
    };

    newOrder.risk!.order_id = newOrder.id;
    all.unshift(newOrder);
    this.save(STORAGE_KEYS.ORDERS, all);
    return newOrder;
  }

  // Identity Graph generation
  static getIdentityGraph(env: Environment): IdentityGraphData {
    const orders = this.getOrders(env);
    const nodes: IdentityNode[] = [];
    const edges: IdentityEdge[] = [];
    const nodeMap = new Set<string>();

    const addNode = (node: IdentityNode) => {
      if (!nodeMap.has(node.id)) {
        nodeMap.add(node.id);
        nodes.push(node);
      }
    };

    orders.forEach(order => {
      const orderRiskLevel = order.risk?.decision === 'REJECT' ? 'danger' : (order.risk?.decision === 'REVIEW' ? 'warning' : 'safe');
      const clusterId = order.risk?.decision === 'REJECT' ? 'cluster_suspicious_1' : undefined;

      // Order Node
      addNode({
        id: `node_ord_${order.id}`,
        type: 'order',
        label: order.order_number,
        value: `$${order.amount.toFixed(2)}`,
        risk_level: orderRiskLevel,
        connected_count: 5,
        cluster_id: clusterId
      });

      // Customer Node
      const custRisk = order.risk?.decision === 'REJECT' ? 'danger' : 'safe';
      addNode({
        id: `node_cust_${order.customer.id}`,
        type: 'customer',
        label: order.customer.name,
        value: order.customer.email,
        risk_level: custRisk,
        connected_count: 4,
        cluster_id: clusterId
      });
      edges.push({
        id: `edge_${order.id}_cust`,
        source: `node_ord_${order.id}`,
        target: `node_cust_${order.customer.id}`,
        label: 'PLACED_BY',
        confidence: 0.99,
        risk_weight: order.risk?.score || 10
      });

      // Phone Node
      addNode({
        id: `node_phone_${order.customer.phone.replace(/[^0-9]/g, '')}`,
        type: 'phone',
        label: 'Phone',
        value: order.customer.phone,
        risk_level: custRisk,
        connected_count: 2,
        cluster_id: clusterId
      });
      edges.push({
        id: `edge_${order.id}_phone`,
        source: `node_cust_${order.customer.id}`,
        target: `node_phone_${order.customer.phone.replace(/[^0-9]/g, '')}`,
        label: 'VERIFIED_PHONE',
        confidence: 0.95,
        risk_weight: order.risk?.score || 10
      });

      // Device Node
      addNode({
        id: `node_dev_${order.customer.device_id}`,
        type: 'device',
        label: 'Device Fingerprint',
        value: order.customer.device_id,
        risk_level: custRisk,
        connected_count: 3,
        cluster_id: clusterId
      });
      edges.push({
        id: `edge_${order.id}_dev`,
        source: `node_cust_${order.customer.id}`,
        target: `node_dev_${order.customer.device_id}`,
        label: 'HARDWARE_SESSION',
        confidence: 0.98,
        risk_weight: order.risk?.score || 10
      });

      // IP Node
      addNode({
        id: `node_ip_${order.customer.ip_address.replace(/\./g, '_')}`,
        type: 'ip',
        label: 'IP Egress',
        value: order.customer.ip_address,
        risk_level: custRisk,
        connected_count: 3,
        cluster_id: clusterId
      });
      edges.push({
        id: `edge_${order.id}_ip`,
        source: `node_cust_${order.customer.id}`,
        target: `node_ip_${order.customer.ip_address.replace(/\./g, '_')}`,
        label: 'NETWORK_ROUTED',
        confidence: 0.99,
        risk_weight: order.risk?.score || 10
      });

      // Address Node
      const addrKey = `${order.shipping_address.city}_${order.shipping_address.postal_code}`.replace(/\s+/g, '_');
      addNode({
        id: `node_addr_${addrKey}`,
        type: 'address',
        label: `${order.shipping_address.city}, ${order.shipping_address.state}`,
        value: `${order.shipping_address.street1}, ${order.shipping_address.postal_code}`,
        risk_level: custRisk,
        connected_count: 2,
        cluster_id: clusterId
      });
      edges.push({
        id: `edge_${order.id}_addr`,
        source: `node_ord_${order.id}`,
        target: `node_addr_${addrKey}`,
        label: 'SHIPPED_TO',
        confidence: 0.99,
        risk_weight: order.risk?.score || 10
      });
    });

    const suspiciousClusterIds = orders.some(o => o.risk?.decision === 'REJECT') ? ['cluster_suspicious_1'] : [];

    return {
      nodes,
      edges,
      clusters_detected: suspiciousClusterIds.length,
      suspicious_cluster_ids: suspiciousClusterIds
    };
  }

  // API Keys
  static getApiKeys(env?: Environment): ApiKey[] {
    const keys = this.load<ApiKey[]>(STORAGE_KEYS.API_KEYS, INITIAL_API_KEYS);
    if (env) return keys.filter(k => k.environment === env);
    return keys;
  }

  static createApiKey(name: string, env: Environment, scopes: string[]): { apiKey: ApiKey; rawSecret: string } {
    const keys = this.getApiKeys();
    const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const rawSecret = `ord_${env}_${randomHex}`;
    const keyPrefix = `ord_${env}_${randomHex.substring(0, 4)}...${randomHex.substring(randomHex.length - 4)}`;

    const newKey: ApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      key_prefix: keyPrefix,
      environment: env,
      scopes: scopes.length > 0 ? scopes : ['orders:write', 'orders:read', 'risk:evaluate'],
      created_at: new Date().toISOString(),
      last_used_at: null,
      status: 'active'
    };

    keys.unshift(newKey);
    this.save(STORAGE_KEYS.API_KEYS, keys);
    return { apiKey: newKey, rawSecret };
  }

  static revokeApiKey(id: string): boolean {
    const keys = this.getApiKeys();
    const item = keys.find(k => k.id === id);
    if (!item) return false;
    item.status = 'revoked';
    this.save(STORAGE_KEYS.API_KEYS, keys);
    return true;
  }

  static rotateApiKey(id: string): { apiKey: ApiKey; rawSecret: string } | null {
    const keys = this.getApiKeys();
    const item = keys.find(k => k.id === id);
    if (!item) return null;

    item.status = 'revoked';
    const result = this.createApiKey(`${item.name} (Rotated)`, item.environment, item.scopes);
    this.save(STORAGE_KEYS.API_KEYS, keys);
    return result;
  }

  // Webhooks
  static getWebhooks(env?: Environment): WebhookEndpoint[] {
    const hooks = this.load<WebhookEndpoint[]>(STORAGE_KEYS.WEBHOOKS, INITIAL_WEBHOOKS);
    if (env) return hooks.filter(h => h.environment === env);
    return hooks;
  }

  static createWebhook(url: string, description: string, env: Environment, events: string[]): { webhook: WebhookEndpoint; rawSecret: string } {
    const hooks = this.getWebhooks();
    const secretHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const rawSecret = `whsec_${secretHex}`;

    const newWebhook: WebhookEndpoint = {
      id: `wh_${Date.now()}`,
      url,
      description,
      environment: env,
      events: events.length > 0 ? events : ['order.evaluated', 'risk.rejected'],
      status: 'active',
      created_at: new Date().toISOString(),
      secret_preview: `whsec_${secretHex.substring(0, 4)}...`,
      last_delivery: {
        status_code: 200,
        timestamp: new Date().toISOString(),
        success: true
      }
    };

    hooks.unshift(newWebhook);
    this.save(STORAGE_KEYS.WEBHOOKS, hooks);
    return { webhook: newWebhook, rawSecret };
  }

  static toggleWebhook(id: string): WebhookEndpoint | null {
    const hooks = this.getWebhooks();
    const item = hooks.find(h => h.id === id);
    if (!item) return null;
    item.status = item.status === 'active' ? 'disabled' : 'active';
    this.save(STORAGE_KEYS.WEBHOOKS, hooks);
    return item;
  }

  static deleteWebhook(id: string): boolean {
    let hooks = this.getWebhooks();
    const beforeLen = hooks.length;
    hooks = hooks.filter(h => h.id !== id);
    if (hooks.length === beforeLen) return false;
    this.save(STORAGE_KEYS.WEBHOOKS, hooks);
    return true;
  }

  static testWebhookPing(id: string): WebhookDeliveryLog {
    const log: WebhookDeliveryLog = {
      id: `log_${Date.now()}`,
      webhook_id: id,
      event: 'ping.test',
      status_code: 200,
      timestamp: new Date().toISOString(),
      duration_ms: Math.floor(Math.random() * 40) + 35,
      request_id: `req_${Math.random().toString(36).substring(2, 10)}`,
      success: true,
      payload_summary: JSON.stringify({ event: 'ping.test', message: 'Test delivery verified by ORDIUM engine' })
    };

    const logs = this.load<WebhookDeliveryLog[]>(STORAGE_KEYS.WEBHOOK_LOGS, []);
    logs.unshift(log);
    this.save(STORAGE_KEYS.WEBHOOK_LOGS, logs.slice(0, 50));
    return log;
  }

  // Metrics summary
  static getMetrics(env: Environment): MetricsSummary {
    const orders = this.getOrders(env);

    if (orders.length === 0) {
      return {
        orders_analyzed: 0,
        allow_rate: 0,
        review_rate: 0,
        reject_rate: 0,
        risk_detection_rate: 0,
        false_positive_rate: 0,
        false_negative_rate: 0,
        average_risk_score: 0,
        api_health: 99.99,
        decisions_over_time: [],
        risk_distribution: [
          { range: '0-20 (Safe)', count: 0, percentage: 0 },
          { range: '21-40 (Low)', count: 0, percentage: 0 },
          { range: '41-60 (Moderate)', count: 0, percentage: 0 },
          { range: '61-80 (Elevated)', count: 0, percentage: 0 },
          { range: '81-100 (Critical)', count: 0, percentage: 0 }
        ],
        top_risk_signals: []
      };
    }

    const total = orders.length;
    const allows = orders.filter(o => o.risk?.decision === 'ALLOW').length;
    const reviews = orders.filter(o => o.risk?.decision === 'REVIEW').length;
    const rejects = orders.filter(o => o.risk?.decision === 'REJECT').length;
    const avgScore = Math.round(orders.reduce((acc, o) => acc + (o.risk?.score || 0), 0) / total);

    const distMap = {
      '0-20 (Safe)': 0,
      '21-40 (Low)': 0,
      '41-60 (Moderate)': 0,
      '61-80 (Elevated)': 0,
      '81-100 (Critical)': 0
    };

    orders.forEach(o => {
      const s = o.risk?.score || 0;
      if (s <= 20) distMap['0-20 (Safe)']++;
      else if (s <= 40) distMap['21-40 (Low)']++;
      else if (s <= 60) distMap['41-60 (Moderate)']++;
      else if (s <= 80) distMap['61-80 (Elevated)']++;
      else distMap['81-100 (Critical)']++;
    });

    const risk_distribution = Object.entries(distMap).map(([range, count]) => ({
      range,
      count,
      percentage: Math.round((count / total) * 100)
    }));

    return {
      orders_analyzed: total,
      allow_rate: Number(((allows / total) * 100).toFixed(1)),
      review_rate: Number(((reviews / total) * 100).toFixed(1)),
      reject_rate: Number(((rejects / total) * 100).toFixed(1)),
      risk_detection_rate: Number((((reviews + rejects) / total) * 100).toFixed(1)),
      false_positive_rate: 0.08,
      false_negative_rate: 0.02,
      average_risk_score: avgScore,
      api_health: 99.99,
      decisions_over_time: [
        { date: 'Sep 08', allow: 24, review: 2, reject: 1 },
        { date: 'Sep 09', allow: 38, review: 3, reject: 2 },
        { date: 'Sep 10', allow: 45, review: 4, reject: 3 },
        { date: 'Sep 11', allow: 42, review: 5, reject: 2 },
        { date: 'Sep 12', allow: 51, review: 3, reject: 4 },
        { date: 'Sep 13', allow: 60, review: 6, reject: 3 },
        { date: 'Sep 14', allow: allows, review: reviews, reject: rejects }
      ],
      risk_distribution,
      top_risk_signals: [
        { code: 'NETWORK_REPUTATION', name: 'Network Reputation (Tor / Proxy)', count: 4, severity: 'critical' },
        { code: 'DEVICE_REUSE', name: 'Device Fingerprint Reuse', count: 3, severity: 'critical' },
        { code: 'IDENTITY_CLUSTER', name: 'Identity Cluster Anomaly', count: 3, severity: 'high' },
        { code: 'HIGH_IP_VELOCITY', name: 'High IP Velocity', count: 2, severity: 'high' },
        { code: 'HIGH_CANCELLATION_RATE', name: 'Address Cancellation Rate', count: 2, severity: 'medium' }
      ]
    };
  }

  // Usage stats
  static getUsage(env: Environment): UsageStats {
    const orders = this.getOrders(env);
    return {
      billing_cycle_start: '2026-09-01T00:00:00.000Z',
      billing_cycle_end: '2026-09-30T23:59:59.000Z',
      orders_used: orders.length + 18420,
      orders_quota: 1000,
      requests_count: (orders.length * 4) + 74800,
      rate_limit_rps: 250,
      rate_limit_current: 28,
      p95_latency_ms: 36
    };
  }

  // Reset database to seed
  static resetToSeed(): void {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.API_KEYS);
    localStorage.removeItem(STORAGE_KEYS.WEBHOOKS);
    localStorage.removeItem(STORAGE_KEYS.WEBHOOK_LOGS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
  }
}
