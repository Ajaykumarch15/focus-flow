// @vitest-environment node
// IES-P1-17 · admin system analytics is driven by MongoDB aggregation pipelines
// ($match/$group/$facet) instead of loading every session/task/user into JS.
// The fixture asserts the pipeline output matches what the previous in-memory
// handler computed, and the route wiring stays admin-gated. Bounded memory is
// enforced by asserting the handler never calls find() on the collections.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const adminRouter = require('../routes/admin');
const { runSystemAnalytics } = require('../utils/adminAnalytics');

const SECRET = 'p1-17-admin-analytics-test-secret-32char';
const CLIENT_URL = 'http://localhost:5173';
const ADMIN_ID = '5f0000000000000000000a12';
const NOW = Date.UTC(2026, 6, 15, 12, 0, 0); // 2026-07-15T12:00:00Z

const signToken = (userId, tv = 0) => jwt.sign({ id: userId, tv }, SECRET, { expiresIn: '30d' });
const cookieHeaderFor = (token) => `ff_session=${token}`;

let server;
let baseUrl;

function adminUser() {
  return {
    _id: ADMIN_ID,
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    tokenVersion: 0,
    deletedAt: null,
    settings: { timezone: 'UTC' },
  };
}

function plainUser() {
  return {
    _id: '5f0000000000000000000a32',
    name: 'Regular',
    email: 'reg@example.com',
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

// Fixture that mirrors the numbers the OLD in-memory handler would produce:
//   3 completed sessions (users A,A,B) → totalFocusMs 6.0M, avgFocusScore 77,
//   2 unique users; 2 live sessions → totalSessions 5; 4 tasks (2 completed)
//   → 50% completion; signups grouped on 2026-07-10 (2) and 2026-07-14 (1).
function mockAnalyticsFixtures() {
  vi.spyOn(User, 'countDocuments').mockImplementation((filter) =>
    Promise.resolve(filter && filter.createdAt ? 3 : 10)
  );
  vi.spyOn(Session, 'countDocuments').mockResolvedValue(2);
  vi.spyOn(Session, 'aggregate').mockResolvedValue([
    {
      period: [{ totalFocusMs: 6_000_000, totalFocusScore: 230, sessionCount: 3, uniqueUsers: 2 }],
      daily: [
        { date: '2026-06-16', totalMs: 4_200_000, sessionCount: 2, activeUsers: 1 },
        { date: '2026-07-14', totalMs: 1_800_000, sessionCount: 1, activeUsers: 1 },
      ],
      live: [{ n: 2 }],
    },
  ]);
  vi.spyOn(Task, 'aggregate').mockResolvedValue([
    {
      totals: [{ totalTasks: 4, completedTasks: 2 }],
      byCategory: [
        { category: 'Deep Work', totalTimeMs: 4_000_000, taskCount: 1 },
        { category: 'Work', totalTimeMs: 2_500_000, taskCount: 2 },
        { category: 'Uncategorized', totalTimeMs: 100_000, taskCount: 1 },
      ],
    },
  ]);
  vi.spyOn(User, 'aggregate').mockResolvedValue([
    { _id: '2026-07-10', count: 2 },
    { _id: '2026-07-14', count: 1 },
  ]);
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = CLIENT_URL;
  delete process.env.NODE_ENV;

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRouter);
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

describe('IES-P1-17 · runSystemAnalytics matches the previous JS aggregation', () => {
  it('computes identical metrics without loading collections via find()', async () => {
    mockAnalyticsFixtures();
    const sessionFind = vi.spyOn(Session, 'find').mockImplementation(() => { throw new Error('Session.find must not be used'); });
    const taskFind = vi.spyOn(Task, 'find').mockImplementation(() => { throw new Error('Task.find must not be used'); });
    const userFind = vi.spyOn(User, 'find').mockImplementation(() => { throw new Error('User.find must not be used'); });

    const result = await runSystemAnalytics({ period: 'month', now: NOW });

    expect(result.period).toBe('month');
    expect(result.totalUsers).toBe(10);
    expect(result.newUsers).toBe(3);
    expect(result.activeUsers).toBe(2);
    expect(result.totalFocusMs).toBe(6_000_000);
    expect(result.totalSessions).toBe(5); // 3 completed + 2 live
    expect(result.avgFocusScore).toBe(77); // Math.round(230 / 3)
    expect(result.taskCompletionRate).toBe(50); // Math.round(2 / 4 * 100)
    expect(result.totalTasks).toBe(4);
    expect(result.completedTasks).toBe(2);

    expect(result.dailyFocus).toEqual([
      { date: '2026-06-16', totalMs: 4_200_000, sessionCount: 2, activeUsers: 1 },
      { date: '2026-07-14', totalMs: 1_800_000, sessionCount: 1, activeUsers: 1 },
    ]);

    expect(result.topCategories).toEqual([
      { category: 'Deep Work', totalTimeMs: 4_000_000, taskCount: 1 },
      { category: 'Work', totalTimeMs: 2_500_000, taskCount: 2 },
      { category: 'Uncategorized', totalTimeMs: 100_000, taskCount: 1 },
    ]);

    expect(result.userGrowth).toHaveLength(30);
    expect(result.userGrowth[0].date).toBe('2026-06-16');
    expect(result.userGrowth[29].date).toBe('2026-07-15');
    expect(result.userGrowth.reduce((sum, d) => sum + d.count, 0)).toBe(3);
    expect(result.userGrowth.find((d) => d.date === '2026-07-14').count).toBe(1);

    expect(sessionFind).not.toHaveBeenCalled();
    expect(taskFind).not.toHaveBeenCalled();
    expect(userFind).not.toHaveBeenCalled();
  });

  it('drives aggregation through $match/$group/$facet pipelines', async () => {
    mockAnalyticsFixtures();
    await runSystemAnalytics({ period: 'month', now: NOW });

    const sessionPipeline = vi.mocked(Session.aggregate).mock.calls[0][0];
    // IES-P1-23: the pipeline leads with a users $lookup so a soft-deleted
    // owner's sessions are excluded before any aggregation runs.
    expect(sessionPipeline[0]).toEqual({
      $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' },
    });
    expect(sessionPipeline[1]).toEqual({ $match: { 'u.deletedAt': null } });
    const sessionFacet = sessionPipeline.find((stage) => stage.$facet).$facet;
    expect(sessionFacet.period.find((stage) => stage.$group).$group).toMatchObject({
      _id: null,
      totalFocusMs: { $sum: '$activeTime' },
      sessionCount: { $sum: 1 },
      uniqueUsers: { $addToSet: '$userId' },
    });
    expect(sessionFacet.daily.some((stage) => stage.$group && stage.$group._id.$dateToString)).toBe(true);
    expect(sessionFacet.daily.some((stage) => stage.$sort && stage.$sort.date === 1)).toBe(true);
    // IES-P1-23: the live-session count lives in its own facet branch and is
    // subject to the same deleted-user $lookup.
    expect(sessionFacet.live.some((stage) => stage.$count && stage.$count === 'n')).toBe(true);

    const taskPipeline = vi.mocked(Task.aggregate).mock.calls[0][0];
    expect(taskPipeline[0]).toEqual({ $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } });
    expect(taskPipeline[1].$match).toEqual({ 'u.deletedAt': null, createdAt: { $gte: expect.any(Date) } });
    const taskFacet = taskPipeline.find((stage) => stage.$facet).$facet;
    expect(taskFacet.totals[0].$group._id).toBeNull();
    expect(taskFacet.byCategory.some((stage) => stage.$limit === 10)).toBe(true);
    expect(taskFacet.byCategory.some((stage) => stage.$sort && stage.$sort.totalTimeMs === -1)).toBe(true);
  });
});

describe('IES-P1-17 · GET /api/admin/system-analytics route', () => {
  it('rejects a non-admin caller with 403', async () => {
    mockFindById(plainUser());
    const res = await fetch(`${baseUrl}/api/admin/system-analytics`, {
      headers: { Cookie: cookieHeaderFor(signToken(plainUser()._id)) },
    });
    expect(res.status).toBe(403);
  });

  it('returns analytics computed from aggregation pipelines for an admin', async () => {
    mockFindById(adminUser());
    mockAnalyticsFixtures();

    const res = await fetch(`${baseUrl}/api/admin/system-analytics?period=week`, {
      headers: { Cookie: cookieHeaderFor(signToken(ADMIN_ID)) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('week');
    expect(body.totalUsers).toBe(10);
    expect(body.dailyFocus).toHaveLength(2);
    expect(body.userGrowth).toHaveLength(30);

    const sessionPipeline = vi.mocked(Session.aggregate).mock.calls[0][0];
    expect(sessionPipeline.some((stage) => stage.$facet)).toBe(true);
  });
});
