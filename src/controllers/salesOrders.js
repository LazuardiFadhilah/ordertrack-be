import { createSalesOrderService } from '../services/salesOrders.js';

export function createSalesOrdersController({ salesOrderModel, vendorPoModel, goodsReceiptModel }) {
  const service = createSalesOrderService({ salesOrderModel, vendorPoModel, goodsReceiptModel });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query, request.user) });
    },
    async get(request, response) {
      response.json({ success: true, data: { salesOrder: await service.get(request.params.id, request.user) } });
    },
  };
}
