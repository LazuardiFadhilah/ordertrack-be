import { createShippingService } from '../services/shipping.js';

export function createShippingController({ salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, notificationService }) {
  const service = createShippingService({ salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, notificationService });

  return {
    async listRequests(request, response) {
      response.json({ success: true, data: await service.listRequests(request.query, request.user) });
    },
    async getRequest(request, response) {
      response.json({ success: true, data: { shippingRequest: await service.getRequest(request.params.id, request.user) } });
    },
    async createRequest(request, response) {
      response.status(201).json({ success: true, data: { shippingRequest: await service.createRequest(request.body, request.user) } });
    },
    async listDeliveryOrders(request, response) {
      response.json({ success: true, data: await service.listDeliveryOrders(request.query, request.user) });
    },
    async getDeliveryOrder(request, response) {
      response.json({ success: true, data: { deliveryOrder: await service.getDeliveryOrder(request.params.id, request.user) } });
    },
    async createDeliveryOrder(request, response) {
      response.status(201).json({ success: true, data: { deliveryOrder: await service.createDeliveryOrder(request.body, request.user) } });
    },
    async markSignedReturned(request, response) {
      response.json({ success: true, data: { deliveryOrder: await service.markSignedReturned(request.params.id, request.user) } });
    },
  };
}
