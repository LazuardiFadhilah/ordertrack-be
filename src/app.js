import express from 'express';
import healthRouter from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import User from './models/User.js';
import { env } from './config/env.js';

export function createApp({ userModel = User, settings = env } = {}) {
  const app = express();

  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api/auth', createAuthRouter({ userModel, settings }));

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
