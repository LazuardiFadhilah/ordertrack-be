import { createGoodsReceiptService } from '../services/goodsReceipt.js';

export function createGoodsReceiptsController({ salesOrderModel, vendorPoModel, goodsReceiptModel, notificationService }) {
  const service = createGoodsReceiptService({ salesOrderModel, vendorPoModel, goodsReceiptModel, notificationService });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query, request.user) });
    },
    async get(request, response) {
      response.json({ success: true, data: { goodsReceipt: await service.get(request.params.id, request.user) } });
    },
    async create(request, response) {
      response.status(201).json({ success: true, data: { goodsReceipt: await service.create(request.body, request.user) } });
    },
  };
}
