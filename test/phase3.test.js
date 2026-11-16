import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { createNumbered, nextNumber } from '../src/services/shared.js';
import { createMemoryModels } from './support/memory-model.js';

const testSettings = {
  jwtSecret: randomBytes(32).toString('hex'),
  jwtExpiresIn: '1h',
  authCookieName: `ordertrack_test_session_${randomUUID()}`,
  authCookieSecure: false,
};

const password = randomBytes(24).toString('hex');
const passwordHash = await bcrypt.hash(password, 4);

const users = [
  { name: 'Dummy Sales A', email: 'sales-a@example.test', role: 'SALES' },
  { name: 'Dummy Sales B', email: 'sales-b@example.test', role: 'SALES' },
  { name: 'Dummy Admin User', email: 'admin@example.test', role: 'ADMIN' },
  { name: 'Dummy AR User', email: 'ar@example.test', role: 'AR' },
  { name: 'Dummy Purchasing User', email: 'purchasing@example.test', role: 'PURCHASING' },
].map((user) => ({ ...user, _id: new Types.ObjectId().toString(), passwordHash }));

const userModel = {
  findOne({ email }) {
    return {
      select() {
        return this;
      },
      lean() {
        return Promise.resolve(users.find((user) => user.email === email) ?? null);
      },
    };
  },
  findById(id) {
    return {
      select() {
        return this;
      },
      lean() {
        return Promise.resolve(users.find((user) => user._id === String(id)) ?? null);
      },
    };
  },
};

const customerBody = {
  name: 'PT Dummy Nusantara',
  address: 'Jl. Contoh Raya No. 1, Jakarta',
  contact: 'Rani - 081200000001',
  npwp: '01.234.567.8-901.2345',
  npwpName: 'PT Dummy Nusantara',
  taxAddress: 'Jl. Contoh Raya No. 1, Jakarta',
};

const quotationItems = [{ sku: 'DUM-001', name: 'Barang Dummy A', qty: 10, unitPrice: 150000 }];

