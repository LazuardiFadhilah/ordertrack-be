import mongoose from 'mongoose';
import { env } from '../config/env.js';

const cache = globalThis.__orderTrackMongooseCache ?? {
  connection: null,
  promise: null,
};

globalThis.__orderTrackMongooseCache = cache;

export async function connectToDatabase(uri = env.mongodbUri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (cache.connection) {
    return cache.connection;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri).then(() => mongoose.connection).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }

  cache.connection = await cache.promise;
  return cache.connection;
}
