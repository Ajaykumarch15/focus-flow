// @vitest-environment node
// IES-P0-40 · report access control — every authenticated reports endpoint must
// reject unauthenticated callers, and the token-gated share path must refuse
// revoked/expired/unknown tokens while never leaking per-session detail.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('../models/User');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const ReportShare = require('../models/ReportShare');
const reportRouter = require('../routes/reports');
const { csrfProtect } = require('../middleware/csrf');

const SECRET = 'p0-40-test-report-access-secret-32char';
const CLIENT_URL = 'http://localhost:5173';
const USER_ID = '5f0000000000000000000d2';

const signToken = (userId, tv = 0) => jwt.sign({ id: userId, tv }, SECRET, { expiresIn: '30d' });
const cookieHeaderFor = (token) => `ff_session=${token}`;

let server;
let baseUrl;

function authUser(overrides = {}) {
  return {
    _id: USER_ID,
    name: 'Report User',
    email: 'report@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    settings: { timezone: 'UTC' },
    ...overrides,
  };
}

function mockFindById(user) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

function mockEmptyData() {
  const sessions = Promise.resolve([]);
  sessions.populate = () => sessions;
  const workLogs = Promise.resolve([]);
  workLogs.sort = () => workLogs;
  vi.spyOn(Session, 'find').mockReturnValue(sessions);
  vi.spyOn(WorkLog, 'find').mockReturnValue(workLogs);
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

describe('IES-P0-40 · reports require auth — no unauthenticated legacy path', () => {
  it('GET /api/reports/summary without a token is rejected 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports/summary`);
    expect(res.status).toBe(401);
  });

  it('GET /api/reports/day without a token is rejected 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports/day?date=2026-07-15`);
    expect(res.status).toBe(401);
  });

  it('GET /api/reports/leaderboard without a token is rejected 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports/leaderboard`);
    expect(res.status).toBe(401);
  });

  it('POST /api/reports/share without a token is rejected 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-07-15' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/reports/share/:token/revoke without a token is rejected 401', async () => {
    const res = await fetch(`${baseUrl}/api/reports/share/abc/revoke`, { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

describe('IES-P0-40 · authenticated report endpoints', () => {
  it('returns a 200 summary for a valid token', async () => {
    mockFindById(authUser());
    mockEmptyData();
    const res = await fetch(`${baseUrl}/api/reports/summary`, {
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('creates a token-gated share for an authenticated user', async () => {
    mockFindById(authUser());
    vi.spyOn(ReportShare, 'create').mockResolvedValue({
      token: 'share-token-1',
      date: '2026-07-15',
      expiresAt: null,
    });
    const res = await fetch(`${baseUrl}/api/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeaderFor(signToken(USER_ID)),
      },
      body: JSON.stringify({ date: '2026-07-15' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBe('share-token-1');
    expect(body.date).toBe('2026-07-15');
  });

  it('revoke only succeeds for a share owned by the caller', async () => {
    mockFindById(authUser());
    vi.spyOn(ReportShare, 'findOneAndUpdate').mockResolvedValue({ token: 'abc' });
    const res = await fetch(`${baseUrl}/api/reports/share/abc/revoke`, {
      method: 'POST',
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(200);
  });

  it('revoke returns 404 when the share does not belong to the caller', async () => {
    mockFindById(authUser());
    vi.spyOn(ReportShare, 'findOneAndUpdate').mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/api/reports/share/nope/revoke`, {
      method: 'POST',
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(404);
  });
});

describe('IES-P0-40 · auth middleware on reports rejects deleted users and stale tokens', () => {
  it('rejects a soft-deleted user', async () => {
    mockFindById(authUser({ deletedAt: new Date() }));
    const res = await fetch(`${baseUrl}/api/reports/summary`, {
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a token with an outdated tokenVersion', async () => {
    mockFindById(authUser({ tokenVersion: 7 }));
    const res = await fetch(`${baseUrl}/api/reports/summary`, {
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID, 0)) },
    });
    expect(res.status).toBe(401);
  });
});

describe('IES-P0-40 · public share-token path is gated by a valid, unexpired token', () => {
  it('renders a share for a valid unexpired token without session detail', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue({
      token: 'share-token-1',
      userId: USER_ID,
      date: '2026-07-15',
      revokedAt: null,
      expiresAt: null,
    });
    mockFindById(authUser());
    vi.spyOn(Session, 'find').mockImplementation(() => ({
      populate: () =>
        Promise.resolve([
          { _id: 's1', startTime: 1, endTime: 2, activeTime: 1_000, taskId: { _id: 't1', title: 'T' } },
        ]),
    }));
    vi.spyOn(WorkLog, 'find').mockImplementation(() => ({ sort: () => Promise.resolve([]) }));

    const res = await fetch(`${baseUrl}/api/reports/share/token/share-token-1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intern).toBe('Report User');
    expect(body.sessionCount).toBe(1);
    expect(body.totalMs).toBe(1_000);
    expect(body.tasks[0].sessions).toEqual([]);
  });

  it('refuses an unknown share token', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/api/reports/share/token/does-not-exist`);
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('Share link expired or revoked');
  });

  it('refuses a revoked share token', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue({
      token: 'revoked-1',
      userId: USER_ID,
      revokedAt: new Date(),
      expiresAt: null,
    });
    const res = await fetch(`${baseUrl}/api/reports/share/token/revoked-1`);
    expect(res.status).toBe(404);
  });

  it('refuses an expired share token', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue({
      token: 'expired-1',
      userId: USER_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await fetch(`${baseUrl}/api/reports/share/token/expired-1`);
    expect(res.status).toBe(404);
  });

  it('refuses a share whose owner has been soft-deleted (IES-P1-23)', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue({
      token: 'gone-owner-1',
      userId: USER_ID,
      date: '2026-07-15',
      revokedAt: null,
      expiresAt: null,
    });
    mockFindById(authUser({ deletedAt: new Date() }));
    const res = await fetch(`${baseUrl}/api/reports/share/token/gone-owner-1`);
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('User not found');
  });
});

describe('IES-P1-13 · share creation always sets a bounded expiresAt', () => {
  function mockCreateCapture() {
    let captured;
    vi.spyOn(ReportShare, 'create').mockImplementation(async (doc) => {
      captured = doc;
      return { ...doc, token: 'share-token-p1-13' };
    });
    return () => captured;
  }

  it('defaults to a future expiresAt within the 1..365 day bound', async () => {
    mockFindById(authUser());
    const getCaptured = mockCreateCapture();
    const before = Date.now();

    const res = await fetch(`${baseUrl}/api/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeaderFor(signToken(USER_ID)),
      },
      body: JSON.stringify({ date: '2026-07-15' }),
    });

    expect(res.status).toBe(201);
    const captured = getCaptured();
    expect(captured.expiresAt).toBeDefined();
    expect(captured.expiresAt.getTime()).toBeGreaterThan(before);
    expect(captured.expiresAt.getTime()).toBeLessThanOrEqual(before + 365 * 86400000);
  });

  it('honours an explicit expiresInDays and stays within the cap', async () => {
    mockFindById(authUser());
    const getCaptured = mockCreateCapture();
    const before = Date.now();

    const res = await fetch(`${baseUrl}/api/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeaderFor(signToken(USER_ID)),
      },
      body: JSON.stringify({ date: '2026-07-15', expiresInDays: 7 }),
    });

    expect(res.status).toBe(201);
    const captured = getCaptured();
    expect(captured.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 86400000 - 1000);
    expect(captured.expiresAt.getTime()).toBeLessThanOrEqual(before + 7 * 86400000 + 1000);
  });

  it('rejects expiresInDays outside the 1..365 bound', async () => {
    mockFindById(authUser());
    const createSpy = vi.spyOn(ReportShare, 'create').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeaderFor(signToken(USER_ID)),
      },
      body: JSON.stringify({ date: '2026-07-15', expiresInDays: 366 }),
    });

    expect(res.status).toBe(400);
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe('IES-P1-15 · share responses are never cached (no-store)', () => {
  it('token render response carries Cache-Control: no-store', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue({
      token: 'ns-token',
      userId: USER_ID,
      date: '2026-07-15',
      revokedAt: null,
      expiresAt: null,
    });
    mockFindById(authUser());
    vi.spyOn(Session, 'find').mockImplementation(() => ({
      populate: () => Promise.resolve([]),
    }));
    vi.spyOn(WorkLog, 'find').mockImplementation(() => ({ sort: () => Promise.resolve([]) }));

    const res = await fetch(`${baseUrl}/api/reports/share/token/ns-token`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('unknown-token 404 also refuses caching', async () => {
    vi.spyOn(ReportShare, 'findOne').mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/api/reports/share/token/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('share creation response carries Cache-Control: no-store', async () => {
    mockFindById(authUser());
    vi.spyOn(ReportShare, 'create').mockResolvedValue({
      token: 'ns-token',
      date: '2026-07-15',
      expiresAt: null,
    });
    const res = await fetch(`${baseUrl}/api/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeaderFor(signToken(USER_ID)),
      },
      body: JSON.stringify({ date: '2026-07-15' }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('revoke response carries Cache-Control: no-store', async () => {
    mockFindById(authUser());
    vi.spyOn(ReportShare, 'findOneAndUpdate').mockResolvedValue({ token: 'ns-token' });
    const res = await fetch(`${baseUrl}/api/reports/share/ns-token/revoke`, {
      method: 'POST',
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
