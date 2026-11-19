import { Router } from 'express';
import { recordVendorPaymentSchema } from '../validation/vendorPayment.js';
import { recordVendorPayment, listVendorPayments } from '../services/vendorPayment.js';

export function createVendorPaymentRouter({ vendorPoModel, vendorPaymentModel, salesOrderModel, authenticate }) {
  const router = Router();

  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const { soId, vendorPoId } = req.query;
      const payments = await listVendorPayments({ soId, vendorPoId }, { vendorPaymentModel });
      res.json({ success: true, data: payments });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const parsed = recordVendorPaymentSchema.parse(req.body);
      const payment = await recordVendorPayment({ ...parsed, user: req.user }, { vendorPoModel, vendorPaymentModel, salesOrderModel });
      res.status(201).json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createVendorPaymentRouter;
