import { createSalesOrderService } from '../services/salesOrders.js';

export function createSalesOrdersController({ salesOrderModel }) {
  const service = createSalesOrderService({ salesOrderModel });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query, request.user) });
    },
    async get(request, response) {
      response.json({ success: true, data: { salesOrder: await service.get(request.params.id, request.user) } });
    },
  };
}
