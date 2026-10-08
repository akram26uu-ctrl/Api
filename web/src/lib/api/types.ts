/**
 * ORDIUM Fraud Detection & Order Risk Intelligence
 * Typed API Contracts & Domain Models
 */

export type Environment = 'live' | 'test';

export interface Store { id: string; name: string; slug: string; is_active: boolean; created_at: string; order_count?: number; }

export type RiskDecision = 'ALLOW' | 'REVIEW' | 'REJECT';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  id: string;
  code: string;
  name: string;
  category: 'identity' | 'network' | 'behavioral' | 'velocity' | 'historical';
  severity: SignalSeverity;
  weight: number;
  description: string;
  value?: string | number | boolean;
}

export interface RiskCategoryBreakdown {
  score: number; // 0 - 100
  weight: number;
  status: 'safe' | 'moderate' | 'elevated' | 'critical';
  signals: RiskSignal[];
}

export interface RiskEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface RiskAssessment {
  id: string;
  order_id: string;
  score: number; // 0 - 100
  decision: RiskDecision;
  evaluated_at: string;
  execution_time_ms: number | null;
  rules_version: string;
  confidence: number | null;
  categories: {
    identity: RiskCategoryBreakdown;
    network: RiskCategoryBreakdown;
    behavioral: RiskCategoryBreakdown;
    velocity: RiskCategoryBreakdown;
    historical: RiskCategoryBreakdown;
  };
  signals: RiskSignal[];
  events: RiskEvent[];
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  ip_address: string;
  user_agent?: string;
  device_id: string;
  first_seen_at?: string;
  total_orders?: number;
  chargeback_count?: number;
}

export interface OrderItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  category?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'evaluated' | 'flagged' | 'fulfilled';

export type OrderOutcome = 'fulfilled' | 'chargeback' | 'cancelled_fraud' | 'return_abusive' | 'pending' | 'legitimate' | 'false_positive';

export type RiskOutcome = OrderOutcome;

export interface Order {
  id: string;
  order_number: string;
  amount: number;
  currency: string;
  created_at: string;
  environment: Environment;
  status: OrderStatus;
  customer: CustomerProfile;
  shipping_address: Address;
  billing_address?: Address;
  items?: OrderItem[];
  risk?: RiskAssessment;
  outcome?: OrderOutcome;
  outcome_reported_at?: string;
}

export interface CreateOrderRequest {
  order_number: string;
  amount: number;
  currency: string;
  customer: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    ip_address: string;
    user_agent?: string;
    device_id: string;
  };
  shipping_address?: Address;
  billing_address?: Address;
  items?: OrderItem[];
  environment?: Environment;
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  environment?: Environment;
  decision?: RiskDecision | 'ALL';
  search?: string;
  min_score?: number;
  max_score?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export type EntityType = 'customer' | 'phone' | 'device' | 'address' | 'ip' | 'order';

export interface IdentityNode {
  id: string;
  type: EntityType;
  label: string;
  value: string;
  risk_level: 'safe' | 'warning' | 'danger';
  connected_count: number;
  cluster_id?: string;
  metadata?: Record<string, any>;
  x?: number;
  y?: number;
  z?: number;
}

export interface IdentityEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: number | null;
  risk_weight: number;
  type?: string;
}

export interface IdentityGraphData {
  nodes: IdentityNode[];
  edges: IdentityEdge[];
  clusters_detected: number;
  suspicious_cluster_ids: string[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string; // e.g. "ord_test_8f29..."
  environment: Environment;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  status: 'active' | 'revoked';
  store_id?: string | null;
  raw_key_secret?: string; // only present on immediate creation
}

export interface CreateApiKeyRequest {
  name: string;
  environment: Environment;
  scopes: string[];
}


export interface DashboardNotification {
  id: string;
  environment: Environment;
  store_id?: string | null;
  notification_type: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, any> | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationPage {
  data: DashboardNotification[];
  unread_count: number;
  pagination: { total: number; limit: number };
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  environment: Environment;
  events: string[];
  status: 'active' | 'disabled';
  created_at: string;
  store_id?: string | null;
  failure_rate?: number;
  secret_preview?: string; // "whsec_..."
  last_delivery?: {
    status_code: number;
    timestamp: string;
    success: boolean;
  };
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number;
  timestamp: string;
  duration_ms: number;
  request_id: string;
  success: boolean;
  payload_summary: string;
}

export type WebhookDelivery = WebhookDeliveryLog;

export interface MetricsSummary {
  orders_analyzed?: number;
  total_orders?: number;
  total_volume?: number;
  fraud_blocked_volume?: number;
  avg_execution_time_ms?: number;
  allow_count?: number;
  review_count?: number;
  reject_count?: number;
  allow_percentage?: number;
  review_percentage?: number;
  reject_percentage?: number;
  avg_risk_score?: number;
  allow_rate?: number;
  review_rate?: number;
  reject_rate?: number;
  risk_detection_rate?: number;
  false_positive_rate?: number;
  false_negative_rate?: number;
  average_risk_score?: number;
  api_health?: number;
  decisions_over_time?: {
    date: string;
    allow: number;
    review: number;
    reject: number;
  }[];
  risk_distribution?: {
    range: string;
    count: number;
    percentage: number;
  }[];
  top_risk_signals?: {
    code: string;
    name: string;
    count: number;
    severity: SignalSeverity;
  }[];
}

export interface UsageQuota {
  plan_code: string;
  plan_name: string;
  beta_access: boolean;
  period_start: string;
  period_end: string;
  evaluations_used: number;
  evaluations_limit: number;
  evaluations_remaining: number;
  percent_used: number;
  rate_limit_per_min: number;
  billing_cycle_resets_in_days: number;
  source?: 'live' | 'unavailable';
}

export interface UsageStats {
  billing_cycle_start: string;
  billing_cycle_end: string;
  orders_used: number;
  orders_quota: number;
  requests_count: number;
  rate_limit_rps: number;
  rate_limit_current: number;
  p95_latency_ms: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
    field?: string;
  };
}

// Authentication & Session Models
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: 'owner' | 'admin' | 'analyst' | 'developer' | 'viewer';
  organization?: string;
  created_at?: string;
}

export interface AuthSession {
  user: UserProfile;
  organization?: {
    id: string;
    name: string;
    merchant_id: string | null;
    country: string;
    wilaya?: string | null;
    city?: string | null;
    website_url?: string | null;
    ecommerce_platform?: string | null;
    business_type?: string | null;
    primary_market?: string | null;
    phone?: string | null;
    monthly_orders?: string | null;
  };
  role?: string;
  initial_test_api_key?: string | null;
  verification_required?: boolean;
  verification_token?: string | null;
}

export interface AccountSettingsUpdate {
  first_name: string;
  last_name: string;
  organization_name?: string;
  country?: string;
  wilaya?: string | null;
  city?: string | null;
  website_url?: string | null;
  ecommerce_platform?: string | null;
  business_type?: string | null;
  primary_market?: string | null;
  phone?: string | null;
  monthly_orders?: string | null;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  organization?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  wilaya?: string;
  city?: string;
  website_url?: string;
  business_type?: string;
  ecommerce_platform?: string;
  monthly_orders?: string;
  primary_market?: string;
}

// Audit Logs
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  ip_address: string;
  status: 'success' | 'failure';
  request_id?: string;
  details?: Record<string, any>;
}

// Risk Features & Heuristics
export interface RiskFeature {
  key: string;
  name: string;
  category: 'identity' | 'network' | 'behavioral' | 'velocity' | 'historical';
  description: string;
  type: 'numeric' | 'boolean' | 'categorical';
  weight: number;
  importance: number;
}

