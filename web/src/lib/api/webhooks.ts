import { ordiumClient } from './client';
import { Environment, WebhookDeliveryLog, WebhookEndpoint } from './types';
export const webhooksApi = {
  listEndpoints: async (_env?: Environment): Promise<WebhookEndpoint[]> => ordiumClient.getWebhooks(),
  createEndpoint: async (url: string, description: string, _env: Environment, events: string[]) => { const webhook = await ordiumClient.createWebhook({ url, description, events }); return { webhook, rawSecret: webhook.secret || '' }; },
  toggleEndpoint: async (id: string) => { await ordiumClient.deleteWebhook(id); const endpoints = await ordiumClient.getWebhooks(); const item = endpoints.find(x => x.id === id); if (!item) throw new Error('Webhook not found'); return item; },
  deleteEndpoint: (id: string) => ordiumClient.deleteWebhook(id),
  testEndpoint: (id: string): Promise<WebhookDeliveryLog> => ordiumClient.testWebhook(id),
};
