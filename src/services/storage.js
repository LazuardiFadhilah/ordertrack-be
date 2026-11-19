import { issueSignedToken } from '@vercel/blob';
import { ApiError } from './shared.js';

export const ALLOWED_MIME_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

function safePathname({ soId, fileName }) {
  const name = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `documents/${String(soId).replace(/[^a-zA-Z0-9_-]/g, '_')}/${crypto.randomUUID()}-${name}`;
}

export function createStorageService(settings = {}, adapter = { issueSignedToken }) {
  function assertConfigured() {
    if (!settings.storage?.blobReadWriteToken) {
      throw new ApiError(503, 'Document storage is not configured', [{ field: 'BLOB_READ_WRITE_TOKEN', message: 'Required storage environment variable is missing' }]);
    }
  }

  return {
    async createUploadIntent({ soId, refType, fileName, mimeType, size }) {
      if (!soId || !refType || !fileName) throw new ApiError(400, 'Invalid request', [{ field: 'body', message: 'soId, refType, and fileName are required' }]);
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) throw new ApiError(400, 'Invalid request', [{ field: 'mimeType', message: 'Only PDF, JPG, and PNG files are allowed' }]);
      if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_SIZE) throw new ApiError(400, 'Invalid request', [{ field: 'size', message: 'File size must be between 1 byte and 10 MB' }]);
      assertConfigured();
      const pathname = safePathname({ soId, fileName });
      const clientToken = await adapter.issueSignedToken({ pathname, allowedContentTypes: [mimeType], maximumSizeInBytes: MAX_FILE_SIZE, token: settings.storage.blobReadWriteToken });
      return { clientToken, pathname, fileName, mimeType, size, soId, refType };
    },
  };
}
