import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import app from '../src/app.js';

async function withServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /api/health returns the contracted success response', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: {
        service: 'server',
        status: 'ok',
      },
    });
  });
});

test('unknown routes return the standard error response without a stack trace', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-defined`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.deepEqual(body, {
      success: false,
      message: 'Route not found',
      errors: [],
    });
    assert.equal(body.stack, undefined);
  });
});

test('malformed JSON returns the standard error response without a stack trace', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      success: false,
      message: 'Invalid JSON body',
      errors: [],
    });
    assert.equal(body.stack, undefined);
  });
});
