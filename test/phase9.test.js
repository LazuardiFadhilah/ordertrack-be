import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createMemoryModel } from './support/memory-model.js';

const settings = { jwtSecret: randomBytes(32).toString('hex'), jwtExpiresIn: '1h', authCookieName: `phase9_${randomUUID()}`, authCookieSecure: false };

function cookieFrom(response) {
  const header = response.headers.get('set-cookie');
  return header ? header.split(';', 1)[0] : '';
}

async function startApp(models) {
  const server = http.createServer(createApp({ ...models, settings }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

test('phase 9 notification endpoint lists only notifications for the authenticated user', async (t) => {
  const userModel = createMemoryModel();
  const notificationModel = createMemoryModel();
  const passwordHash = await bcrypt.hash('Password123!', 4);
  const ga = await userModel.create({ name: 'GA', email: 'ga@ordertrack.test', passwordHash, role: 'GA' });
  await notificationModel.create({ recipientId: ga._id, soId: 'so-1', type: 'VENDOR_PO_CREATED', title: 'PO', message: 'Created' });
  await notificationModel.create({ recipientId: 'other-user', soId: 'so-2', type: 'VENDOR_PO_CREATED', title: 'Other', message: 'Hidden' });
  const { server, baseUrl } = await startApp({ userModel, notificationModel, activityLogModel: createMemoryModel() });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ga@ordertrack.test', password: 'Password123!' }) });
  const response = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: cookieFrom(login) } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.total, 1);
  assert.equal(body.data.items[0].title, 'PO');
});

test('phase 9 Vendor PO creation notifies GA and records the activity', async (t) => {
  const userModel = createMemoryModel();
  const salesOrderModel = createMemoryModel();
  const vendorPoModel = createMemoryModel();
  const vendorModel = createMemoryModel();
  const goodsReceiptModel = createMemoryModel();
  const notificationModel = createMemoryModel();
  const activityLogModel = createMemoryModel();
  const passwordHash = await bcrypt.hash('Password123!', 4);
  const purchaser = await userModel.create({ name: 'Purchasing', email: 'purchasing@ordertrack.test', passwordHash, role: 'PURCHASING' });
  const ga = await userModel.create({ name: 'GA', email: 'ga@ordertrack.test', passwordHash, role: 'GA' });
  const so = await salesOrderModel.create({ soNumber: 'SO-009', status: 'PAID', items: [{ sku: 'SKU-1', name: 'Item', qtyOrdered: 1, qtyReceived: 0 }] });
  const vendor = await vendorModel.create({ name: 'Vendor 1' });
  const { server, baseUrl } = await startApp({ userModel, salesOrderModel, vendorPoModel, vendorModel, goodsReceiptModel, notificationModel, activityLogModel });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: purchaser.email, password: 'Password123!' }) });
  const response = await fetch(`${baseUrl}/api/vendor-pos`, { method: 'POST', headers: { Cookie: cookieFrom(login), 'Content-Type': 'application/json' }, body: JSON.stringify({ soId: so._id, vendorId: vendor._id, items: [{ soItemIndex: 0, qty: 1 }] }) });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.success, true);

  const notifications = await notificationModel.find({ recipientId: ga._id }).lean();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'VENDOR_PO_CREATED');
  assert.equal(notifications[0].entityType, 'VendorPO');
  const activities = await activityLogModel.find({ soId: so._id }).lean();
  assert.equal(activities.length, 1);
  assert.equal(activities[0].action, 'VENDOR_PO_CREATED');
  assert.equal(purchaser._id !== undefined, true);
});
