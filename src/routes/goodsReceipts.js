import { Router } from 'express';
import SalesOrder from '../models/SalesOrder.js';
import VendorPO from '../models/VendorPO.js';
import GoodsReceipt from '../models/GoodsReceipt.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createGoodsReceiptsController } from '../controllers/goodsReceipts.js';

export function createGoodsReceiptsRouter({
  salesOrderModel = SalesOrder,
  vendorPoModel = VendorPO,
  goodsReceiptModel = GoodsReceipt,
  authenticate = authenticateUser,
} = {}) {
  const router = Router();
  const controller = createGoodsReceiptsController({ salesOrderModel, vendorPoModel, goodsReceiptModel });

  router.use(authenticate);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', requireRole('GA', 'ADMIN'), controller.create);

  return router;
}

export default createGoodsReceiptsRouter();
