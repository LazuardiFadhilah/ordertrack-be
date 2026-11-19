import { Router } from 'express';
import { createReminderService } from '../services/reminders.js';

export function createCronRouter({ goodsReceiptModel, shippingRequestModel, deliveryOrderModel, invoiceModel, notificationModel, notificationService, userModel, settings }) {
  const router = Router();
  const service = createReminderService({ goodsReceiptModel, shippingRequestModel, deliveryOrderModel, invoiceModel, notificationModel, notificationService, userModel });
  router.post('/reminders', async (request, response, next) => {
    const secret = settings.cronSecret;
    if (!secret || request.get('authorization') !== `Bearer ${secret}`) {
      return response.status(401).json({ success: false, message: 'Unauthorized', errors: [] });
    }
    try {
      const result = await service.run();
      return response.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
