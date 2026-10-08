/**
 * ORDIUM authenticated API client.
 * The dashboard uses the session-bound API credential issued by Control Plane.
 * Demo/mock data is available only when VITE_ORDIUM_DEMO_MODE=true.
 */
import { CONTROL_PLANE_CONFIG } from './controlPlane';
import {
  ApiErrorResponse, ApiKey, CreateOrderRequest, Environment, IdentityGraphData,
  MetricsSummary, Order, OrderListQuery, OrderOutcome, RiskAssessment, RiskCategoryBreakdown, RiskSignal, DashboardNotification, NotificationPage,
  UsageQuota, WebhookDeliveryLog, WebhookEndpoint, Store, OrderStatus,
} from './types';
import { MockDatabase } from './mockDatabase';

const DEMO_MODE = typeof import.meta !== 'undefined' && !(import.meta as any).env?.PROD && (import.meta as any).env?.VITE_ORDIUM_DEMO_MODE === 'true';

export class OrdiumApiError extends Error {
  public statusCode: number;
  public code: string;
  public requestId: string;
  public field?: string;
  constructor(statusCode: number, code: string, message: string, requestId: string, field?: string) {
    super(message); this.name = 'OrdiumApiError'; this.statusCode = statusCode; this.code = code; this.requestId = requestId; this.field = field;
  }
  static fromStatus(status: number, customMessage?: string, field?: string, requestId?: string) {
    const reqId = requestId || `req_${Date.now()}`;
    const messages: Record<number, [string, string]> = {
      401: ['UNAUTHORIZED', 'Invalid or missing API credential.'],
      403: ['FORBIDDEN', 'Your API credential does not have permission for this resource.'],
      404: ['NOT_FOUND', 'Requested resource could not be found.'],
      409: ['CONFLICT', 'The request conflicts with the current ORDIUM state.'],
      422: ['UNPROCESSABLE_ENTITY', 'Validation failed for the submitted data.'],
      429: ['RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Please retry later.'],
    };
    const [code, message] = messages[status] || ['INTERNAL_SERVER_ERROR', 'ORDIUM service error.'];
    return new OrdiumApiError(status, code, customMessage || message, reqId, field);
  }
}

export const API_CONFIG = {
  baseUrl: CONTROL_PLANE_CONFIG.baseUrl,
  version: 'v1',
};

export async function ordiumFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!CONTROL_PLANE_CONFIG.baseUrl) throw OrdiumApiError.fromStatus(503, 'Account service is not configured.');
  const url = `${CONTROL_PLANE_CONFIG.baseUrl}/api/v1/dashboard${endpoint}`;
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('X-Ordium-Client-Version', '1.5.2-web');
  if (!headers.has('X-Ordium-Environment')) headers.set('X-Ordium-Environment', activeEnvironmentForRequest === 'live' ? 'live' : 'test');
  if (!headers.has('X-Ordium-Store-ID') && activeStoreId) headers.set('X-Ordium-Store-ID', activeStoreId);
  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    let payload: ApiErrorResponse | null = null;
    try { payload = await response.json(); } catch { /* ignore */ }
    throw OrdiumApiError.fromStatus(response.status, payload?.error?.message || (payload as any)?.detail, (payload as any)?.error?.field, response.headers.get('X-Request-ID') || undefined);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0] || 'Customer', parts.slice(1).join(' ') || 'Customer'];
}

function normalizeEnvironment(env?: Environment): 'live' | 'test' { return env === 'live' ? 'live' : 'test'; }

