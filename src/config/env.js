const port = Number.parseInt(process.env.PORT ?? '3000', 10);

export const env = {
  port: Number.isNaN(port) ? 3000 : port,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  storage: {
    provider: process.env.STORAGE_PROVIDER,
    bucket: process.env.STORAGE_BUCKET,
  },
};
