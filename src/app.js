import express from 'express';
import healthRouter from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createCustomersRouter } from './routes/customers.js';
import { createVendorsRouter } from './routes/vendors.js';
import { createQuotationsRouter } from './routes/quotations.js';
import { createSalesOrdersRouter } from './routes/salesOrders.js';
import docsRouter from './routes/docs.js';
import User from './models/User.js';
import Customer from './models/Customer.js';
import Vendor from './models/Vendor.js';
import Quotation from './models/Quotation.js';
import SalesOrder from './models/SalesOrder.js';
import { createAuthenticateUser } from './middleware/auth.js';
import { ApiError } from './services/shared.js';
import { env } from './config/env.js';

export function createApp({
  userModel = User,
  customerModel = Customer,
  vendorModel = Vendor,
  quotationModel = Quotation,
  salesOrderModel = SalesOrder,
  settings = env,
} = {}) {
  const app = express();
  const authenticate = createAuthenticateUser(userModel, settings);

  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api/docs', docsRouter);
  app.use('/api/auth', createAuthRouter({ userModel, settings }));
  app.use('/api/customers', createCustomersRouter({ customerModel, authenticate }));
  app.use('/api/vendors', createVendorsRouter({ vendorModel, authenticate }));
  app.use('/api/quotations', createQuotationsRouter({ quotationModel, customerModel, salesOrderModel, authenticate }));
  app.use('/api/sales-orders', createSalesOrdersRouter({ salesOrderModel, authenticate }));

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
