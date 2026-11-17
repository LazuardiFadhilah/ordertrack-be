import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createMemoryModel } from './support/memory-model.js';

const testSettings = {
  jwtSecret: randomBytes(32).toString('hex'),
  jwtExpiresIn: '1h',
  authCookieName: `ordertrack_test_session_${randomUUID()}`,
  authCookieSecure: false,
};

const customerBody = {
  name: 'PT Dummy Nusantara',
  address: 'Jl. Contoh Raya No. 1, Jakarta',
  contact: 'Rani - 081200000001',
  npwp: '01.234.567.8-901.2345',
  npwpName: 'PT Dummy Nusantara',
  taxAddress: 'Jl. Contoh Raya No. 1, Jakarta',
};

async function signIn(baseUrl, email = 'admin@ordertrack.test', password = 'Password123!') {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = response.headers.get('set-cookie');
  const body = await response.json();
  return { user: body.data.user, cookie };
}

async function withPhase5Server(fn) {
  const userModel = createMemoryModel();
  const customerModel = createMemoryModel();
  const vendorModel = createMemoryModel();
  const quotationModel = createMemoryModel();
  const salesOrderModel = createMemoryModel();
  const vendorPoModel = createMemoryModel();
  const goodsReceiptModel = createMemoryModel();
  const shippingRequestModel = createMemoryModel();
  const deliveryOrderModel = createMemoryModel();

  // seed users
  const passwordHash = await bcrypt.hash('Password123!', 4);
  await userModel.create({ name: 'Admin', email: 'admin@ordertrack.test', passwordHash, role: 'ADMIN' });
  await userModel.create({ name: 'Sales A', email: 'salesa@ordertrack.test', passwordHash, role: 'SALES' });
  await userModel.create({ name: 'Purchasing', email: 'purchasing@ordertrack.test', passwordHash, role: 'PURCHASING' });
  await userModel.create({ name: 'GA', email: 'ga@ordertrack.test', passwordHash, role: 'GA' });
  await userModel.create({ name: 'AR', email: 'ar@ordertrack.test', passwordHash, role: 'AR' });

  const app = createApp({
    userModel,
    customerModel,
    vendorModel,
    quotationModel,
    salesOrderModel,
    vendorPoModel,
    goodsReceiptModel,
    shippingRequestModel,
    deliveryOrderModel,
    settings: testSettings,
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn({ baseUrl, userModel, salesOrderModel, shippingRequestModel, deliveryOrderModel });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function api(baseUrl, path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.cookie ? { Cookie: options.cookie } : {}) };
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

test('shipping request creation and delivery order flow to completed', async () => {
  await withPhase5Server(async ({ baseUrl }) => {
    const adminAuth = await signIn(baseUrl, 'admin@ordertrack.test');
    const salesAuth = await signIn(baseUrl, 'salesa@ordertrack.test');
    const purchasingAuth = await signIn(baseUrl, 'purchasing@ordertrack.test');
    const gaAuth = await signIn(baseUrl, 'ga@ordertrack.test');
    const arAuth = await signIn(baseUrl, 'ar@ordertrack.test');

    // Create Customer
    const custRes = await api(baseUrl, '/api/customers', {
      method: 'POST',
      cookie: adminAuth.cookie,
      body: customerBody,
    });
    assert.equal(custRes.status, 201);
    const customerId = custRes.body.data.customer.id;

    // Create Vendor
    const vendorRes = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      cookie: adminAuth.cookie,
      body: { name: 'PT Vendor Jaya', contact: '08123456789' },
    });
    assert.equal(vendorRes.status, 201);
    const vendorId = vendorRes.body.data.vendor.id;

    // Create Quotation
    const quotRes = await api(baseUrl, '/api/quotations', {
      method: 'POST',
      cookie: salesAuth.cookie,
      body: {
        customerId,
        items: [{ sku: 'SKU-1', name: 'Barang A', qty: 5, unitPrice: 1000 }],
        notes: 'Test Quotation',
      },
    });
    assert.equal(quotRes.status, 201);
    const quotationId = quotRes.body.data.quotation.id;

    // Convert Quotation to SO
    await api(baseUrl, `/api/quotations/${quotationId}/send`, { method: 'POST', cookie: salesAuth.cookie });
    const convRes = await api(baseUrl, `/api/quotations/${quotationId}/convert`, { method: 'POST', cookie: salesAuth.cookie });
    assert.equal(convRes.status, 201);
    const salesOrderId = convRes.body.data.salesOrder.id;

    // Create Vendor PO so we can receive goods
    const vpoRes = await api(baseUrl, '/api/vendor-pos', {
      method: 'POST',
      cookie: purchasingAuth.cookie,
      body: {
        soId: salesOrderId,
        vendorId,
        items: [{ soItemIndex: 0, qty: 5 }],
      },
    });
    assert.equal(vpoRes.status, 201);
    const vendorPoId = vpoRes.body.data.vendorPo.id;

    // Create Goods Receipt so items are available to ship
    const grRes = await api(baseUrl, '/api/goods-receipts', {
      method: 'POST',
      cookie: gaAuth.cookie,
      body: {
        soId: salesOrderId,
        vendorPoId,
        items: [{ soItemIndex: 0, qtyReceived: 5 }],
      },
    });
    assert.equal(grRes.status, 201);

    // Create Shipping Request
    const srRes = await api(baseUrl, '/api/shipping/shipping-requests', {
      method: 'POST',
      cookie: salesAuth.cookie,
      body: {
        soId: salesOrderId,
        items: [{ soItemIndex: 0, qty: 5 }],
      },
    });
    assert.equal(srRes.status, 201);
    const shippingRequestId = srRes.body.data.shippingRequest.id;

    // Verify duplicate pending shipping request fails due to reserved quantity guard
    const dupSrRes = await api(baseUrl, '/api/shipping/shipping-requests', {
      method: 'POST',
      cookie: salesAuth.cookie,
      body: {
        soId: salesOrderId,
        items: [{ soItemIndex: 0, qty: 1 }],
      },
    });
    assert.equal(dupSrRes.status, 400);

    // Create Delivery Order (GA)
    const doRes = await api(baseUrl, '/api/shipping/delivery-orders', {
      method: 'POST',
      cookie: gaAuth.cookie,
      body: {
        shippingRequestId,
        items: [{ soItemIndex: 0, qty: 5 }],
      },
    });
    assert.equal(doRes.status, 201);
    const deliveryOrderId = doRes.body.data.deliveryOrder.id;

    // Check SO status is SHIPPED
    const soDetail = await api(baseUrl, `/api/sales-orders/${salesOrderId}`, { cookie: arAuth.cookie });
    assert.equal(soDetail.body.data.salesOrder.status, 'SHIPPED');

    // Mark Signed Returned (AR/GA)
    const signRes = await api(baseUrl, `/api/shipping/delivery-orders/${deliveryOrderId}/signed-returned`, {
      method: 'PATCH',
      cookie: arAuth.cookie,
    });
    assert.equal(signRes.status, 200);
    assert.equal(signRes.body.data.deliveryOrder.status, 'SIGNED_RETURNED');

    // Check SO status is COMPLETED
    const soCompleted = await api(baseUrl, `/api/sales-orders/${salesOrderId}`, { cookie: arAuth.cookie });
    assert.equal(soCompleted.body.data.salesOrder.status, 'COMPLETED');
  });
});
