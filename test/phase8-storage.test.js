import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorageService, MAX_FILE_SIZE } from '../src/services/storage.js';

const settings = { storage: { provider: 's3-compatible', bucket: 'docs', region: 'region', endpoint: 'https://storage.test', accessKeyId: 'x', secretAccessKey: 'y' } };
const valid = { soId: 'so-1', refType: 'INVOICE', fileName: 'invoice.pdf', mimeType: 'application/pdf', size: MAX_FILE_SIZE };

test('upload intent validates allowed types and 10 MB boundary before storage setup', () => {
  const storage = createStorageService(settings);
  assert.throws(() => storage.createUploadIntent({ ...valid, mimeType: 'text/plain' }), { status: 400 });
  assert.throws(() => storage.createUploadIntent({ ...valid, mimeType: 'image/jpeg' , size: MAX_FILE_SIZE + 1 }), { status: 400 });
  assert.throws(() => storage.createUploadIntent({ ...valid, mimeType: 'image/png' , size: 0 }), { status: 400 });
});

test('upload intent fails closed with exact missing storage environment names', () => {
  const storage = createStorageService({ storage: {} });
  assert.throws(() => storage.createUploadIntent(valid), (error) => {
    assert.equal(error.status, 503);
    assert.deepEqual(error.errors.map(({ field }) => field), [
      'STORAGE_PROVIDER', 'STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ENDPOINT',
      'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY',
    ]);
    return true;
  });
});
