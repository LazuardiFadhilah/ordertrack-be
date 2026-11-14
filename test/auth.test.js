import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import appFactory, { createApp } from '../src/app.js';
import { createAuthenticateUser, requireRole } from '../src/middleware/auth.js';
import { USER_ROLES } from '../src/models/User.js';

const testSettings = {
  jwtSecret: randomBytes(32).toString('hex'),
  jwtExpiresIn: '1h',
  authCookieName: `ordertrack_test_session_${randomUUID()}`,
  authCookieSecure: false,
};

const password = randomBytes(24).toString('hex');
const passwordHash = await bcrypt.hash(password, 4);

function createQuery(value) {
  return {
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
  };
}

function createUserModel(users) {
  return {
    findOne({ email }) {
      return createQuery(users.find((user) => user.email === email) ?? null);
    },
    findById(id) {
      return createQuery(users.find((user) => String(user._id) === String(id)) ?? null);
    },
  };
}

const salesUser = {
  _id: 'user-sales',
  name: 'Dummy Sales User',
  email: 'sales@example.test',
  passwordHash,
  role: 'SALES',
};
const adminUser = {
  _id: 'user-admin',
  name: 'Dummy Admin User',
  email: 'admin@example.test',
  passwordHash,
  role: 'ADMIN',
};
const userModel = createUserModel([salesUser, adminUser]);

async function withServer(serverApp, run) {
  const server = http.createServer(serverApp);
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

function cookieFrom(response) {
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('login rejects malformed input with the standard validation error shape', async () => {
  await withServer(createApp({ userModel, settings: testSettings }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Invalid request');
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.some(({ field }) => field === 'email'));
    assert.ok(body.errors.some(({ field }) => field === 'password'));
    assert.equal(body.passwordHash, undefined);
    assert.equal(body.token, undefined);
  });
});

test('unknown and wrong-password login failures have the same generic response', async () => {
  await withServer(createApp({ userModel, settings: testSettings }), async (baseUrl) => {
    async function login(email, candidatePassword) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: candidatePassword }),
      });
      return { status: response.status, body: await response.json() };
    }

    const unknown = await login('unknown@example.test', password);
    const wrongPassword = await login(salesUser.email, 'wrong-password');
    assert.deepEqual(unknown, wrongPassword);
    assert.deepEqual(unknown, {
      status: 401,
      body: {
        success: false,
        message: 'Invalid email or password',
        errors: [],
      },
    });
  });
});

test('valid login returns a safe profile and sets an httpOnly cookie', async () => {
  await withServer(createApp({ userModel, settings: testSettings }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: salesUser.email, password }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      success: true,
      data: {
        user: {
          id: salesUser._id,
          name: salesUser.name,
          email: salesUser.email,
          role: salesUser.role,
        },
      },
    });
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, new RegExp(`^${testSettings.authCookieName}=`));
    assert.match(setCookie, /HttpOnly/);
    assert.doesNotMatch(setCookie, /passwordHash/);
    assert.equal(body.data.user.passwordHash, undefined);
    assert.equal(body.data.token, undefined);
  });
});

test('me requires a valid cookie and returns the safe profile with one', async () => {
  await withServer(createApp({ userModel, settings: testSettings }), async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(missing.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: salesUser.email, password }),
    });
    const authenticated = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: cookieFrom(login) },
    });

    assert.equal(authenticated.status, 200);
    assert.deepEqual(await authenticated.json(), {
      success: true,
      data: {
        user: {
          id: salesUser._id,
          name: salesUser.name,
          email: salesUser.email,
          role: salesUser.role,
        },
      },
    });
  });
});

test('logout clears the configured cookie with the contracted null data', async () => {
  await withServer(createApp({ userModel, settings: testSettings }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: null });
    assert.match(response.headers.get('set-cookie'), new RegExp(`^${testSettings.authCookieName}=;`));
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  });
});

test('role middleware returns 403 for a disallowed authenticated role over HTTP', async () => {
  const protectedApp = express();
  const router = Router();
  router.get(
    '/protected',
    createAuthenticateUser(userModel, testSettings),
    requireRole('ADMIN'),
    (_request, response) => response.json({ success: true, data: { allowed: true } }),
  );
  protectedApp.use(router);

  await withServer(protectedApp, async (baseUrl) => {
    const login = await fetch(`${baseUrl}/protected`, { headers: { cookie: 'invalid=1' } });
    assert.equal(login.status, 401);

    const authApp = createApp({ userModel, settings: testSettings });
    await withServer(authApp, async (authBaseUrl) => {
      const loginResponse = await fetch(`${authBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: salesUser.email, password }),
      });
      const response = await fetch(`${baseUrl}/protected`, {
        headers: { cookie: cookieFrom(loginResponse) },
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), {
        success: false,
        message: 'Forbidden',
        errors: [],
      });
    });
  });
});

test('appFactory remains the default Express application export', () => {
  assert.equal(typeof appFactory, 'function');
});

test('the User role enum contains exactly all six contracted roles', () => {
  assert.deepEqual(USER_ROLES, ['SALES', 'PURCHASING', 'GA', 'AR', 'AP', 'ADMIN']);
});