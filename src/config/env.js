const port = Number.parseInt(process.env.PORT ?? '3000', 10);

export const env = {
  port: Number.isNaN(port) ? 3000 : port,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'ordertrack_session',
  authCookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
  storage: {
    provider: process.env.STORAGE_PROVIDER,
    bucket: process.env.STORAGE_BUCKET,
  },
};
