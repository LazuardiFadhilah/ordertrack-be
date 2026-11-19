import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createMemoryModel } from './support/memory-model.js';

const settings = { jwtSecret: randomBytes(32).toString('hex'), jwtExpiresIn: '1h', authCookieName: `phase6_${randomUUID()}`, authCookieSecure: false };

function cookieFrom(response) {
  const header = response.headers.get('set-cookie');
  return header ? header.split(';', 1)[0] : '';
}

test('phase 6 invoices shipped sales order, records payment, prevents overpayment', async (t) => {
  const userModel = createMemoryModel();
  const salesOrderModel = createMemoryModel();
  const invoiceModel = createMemoryModel();
  const paymentModel = createMemoryModel();
  const passwordHash = await bcrypt.hash('Password123!', 4);
  const ar = await userModel.create({ name: 'AR', email: 'ar@ordertrack.test', passwordHash, role: 'AR' });
  await userModel.create({ name: 'Sales', email: 'sales@ordertrack.test', passwordHash, role: 'SALES' });
  const so = await salesOrderModel.create({
    soNumber: 'SO-TEST-001', customerId: 'customer-test', customerName: 'Customer Test', status: 'COMPLETED',
    items: [{ sku: 'SKU-1', name: 'Item', qtyOrdered: 3, qtyShipped: 3, unitPrice: 100 }],
  });
  const server = http.createServer(createApp({ userModel, salesOrderModel, invoiceModel, paymentModel, settings }));
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ar@ordertrack.test', password: 'Password123!' }) });
  const cookie = login.headers.get('set-cookie');
  assert.equal(login.status, 200);
  const api = (path, method = 'GET', body) => fetch(`${baseUrl}${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

  const created = await api('/api/invoices', 'POST', { soId: so._id, dueDate: '2027-01-01' });
  assert.equal(created.status, 201);
  const invoice = (await created.json()).data.invoice;
  assert.equal(invoice.totalAmount, 300);
  assert.equal((await salesOrderModel.findById(so._id)).status, 'INVOICING');

  const partial = await api('/api/invoices/payments', 'POST', { invoiceId: invoice._id, amount: 100, paymentMethod: 'BANK_TRANSFER' });
  assert.equal(partial.status, 201);
  assert.equal((await partial.json()).data.outstandingAmount, 200);

  const overpay = await api('/api/invoices/payments', 'POST', { invoiceId: invoice._id, amount: 201, paymentMethod: 'CASH' });
  assert.equal(overpay.status, 409);
  assert.equal((await invoiceModel.findById(invoice._id)).paidAmount, 100);

  const paid = await api('/api/invoices/payments', 'POST', { invoiceId: invoice._id, amount: 200, paymentMethod: 'CASH' });
  assert.equal(paid.status, 201);
  assert.equal((await paid.json()).data.invoice.status, 'PAID');
  assert.equal((await salesOrderModel.findById(so._id)).status, 'PAID');
  assert.equal(await paymentModel.countDocuments({ invoiceId: invoice._id }), 2);
  assert.equal(ar.role, 'AR');
});

test('phase 6 invoice endpoints require authentication and enforce AR/ADMIN writer role', async (t) => {
  const userModel = createMemoryModel();
  const salesOrderModel = createMemoryModel();
  const invoiceModel = createMemoryModel();
  const paymentModel = createMemoryModel();
  const passwordHash = await bcrypt.hash('Password123!', 4);
  await userModel.create({ name: 'AR', email: 'ar@ordertrack.test', passwordHash, role: 'AR' });
  await userModel.create({ name: 'Sales', email: 'sales@ordertrack.test', passwordHash, role: 'SALES' });
  const so = await salesOrderModel.create({
    soNumber: 'SO-TEST-002', customerId: 'customer-test', customerName: 'Customer Test', status: 'COMPLETED',
    items: [{ sku: 'SKU-1', name: 'Item', qtyOrdered: 2, qtyShipped: 2, unitPrice: 100 }],
  });
  const server = http.createServer(createApp({ userModel, salesOrderModel, invoiceModel, paymentModel, settings }));
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const loginAr = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ar@ordertrack.test', password: 'Password123!' }) });
  assert.equal(loginAr.status, 200);
  const arCookie = cookieFrom(loginAr);

  const created = await fetch(`${baseUrl}/api/invoices`, { method: 'POST', headers: { Cookie: arCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ soId: so._id, dueDate: '2027-01-01' }) });
  assert.equal(created.status, 201);
  const invoice = (await created.json()).data.invoice;

  const unauthenticated = [
    { method: 'POST', path: '/api/invoices', body: { soId: so._id, dueDate: '2027-01-01' } },
    { method: 'GET', path: '/api/invoices' },
    { method: 'GET', path: `/api/invoices/${invoice._id}` },
    { method: 'POST', path: '/api/invoices/payments', body: { invoiceId: invoice._id, amount: 50, paymentMethod: 'CASH' } },
  ];
  for (const { method, path, body } of unauthenticated) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 401, `${method} ${path} without cookie should be 401`);
    const json = await response.json();
    assert.equal(json.success, false);
    assert.ok(json.message);
  }

  const loginSales = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sales@ordertrack.test', password: 'Password123!' }) });
  assert.equal(loginSales.status, 200);
  const salesCookie = cookieFrom(loginSales);

  const list = await fetch(`${baseUrl}/api/invoices`, { headers: { Cookie: salesCookie } });
  assert.equal(list.status, 200, 'SALES should be allowed to list invoices');
  assert.equal((await list.json()).data.invoices.length, 1);

  const detail = await fetch(`${baseUrl}/api/invoices/${invoice._id}`, { headers: { Cookie: salesCookie } });
  assert.equal(detail.status, 200, 'SALES should be allowed to read invoice detail');
  assert.equal((await detail.json()).data.invoice._id, invoice._id);

  const writeDenied = [
    { method: 'POST', path: '/api/invoices', body: { soId: so._id, dueDate: '2027-01-01' } },
    { method: 'POST', path: '/api/invoices/payments', body: { invoiceId: invoice._id, amount: 50, paymentMethod: 'CASH' } },
  ];
  for (const { method, path, body } of writeDenied) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { Cookie: salesCookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 403, `${method} ${path} as SALES should be 403`);
    const json = await response.json();
    assert.equal(json.success, false);
    assert.equal(json.message, 'Forbidden');
  }
});
