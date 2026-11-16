import { Router } from 'express';
import Customer from '../models/Customer.js';
import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createQuotationsController } from '../controllers/quotations.js';

export function createQuotationsRouter({
  quotationModel = Quotation,
  customerModel = Customer,
  salesOrderModel = SalesOrder,
  authenticate = authenticateUser,
} = {}) {
  const router = Router();
  const controller = createQuotationsController({ quotationModel, customerModel, salesOrderModel });
  const canWrite = requireRole('SALES', 'ADMIN');

  router.use(authenticate);
  router.get('/', controller.list);
  router.post('/', canWrite, controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', canWrite, controller.update);
  router.post('/:id/send', canWrite, controller.send);
  router.post('/:id/lose', canWrite, controller.lose);
  router.post('/:id/convert', canWrite, controller.convert);

  return router;
}

export default createQuotationsRouter();