async function withPhase3Server(run) {
  const models = createMemoryModels();
  const app = createApp({ userModel, settings: testSettings, ...models });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await run({ baseUrl: `http://127.0.0.1:${port}`, models });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function api(baseUrl, path, { method = 'GET', cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

const emailOf = (user) => user.email;

async function signIn(baseUrl) {
  const cookies = {};
  for (const user of users) cookies[user.email] = await login(baseUrl, emailOf(user));
  return {
    salesA: cookies['sales-a@example.test'],
    salesB: cookies['sales-b@example.test'],
    admin: cookies['admin@example.test'],
    ar: cookies['ar@example.test'],
    purchasing: cookies['purchasing@example.test'],
  };
}

async function createCustomer(baseUrl, admin, overrides = {}) {
  const response = await api(baseUrl, '/api/customers', {
    method: 'POST',
    cookie: admin,
    body: { ...customerBody, ...overrides },
  });
  assert.equal(response.status, 201);
  return response.body.data.customer;
}

async function createQuotation(baseUrl, cookie, customerId, overrides = {}) {
  const response = await api(baseUrl, '/api/quotations', {
    method: 'POST',
    cookie,
    body: { customerId, items: quotationItems, ...overrides },
  });
  assert.equal(response.status, 201);
  return response.body.data.quotation;
}

test('phase 3 endpoints require authentication', async () => {
  await withPhase3Server(async ({ baseUrl }) => {
    for (const path of ['/api/customers', '/api/vendors', '/api/quotations', '/api/sales-orders']) {
      const response = await api(baseUrl, path);
      assert.equal(response.status, 401, path);
      assert.equal(response.body.success, false);
    }
  });
});

test('customer master data: admin writes, npwp normalized, search and pagination', async () => {
  await withPhase3Server(async ({ baseUrl }) => {
    const { admin, salesA, ar } = await signIn(baseUrl);

    const forbidden = await api(baseUrl, '/api/customers', { method: 'POST', cookie: salesA, body: customerBody });
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, { success: false, message: 'Forbidden', errors: [] });

    const customer = await createCustomer(baseUrl, admin);
    assert.match(customer.id, /^[0-9a-f]{24}$/);
    assert.equal(customer.npwp, '0123456789012345');
    assert.equal(customer.name, customerBody.name);
    assert.equal(customer.npwpName, customerBody.npwpName);
    assert.ok(customer.createdAt);
    assert.ok(customer.updatedAt);

    const short = await api(baseUrl, '/api/customers', {
      method: 'POST',
      cookie: admin,
      body: { ...customerBody, npwp: '01234567890123' },
    });
    assert.equal(short.status, 400);
    assert.equal(short.body.message, 'Invalid request');
    assert.deepEqual(short.body.errors.map(({ field }) => field), ['npwp']);

    const long = await api(baseUrl, '/api/customers', {
      method: 'POST',
      cookie: admin,
      body: { ...customerBody, npwp: '01234567890123456' },
    });
    assert.equal(long.status, 400);
    assert.equal(long.body.errors[0].field, 'npwp');

    const blank = await api(baseUrl, '/api/customers', {
      method: 'POST',
      cookie: admin,
      body: { ...customerBody, npwpName: '   ' },
    });
    assert.equal(blank.status, 400);
    assert.equal(blank.body.errors[0].field, 'npwpName');

    await createCustomer(baseUrl, admin, { name: 'PT Dummy Sentosa', npwp: '99.888.777.6-655.444' });

    const list = await api(baseUrl, '/api/customers?search=dummy', { cookie: ar });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.total, 2);
    assert.equal(list.body.data.page, 1);
    assert.equal(list.body.data.limit, 20);
    assert.equal(list.body.data.items.length, 2);

    const byNpwp = await api(baseUrl, '/api/customers?search=0123456', { cookie: ar });
    assert.equal(byNpwp.body.data.total, 1);
    assert.equal(byNpwp.body.data.items[0].id, customer.id);

    const clamped = await api(baseUrl, '/api/customers?limit=500', { cookie: ar });
    assert.equal(clamped.body.data.limit, 100);

    const page2 = await api(baseUrl, '/api/customers?limit=1&page=2', { cookie: ar });
    assert.equal(page2.body.data.items.length, 1);
    assert.equal(page2.body.data.total, 2);
    assert.equal(page2.body.data.page, 2);

    const updated = await api(baseUrl, `/api/customers/${customer.id}`, {
      method: 'PATCH',
      cookie: admin,
      body: { contact: 'Budi - 081200000009' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.customer.contact, 'Budi - 081200000009');
    assert.equal(updated.body.data.customer.npwp, '0123456789012345');

    const deniedUpdate = await api(baseUrl, `/api/customers/${customer.id}`, {
      method: 'PATCH',
      cookie: salesA,
      body: { contact: 'Nope' },
    });
    assert.equal(deniedUpdate.status, 403);

    const detail = await api(baseUrl, `/api/customers/${customer.id}`, { cookie: ar });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.customer.id, customer.id);

    const missing = await api(baseUrl, `/api/customers/${new Types.ObjectId()}`, { cookie: ar });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Customer not found');
  });
});

test('vendor master data: admin writes, all roles read', async () => {
  await withPhase3Server(async ({ baseUrl }) => {
    const { admin, ar, purchasing } = await signIn(baseUrl);

    const denied = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      cookie: purchasing,
      body: { name: 'CV Dummy Supply', contact: 'Sari - 081200000002' },
    });
    assert.equal(denied.status, 403);

    const created = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      cookie: admin,
      body: { name: 'CV Dummy Supply', contact: 'Sari - 081200000002' },
    });
    assert.equal(created.status, 201);
    const vendor = created.body.data.vendor;
    assert.equal(vendor.name, 'CV Dummy Supply');

    const invalid = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      cookie: admin,
      body: { name: 'X', contact: 'ab' },
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(invalid.body.errors.map(({ field }) => field).sort(), ['contact', 'name']);

    const list = await api(baseUrl, '/api/vendors?search=dummy', { cookie: ar });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.total, 1);
    assert.equal(list.body.data.items[0].id, vendor.id);

    const detail = await api(baseUrl, `/api/vendors/${vendor.id}`, { cookie: ar });
    assert.equal(detail.status, 200);

    const updated = await api(baseUrl, `/api/vendors/${vendor.id}`, {
      method: 'PATCH',
      cookie: admin,
      body: { contact: 'Sari - 081200000003' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.vendor.contact, 'Sari - 081200000003');

    const missing = await api(baseUrl, `/api/vendors/${new Types.ObjectId()}`, { cookie: ar });
    assert.equal(missing.status, 404);
  });
});

