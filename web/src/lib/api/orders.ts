import { ordiumClient } from './client';
import { CreateOrderRequest, Order, OrderListQuery, OrderOutcome, PaginatedResponse } from './types';
export const ordersApi = {
  async listOrders(query: OrderListQuery = {}): Promise<PaginatedResponse<Order>> {
    const data = await ordiumClient.getOrders(query);
    const page = query.page || 1; const limit = query.limit || data.length || 20;
    return { data, pagination: { total: data.length, page, limit, total_pages: data.length ? Math.ceil(data.length / limit) : 1 } };
  },
  getOrder: (id: string) => ordiumClient.getOrder(id),
  createOrder: (payload: CreateOrderRequest) => ordiumClient.createOrder(payload),
  updateOutcome: (id: string, outcome: OrderOutcome) => ordiumClient.updateOrderOutcome(id, outcome),
};
