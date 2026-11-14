import { Router } from 'express';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { createAuthController } from '../controllers/auth.js';
import { createAuthenticateUser } from '../middleware/auth.js';

export function createAuthRouter({ userModel = User, settings = env } = {}) {
  const router = Router();
  const controller = createAuthController({ userModel, settings });
  const authenticate = createAuthenticateUser(userModel, settings);

  router.post('/login', controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);

  return router;
}

export default createAuthRouter();
