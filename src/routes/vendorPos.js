import { Router } from 'express';
import SalesOrder from '../models/SalesOrder.js';
import VendorPO from '../models/VendorPO.js';
import Vendor from '../models/Vendor.js';
import GoodsReceipt from '../models/GoodsReceipt.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createVendorPosController } from '../controllers/vendorPos.js';

export function createVendorPosRouter({
  salesOrderModel = SalesOrder,
  vendorPoModel = VendorPO,
  vendorModel = Vendor,
  goodsReceiptModel = GoodsReceipt,
  authenticate = authenticateUser,
} = {}) {
  const router = Router();
  const controller = createVendorPosController({ salesOrderModel, vendorPoModel, vendorModel, goodsReceiptModel });

  router.use(authenticate);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', requireRole('PURCHASING', 'ADMIN'), controller.create);

  return router;
}

export default createVendorPosRouter();
