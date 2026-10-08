import { AccountSettingsUpdate, AuthSession, ChangePasswordPayload, LoginCredentials, RegisterPayload } from './types';
export interface SessionInfo { id:string; created_at:string; last_seen_at:string; expires_at:string; current:boolean; }
import { ControlPlaneError, CONTROL_PLANE_CONFIG, controlPlaneFetch } from './controlPlane';
import { OrdiumApiError } from './client';

export interface AuthCapabilityStatus {
  hasAccountEndpoints: boolean;
  apiKeyAuthActive: boolean;
  registrationStatus: 'invite_only' | 'closed_preview' | 'open' | 'api_key_only';
  message: string;
}

function fromControlPlaneError(error: unknown): OrdiumApiError {
  if (error instanceof ControlPlaneError) {
    return new OrdiumApiError(error.statusCode, error.code, error.message, error.requestId);
  }
  return OrdiumApiError.fromStatus(500, 'Unable to reach the ORDIUM account service.');
}

export const authApi = {
  getCapabilities(): AuthCapabilityStatus {
    const configured = Boolean(CONTROL_PLANE_CONFIG.baseUrl);
    return {
      hasAccountEndpoints: configured,
      apiKeyAuthActive: true,
      registrationStatus: configured ? 'open' : 'closed_preview',
      message: configured
        ? 'Connected to the ORDIUM account service.'
        : 'Account service is not configured.',
    };
  },

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      const session = await controlPlaneFetch<AuthSession>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return session;
    } catch (error) {
      throw fromControlPlaneError(error);
    }
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    if (!payload.organization?.trim()) {
      throw OrdiumApiError.fromStatus(422, 'Store or company name is required.', 'organization');
    }
    try {
      const session = await controlPlaneFetch<AuthSession>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          first_name: payload.first_name ?? '',
          last_name: payload.last_name ?? '',
          organization_name: payload.organization,
          country: payload.country ?? 'Algeria',
          wilaya: payload.wilaya ?? null,
          city: payload.city ?? null,
          website_url: payload.website_url ?? null,
          ecommerce_platform: payload.ecommerce_platform ?? null,
          business_type: payload.business_type ?? null,
          primary_market: payload.primary_market ?? null,
          phone: payload.phone ?? null,
          monthly_orders: payload.monthly_orders ?? null,
        }),
      });
      return session;
    } catch (error) {
      throw fromControlPlaneError(error);
    }
  },

  async verifyEmail(token: string): Promise<AuthSession> {
    try {
      const session = await controlPlaneFetch<AuthSession>(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'POST' });
      return session;
    } catch (error) {
      throw fromControlPlaneError(error);
    }
  },

  async updateAccount(payload: AccountSettingsUpdate): Promise<AuthSession> {
    try {
      return await controlPlaneFetch<AuthSession>('/api/v1/auth/account', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw fromControlPlaneError(error);
    }
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    try {
      await controlPlaneFetch<void>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw fromControlPlaneError(error);
    }
  },

  async exportAccount(): Promise<void> { const response = await fetch(`${CONTROL_PLANE_CONFIG.baseUrl}/api/v1/auth/export`, { credentials:'include' }); if (!response.ok) throw OrdiumApiError.fromStatus(response.status, 'Unable to export account data.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download='ordium-account-export.json'; link.click(); URL.revokeObjectURL(url); },
  async listSessions(): Promise<SessionInfo[]> { try { return await controlPlaneFetch<SessionInfo[]>('/api/v1/auth/sessions', { method: 'GET' }); } catch (error) { throw fromControlPlaneError(error); } },
  async revokeSession(id: string): Promise<void> { try { await controlPlaneFetch<void>(`/api/v1/auth/sessions/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' }); } catch (error) { throw fromControlPlaneError(error); } },
  async revokeOtherSessions(): Promise<void> { try { await controlPlaneFetch<void>('/api/v1/auth/sessions/revoke-others', { method: 'POST', body: '{}' }); } catch (error) { throw fromControlPlaneError(error); } },

  async me(): Promise<AuthSession> {
    try {
      return await controlPlaneFetch<AuthSession>('/api/v1/auth/me', { method: 'GET' });
    } catch (error) {
      throw fromControlPlaneError(error);
    }
  },

  async logout(): Promise<void> {
    try {
      await controlPlaneFetch<void>('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      // Best-effort logout; browser cookie is server-managed.
    } finally {
    }
  },
};
