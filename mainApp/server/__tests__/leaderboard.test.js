// @vitest-environment node
// IES-P1-16 · leaderboard correctness (DB-21) — the partial index
// `{ leaderboardOptIn: 1, totalPoints: -1 }` (filtered to `deletedAt: null`)
// serves the route, which must scope to opted-in, non-deleted users, order by
// descending points, and cap at 10. The query predicates match the partial
// filter + equality prefix + sort, which is the precondition for the index to
// serve it (real `explain()` needs a live DB; the migration test verifies the
// index itself exists with the same options).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('../models/User');
const reportRouter = require('../routes/reports');
const { csrfProtect } = require('../middleware/csrf');

const SECRET = 'p1-16-leaderboard-test-secret-32ch';
const CLIENT_URL = 'http://localhost:5173';
const USER_ID = '5f0000000000000000000d2';

const signToken = (userId, tv = 0) => jwt.sign({ id: userId, tv }, SECRET, { expiresIn: '30d' });
const cookieHeaderFor = (token) => `ff_session=${token}`;

let server;
let baseUrl;

function authUser() {
  return {
    _id: USER_ID,
    name: 'Leaderboard User',
    email: 'lb@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    settings: { timezone: 'UTC' },
  };
}

function mockFindById(user) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

function mockLeaderboard(users) {
  const query = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(users),
  };
  const findSpy = vi.spyOn(User, 'find').mockReturnValue(query);
  return { query, findSpy };
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = CLIENT_URL;
  delete process.env.NODE_ENV;

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrfProtect);
  app.use('/api/reports', reportRouter);
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

describe('IES-P1-16 · leaderboard scope, ordering, and index shape', () => {
  it('queries opted-in non-deleted users, sorted by points desc, capped at 10', async () => {
    mockFindById(authUser());
    const topUsers = [
      { name: 'Ada', avatar: '', totalPoints: 900, streak: { current: 5 } },
      { name: 'Grace', avatar: '', totalPoints: 400, streak: { current: 2 } },
    ];
    const { query, findSpy } = mockLeaderboard(topUsers);

    const res = await fetch(`${baseUrl}/api/reports/leaderboard`, {
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(topUsers);

    // The filter is the partial index's predicate — soft-deleted users
    // (deletedAt set) and opted-out users can never be returned because the
    // DB query itself excludes them.
    expect(findSpy).toHaveBeenCalledWith({ leaderboardOptIn: true, deletedAt: null });
    expect(query.select).toHaveBeenCalledWith('name avatar totalPoints streak');
    expect(query.sort).toHaveBeenCalledWith({ totalPoints: -1 });
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('query predicates match the partial index expression declared on the model', () => {
    const [spec, opts] = User.schema.indexes().find(([key]) =>
      JSON.stringify(key) === JSON.stringify({ leaderboardOptIn: 1, totalPoints: -1 })
    );
    expect(spec).toEqual({ leaderboardOptIn: 1, totalPoints: -1 });
    expect(opts.partialFilterExpression).toEqual({ leaderboardOptIn: true, deletedAt: null });
  });
});