function mapRisk(raw: any): RiskAssessment {
  const events = (raw?.events || []).map((event: any, index: number) => {
    const impact = Number(event?.score_impact ?? 0);
    return {
      id: `${raw.assessment_id}-${index}`,
      timestamp: raw.evaluated_at || new Date().toISOString(),
      type: event.event_type,
      description: event.event_type,
      metadata: event.event_data || {},
      scoreImpact: impact,
    };
  });

  const categoryForEvent = (eventType: string): RiskSignal['category'] => {
    if (/frequency|velocity|burst|repeated/i.test(eventType)) return 'velocity';
    if (/vpn|proxy|tor|ip_|ip_reputation|bot|network/i.test(eventType)) return 'network';
    if (/cancel|unusual_order|duplicate/i.test(eventType)) return 'behavioral';
    if (/phone|device|address|customer|identity/i.test(eventType)) return 'identity';
    return 'historical';
  };

  const signals = events.map((event: any) => {
    const category = categoryForEvent(event.type);
    const impact = Number(event.scoreImpact || 0);
    return {
      id: event.id,
      code: event.type,
      name: event.type,
      category,
      severity: impact >= 30 ? 'high' as const : impact >= 10 ? 'medium' as const : 'low' as const,
      weight: impact,
      description: event.description,
      value: event.metadata,
    };
  });

  const buildCategory = (category: RiskSignal['category']): RiskCategoryBreakdown => {
    const categorySignals = signals.filter(signal => signal.category === category);
    const score = Math.max(0, Math.min(100, categorySignals.reduce((sum, signal) => sum + Math.max(0, Number(signal.weight) || 0), 0)));
    const status = score >= 75 ? 'critical' : score >= 50 ? 'elevated' : score >= 20 ? 'moderate' : 'safe';
    return { score, weight: categorySignals.length ? score / Math.max(1, Number(raw.score || 0)) : 0, status, signals: categorySignals };
  };

  const explanation = raw?.explanation || {};
  return {
    id: raw.assessment_id,
    order_id: raw.order_id || '',
    score: Number(raw.score || 0),
    decision: String(raw.decision || '').toUpperCase() as any,
    evaluated_at: raw.evaluated_at || new Date().toISOString(),
    execution_time_ms: raw.execution_time_ms != null ? Number(raw.execution_time_ms) : null,
    rules_version: raw.rules_version || 'unknown',
    confidence: explanation.identity_confidence != null ? Math.max(0, Math.min(100, Number(explanation.identity_confidence))) / 100 : null,
    categories: {
      identity: buildCategory('identity'),
      network: buildCategory('network'),
      behavioral: buildCategory('behavioral'),
      velocity: buildCategory('velocity'),
      historical: buildCategory('historical'),
    },
    signals,
    events: events.map(({ scoreImpact: _scoreImpact, ...event }: any) => event),
  };
}

function mapOrder(raw: any): Order {
  const [first, last] = [raw.first_name || 'Customer', raw.last_name || 'Customer'];
  const risk = mapRisk(raw.risk || {});
  risk.order_id = raw.order_id;
  return {
    id: raw.order_id,
    order_number: raw.external_order_id,
    amount: Number(raw.total_amount || 0),
    currency: raw.currency || 'DZD',
    created_at: raw.created_at || new Date().toISOString(),
    environment: raw.environment,
    status: raw.status as OrderStatus,
    customer: { id: '', name: `${first} ${last}`.trim(), email: '', phone: raw.phone || '', ip_address: raw.ip_address || '', user_agent: raw.user_agent, device_id: '', total_orders: undefined },
    shipping_address: { street1: '', city: '', state: raw.commune || '', postal_code: '', country: 'DZ' },
    items: (raw.items || []).map((item: any) => ({ id: item.id, name: item.product_name, sku: item.sku || '', price: Number(item.unit_price), quantity: item.quantity, category: item.product_category || undefined })),
    risk,
    outcome: raw.outcome_status === 'delivered' ? 'legitimate' : raw.outcome_status === 'cancelled' ? 'chargeback' : raw.outcome_status === 'returned' ? 'false_positive' : 'pending',
  };
}

let activeEnvironmentForRequest: Environment = 'live';
let activeStoreId: string | null = null;

class OrdiumClientService {
  private activeEnvironment: Environment = 'live';
  getEnvironment() { return this.activeEnvironment; }
  setEnvironment(env: Environment) { this.activeEnvironment = env === 'live' ? 'live' : 'test'; activeEnvironmentForRequest = this.activeEnvironment; }
  getStoreId() { return activeStoreId; }
  setStoreId(storeId: string | null) { activeStoreId = storeId; }

  async getStores(): Promise<Store[]> {
    return ordiumFetch<Store[]>('/stores');
  }

  async createStore(name: string, slug?: string): Promise<Store> {
    return ordiumFetch<Store>('/stores', { method: 'POST', body: JSON.stringify({ name, slug: slug || undefined }) });
  }

