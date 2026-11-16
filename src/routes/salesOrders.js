import { Router } from 'express';
import SalesOrder from '../models/SalesOrder.js';
import VendorPO from '../models/VendorPO.js';
import GoodsReceipt from '../models/GoodsReceipt.js';
import { authenticateUser } from '../middleware/auth.js';
import { createSalesOrdersController } from '../controllers/salesOrders.js';

export function createSalesOrdersRouter({
  salesOrderModel = SalesOrder,
  vendorPoModel = VendorPO,
  goodsReceiptModel = GoodsReceipt,
  authenticate = authenticateUser,
} = {}) {
  const router = Router();
  const controller = createSalesOrdersController({ salesOrderModel, vendorPoModel, goodsReceiptModel });

  router.use(authenticate);
  router.get('/', controller.list);
  router.get('/:id', controller.get);

  return router;
}

export default createSalesOrdersRouter();
