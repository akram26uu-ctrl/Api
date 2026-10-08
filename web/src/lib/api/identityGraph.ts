import { ordiumClient } from './client';
import { Environment, IdentityGraphData } from './types';
export const identityGraphApi = { getGraph: async (_env: Environment = 'live'): Promise<IdentityGraphData> => ordiumClient.getIdentityGraph() };
