import { ordiumClient } from './client';
import { Environment, UsageStats } from './types';
export const usageApi = {
  async getUsage(_env: Environment = 'live'): Promise<UsageStats> {
    const quota = await ordiumClient.getUsage();
    return { billing_cycle_start: '', billing_cycle_end: '', orders_used: quota.evaluations_used, orders_quota: quota.evaluations_limit, requests_count: quota.evaluations_used, rate_limit_rps: quota.rate_limit_per_min / 60, rate_limit_current: 0, p95_latency_ms: 0 };
  }
};