test('quotation create validates the body, computes totals, and numbers sequentially', async () => {
  await withPhase3Server(async ({ baseUrl }) => {
    const { admin, salesA, purchasing } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);

    const denied = await api(baseUrl, '/api/quotations', {
      method: 'POST',
      cookie: purchasing,
      body: { customerId: customer.id, items: quotationItems },
    });
    assert.equal(denied.status, 403);

    const first = await createQuotation(baseUrl, salesA, customer.id, {
      totalAmount: 99,
      items: [{ ...quotationItems[0], lineTotal: 1 }],
    });
    assert.match(first.number, /^QTN-\d{4}-\d{2}-0001$/);
    assert.equal(first.status, 'DRAFT');
    assert.equal(first.salesOrderId, null);
    assert.equal(first.totalAmount, 1500000);
    assert.equal(first.items[0].lineTotal, 1500000);
    assert.equal(first.customerName, customerBody.name);
    assert.equal(first.createdBy.name, 'Dummy Sales A');

    const second = await createQuotation(baseUrl, salesA, customer.id);
    assert.match(second.number, /^QTN-\d{4}-\d{2}-0002$/);

    const unknownCustomer = await api(baseUrl, '/api/quotations', {
      method: 'POST',
      cookie: salesA,
      body: { customerId: new Types.ObjectId().toString(), items: quotationItems },
    });
    assert.equal(unknownCustomer.status, 400);
    assert.equal(unknownCustomer.body.errors[0].field, 'customerId');

    const noItems = await api(baseUrl, '/api/quotations', {
      method: 'POST',
      cookie: salesA,
      body: { customerId: customer.id, items: [] },
    });
    assert.equal(noItems.status, 400);
    assert.equal(noItems.body.errors[0].field, 'items');

    const badQty = await api(baseUrl, '/api/quotations', {
      method: 'POST',
      cookie: salesA,
      body: { customerId: customer.id, items: [{ ...quotationItems[0], qty: 0 }] },
    });
    assert.equal(badQty.status, 400);
    assert.equal(badQty.body.errors[0].field, 'items.0.qty');

    const badPrice = await api(baseUrl, '/api/quotations', {
      method: 'POST',
      cookie: salesA,
      body: { customerId: customer.id, items: [{ ...quotationItems[0], unitPrice: 150000.999 }] },
    });
    assert.equal(badPrice.status, 400);
    assert.equal(badPrice.body.errors[0].field, 'items.0.unitPrice');
  });
});

