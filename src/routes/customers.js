import { Router } from 'express';
import Customer from '../models/Customer.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createCustomersController } from '../controllers/customers.js';

export function createCustomersRouter({ customerModel = Customer, authenticate = authenticateUser } = {}) {
  const router = Router();
  const controller = createCustomersController({ customerModel });

  router.use(authenticate);
  router.get('/', controller.list);
  router.post('/', requireRole('ADMIN'), controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', requireRole('ADMIN'), controller.update);

  return router;
}

export default createCustomersRouter();
