// @vitest-environment node
// IES-P1-18 — admin list endpoints return bounded, cursor-paginated responses
// with stable ordering, instead of unbounded full-collection dumps.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const adminRouter = require('../routes/admin');

function buildAdmin() {
  return new User({
    name: 'Pagination Admin',
    email: 'admin@example.com',
    passwordHash: 'not-a-real-hash',
    role: 'admin',
  });
}

function signToken(userId) {
  return jwt.sign({ id: userId.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function makeDocs(n, field = 'createdAt') {
  return Array.from({ length: n }, (_, i) => ({
    _id: `id-${String(i).padStart(3, '0')}`,
    [field]: new Date(1700000000000 - i * 1000),
  }));
}

function encodeCursor(t, id) {
  return Buffer.from(JSON.stringify({ t, id })).toString('base64url');
}

let server;
let baseUrl;

beforeAll(async () => {
  process.env.JWT_SECRET = 'p1-18-pagination-test-secret-at-least-32-chars';
  const app = express();
  app.use(express.json());
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

// Capture the filter/sort/limit args each route passes to its model query.
let captured;
function mockUserFind(docs) {
  vi.spyOn(User, 'find').mockImplementation((filter) => {
    captured = { filter };
    return {
      sort: (sort) => {
        captured.sort = sort;
        return {
          limit: (lim) => {
            captured.limit = lim;
            return { select: () => Promise.resolve(docs) };
          },
        };
      },
    };
  });
}

function mockActivityFind(docs) {
  vi.spyOn(Activity, 'find').mockImplementation((filter) => {
    captured = { filter };
    return {
      populate: () => ({
        sort: (sort) => {
          captured.sort = sort;
          return {
            limit: (lim) => {
              captured.limit = lim;
              return Promise.resolve(docs);
            },
          };
        },
      }),
    };
  });
}

function mockAuth() {
  const admin = buildAdmin();
  vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(admin),
  }));
  return admin;
}

describe('IES-P1-18 · admin list pagination', () => {
  it('GET /api/admin/users returns a bounded { items, hasMore, nextCursor } page', async () => {
    mockAuth();
    mockUserFind(makeDocs(2));

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('caps the page size at 100 and sets nextCursor when more rows exist', async () => {
    mockAuth();
    mockUserFind(makeDocs(101));

    const res = await fetch(`${baseUrl}/api/admin/users?limit=1000`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(200);
    expect(captured.limit).toBe(101); // pageSize cap (100) + 1 probe row
    const body = await res.json();
    expect(body.items).toHaveLength(100);
    expect(body.hasMore).toBe(true);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('uses the default page size when no limit is given', async () => {
    mockAuth();
    mockUserFind(makeDocs(1));

    await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(captured.limit).toBe(51); // default 50 + 1 probe row
  });

  it('applies the keyset cursor with stable (createdAt: -1, _id: -1) ordering', async () => {
    mockAuth();
    mockUserFind(makeDocs(100));
    const cursor = encodeCursor(1700000000000, 'id-050');

    await fetch(`${baseUrl}/api/admin/users?cursor=${encodeURIComponent(cursor)}`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });

    expect(captured.sort).toEqual({ createdAt: -1, _id: -1 });
    expect(captured.filter).toEqual({
      deletedAt: null,
      $or: [
        { createdAt: { $lt: 1700000000000 } },
        { createdAt: 1700000000000, _id: { $lt: 'id-050' } },
      ],
    });
  });

  it('rejects a malformed cursor with 400', async () => {
    mockAuth();
    mockUserFind([]);

    const res = await fetch(`${baseUrl}/api/admin/users?cursor=${encodeURIComponent('%%%')}`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/users/deleted paginates by deletedAt with a non-null filter', async () => {
    mockAuth();
    mockUserFind(makeDocs(3, 'deletedAt'));

    const res = await fetch(`${baseUrl}/api/admin/users/deleted`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(200);
    expect(captured.sort).toEqual({ deletedAt: -1, _id: -1 });
    expect(captured.filter.deletedAt).toEqual({ $ne: null });
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.hasMore).toBe(false);
  });

  it('GET /api/admin/activity returns a paged feed with stable ordering', async () => {
    mockAuth();
    mockActivityFind(makeDocs(10));

    const res = await fetch(`${baseUrl}/api/admin/activity?limit=10&action=login`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(200);
    expect(captured.filter).toEqual({ action: 'login' });
    expect(captured.sort).toEqual({ createdAt: -1, _id: -1 });
    expect(captured.limit).toBe(11);
    const body = await res.json();
    expect(body.items).toHaveLength(10);
    expect(body.hasMore).toBe(false);
  });

  it('keeps the legacy `before` param working on activity without a cursor', async () => {
    mockAuth();
    mockActivityFind(makeDocs(2));

    const res = await fetch(`${baseUrl}/api/admin/activity?before=1700000000000`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(200);
    expect(captured.filter.createdAt.$lt.getTime()).toBe(1700000000000);
    expect(captured.filter).not.toHaveProperty('$or');
    const body = await res.json();
    expect(body.items).toHaveLength(2);
  });

  it('sets nextCursor on activity when a second page exists', async () => {
    mockAuth();
    mockActivityFind(makeDocs(11));

    const res = await fetch(`${baseUrl}/api/admin/activity?limit=10`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    const body = await res.json();
    expect(body.items).toHaveLength(10);
    expect(body.hasMore).toBe(true);
    expect(typeof body.nextCursor).toBe('string');
  });
});

describe('EEP2-P2.3.2 · admin audit scoping (no data leak)', () => {
  function mockNonAdmin() {
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(new User({
        name: 'Pagination Dev',
        email: 'dev@example.com',
        passwordHash: 'not-a-real-hash',
        role: 'developer',
      })),
    }));
  }

  it('GET /api/admin/activity rejects a non-admin with 403', async () => {
    mockNonAdmin();
    const res = await fetch(`${baseUrl}/api/admin/activity`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('Admin privileges required');
  });

  it('GET /api/admin/users rejects a non-admin with 403', async () => {
    mockNonAdmin();
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${signToken('aaaaaaaaaaaaaaaaaaaaaaaa')}` },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('Admin privileges required');
  });
});
