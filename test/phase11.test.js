import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { createMemoryModel } from './support/memory-model.js';

test('cron reminders require secret and create each reminder once', async (t) => {
  const models = { userModel: createMemoryModel(), goodsReceiptModel: createMemoryModel(), shippingRequestModel: createMemoryModel(), deliveryOrderModel: createMemoryModel(), invoiceModel: createMemoryModel(), notificationModel: createMemoryModel(), activityLogModel: createMemoryModel() };
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await models.userModel.create({ name: 'Sales', role: 'SALES' });
  await models.userModel.create({ name: 'AR', role: 'AR' });
  const soId = 'so-reminder';
  await models.goodsReceiptModel.create({ _id: 'gr-1', grNumber: 'GR-1', soId, receivedAt: old });
  const deliveryOrder = await models.deliveryOrderModel.create({ doNumber: 'DO-1', soId: 'so-do', status: 'SIGNED_RETURNED' });
  models.deliveryOrderModel.documents.find((item) => item._id === deliveryOrder._id).updatedAt = old;
  const settings = { cronSecret: 'test-secret', jwtSecret: 'unused', authCookieName: 'x' };
  const server = http.createServer(createApp({ ...models, settings }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/cron/reminders`;
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  const first = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer test-secret' } });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).data.created, 2);
  const second = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer test-secret' } });
  assert.equal((await second.json()).data.created, 0);
  assert.equal(await models.notificationModel.countDocuments({}), 2);
});
