import { ordiumClient } from './client';
import { Environment, MetricsSummary } from './types';
export const metricsApi = { getSummary: async (_env: Environment = 'live'): Promise<MetricsSummary> => ordiumClient.getMetrics() };
