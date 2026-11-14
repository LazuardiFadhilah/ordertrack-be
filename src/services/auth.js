import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export function toSafeUser(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function authSettings(settings = env) {
  return {
    jwtSecret: settings.jwtSecret,
    jwtExpiresIn: settings.jwtExpiresIn ?? '1h',
    authCookieName: settings.authCookieName ?? 'ordertrack_session',
    authCookieSecure: settings.authCookieSecure === true,
  };
}

function jwtSettings(settings = env) {
  const config = authSettings(settings);
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return config;
}

export async function authenticateCredentials(userModel, email, password) {
  const user = await userModel.findOne({ email }).select('+passwordHash').lean();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  return user;
}

export function signSession(user, settings = env) {
  const config = jwtSettings(settings);
  return jwt.sign({ sub: String(user._id ?? user.id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifySession(token, settings = env) {
  const config = jwtSettings(settings);
  return jwt.verify(token, config.jwtSecret);
}

export function getAuthConfig(settings = env) {
  return authSettings(settings);
}
