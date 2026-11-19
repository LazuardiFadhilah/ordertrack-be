import { ApiError } from './shared.js';

export const ALLOWED_MIME_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const STORAGE_ENV_NAMES = Object.freeze([
  'STORAGE_PROVIDER', 'STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY',
]);

export function createStorageService(settings = {}) {
  function assertConfigured() {
    const missing = STORAGE_ENV_NAMES.filter((name) => {
      const key = { STORAGE_PROVIDER: 'provider', STORAGE_BUCKET: 'bucket', STORAGE_REGION: 'region', STORAGE_ENDPOINT: 'endpoint', STORAGE_ACCESS_KEY_ID: 'accessKeyId', STORAGE_SECRET_ACCESS_KEY: 'secretAccessKey' }[name];
      return !settings.storage?.[key];
    });
    if (missing.length) throw new ApiError(503, 'Document storage is not configured', missing.map((field) => ({ field, message: 'Required storage environment variable is missing' })));
  }

  return {
    createUploadIntent({ soId, refType, fileName, mimeType, size }) {
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) throw new ApiError(400, 'Invalid request', [{ field: 'mimeType', message: 'Only PDF, JPG, and PNG files are allowed' }]);
      if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_SIZE) throw new ApiError(400, 'Invalid request', [{ field: 'size', message: 'File size must be between 1 byte and 10 MB' }]);
      assertConfigured();
      throw new ApiError(501, 'Storage provider signed upload adapter is not implemented', [{ field: 'storage', message: 'Configure a provider adapter before issuing signed URLs' }]);
    },
  };
}
