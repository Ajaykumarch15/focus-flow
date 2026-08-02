// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const authRouter = require('../routes/auth');
const adminRouter = require('../routes/admin');

const SECRET = 'p0-08-test-secret-at-least-32-chars-long';
const CLIENT_URL = 'http://localhost:5173';

// IES-P0-12: the JWT is delivered via the httpOnly ff_session cookie, not the body.
const tokenFromSetCookie = (res) => {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/ff_session=([^;]+)/);
  return match ? match[1] : null;
};

const ADMIN_ID = '5f0000000000000000000a1';
const TARGET_ID = '5f0000000000000000000a2';

function signToken(userId, tv) {
  return jwt.sign({ id: userId, tv }, SECRET, { expiresIn: '1h' });
}

let server;
let baseUrl;
let adminUser;
let authUser;

function mockFindByIdReturning(userObj) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(userObj),
  }));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = CLIENT_URL;

  adminUser = {
    _id: ADMIN_ID,
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    tokenVersion: 0,
  };
  authUser = {
    _id: '5f0000000000000000000a3',
    name: 'Auth User',
    email: 'auth@example.com',
    role: 'user',
    tokenVersion: 2,
  };

  vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-P0-08 · login rejects soft-deleted users', () => {
  it('queries with { email, deletedAt: null }', async () => {
    const findOne = vi.spyOn(User, 'findOne').mockImplementation(() => ({
      select: () => Promise.resolve(null),
    }));

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gone@example.com', password: 'secret1' }),
    });

    expect(res.status).toBe(401);
    expect(findOne).toHaveBeenCalledWith({ email: 'gone@example.com', deletedAt: null });
  });

  it('blocks a soft-deleted user even with the right password', async () => {
    const deleted = {
      _id: TARGET_ID,
      email: 'gone@example.com',
      deletedAt: new Date(),
      comparePassword: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(User, 'findOne').mockImplementation(() => ({
      select: () => Promise.resolve(deleted),
    }));

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gone@example.com', password: 'secret1' }),
    });

    expect(res.status).toBe(401);
  });

  it('embeds the user tokenVersion in the issued token', async () => {
    const active = {
      _id: authUser._id,
      email: 'auth@example.com',
      tokenVersion: 7,
      comparePassword: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(User, 'findOne').mockImplementation(() => ({
      select: () => Promise.resolve(active),
    }));

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'auth@example.com', password: 'secret1' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('ff_session=');
    const decoded = jwt.verify(tokenFromSetCookie(res), SECRET);
    expect(decoded.id).toBe(authUser._id);
    expect(decoded.tv).toBe(7);
  });
});

describe('IES-P0-08 · protect rejects deleted users and stale tokens', () => {
  it('accepts a token whose tv matches the user tokenVersion', async () => {
    mockFindByIdReturning(authUser);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${signToken(authUser._id, authUser.tokenVersion)}` },
    });

    expect(res.status).toBe(200);
  });

  it('rejects a token with a mismatched tv (invalidated by delete / role change)', async () => {
    mockFindByIdReturning(authUser);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${signToken(authUser._id, authUser.tokenVersion - 1)}` },
    });

    expect(res.status).toBe(401);
  });

  it('rejects a token with no tv claim against a versioned user', async () => {
    mockFindByIdReturning(authUser);

    const legacy = jwt.sign({ id: authUser._id }, SECRET, { expiresIn: '1h' });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${legacy}` },
    });

    expect(res.status).toBe(401);
  });

  it('rejects a token with no tv claim against any real (tv 0) user — forces re-login', async () => {
    mockFindByIdReturning({ ...authUser, tokenVersion: 0 });

    const legacy = jwt.sign({ id: authUser._id }, SECRET, { expiresIn: '1h' });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${legacy}` },
    });

    expect(res.status).toBe(401);
  });

  it('rejects a soft-deleted user per request', async () => {
    mockFindByIdReturning({ ...authUser, deletedAt: new Date() });

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${signToken(authUser._id, authUser.tokenVersion)}` },
    });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown user', async () => {
    mockFindByIdReturning(null);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${signToken(authUser._id, authUser.tokenVersion)}` },
    });

    expect(res.status).toBe(401);
  });
});

