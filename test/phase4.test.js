import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
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
  { name: 'Dummy Admin User', email: 'admin@example.test', role: 'ADMIN' },
  { name: 'Dummy GA User', email: 'ga@example.test', role: 'GA' },
  { name: 'Dummy Purchasing User', email: 'purchasing@example.test', role: 'PURCHASING' },
  { name: 'Dummy AR User', email: 'ar@example.test', role: 'AR' },
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

async function withPhase4Server(run) {
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
    admin: cookies['admin@example.test'],
    ga: cookies['ga@example.test'],
    purchasing: cookies['purchasing@example.test'],
    ar: cookies['ar@example.test'],
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

async function createVendor(baseUrl, admin, overrides = {}) {
  const response = await api(baseUrl, '/api/vendors', {
    method: 'POST',
    cookie: admin,
    body: { name: 'CV Dummy Supply', contact: 'Sari - 081200000002', ...overrides },
  });
  assert.equal(response.status, 201);
  return response.body.data.vendor;
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

async function convertQuotation(baseUrl, cookie, quotationId) {
  await api(baseUrl, `/api/quotations/${quotationId}/send`, { method: 'POST', cookie });
  const response = await api(baseUrl, `/api/quotations/${quotationId}/convert`, {
    method: 'POST',
    cookie,
    body: { customerPoNumber: 'PO/DUMMY/001' },
  });
  assert.equal(response.status, 201);
  return response.body.data.salesOrder;
}

async function createVendorPo(baseUrl, purchasing, { soId, vendorId, items }) {
  const response = await api(baseUrl, '/api/vendor-pos', {
    method: 'POST',
    cookie: purchasing,
    body: { soId, vendorId, items },
  });
  assert.equal(response.status, 201);
  return response.body.data.vendorPo;
}

async function createGoodsReceipt(baseUrl, ga, { soId, vendorPoId, items }) {
  const response = await api(baseUrl, '/api/goods-receipts', {
    method: 'POST',
    cookie: ga,
    body: { soId, vendorPoId, items },
  });
  assert.equal(response.status, 201);
  return response.body.data.goodsReceipt;
}

test('vendor po creation and SO status transition to PROCURING', async () => {
  await withPhase4Server(async ({ baseUrl }) => {
    const { admin, salesA, purchasing, ar } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const vendor = await createVendor(baseUrl, admin);
    const quotation = await createQuotation(baseUrl, salesA, customer.id);
    const salesOrder = await convertQuotation(baseUrl, salesA, quotation.id);

    assert.equal(salesOrder.status, 'PO_RECEIVED');

    const denied = await api(baseUrl, '/api/vendor-pos', {
      method: 'POST',
      cookie: salesA,
      body: { soId: salesOrder.id, vendorId: vendor.id, items: [{ soItemIndex: 0, qty: 5 }] },
    });
    assert.equal(denied.status, 403);

    const vendorPo = await createVendorPo(baseUrl, purchasing, {
      soId: salesOrder.id,
      vendorId: vendor.id,
      items: [{ soItemIndex: 0, qty: 5 }],
    });

    assert.match(vendorPo.poNumber, /^VPO-\d{4}-\d{2}-0001$/);
    assert.equal(vendorPo.vendorId, vendor.id);
    assert.equal(vendorPo.status, 'ISSUED');
    assert.equal(vendorPo.items[0].sku, 'DUM-001');

    const soDetail = await api(baseUrl, `/api/sales-orders/${salesOrder.id}`, { cookie: ar });
    assert.equal(soDetail.status, 200);
    assert.equal(soDetail.body.data.salesOrder.status, 'PROCURING');
    assert.equal(soDetail.body.data.salesOrder.vendorPos.length, 1);
    assert.equal(soDetail.body.data.salesOrder.vendorPos[0].id, vendorPo.id);
  });
});

test('goods receipt partial receiving and SO status transition to PARTIAL_RECEIVED', async () => {
  await withPhase4Server(async ({ baseUrl }) => {
    const { admin, salesA, purchasing, ga, ar } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const vendor = await createVendor(baseUrl, admin);
    const quotation = await createQuotation(baseUrl, salesA, customer.id);
    const salesOrder = await convertQuotation(baseUrl, salesA, quotation.id);
    const vendorPo = await createVendorPo(baseUrl, purchasing, {
      soId: salesOrder.id,
      vendorId: vendor.id,
      items: [{ soItemIndex: 0, qty: 10 }],
    });

    const denied = await api(baseUrl, '/api/goods-receipts', {
      method: 'POST',
      cookie: purchasing,
      body: { soId: salesOrder.id, vendorPoId: vendorPo.id, items: [{ soItemIndex: 0, qtyReceived: 3 }] },
    });
    assert.equal(denied.status, 403);

    const goodsReceipt = await createGoodsReceipt(baseUrl, ga, {
      soId: salesOrder.id,
      vendorPoId: vendorPo.id,
      items: [{ soItemIndex: 0, qtyReceived: 3 }],
    });

    assert.match(goodsReceipt.grNumber, /^GR-\d{4}-\d{2}-0001$/);
    assert.equal(goodsReceipt.vendorPoNumber, vendorPo.poNumber);

    const vendorPoDetail = await api(baseUrl, `/api/vendor-pos/${vendorPo.id}`, { cookie: ar });
    assert.equal(vendorPoDetail.body.data.vendorPo.status, 'PARTIAL_RECEIVED');

    const soDetail = await api(baseUrl, `/api/sales-orders/${salesOrder.id}`, { cookie: ar });
    assert.equal(soDetail.body.data.salesOrder.status, 'PARTIAL_RECEIVED');
    assert.equal(soDetail.body.data.salesOrder.items[0].qtyReceived, 3);
    assert.equal(soDetail.body.data.salesOrder.goodsReceipts.length, 1);
    assert.equal(soDetail.body.data.salesOrder.goodsReceipts[0].id, goodsReceipt.id);
  });
});

test('goods receipt full receiving and SO status transition to GOODS_RECEIVED', async () => {
  await withPhase4Server(async ({ baseUrl }) => {
    const { admin, salesA, purchasing, ga, ar } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const vendor = await createVendor(baseUrl, admin);
    const quotation = await createQuotation(baseUrl, salesA, customer.id);
    const salesOrder = await convertQuotation(baseUrl, salesA, quotation.id);
    const vendorPo = await createVendorPo(baseUrl, purchasing, {
      soId: salesOrder.id,
      vendorId: vendor.id,
      items: [{ soItemIndex: 0, qty: 10 }],
    });

    const goodsReceipt = await createGoodsReceipt(baseUrl, ga, {
      soId: salesOrder.id,
      vendorPoId: vendorPo.id,
      items: [{ soItemIndex: 0, qtyReceived: 10 }],
    });

    const vendorPoDetail = await api(baseUrl, `/api/vendor-pos/${vendorPo.id}`, { cookie: ar });
    assert.equal(vendorPoDetail.body.data.vendorPo.status, 'RECEIVED');

    const soDetail = await api(baseUrl, `/api/sales-orders/${salesOrder.id}`, { cookie: ar });
    assert.equal(soDetail.body.data.salesOrder.status, 'GOODS_RECEIVED');
    assert.equal(soDetail.body.data.salesOrder.items[0].qtyReceived, 10);
  });
});

test('goods receipt over-receiving returns 400', async () => {
  await withPhase4Server(async ({ baseUrl }) => {
    const { admin, salesA, purchasing, ga } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const vendor = await createVendor(baseUrl, admin);
    const quotation = await createQuotation(baseUrl, salesA, customer.id);
    const salesOrder = await convertQuotation(baseUrl, salesA, quotation.id);
    const vendorPo = await createVendorPo(baseUrl, purchasing, {
      soId: salesOrder.id,
      vendorId: vendor.id,
      items: [{ soItemIndex: 0, qty: 10 }],
    });

    const over = await api(baseUrl, '/api/goods-receipts', {
      method: 'POST',
      cookie: ga,
      body: { soId: salesOrder.id, vendorPoId: vendorPo.id, items: [{ soItemIndex: 0, qtyReceived: 11 }] },
    });
    assert.equal(over.status, 400);
    assert.equal(over.body.errors[0].field, 'items.0.qtyReceived');
  });
});

test('SALES can read vendor POs and goods receipts for their own SOs only', async () => {
  await withPhase4Server(async ({ baseUrl }) => {
    const { admin, salesA, purchasing, ga } = await signIn(baseUrl);
    const customer = await createCustomer(baseUrl, admin);
    const vendor = await createVendor(baseUrl, admin);
    const quotation = await createQuotation(baseUrl, salesA, customer.id);
    const salesOrder = await convertQuotation(baseUrl, salesA, quotation.id);
    const vendorPo = await createVendorPo(baseUrl, purchasing, {
      soId: salesOrder.id,
      vendorId: vendor.id,
      items: [{ soItemIndex: 0, qty: 5 }],
    });
    await createGoodsReceipt(baseUrl, ga, {
      soId: salesOrder.id,
      vendorPoId: vendorPo.id,
      items: [{ soItemIndex: 0, qtyReceived: 5 }],
    });

    const poList = await api(baseUrl, '/api/vendor-pos', { cookie: salesA });
    assert.equal(poList.status, 200);
    assert.equal(poList.body.data.total, 1);

    const grList = await api(baseUrl, '/api/goods-receipts', { cookie: salesA });
    assert.equal(grList.status, 200);
    assert.equal(grList.body.data.total, 1);
  });
});
