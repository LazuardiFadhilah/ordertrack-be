import express from 'express';
import healthRouter from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createCustomersRouter } from './routes/customers.js';
import { createVendorsRouter } from './routes/vendors.js';
import { createQuotationsRouter } from './routes/quotations.js';
import { createSalesOrdersRouter } from './routes/salesOrders.js';
import { createVendorPosRouter } from './routes/vendorPos.js';
import { createGoodsReceiptsRouter } from './routes/goodsReceipts.js';
import docsRouter from './routes/docs.js';
import { User } from './models/User.js';
import { Customer } from './models/Customer.js';
import { Vendor } from './models/Vendor.js';
import { Quotation } from './models/Quotation.js';
import { SalesOrder } from './models/SalesOrder.js';
import { VendorPO } from './models/VendorPO.js';
import { GoodsReceipt } from './models/GoodsReceipt.js';
import { ShippingRequest } from './models/ShippingRequest.js';
import { DeliveryOrder } from './models/DeliveryOrder.js';
import { Invoice, Payment } from './models/invoice.js';
import { VendorPayment } from './models/vendorPayment.js';
import { Document } from './models/Document.js';
import { Notification } from './models/Notification.js';
import { ActivityLog } from './models/ActivityLog.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createNotificationService } from './services/notifications.js';
import { createDocumentsRouter } from './routes/documents.js';

// Storage credentials remain local; the API currently records metadata only.
import { createVendorPaymentRouter } from './routes/vendorPayment.js';
import { createAuthenticateUser } from './middleware/auth.js';
import { createShippingRouter } from './routes/shipping.js';
import { createInvoiceRouter } from './routes/invoice.js';
import { ApiError } from './services/shared.js';
import { env } from './config/env.js';

export function createApp({
  userModel = User,
  customerModel = Customer,
  vendorModel = Vendor,
  quotationModel = Quotation,
  salesOrderModel = SalesOrder,
  vendorPoModel = VendorPO,
  goodsReceiptModel = GoodsReceipt,
  shippingRequestModel = ShippingRequest,
  deliveryOrderModel = DeliveryOrder,
  invoiceModel = Invoice,
  paymentModel = Payment,
  vendorPaymentModel = VendorPayment,
  documentModel = Document,
  notificationModel = Notification,
  activityLogModel = ActivityLog,
  settings = env,
} = {}) {
  const app = express();
  const authenticate = createAuthenticateUser(userModel, settings);
  const notificationService = createNotificationService({ notificationModel, activityLogModel, userModel });

  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api/docs', docsRouter);
  app.use('/api/auth', createAuthRouter({ userModel, settings }));
  app.use('/api/customers', createCustomersRouter({ customerModel, authenticate }));
  app.use('/api/vendors', createVendorsRouter({ vendorModel, authenticate }));
  app.use('/api/quotations', createQuotationsRouter({ quotationModel, customerModel, salesOrderModel, authenticate }));
  app.use('/api/sales-orders', createSalesOrdersRouter({ salesOrderModel, vendorPoModel, goodsReceiptModel, authenticate }));
  app.use('/api/vendor-pos', createVendorPosRouter({ salesOrderModel, vendorPoModel, vendorModel, goodsReceiptModel, notificationService, authenticate }));
  app.use('/api/goods-receipts', createGoodsReceiptsRouter({ salesOrderModel, vendorPoModel, goodsReceiptModel, notificationService, authenticate }));
  app.use('/api/shipping', createShippingRouter({ salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, notificationService, authenticate }));
  app.use('/api/invoices', createInvoiceRouter({ invoiceModel, paymentModel, salesOrderModel, notificationService, userModel, authenticate }));
  app.use('/api/vendor-payments', createVendorPaymentRouter({ vendorPoModel, vendorPaymentModel, salesOrderModel, authenticate }));
  app.use('/api/documents', createDocumentsRouter({ documentModel, notificationService, authenticate }));
  app.use('/api/notifications', createNotificationsRouter({ notificationModel, activityLogModel, userModel, authenticate }));

  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      message: 'Route not found',
      errors: [],
    });
  });

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({
        success: false,
        message: 'Invalid JSON body',
        errors: [],
      });
    }

    if (error instanceof ApiError) {
      return response.status(error.status).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }

    console.error('[api] unhandled error:', error.name, error.message);

    return response.status(500).json({
      success: false,
      message: 'Internal server error',
      errors: [],
    });
  });

  return app;
}

export default createApp();
