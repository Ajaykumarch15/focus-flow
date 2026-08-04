// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('../models/User');
const Activity = require('../models/Activity');
const authRouter = require('../routes/auth');
const { csrfProtect } = require('../middleware/csrf');

const SECRET = 'p0-12-test-secret-at-least-32-chars-long';
const CLIENT_URL = 'http://localhost:5173';
const USER_ID = '5f0000000000000000000d1';

const signToken = (userId, tv = 0) => jwt.sign({ id: userId, tv }, SECRET, { expiresIn: '30d' });
const cookieHeaderFor = (token) => `ff_session=${token}`;

let server;
let baseUrl;

function mockUser(overrides = {}) {
  return {
    _id: USER_ID,
    name: 'Cookie User',
    email: 'cookie@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    comparePassword: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockFindById(user) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = CLIENT_URL;
  delete process.env.NODE_ENV;

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrfProtect);
  app.use('/api/auth', authRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-P0-12 · httpOnly session cookie', () => {
  it('login issues the JWT in an httpOnly SameSite=Lax cookie, not in the body', async () => {
    const user = mockUser();
    vi.spyOn(User, 'findOne').mockImplementation(() => ({ select: () => Promise.resolve(user) }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: CLIENT_URL },
      body: JSON.stringify({ email: 'cookie@example.com', password: 'secret1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeUndefined();

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('ff_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('Secure'); // dev is http
  });

  it('register sets the same session cookie', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'hashPassword').mockResolvedValue('hashed');
    vi.spyOn(User, 'create').mockResolvedValue(mockUser());

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: CLIENT_URL },
      body: JSON.stringify({ name: 'Cookie User', email: 'new@example.com', password: 'cookie-pass-1234' }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get('set-cookie')).toContain('ff_session=');
  });

  it('authenticates /me from the cookie alone, with no Authorization header', async () => {
    const user = mockUser();
    mockFindById(user);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID, 0)) },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe('cookie@example.com');
  });

  it('sets the Secure flag on the cookie in production', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const user = mockUser();
      vi.spyOn(User, 'findOne').mockImplementation(() => ({ select: () => Promise.resolve(user) }));
      vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: CLIENT_URL },
        body: JSON.stringify({ email: 'cookie@example.com', password: 'secret1' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('set-cookie')).toContain('Secure');
    } finally {
      delete process.env.NODE_ENV;
    }
  });
});

describe('IES-P0-12 · server-side logout revocation', () => {
  it('clears the cookie and bumps tokenVersion so the old token is rejected', async () => {
    const user = mockUser();
    mockFindById(user);
    const token = signToken(USER_ID, 0);

    const out = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeaderFor(token), Origin: CLIENT_URL },
    });

    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('ff_session=');
    expect(user.save).toHaveBeenCalled();
    expect(user.tokenVersion).toBe(1);

    // The now-stale token (tv 0 vs user tv 1) must be rejected.
    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeaderFor(token) },
    });
    expect(me.status).toBe(401);
  });
});

describe('IES-P0-12 · CSRF (SameSite + Origin check)', () => {
  it('rejects a state-changing request from a foreign origin', async () => {
    const user = mockUser();
    vi.spyOn(User, 'findOne').mockImplementation(() => ({ select: () => Promise.resolve(user) }));

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
      body: JSON.stringify({ email: 'cookie@example.com', password: 'secret1' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('Invalid request origin');
  });

  it('rejects a `null` origin (sandboxed context)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'null' },
      body: JSON.stringify({ email: 'cookie@example.com', password: 'secret1' }),
    });
    expect(res.status).toBe(403);
  });

  it('allows the configured client origin and origin-less requests', async () => {
    const user = mockUser();
    vi.spyOn(User, 'findOne').mockImplementation(() => ({ select: () => Promise.resolve(user) }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    let res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: CLIENT_URL },
      body: JSON.stringify({ email: 'cookie@example.com', password: 'secret1' }),
    });
    expect(res.status).toBe(200);

    res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cookie@example.com', password: 'secret1' }),
    });
    expect(res.status).toBe(200);
  });

  it('does not gate read-only GET requests on the origin', async () => {
    const user = mockUser();
    mockFindById(user);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Origin: 'https://evil.example.com', Cookie: cookieHeaderFor(signToken(USER_ID, 0)) },
    });
    expect(res.status).toBe(200);
  });
});
