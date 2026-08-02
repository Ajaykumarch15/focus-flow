// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

// Load all server CJS modules via native require so mongoose compiles each model exactly once.
const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authRouter = require('../routes/auth');
const profileRouter = require('../routes/profile');
const adminRouter = require('../routes/admin');

const TOKEN_FIELDS = /googleTokens|accessToken|refreshToken/;

function buildUser(overrides = {}) {
  return new User({
    name: 'Token Test',
    email: 'tokens@example.com',
    passwordHash: 'not-a-real-hash',
    role: 'user',
    googleConnected: true,
    googleTokens: {
      accessToken: 'at-iamatest',
      refreshToken: 'rt-iamatest',
      expiryDate: 987654321,
    },
    ...overrides,
  });
}

function signToken(userId) {
  return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

let server;
let baseUrl;

beforeAll(async () => {
  process.env.JWT_SECRET = 'p0-04-test-secret-at-least-32-chars-long';
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/admin', adminRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IES-P0-04 · Google OAuth tokens never reach API responses', () => {
  it('user.toJSON() strips googleTokens and passwordHash', () => {
    const json = buildUser().toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.googleTokens).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(TOKEN_FIELDS);
  });

  it('GET /api/auth/me returns no google tokens', async () => {
    const user = buildUser();
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(user),
    }));

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${signToken(user._id)}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.googleTokens).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(TOKEN_FIELDS);
  });

  it('GET /api/profile returns no google tokens', async () => {
    const user = buildUser();
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(user),
    }));

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${signToken(user._id)}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.googleTokens).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(TOKEN_FIELDS);
  });

  it('PATCH /api/profile returns no google tokens', async () => {
    const user = buildUser({ name: 'Old Name' });
    const updated = buildUser({ name: 'New Name' });
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(user),
    }));
    vi.spyOn(User, 'findByIdAndUpdate').mockImplementation(() => ({
      select: () => Promise.resolve(updated),
    }));

    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${signToken(user._id)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New Name');
    expect(body.googleTokens).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(TOKEN_FIELDS);
  });

  it('GET /api/admin/users returns no google tokens', async () => {
    const admin = buildUser({ email: 'admin@example.com', role: 'admin' });
    const members = [
      buildUser({ email: 'a@example.com' }),
      buildUser({ email: 'b@example.com' }),
    ];
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(admin),
    }));
    vi.spyOn(User, 'find').mockImplementation(() => ({
      select: () => ({ sort: () => Promise.resolve(members) }),
    }));

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${signToken(admin._id)}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    for (const u of body) {
      expect(u.googleTokens).toBeUndefined();
      expect(u.passwordHash).toBeUndefined();
      expect(JSON.stringify(u)).not.toMatch(TOKEN_FIELDS);
    }
  });
});
