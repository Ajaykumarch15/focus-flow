// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const sessionsRouter = require('../routes/sessions');
const { serverTime, FUTURE_SKEW_MS, MAX_SESSION_AGE_MS } = require('../utils/sessionTime');

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('serverTime · IES-P0-07 timestamp validation', () => {
  it('falls back to server now for absent / non-finite values', () => {
    expect(serverTime(undefined, { now: NOW })).toBe(NOW);
    expect(serverTime(null, { now: NOW })).toBe(NOW);
    expect(serverTime(NaN, { now: NOW })).toBe(NOW);
    expect(serverTime(Infinity, { now: NOW })).toBe(NOW);
    expect(serverTime('123', { now: NOW })).toBe(NOW);
  });

  it('rejects future timestamps beyond clock skew', () => {
    expect(serverTime(NOW + HOUR, { now: NOW })).toBe(NOW);
    expect(serverTime(NOW + FUTURE_SKEW_MS + 1, { now: NOW })).toBe(NOW);
  });

  it('tolerates small future clock skew', () => {
    expect(serverTime(NOW + 60_000, { now: NOW })).toBe(NOW + 60_000);
  });

  it('rejects timestamps older than the 24h recency window', () => {
    expect(serverTime(NOW - 2 * DAY, { now: NOW })).toBe(NOW);
    expect(serverTime(NOW - MAX_SESSION_AGE_MS - 1, { now: NOW })).toBe(NOW);
  });

  it('accepts timestamps within the 24h recency window', () => {
    expect(serverTime(NOW - HOUR, { now: NOW })).toBe(NOW - HOUR);
    expect(serverTime(NOW - MAX_SESSION_AGE_MS, { now: NOW })).toBe(NOW - MAX_SESSION_AGE_MS);
  });

  it('rejects a value earlier than the session start (min)', () => {
    const min = NOW - HOUR;
    expect(serverTime(min - 5_000, { min, now: NOW })).toBe(NOW);
  });

  it('accepts a value at or after the session start (min)', () => {
    const min = NOW - HOUR;
    expect(serverTime(min, { min, now: NOW })).toBe(min);
    expect(serverTime(NOW, { min, now: NOW })).toBe(NOW);
  });
});

describe('PATCH/POST /api/sessions enforce server timestamps', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function resetMockUser() {
    mockUser.totalPoints = 0;
    mockUser.streak = { current: 0, best: 0, lastDate: null };
    mockUser.settings = { dailyGoal: 8, timezone: 'UTC' };
    mockUser.save = vi.fn().mockResolvedValue(undefined);
  }

  function makeActiveSession(overrides = {}) {
    return {
      _id: 'sess-1',
      userId: mockUser._id,
      taskId: 'task-1',
      startTime: Date.now() - 5 * 60_000,
      pauseLog: [],
      totalPauseDuration: 0,
      pauseCount: 0,
      activeTime: 0,
      focusScore: 0,
      isActive: true,
      save: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p0-07-test-secret-at-least-32-chars-long';
    mockUser = {
      _id: '5f00000000000000000000ab',
      name: 'Time Test',
      email: 'time@example.com',
      settings: {},
      streak: {},
    };
    resetMockUser();

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());
    vi.spyOn(WorkLog, 'find').mockResolvedValue([]);

    const app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('POST start ignores a future startTime and records ~now', async () => {
    const future = Date.now() + 365 * DAY;
    vi.spyOn(Task, 'findOne').mockClear().mockResolvedValue({ _id: 'task-1', title: 'T' });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});
    const create = vi.spyOn(Session, 'create').mockClear().mockImplementation(async (doc) => ({ _id: 'sess-new', ...doc }));

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1', startTime: future }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.startTime).toBeLessThanOrEqual(Date.now() + FUTURE_SKEW_MS);
    expect(body.startTime).toBeGreaterThan(Date.now() - 30_000);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1', isActive: true }));
  });

  it('POST start ignores an ancient startTime and records ~now', async () => {
    const ancient = Date.now() - 100 * DAY;
    vi.spyOn(Task, 'findOne').mockClear().mockResolvedValue({ _id: 'task-1', title: 'T' });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});
    const create = vi.spyOn(Session, 'create').mockClear().mockImplementation(async (doc) => ({ _id: 'sess-new', ...doc }));

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1', startTime: ancient }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.startTime).toBeGreaterThan(Date.now() - 30_000);
    expect(body.startTime).toBeGreaterThan(ancient);
  });

  it('PATCH stop with a year-in-the-future endTime cannot inflate activeTime', async () => {
    resetMockUser();
    const session = makeActiveSession();
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/sess-1/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endTime: Date.now() + 365 * DAY }),
    });

    expect(res.status).toBe(200);
    expect(session.isActive).toBe(false);
    expect(session.endTime).toBeLessThanOrEqual(Date.now() + FUTURE_SKEW_MS);
    expect(session.activeTime).toBeLessThan(HOUR); // ~5 min elapsed, not a year
    expect(session.activeTime).toBeGreaterThan(0);
  });

  it('PATCH stop with endTime before startTime clamps to a sane elapsed time', async () => {
    resetMockUser();
    const session = makeActiveSession();
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/sess-1/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endTime: session.startTime - HOUR }),
    });

    expect(res.status).toBe(200);
    expect(session.activeTime).toBeGreaterThanOrEqual(0);
    expect(session.activeTime).toBeLessThan(HOUR);
  });

  it('PATCH pause/resume with invalid timestamps still closes the pause safely', async () => {
    const session = makeActiveSession({ pauseLog: [{ pauseStart: Date.now() - 60_000 }], totalPauseDuration: 0 });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/sess-1/resume`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeTime: Date.now() + 365 * DAY }), // future
    });

    expect(res.status).toBe(200);
    const pause = session.pauseLog[0];
    expect(pause.resumeTime).toBeLessThanOrEqual(Date.now() + FUTURE_SKEW_MS);
    expect(session.totalPauseDuration).toBeGreaterThanOrEqual(0);
  });
});
