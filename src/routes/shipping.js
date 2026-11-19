import { Router } from 'express';
import SalesOrder from '../models/SalesOrder.js';
import VendorPO from '../models/VendorPO.js';
import GoodsReceipt from '../models/GoodsReceipt.js';
import ShippingRequest from '../models/ShippingRequest.js';
import DeliveryOrder from '../models/DeliveryOrder.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createShippingController } from '../controllers/shipping.js';

export function createShippingRouter({
  salesOrderModel = SalesOrder,
  vendorPoModel = VendorPO,
  goodsReceiptModel = GoodsReceipt,
  shippingRequestModel = ShippingRequest,
  deliveryOrderModel = DeliveryOrder,
  notificationService,
  authenticate = authenticateUser,
} = {}) {
  const router = Router();
  const controller = createShippingController({ salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, notificationService });

  // Shipping Requests
  router.get('/shipping-requests', authenticate, controller.listRequests);
  router.get('/shipping-requests/:id', authenticate, controller.getRequest);
  router.post('/shipping-requests', authenticate, requireRole('SALES', 'GA', 'ADMIN'), controller.createRequest);

  // Delivery Orders
  router.get('/delivery-orders', authenticate, controller.listDeliveryOrders);
  router.get('/delivery-orders/:id', authenticate, controller.getDeliveryOrder);
  router.post('/delivery-orders', authenticate, requireRole('GA', 'ADMIN'), controller.createDeliveryOrder);
  router.patch('/delivery-orders/:id/signed-returned', authenticate, requireRole('GA', 'ADMIN', 'AR'), controller.markSignedReturned);

  return router;
}

export default createShippingRouter();