  async updateStore(id: string, payload: { name: string; is_active: boolean }): Promise<Store> {
    return ordiumFetch<Store>(`/stores/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async getOrders(query: OrderListQuery & { status?: string } = {}): Promise<Order[]> {
    if (DEMO_MODE) return MockDatabase.getOrders(normalizeEnvironment(query.environment));
    const qs = new URLSearchParams({ page: String(query.page || 1), limit: String(query.limit || 100), });
    if (query.decision && query.decision !== 'ALL') qs.set('decision', String(query.decision).toLowerCase());
    const env = normalizeEnvironment(query.environment || this.activeEnvironment);
    // Environment is carried by the dashboard API credential, not a user-controlled query parameter.
    void env;
    if (query.search) qs.set('search', query.search);
    if (query.status && query.status !== 'all') qs.set('status', query.status);
    if (activeStoreId) qs.set('store_id', activeStoreId);
    const response = await ordiumFetch<{ data: any[]; pagination: any }>(`/orders?${qs.toString()}`);
    return response.data.map(mapOrder);
  }

  async listOrders(query: OrderListQuery & { status?: string } = {}): Promise<{data: Order[]; pagination: {total:number; page:number; limit:number; total_pages:number}}> {
    if (DEMO_MODE) { const data = MockDatabase.getOrders(normalizeEnvironment(query.environment || this.activeEnvironment)); return { data, pagination: { total: data.length, page: query.page || 1, limit: query.limit || 20, total_pages: Math.max(1, Math.ceil(data.length / (query.limit || 20))) } }; }
    const qs = new URLSearchParams({ page: String(query.page || 1), limit: String(query.limit || 20) });
    if (query.decision && query.decision !== 'ALL') qs.set('decision', String(query.decision).toLowerCase());
    if (query.status && query.status !== 'all') qs.set('status', query.status);
    if (query.search?.trim()) qs.set('search', query.search.trim());
    if (activeStoreId) qs.set('store_id', activeStoreId);
    const response = await ordiumFetch<{ data: any[]; pagination: any }>(`/orders?${qs.toString()}`);
    return { data: response.data.map(mapOrder), pagination: response.pagination };
  }

  async getOrder(id: string): Promise<Order> {
    if (DEMO_MODE) { const order = MockDatabase.getOrderById(id); if (!order) throw OrdiumApiError.fromStatus(404); return order; }
    return mapOrder(await ordiumFetch<any>(`/orders/${encodeURIComponent(id)}${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`));
  }

  async createOrder(payload: CreateOrderRequest, options: { simulation?: boolean; storeId?: string | null } = {}): Promise<Order> {
    if (!options.simulation && activeEnvironmentForRequest === 'test') throw OrdiumApiError.fromStatus(403, 'The live dashboard cannot submit orders from TEST mode.');
    if (DEMO_MODE) return MockDatabase.evaluateAndCreateOrder({ ...payload, environment: normalizeEnvironment(payload.environment) });
    const [first_name, ...lastParts] = payload.customer.name.trim().split(/\s+/);
    const last_name = lastParts.join(' ') || first_name || 'Customer';
    const address = payload.shipping_address;
    if (!address) throw OrdiumApiError.fromStatus(422, 'Shipping address is required.', 'shipping_address');
    const body = {
      external_order_id: payload.order_number,
      first_name: first_name || 'Customer', last_name,
      phone: payload.customer.phone, wilaya: address.state || 'Algiers', commune: address.city || 'Algiers', address: address.street1,
      total_amount: payload.amount, currency: String(payload.currency || 'DZD').trim().toUpperCase(),
      items: (payload.items || []).map(item => ({ product_name: item.name, sku: item.sku || null, product_category: item.category || null, quantity: item.quantity, unit_price: item.price })),
    };
    const storeQuery = options.storeId ? `?store_id=${encodeURIComponent(options.storeId)}` : '';
    const raw = await ordiumFetch<any>(`/orders${storeQuery}`, { method: 'POST', headers: { 'Idempotency-Key': options.simulation ? `sim_${crypto.randomUUID()}` : payload.order_number, 'X-Device-Fingerprint': payload.customer.device_id, ...(options.simulation ? { 'X-Ordium-Environment': 'test', 'X-Simulation-IP': payload.customer.ip_address } : {}), ...(options.storeId ? { 'X-Ordium-Store-ID': options.storeId } : {}) }, body: JSON.stringify(body) });
    return mapOrder({ ...raw, first_name: body.first_name, last_name: body.last_name, phone: body.phone, ip_address: payload.customer.ip_address, currency: body.currency, total_amount: body.total_amount, created_at: new Date().toISOString() });
  }

  async updateOrderOutcome(orderId: string, outcome: OrderOutcome): Promise<Order> {
    if (DEMO_MODE) { const updated = MockDatabase.updateOrderOutcome(orderId, outcome); if (!updated) throw OrdiumApiError.fromStatus(404); return updated; }
    const statusMap: Record<string, string> = { legitimate: 'delivered', chargeback: 'cancelled', false_positive: 'returned', delivered: 'delivered', cancelled: 'cancelled', returned: 'returned' };
    await ordiumFetch(`/orders/${encodeURIComponent(orderId)}/outcome${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST', body: JSON.stringify({ outcome_status: statusMap[outcome] || 'returned', source: 'dashboard' }) });
    return this.getOrder(orderId);
  }

  async evaluateRisk(orderId: string): Promise<RiskAssessment> { return (await this.getOrder(orderId)).risk!; }

  async getMetrics(): Promise<MetricsSummary> {
    if (DEMO_MODE) return MockDatabase.getMetrics(normalizeEnvironment(this.activeEnvironment));
    return ordiumFetch<MetricsSummary>(activeStoreId ? `/metrics/summary?store_id=${encodeURIComponent(activeStoreId)}` : '/metrics/summary');
  }

  async getIdentityGraph(): Promise<IdentityGraphData> {
    if (DEMO_MODE) return MockDatabase.getIdentityGraph(normalizeEnvironment(this.activeEnvironment));
    return ordiumFetch<IdentityGraphData>(`/identity-graph?limit=500${activeStoreId ? `&store_id=${encodeURIComponent(activeStoreId)}` : ''}`);
  }

  async getNotifications(limit = 25): Promise<NotificationPage> {
    if (DEMO_MODE) return { data: [], unread_count: 0, pagination: { total: 0, limit } };
    return ordiumFetch<NotificationPage>(`/notifications?limit=${Math.min(Math.max(limit, 1), 100)}${activeStoreId ? `&store_id=${encodeURIComponent(activeStoreId)}` : ''}`);
  }

  async markNotificationRead(id: string): Promise<DashboardNotification> {
    return ordiumFetch<DashboardNotification>(`/notifications/${encodeURIComponent(id)}/read${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST' });
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return ordiumFetch<{ updated: number }>(`/notifications/read-all${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST' });
  }

  async getUsage(): Promise<UsageQuota> {
    if (DEMO_MODE) { const raw = MockDatabase.getUsage(normalizeEnvironment(this.activeEnvironment)); const now = new Date(); const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); const limit = raw.orders_quota; const used = raw.orders_used; return { plan_code: 'demo', plan_name: 'ORDIUM Demo', beta_access: true, period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), period_end: periodEnd.toISOString(), evaluations_used: used, evaluations_limit: limit, evaluations_remaining: Math.max(0, limit - used), percent_used: limit ? Math.min(100, Number(((used / limit) * 100).toFixed(1))) : 100, rate_limit_per_min: Math.round(raw.rate_limit_rps * 60), billing_cycle_resets_in_days: Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000)), source: 'live' }; }
    return ordiumFetch<UsageQuota>('/usage');
  }

  async getRiskProfile(): Promise<any> {
    if (DEMO_MODE) return {};
    return ordiumFetch<any>('/risk-profile');
  }

  async updateRiskProfile(payload: Record<string, number>): Promise<any> {
    if (DEMO_MODE) return payload;
    return ordiumFetch<any>('/risk-profile', { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async getApiKeys(): Promise<ApiKey[]> {
    if (DEMO_MODE) return MockDatabase.getApiKeys(normalizeEnvironment(this.activeEnvironment));
    const raw = await ordiumFetch<any[]>(activeStoreId ? `/api-keys?store_id=${encodeURIComponent(activeStoreId)}` : '/api-keys');
    return raw.map(key => ({ id: key.id, name: key.name, key_prefix: `ordium_${key.environment}_`, environment: key.environment, scopes: key.scopes || [], created_at: key.created_at, last_used_at: key.last_used_at, status: key.is_active ? 'active' : 'revoked', store_id: key.store_id || null }));
  }

  async createApiKey(name: string, env: Environment, scopes: string[] = ['orders:read', 'orders:write', 'outcomes:write']): Promise<ApiKey & { secret?: string }> {
    if (DEMO_MODE) { const res = MockDatabase.createApiKey(name, normalizeEnvironment(env), scopes); return { ...res.apiKey, secret: res.rawSecret }; }
    if (env !== 'live') throw OrdiumApiError.fromStatus(403, 'Customer API keys can only be created for live traffic.');
    const raw = await ordiumFetch<any>('/api-keys', { method: 'POST', body: JSON.stringify({ name, environment: 'live', scopes, store_id: activeStoreId }) });
    return { id: raw.id, name: raw.name, key_prefix: `ordium_${raw.environment}_`, environment: raw.environment, scopes: raw.scopes, created_at: new Date().toISOString(), last_used_at: null, status: 'active', secret: raw.api_key, store_id: raw.store_id || activeStoreId };
  }

  async revokeApiKey(id: string): Promise<boolean> {
    if (DEMO_MODE) return MockDatabase.revokeApiKey(id);
    await ordiumFetch(`/api-keys/${encodeURIComponent(id)}/revoke${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST' }); return true;
  }

  async rotateApiKey(id: string): Promise<ApiKey & { secret?: string }> {
    if (DEMO_MODE) { const res = MockDatabase.rotateApiKey(id); if (!res) throw OrdiumApiError.fromStatus(404); return { ...res.apiKey, secret: res.rawSecret }; }
    const raw = await ordiumFetch<any>(`/api-keys/${encodeURIComponent(id)}/rotate${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST' });
    return { id: raw.id, name: raw.name, key_prefix: `ordium_${raw.environment}_`, environment: raw.environment, scopes: raw.scopes, created_at: new Date().toISOString(), last_used_at: null, status: 'active', secret: raw.api_key, store_id: raw.store_id || activeStoreId };
  }

  async getWebhooks(): Promise<WebhookEndpoint[]> {
    if (DEMO_MODE) return MockDatabase.getWebhooks(normalizeEnvironment(this.activeEnvironment));
    const raw = await ordiumFetch<any[]>(activeStoreId ? `/webhooks?store_id=${encodeURIComponent(activeStoreId)}` : '/webhooks');
    return raw.map(item => ({ id: item.id, url: item.url, description: 'ORDIUM webhook endpoint', environment: item.environment, events: item.events || [], status: item.is_active ? 'active' : 'disabled', created_at: item.created_at, store_id: item.store_id || null, failure_rate: Number(item.failure_rate || 0) }));
  }

  async createWebhook(payload: { url: string; events: string[]; description?: string }): Promise<WebhookEndpoint & { secret?: string }> {
    if (DEMO_MODE) { const res = MockDatabase.createWebhook(payload.url, payload.description || '', normalizeEnvironment(this.activeEnvironment), payload.events); return { ...res.webhook, secret: res.rawSecret }; }
    const raw = await ordiumFetch<any>('/webhooks', { method: 'POST', body: JSON.stringify({ url: payload.url, events: payload.events, store_id: activeStoreId }) });
    return { id: raw.id, url: raw.url, description: payload.description || 'ORDIUM webhook endpoint', environment: raw.environment, events: raw.events, status: 'active', created_at: new Date().toISOString(), store_id: raw.store_id || activeStoreId, secret: raw.signing_secret, failure_rate: 0 };
  }

  async testWebhook(id: string): Promise<WebhookDeliveryLog> {
    if (DEMO_MODE) return { id: `test-${Date.now()}`, webhook_id: id, event: 'webhook.test', status_code: 200, timestamp: new Date().toISOString(), duration_ms: 0, request_id: `req_${Date.now()}`, success: true, payload_summary: 'Demo webhook test' };
    const raw = await ordiumFetch<any>(`/webhooks/${encodeURIComponent(id)}/test${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST' });
    return { id: raw.delivery_id, webhook_id: id, event: 'webhook.test', status_code: raw.status_code || 0, timestamp: new Date().toISOString(), duration_ms: raw.duration_ms || 0, request_id: '', success: Boolean(raw.success), payload_summary: raw.error || 'Test webhook delivery' };
  }
  async deleteWebhook(id: string): Promise<boolean> {
    if (DEMO_MODE) return MockDatabase.deleteWebhook(id);
    await ordiumFetch(`/webhooks/${encodeURIComponent(id)}/disable${activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''}`, { method: 'POST' }); return true;
  }
}

export const ordiumClient = new OrdiumClientService();
