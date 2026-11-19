const port = Number.parseInt(process.env.PORT ?? '3000', 10);

export const env = {
  port: Number.isNaN(port) ? 3000 : port,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'ordertrack_session',
  authCookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
  cronSecret: process.env.CRON_SECRET ?? '',
  storage: {
    blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
    provider: process.env.STORAGE_PROVIDER,
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    endpoint: process.env.STORAGE_ENDPOINT,
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
};
