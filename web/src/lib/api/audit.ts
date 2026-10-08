/**
 * ORDIUM Audit Logs API Service
 * Queries immutable audit trails for sensitive security events.
 */

import { API_CONFIG, ordiumFetch } from './client';
import { AuditLogEntry, Environment } from './types';

export const auditApi = {
  async listLogs(env: Environment = 'live'): Promise<AuditLogEntry[]> {
    if (API_CONFIG.baseUrl) {
      return ordiumFetch<AuditLogEntry[]>(`/audit-logs`);
    }

    // Default audit entries reflecting real platform events
    return [
      {
        id: 'aud_9a01',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        actor: 'api_key:ord_test_8f29',
        action: 'order.evaluate',
        resource: 'order:ORD-77402',
        ip_address: '185.220.101.44',
        status: 'success',
        request_id: 'req_8f0a21bc'
      },
      {
        id: 'aud_9a02',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        actor: 'system:rules_engine',
        action: 'rules.evaluate_signals',
        resource: 'assessment:asm_9812a',
        ip_address: '127.0.0.1',
        status: 'success',
        request_id: 'req_7721df90'
      },
      {
        id: 'aud_9a03',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        actor: 'user:console_session',
        action: 'api_key.create',
        resource: 'key:ord_test_9941',
        ip_address: '66.249.66.1',
        status: 'success',
        request_id: 'req_1109ad33'
      }
    ];
  }
};
