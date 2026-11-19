import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorageService, MAX_FILE_SIZE } from '../src/services/storage.js';

const settings = { storage: { blobReadWriteToken: 'vercel_blob_test_token' } };
const adapter = { issueSignedToken: async (options) => ({ signed: true, options }) };
const valid = { soId: 'so-1', refType: 'INVOICE', fileName: 'invoice.pdf', mimeType: 'application/pdf', size: MAX_FILE_SIZE };

test('upload intent validates allowed types and 10 MB boundary before storage setup', async () => {
  const storage = createStorageService(settings, adapter);
  await assert.rejects(() => storage.createUploadIntent({ ...valid, mimeType: 'text/plain' }), { status: 400 });
  await assert.rejects(() => storage.createUploadIntent({ ...valid, mimeType: 'image/jpeg' , size: MAX_FILE_SIZE + 1 }), { status: 400 });
  await assert.rejects(() => storage.createUploadIntent({ ...valid, mimeType: 'image/png' , size: 0 }), { status: 400 });
});

test('upload intent returns a restricted Vercel Blob client token', async () => {
  const result = await createStorageService(settings, adapter).createUploadIntent(valid);
  assert.equal(result.clientToken.signed, true);
  assert.deepEqual(result.clientToken.options.allowedContentTypes, ['application/pdf']);
  assert.equal(result.clientToken.options.maximumSizeInBytes, MAX_FILE_SIZE);
  assert.equal(result.clientToken.options.token, 'vercel_blob_test_token');
  assert.match(result.pathname, /^documents\/so-1\/[0-9a-f-]+-invoice\.pdf$/);
});

test('upload intent fails closed when BLOB_READ_WRITE_TOKEN is missing', async () => {
  await assert.rejects(() => createStorageService({ storage: {} }, adapter).createUploadIntent(valid), (error) => {
    assert.equal(error.status, 503);
    assert.deepEqual(error.errors.map(({ field }) => field), ['BLOB_READ_WRITE_TOKEN']);
    return true;
  });
});
