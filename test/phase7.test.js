import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createMemoryModel } from './support/memory-model.js';

const settings = { jwtSecret: randomBytes(32).toString('hex'), jwtExpiresIn: '1h', authCookieName: `phase7_${randomUUID()}`, authCookieSecure: false };

function cookieFrom(response) {
  const header = response.headers.get('set-cookie');
  return header ? header.split(';', 1)[0] : '';
}

test('phase 7 vendor payment records and sets closed status on fully paid SO', async (t) => {
  const userModel = createMemoryModel();
  const salesOrderModel = createMemoryModel();
  const vendorPoModel = createMemoryModel();
  const vendorPaymentModel = createMemoryModel();
  const passwordHash = await bcrypt.hash('Password123!', 4);

  await userModel.create({ name: 'AP', email: 'ap@ordertrack.test', passwordHash, role: 'AP' });
  const so = await salesOrderModel.create({
    soNumber: 'SO-TEST-007', customerId: 'customer-test', customerName: 'Customer Test', status: 'PAID',
    items: [{ sku: 'SKU-1', name: 'Item', qtyOrdered: 1, unitPrice: 100 }],
  });
  const vpo = await vendorPoModel.create({
    poNumber: 'VPO-001', soId: so._id, soNumber: 'SO-TEST-007', vendorId: 'vendor-1', vendorName: 'Vendor 1',
    items: [{ soItemIndex: 0, sku: 'SKU-1', name: 'Item', qty: 1 }], status: 'RECEIVED', createdBy: { id: '1', name: 'Purchasing' },
  });

  const server = http.createServer(createApp({ userModel, salesOrderModel, vendorPoModel, vendorPaymentModel, settings }));
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ap@ordertrack.test', password: 'Password123!' }) });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);

  const res = await fetch(`${baseUrl}/api/vendor-payments`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorPoId: vpo._id, amount: 80, paymentMethod: 'BANK_TRANSFER' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.amount, 80);

  const updatedSo = await salesOrderModel.findById(so._id);
  assert.equal(updatedSo.status, 'CLOSED');
});