test('quotation transitions, DRAFT-only edits, and SALES ownership scoping', async () => {
  await withPhase3Server(async ({ baseUrl }) => {
    const { admin, salesA, salesB, ar } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const mine = await createQuotation(baseUrl, salesA, customer.id);
    const theirs = await createQuotation(baseUrl, salesB, customer.id);

    const ownList = await api(baseUrl, '/api/quotations', { cookie: salesA });
    assert.equal(ownList.status, 200);
    assert.deepEqual(ownList.body.data.items.map(({ id }) => id), [mine.id]);
    assert.equal(ownList.body.data.total, 1);

    const allList = await api(baseUrl, '/api/quotations', { cookie: admin });
    assert.equal(allList.body.data.total, 2);

    const readOnlyList = await api(baseUrl, '/api/quotations', { cookie: ar });
    assert.equal(readOnlyList.body.data.total, 2);

    const peek = await api(baseUrl, `/api/quotations/${theirs.id}`, { cookie: salesA });
    assert.equal(peek.status, 403);
    assert.deepEqual(peek.body, { success: false, message: 'Forbidden', errors: [] });

    const adminPeek = await api(baseUrl, `/api/quotations/${theirs.id}`, { cookie: ar });
    assert.equal(adminPeek.status, 200);

    const foreignSend = await api(baseUrl, `/api/quotations/${theirs.id}/send`, { method: 'POST', cookie: salesA });
    assert.equal(foreignSend.status, 403);

    const edited = await api(baseUrl, `/api/quotations/${mine.id}`, {
      method: 'PATCH',
      cookie: salesA,
      body: { items: [{ sku: 'DUM-002', name: 'Barang Dummy B', qty: 3, unitPrice: 250000.5 }] },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.quotation.totalAmount, 750001.5);
    assert.equal(edited.body.data.quotation.items[0].lineTotal, 750001.5);

    const sent = await api(baseUrl, `/api/quotations/${mine.id}/send`, { method: 'POST', cookie: salesA });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.data.quotation.status, 'SENT');

    const sentAgain = await api(baseUrl, `/api/quotations/${mine.id}/send`, { method: 'POST', cookie: salesA });
    assert.equal(sentAgain.status, 409);
    assert.equal(sentAgain.body.success, false);

    const lateEdit = await api(baseUrl, `/api/quotations/${mine.id}`, {
      method: 'PATCH',
      cookie: salesA,
      body: { items: quotationItems },
    });
    assert.equal(lateEdit.status, 409);

    const sentFilter = await api(baseUrl, '/api/quotations?status=SENT', { cookie: admin });
    assert.equal(sentFilter.body.data.total, 1);
    assert.equal(sentFilter.body.data.items[0].id, mine.id);

    const customerFilter = await api(baseUrl, `/api/quotations?customerId=${customer.id}`, { cookie: admin });
    assert.equal(customerFilter.body.data.total, 2);

    const lost = await api(baseUrl, `/api/quotations/${mine.id}/lose`, { method: 'POST', cookie: salesA });
    assert.equal(lost.status, 200);
    assert.equal(lost.body.data.quotation.status, 'LOST');

    const lostAgain = await api(baseUrl, `/api/quotations/${mine.id}/lose`, { method: 'POST', cookie: salesA });
    assert.equal(lostAgain.status, 409);

    const convertLost = await api(baseUrl, `/api/quotations/${mine.id}/convert`, { method: 'POST', cookie: salesA });
    assert.equal(convertLost.status, 409);

    const missing = await api(baseUrl, `/api/quotations/${new Types.ObjectId()}`, { cookie: admin });
    assert.equal(missing.status, 404);
  });
});

