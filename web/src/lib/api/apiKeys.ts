import { ordiumClient } from './client';
import { ApiKey, CreateApiKeyRequest, Environment } from './types';
export const apiKeysApi = {
  listKeys: async (_env?: Environment): Promise<ApiKey[]> => ordiumClient.getApiKeys(),
  createKey: async (payload: CreateApiKeyRequest): Promise<{ apiKey: ApiKey; rawSecret: string }> => { const key = await ordiumClient.createApiKey(payload.name, payload.environment, payload.scopes); return { apiKey: key, rawSecret: key.secret || '' }; },
  revokeKey: async (id: string) => ordiumClient.revokeApiKey(id),
  rotateKey: async (id: string): Promise<{ apiKey: ApiKey; rawSecret: string }> => { const key = await ordiumClient.rotateApiKey(id); return { apiKey: key, rawSecret: key.secret || '' }; },
};
