import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentService } from '../src/services/documents.js';
import { createMemoryModel } from './support/memory-model.js';

test('phase 8 documents validate metadata and list by SO', async () => {
  const documentModel = createMemoryModel();
  const service = createDocumentService({ documentModel });
  const user = { id: 'user-1', role: 'GA' };
  const created = await service.create({ soId: 'so-1', refType: 'GOODS_RECEIPT', refId: 'gr-1', fileUrl: 'https://upload.test/file.pdf', fileName: 'file.pdf', mimeType: 'application/pdf', size: 1024 }, user);
  assert.equal(created.uploadedBy, 'user-1');
  assert.equal((await service.listBySo('so-1', user)).items.length, 1);
  await assert.rejects(() => service.create({ soId: 'so-1', refType: 'INVOICE', refId: 'inv-1', fileUrl: 'https://upload.test/file.exe', fileName: 'file.exe', mimeType: 'application/octet-stream', size: 1 }, user));
  await assert.rejects(() => service.create({ soId: 'so-1', refType: 'INVOICE', refId: 'inv-1', fileUrl: 'https://upload.test/large.pdf', fileName: 'large.pdf', mimeType: 'application/pdf', size: 10 * 1024 * 1024 + 1 }, user));
});
