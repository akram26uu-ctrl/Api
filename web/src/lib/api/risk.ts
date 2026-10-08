import { ordiumClient } from './client';
import { CreateOrderRequest, RiskAssessment } from './types';
export const riskApi = {
  async evaluate(payload: CreateOrderRequest): Promise<RiskAssessment> {
    const order = await ordiumClient.createOrder(payload);
    return order.risk!;
  }
};
