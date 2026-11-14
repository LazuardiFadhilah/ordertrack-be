import { z } from 'zod';
import { env } from '../config/env.js';
import {
  authenticateCredentials,
  getAuthConfig,
  INVALID_CREDENTIALS_MESSAGE,
  signSession,
  toSafeUser,
} from '../services/auth.js';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function validationErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

function serializeCookie(name, value, { secure, maxAge } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function createAuthController({ userModel, settings = env }) {
  return {
    async login(request, response, next) {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return response.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: validationErrors(parsed.error),
        });
      }

      try {
        const user = await authenticateCredentials(userModel, parsed.data.email.toLowerCase(), parsed.data.password);
        if (!user) {
          return response.status(401).json({
            success: false,
            message: INVALID_CREDENTIALS_MESSAGE,
            errors: [],
          });
        }

        const config = getAuthConfig(settings);
        response.setHeader('Set-Cookie', serializeCookie(config.authCookieName, signSession(user, settings), {
          secure: config.authCookieSecure,
        }));
        return response.status(200).json({
          success: true,
          data: { user: toSafeUser(user) },
        });
      } catch (error) {
        return next(error);
      }
    },

    logout(_request, response) {
      const config = getAuthConfig(settings);
      response.setHeader('Set-Cookie', serializeCookie(config.authCookieName, '', {
        secure: config.authCookieSecure,
        maxAge: 0,
      }));
      return response.status(200).json({ success: true, data: null });
    },

    me(request, response) {
      return response.status(200).json({
        success: true,
        data: { user: request.user },
      });
    },
  };
}
