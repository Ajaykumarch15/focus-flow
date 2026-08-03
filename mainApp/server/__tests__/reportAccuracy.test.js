// @vitest-environment node
// IES-P1-14 · report aggregation correctness — completed items are counted on
// the day they were completed (not on every day a worklog appears) and report
// totals are reconciled with the unified-sync work entries (IES-P1-02), so the
// report matches the worklog view. Also covers the timezone-aware attribution
// that must hold regardless of the user's calendar timezone.
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
const reportRouter = require('../routes/reports');
const { csrfProtect } = require('../middleware/csrf');

const SECRET = 'p1-14-report-accuracy-test-secret-32char';
const CLIENT_URL = 'http://localhost:5173';
const USER_ID = '5f0000000000000000000d2';

const signToken = (userId, tv = 0) => jwt.sign({ id: userId, tv }, SECRET, { expiresIn: '30d' });
const cookieHeaderFor = (token) => `ff_session=${token}`;

let server;
let baseUrl;

function authUser() {
  return {
    _id: USER_ID,
    name: 'Accuracy User',
    email: 'accuracy@example.com',
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

function mockDayReportData({ sessions, workLogs }) {
  const sessionsQuery = Promise.resolve(sessions);
  sessionsQuery.populate = () => sessionsQuery;
  const workLogsQuery = Promise.resolve(workLogs);
  workLogsQuery.sort = () => workLogsQuery;
  vi.spyOn(Session, 'find').mockReturnValue(sessionsQuery);
  vi.spyOn(WorkLog, 'find').mockReturnValue(workLogsQuery);
}

function stubWorkLog(overrides = {}) {
  return {
    _id: 'w1',
    userId: USER_ID,
    title: 'Fixture Log',
    problem: '',
    gitBranch: '',
    currentWork: '',
    plan: '',
    designNotes: '',
    blockers: '',
    completedItems: [],
    links: [],
    status: 'in-progress',
    mood: 3,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
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

describe('IES-P1-14 · buildDayReport counts completed items by day', () => {
  it('counts only items whose completedAt falls on the report day', async () => {
    const today = Date.UTC(2026, 6, 15, 10, 30);
    const prior = Date.UTC(2026, 6, 14, 9, 0);
    const next = Date.UTC(2026, 6, 16, 8, 0);

    mockDayReportData({
      sessions: [],
      workLogs: [
        stubWorkLog({
          completedItems: [
            { _id: 'c1', text: 'today', completedAt: today, createdAt: today },
            { _id: 'c2', text: 'prior-day', completedAt: prior, createdAt: prior },
            { _id: 'c3', text: 'next-day', completedAt: next, createdAt: next },
            { _id: 'c4', text: 'createdAt-fallback', createdAt: today },
          ],
        }),
      ],
    });

    const report = await reportRouter.helpers.buildDayReport(USER_ID, '2026-07-15', 'UTC');
    expect(report.completedCount).toBe(2);
    expect(report.workLogCount).toBe(1);
  });

  it('attributes completed items in the user timezone, not UTC', async () => {
    const istStart = Date.UTC(2026, 6, 14, 18, 30); // 2026-07-15 00:00 IST
    mockDayReportData({
      sessions: [],
      workLogs: [
        stubWorkLog({
          completedItems: [
            // 01:30 IST on the 15th (still the 14th in UTC) → counted.
            { _id: 'c1', text: 'late-ist', completedAt: Date.UTC(2026, 6, 14, 20, 0) },
            // 22:30 IST on the 14th (before the IST midnight range) → excluded.
            { _id: 'c2', text: 'prev-ist', completedAt: Date.UTC(2026, 6, 14, 17, 0) },
            // 15:30 IST on the 15th → counted.
            { _id: 'c3', text: 'mid-ist', completedAt: Date.UTC(2026, 6, 15, 10, 0) },
          ],
        }),
      ],
    });

    const report = await reportRouter.helpers.buildDayReport(USER_ID, '2026-07-15', 'Asia/Kolkata');
    expect(report.completedCount).toBe(2);
    expect(report.totalMs).toBe(0);
    void istStart;
  });
});

describe('IES-P1-14 · buildDayReport totals reconcile with work entries', () => {
  it('uses workEntries.activeMs (unified sync) over raw session activeTime', async () => {
    const dayStart = Date.UTC(2026, 6, 15);

    mockDayReportData({
      sessions: [
        {
          _id: 's1',
          startTime: dayStart + 1000,
          endTime: dayStart + 6000,
          activeTime: 5_000,
          isActive: false,
          taskId: { _id: 't1', title: 'Task', color: '#111', category: 'feature', priority: 'high' },
        },
      ],
      workLogs: [
        stubWorkLog({
          workEntries: [
            {
              _id: 'e1',
              date: new Date(dayStart),
              activeMs: 2_000,
              startedAt: dayStart + 1000,
              endedAt: dayStart + 6000,
            },
          ],
        }),
      ],
    });

    const report = await reportRouter.helpers.buildDayReport(USER_ID, '2026-07-15', 'UTC');
    expect(report.totalMs).toBe(2_000);
    expect(report.tasks[0].totalMs).toBe(5_000);
  });

  it('falls back to session totals when a day has no persisted work entries', async () => {
    const dayStart = Date.UTC(2026, 6, 15);

    mockDayReportData({
      sessions: [
        {
          _id: 's1',
          startTime: dayStart + 1000,
          endTime: dayStart + 2000,
          activeTime: 1_000,
          isActive: false,
          taskId: { _id: 't1', title: 'Task', color: '#111', category: 'feature', priority: 'high' },
        },
      ],
      workLogs: [],
    });

    const report = await reportRouter.helpers.buildDayReport(USER_ID, '2026-07-15', 'UTC');
    expect(report.totalMs).toBe(1_000);
  });
});

describe('IES-P1-14 · /summary attributes completed items to their day', () => {
  it('places each completed item on the day it was completed', async () => {
    mockFindById(authUser());
    const d10 = Date.UTC(2026, 6, 10, 10);
    const d12 = Date.UTC(2026, 6, 12, 10);

    const sessions = Promise.resolve([
      { _id: 's1', startTime: d10, activeTime: 1_000, taskId: { _id: 't1' } },
      { _id: 's2', startTime: d12, activeTime: 2_000, taskId: { _id: 't2' } },
    ]);
    sessions.populate = () => sessions;
    vi.spyOn(Session, 'find').mockReturnValue(sessions);

    vi.spyOn(WorkLog, 'find').mockReturnValue(
      Promise.resolve([
        stubWorkLog({
          createdAt: new Date(d10),
          updatedAt: new Date(d12),
          completedItems: [
            { _id: 'c1', text: 'on-10th', completedAt: d10 },
            { _id: 'c2', text: 'on-12th', completedAt: d12 },
          ],
          workEntries: [
            { _id: 'e1', date: new Date(d10), activeMs: 1_000 },
            { _id: 'e2', date: new Date(d12), activeMs: 2_000 },
          ],
        }),
      ])
    );

    const res = await fetch(`${baseUrl}/api/reports/summary?from=2026-07-01&to=2026-07-15`, {
      headers: { Cookie: cookieHeaderFor(signToken(USER_ID)) },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const day10 = body.find((day) => day.date === '2026-07-10');
    const day12 = body.find((day) => day.date === '2026-07-12');
    expect(day10.completedCount).toBe(1);
    expect(day12.completedCount).toBe(1);
    expect(body.reduce((sum, day) => sum + day.completedCount, 0)).toBe(2);
  });
});