test('conversion creates exactly one sales order and scopes SALES reads', async () => {
  await withPhase3Server(async ({ baseUrl }) => {
    const { admin, salesA, salesB, ar } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const quotation = await createQuotation(baseUrl, salesA, customer.id);

    const early = await api(baseUrl, `/api/quotations/${quotation.id}/convert`, { method: 'POST', cookie: salesA, body: {} });
    assert.equal(early.status, 409);

    await api(baseUrl, `/api/quotations/${quotation.id}/send`, { method: 'POST', cookie: salesA });

    const converted = await api(baseUrl, `/api/quotations/${quotation.id}/convert`, {
      method: 'POST',
      cookie: salesA,
      body: { customerPoNumber: 'PO/DUMMY/001' },
    });
    assert.equal(converted.status, 201);
    assert.deepEqual(Object.keys(converted.body.data.quotation).sort(), ['id', 'number', 'salesOrderId', 'status']);
    assert.equal(converted.body.data.quotation.status, 'CONVERTED');
    assert.match(converted.body.data.quotation.salesOrderId, /^[0-9a-f]{24}$/);
    assert.match(converted.body.data.salesOrder.soNumber, /^SO-\d{4}-\d{2}-0001$/);
    assert.equal(converted.body.data.salesOrder.status, 'PO_RECEIVED');

    const again = await api(baseUrl, `/api/quotations/${quotation.id}/convert`, { method: 'POST', cookie: salesA, body: {} });
    assert.equal(again.status, 409);

    const orders = await api(baseUrl, '/api/sales-orders', { cookie: admin });
    assert.equal(orders.status, 200);
    assert.equal(orders.body.data.total, 1);

    const order = orders.body.data.items[0];
    assert.equal(order.id, converted.body.data.salesOrder.id);
    assert.equal(order.customerId, customer.id);
    assert.equal(order.customerName, customerBody.name);
    assert.equal(order.quotationId, quotation.id);
    assert.equal(order.quotationNumber, quotation.number);
    assert.equal(order.salesId, users[0]._id);
    assert.equal(order.salesName, 'Dummy Sales A');
    assert.equal(order.customerPoNumber, 'PO/DUMMY/001');
    assert.equal(order.status, 'PO_RECEIVED');
    assert.equal(order.totalAmount, 1500000);
    assert.deepEqual(order.items, [
      {
        sku: 'DUM-001',
        name: 'Barang Dummy A',
        qtyOrdered: 10,
        qtyReceived: 0,
        qtyShipped: 0,
        qtyInvoiced: 0,
        unitPrice: 150000,
      },
    ]);

    const ownerList = await api(baseUrl, '/api/sales-orders', { cookie: salesA });
    assert.equal(ownerList.body.data.total, 1);

    const otherList = await api(baseUrl, '/api/sales-orders', { cookie: salesB });
    assert.equal(otherList.body.data.total, 0);
    assert.deepEqual(otherList.body.data.items, []);

    const otherDetail = await api(baseUrl, `/api/sales-orders/${order.id}`, { cookie: salesB });
    assert.equal(otherDetail.status, 403);

    const readOnlyDetail = await api(baseUrl, `/api/sales-orders/${order.id}`, { cookie: ar });
    assert.equal(readOnlyDetail.status, 200);
    assert.equal(readOnlyDetail.body.data.salesOrder.id, order.id);

    const convertedDetail = await api(baseUrl, `/api/quotations/${quotation.id}`, { cookie: salesA });
    assert.equal(convertedDetail.body.data.quotation.status, 'CONVERTED');
    assert.equal(convertedDetail.body.data.quotation.salesOrderId, order.id);

    const customerFilter = await api(baseUrl, `/api/sales-orders?customerId=${customer.id}`, { cookie: admin });
    assert.equal(customerFilter.body.data.total, 1);

    const missing = await api(baseUrl, `/api/sales-orders/${new Types.ObjectId()}`, { cookie: admin });
    assert.equal(missing.status, 404);

    const salesOrderWrite = await api(baseUrl, '/api/sales-orders', {
      method: 'POST',
      cookie: admin,
      body: {},
    });
    assert.equal(salesOrderWrite.status, 404);
  });
});

test('number generation is month-scoped and retries once on a duplicate key', async () => {
  const numbers = [];
  let lookups = 0;
  const model = {
    findOne() {
      lookups += 1;
      const found = lookups === 1 ? null : { number: 'QTN-2026-11-0001' };
      return {
        sort() {
          return this;
        },
        lean() {
          return Promise.resolve(found);
        },
      };
    },
    async create(data) {
      numbers.push(data.number);
      if (numbers.length === 1) {
        const error = new Error('E11000 duplicate key');
        error.code = 11000;
        throw error;
      }
      return data;
    },
  };

  const created = await createNumbered(model, 'number', 'QTN', (number) => ({ number }), new Date('2026-11-16T02:00:00Z'));

  assert.deepEqual(numbers, ['QTN-2026-11-0001', 'QTN-2026-11-0002']);
  assert.equal(created.number, 'QTN-2026-11-0002');

  const emptyModel = {
    findOne() {
      return {
        sort() {
          return this;
        },
        lean() {
          return Promise.resolve(null);
        },
      };
    },
  };
  assert.equal(
    await nextNumber(emptyModel, 'number', 'QTN', new Date('2026-12-01T00:00:00Z')),
    'QTN-2026-12-0001',
  );
});
