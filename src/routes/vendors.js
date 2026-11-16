import { Router } from 'express';
import Vendor from '../models/Vendor.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createVendorsController } from '../controllers/vendors.js';

export function createVendorsRouter({ vendorModel = Vendor, authenticate = authenticateUser } = {}) {
  const router = Router();
  const controller = createVendorsController({ vendorModel });

  router.use(authenticate);
  router.get('/', controller.list);
  router.post('/', requireRole('ADMIN'), controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', requireRole('ADMIN'), controller.update);

  return router;
}

export default createVendorsRouter();
