import { Router } from 'express';
import { createInvoiceService } from '../services/invoice.js';

export function createInvoiceRouter({ invoiceModel, paymentModel, salesOrderModel, notificationService, userModel, authenticate }) {
  const router = Router();
  const service = createInvoiceService({ invoiceModel, paymentModel, salesOrderModel, notificationService, userModel });
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try { res.json({ success: true, data: await service.listInvoices(req.user, req.query) }); }
    catch (error) { next(error); }
  });
  router.get('/:id', async (req, res, next) => {
    try { res.json({ success: true, data: await service.getInvoiceById(req.params.id, req.user) }); }
    catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.createInvoice(req.body, req.user) }); }
    catch (error) { next(error); }
  });
  router.post('/payments', async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.recordPayment(req.body, req.user) }); }
    catch (error) { next(error); }
  });
  return router;
}
