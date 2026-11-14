import express from 'express';
import { connectToDatabase } from '../src/db/mongoose.js';
import app from '../src/app.js';

const server = express();

server.use(async (_request, response, next) => {
  try {
    await connectToDatabase();
    return next();
  } catch (error) {
    console.error('[db] connection failed:', error.name, error.message);
    return response.status(503).json({
      success: false,
      message: 'Database unavailable',
      errors: [],
    });
  }
});

server.use(app);

export default server;
