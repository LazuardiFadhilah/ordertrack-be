import express from 'express';
import healthRouter from './routes/health.js';

const app = express();

app.use(express.json());
app.use('/api', healthRouter);

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

  return response.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [],
  });
});

export default app;
