// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const express = require('express');
const User = require('../models/User');
const Activity = require('../models/Activity');
const authRouter = require('../routes/auth');
const {
  createAuthLoginLimiter,
  createAuthRegisterLimiter,
  createApiLimiter,
} = require('../middleware/rateLimit');

const SECRET = 'p0-09-test-secret-at-least-32-chars-long';

function makeApp() {
  const app = express();
  app.use(express.json());
  return app;
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

function loginBody(email, password) {
  return JSON.stringify({ email, password });
}

function registerBody(name, email, password) {
  return JSON.stringify({ name, email, password });
}

describe('createAuthLoginLimiter · burst failures → 429 lockout', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = makeApp();
    app.post('/api/auth/login', createAuthLoginLimiter({ windowMs: 60_000, limit: 3 }), (req, res) =>
      res.status(401).json({ message: 'Invalid email or password' })
    );
    ({ server, baseUrl } = await listen(app));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns 429 after N failed attempts with a lockout message', async () => {
    const email = 'victim@example.com';
    let last;
    for (let i = 0; i < 3; i++) {
      last = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginBody(email, `wrong${i}`),
      });
    }
    expect(last.status).toBe(401);

    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody(email, 'wrong-again'),
    });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.message).toMatch(/too many failed login attempts/i);
    expect(blocked.headers.get('ratelimit-policy')).toMatch(/^\d+;w=/);
  });

  it('does not lock out a different account from the same IP', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody('other@example.com', 'wrong'),
    });
    expect(res.status).toBe(401);
  });
});

describe('createAuthRegisterLimiter · counts every attempt per IP', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = makeApp();
    app.post('/api/auth/register', createAuthRegisterLimiter({ windowMs: 60_000, limit: 3 }), (req, res) =>
      res.status(201).json({ ok: true })
    );
    ({ server, baseUrl } = await listen(app));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('blocks registration spam even though every attempt succeeds', async () => {
    let last;
    for (let i = 0; i < 3; i++) {
      last = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: registerBody(`Spam ${i}`, `spam${i}@example.com`, 'secret1'),
      });
    }
    expect(last.status).toBe(201);

    const blocked = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerBody('Spam 3', 'spam3@example.com', 'secret1'),
    });
    expect(blocked.status).toBe(429);
  });
});

describe('createApiLimiter · lenient global /api safety net', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = makeApp();
    const limiter = createApiLimiter({ windowMs: 60_000, limit: 5 });
    app.get('/api/reports/summary', limiter, (_req, res) => res.json({ ok: true }));
    ({ server, baseUrl } = await listen(app));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('allows legitimate traffic then 429s the burst', async () => {
    let last;
    for (let i = 0; i < 5; i++) {
      last = await fetch(`${baseUrl}/api/reports/summary`);
      expect(last.status).toBe(200);
    }

    const blocked = await fetch(`${baseUrl}/api/reports/summary`);
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.message).toMatch(/too many requests/i);
  });
});

describe('IES-P0-09 · auth routes enforce rate limits end-to-end', () => {
  let server;
  let baseUrl;

  // Returns the mongoose query-chain object synchronously (the route calls
  // `.select()` on it). Register's duplicate check awaits a bare query instead.
  const findOneMock = vi.fn((query) => {
    if (query.deletedAt !== undefined) {
      const email = query.email;
      return {
        select: () =>
          Promise.resolve({
            _id: '5f0000000000000000000b1',
            email,
            tokenVersion: 0,
            deletedAt: null,
            comparePassword: (pw) => Promise.resolve(pw === 'correct-password'),
          }),
      };
    }
    return Promise.resolve(null);
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    vi.spyOn(User, 'findOne').mockImplementation(findOneMock);
    vi.spyOn(User, 'hashPassword').mockResolvedValue('hashed');
    vi.spyOn(User, 'create').mockImplementation(async (doc) => ({ _id: '5f0000000000000000000b2', ...doc, tokenVersion: 0 }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    const app = makeApp();
    app.use('/api/auth', authRouter);
    ({ server, baseUrl } = await listen(app));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('locks out an account after 10 failed logins (11th → 429)', async () => {
    const email = 'target@example.com';
    let last;
    for (let i = 0; i < 10; i++) {
      last = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginBody(email, `wrong${i}`),
      });
      expect(last.status).toBe(401);
    }

    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody(email, 'wrong-again'),
    });
    expect(blocked.status).toBe(429);
  });

  it('successful logins do not consume the failure quota', async () => {
    const email = 'legit@example.com';
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginBody(email, 'correct-password'),
      });
      expect(res.status).toBe(200);
    }
  });

  it('blocks registration after 5 attempts from one IP', async () => {
    let last;
    for (let i = 0; i < 5; i++) {
      last = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: registerBody(`New User ${i}`, `newuser${i}@example.com`, 'secret1'),
      });
      expect(last.status).toBe(201);
    }

    const blocked = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerBody('New User 5', 'newuser5@example.com', 'secret1'),
    });
    expect(blocked.status).toBe(429);
  });
});

describe('IES-P0-09 · dependency declared in server/package.json', () => {
  it('lists express-rate-limit as a dependency', () => {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.dependencies['express-rate-limit']).toBeDefined();
  });
});
