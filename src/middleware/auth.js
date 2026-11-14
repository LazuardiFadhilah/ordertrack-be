import User from '../models/User.js';
import { env } from '../config/env.js';
import { getAuthConfig, toSafeUser, verifySession } from '../services/auth.js';

function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return null;
}

function unauthorized(response) {
  return response.status(401).json({
    success: false,
    message: 'Authentication required',
    errors: [],
  });
}

export function createAuthenticateUser(userModel = User, settings = env) {
  return async function authenticateUserMiddleware(request, response, next) {
    try {
      const { authCookieName } = getAuthConfig(settings);
      const token = readCookie(request, authCookieName);
      if (!token) return unauthorized(response);

      const payload = verifySession(token, settings);
      const user = await userModel.findById(payload.sub).lean();
      if (!user) return unauthorized(response);

      request.user = toSafeUser(user);
      return next();
    } catch {
      return unauthorized(response);
    }
  };
}

export const authenticateUser = createAuthenticateUser();

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user) {
      return unauthorized(response);
    }

    if (!roles.includes(request.user.role)) {
      return response.status(403).json({
        success: false,
        message: 'Forbidden',
        errors: [],
      });
    }

    return next();
  };
}