describe('IES-P0-08 · admin actions bump tokenVersion', () => {
  beforeEach(() => {
    mockFindByIdReturning(adminUser);
  });

  it('role change increments tokenVersion', async () => {
    const findByIdAndUpdate = vi.spyOn(User, 'findByIdAndUpdate').mockImplementation(() => ({
      select: () => Promise.resolve({ _id: TARGET_ID, name: 'T', role: 'admin', tokenVersion: 1 }),
    }));

    const res = await fetch(`${baseUrl}/api/admin/users/${TARGET_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken(ADMIN_ID, 0)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });

    expect(res.status).toBe(200);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      TARGET_ID,
      { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true }
    );
  });

  it('name-only update leaves tokenVersion untouched', async () => {
    const findByIdAndUpdate = vi.spyOn(User, 'findByIdAndUpdate').mockImplementation(() => ({
      select: () => Promise.resolve({ _id: TARGET_ID, name: 'New Name', role: 'user', tokenVersion: 0 }),
    }));

    const res = await fetch(`${baseUrl}/api/admin/users/${TARGET_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken(ADMIN_ID, 0)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      TARGET_ID,
      { $set: { name: 'New Name' } },
      { new: true, runValidators: true }
    );
  });

  it('soft delete increments tokenVersion alongside deletedAt', async () => {
    const findByIdAndUpdate = vi.spyOn(User, 'findByIdAndUpdate').mockClear().mockImplementation(() => ({
      select: () => Promise.resolve({ _id: TARGET_ID, name: 'T', deletedAt: new Date(), tokenVersion: 1 }),
    }));

    const res = await fetch(`${baseUrl}/api/admin/users/${TARGET_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signToken(ADMIN_ID, 0)}` },
    });

    expect(res.status).toBe(200);
    const [id, ops, opts] = findByIdAndUpdate.mock.calls.at(-1);
    expect(id).toBe(TARGET_ID);
    expect(ops.$set.deletedAt).toBeInstanceOf(Date);
    expect(ops.$inc).toEqual({ tokenVersion: 1 });
    expect(opts).toEqual({ new: true });
  });

  it('restore clears deletedAt without bumping tokenVersion', async () => {
    const findByIdAndUpdate = vi.spyOn(User, 'findByIdAndUpdate').mockImplementation(() => ({
      select: () => Promise.resolve({ _id: TARGET_ID, name: 'T', deletedAt: null, tokenVersion: 1 }),
    }));

    const res = await fetch(`${baseUrl}/api/admin/users/${TARGET_ID}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken(ADMIN_ID, 0)}` },
    });

    expect(res.status).toBe(200);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      TARGET_ID,
      { $set: { deletedAt: null } },
      { new: true }
    );
  });
});

describe('IES-P0-08 · register tokens carry tokenVersion 0', () => {
  it('signs a new user token with tv = 0', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'hashPassword').mockResolvedValue('hashed');
    vi.spyOn(User, 'create').mockResolvedValue({
      _id: '5f0000000000000000000a4',
      name: 'New',
      email: 'new@example.com',
      tokenVersion: 0,
    });

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', email: 'new@example.com', password: 'secret1' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeUndefined();
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('ff_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(jwt.verify(tokenFromSetCookie(res), SECRET).tv).toBe(0);
  });
});

describe('IES-P0-08 · google callback rejects soft-deleted users', () => {
  it('redirects with user_not_found for an unknown/consumed state', async () => {
    // IES-P0-10: callback resolves the user by hashed OAuth nonce, never a JWT.
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const res = { redirect: vi.fn() };
    const state = 'some-opaque-nonce';

    await authRouter.handleGoogleCallback(
      { query: { code: 'some-code', state } },
      res
    );

    expect(res.redirect).toHaveBeenCalledWith(`${CLIENT_URL}/settings?error=user_not_found`);
  });
});
