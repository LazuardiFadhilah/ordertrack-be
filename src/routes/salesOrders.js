import { Router } from 'express';
import SalesOrder from '../models/SalesOrder.js';
import { authenticateUser } from '../middleware/auth.js';
import { createSalesOrdersController } from '../controllers/salesOrders.js';

export function createSalesOrdersRouter({ salesOrderModel = SalesOrder, authenticate = authenticateUser } = {}) {
  const router = Router();
  const controller = createSalesOrdersController({ salesOrderModel });

  router.use(authenticate);
  router.get('/', controller.list);
  router.get('/:id', controller.get);

  return router;
}

export default createSalesOrdersRouter();
