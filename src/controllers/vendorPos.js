import { createVendorPoService } from '../services/vendorPo.js';

export function createVendorPosController({ salesOrderModel, vendorPoModel, vendorModel, goodsReceiptModel, notificationService }) {
  const service = createVendorPoService({ salesOrderModel, vendorPoModel, vendorModel, goodsReceiptModel, notificationService });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query, request.user) });
    },
    async get(request, response) {
      response.json({ success: true, data: { vendorPo: await service.get(request.params.id, request.user) } });
    },
    async create(request, response) {
      response.status(201).json({ success: true, data: { vendorPo: await service.create(request.body, request.user) } });
    },
  };
}
