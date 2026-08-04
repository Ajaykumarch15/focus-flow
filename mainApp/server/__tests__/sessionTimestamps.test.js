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
const { dayKey, localDateToUtc } = require('../utils/dates');

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SESSION_ID = '507f1f77bcf86cd799439011';
const TASK_ID = '507f1f77bcf86cd799439012';

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
      _id: SESSION_ID,
      userId: mockUser._id,
      taskId: TASK_ID,
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

  // IES-P1-08: a stateful User.updateOne mock that mimics MongoDB's atomic
  // conditional-update semantics for the points $inc / streak day-gate / best
  // pipeline, so we can verify increments are never lost and a day counts once.
  function installAtomicUserMock(initial, timeZone) {
    const state = {
      totalPoints: initial.totalPoints ?? 0,
      streak: { current: initial.current ?? 0, best: initial.best ?? 0, lastDate: initial.lastDate ?? null },
    };
    const updateOne = vi.spyOn(User, 'updateOne').mockImplementation((filter, update) => {
      if (update && update.$inc && update.$inc.totalPoints !== undefined) {
        state.totalPoints += update.$inc.totalPoints;
        return Promise.resolve({ modifiedCount: 1 });
      }
      if (update && update.$inc && update.$inc['streak.current'] !== undefined) {
        if (state.streak.lastDate === filter['streak.lastDate']) {
          state.streak.current += 1;
          state.streak.lastDate = dayKey(Date.now(), timeZone);
          return Promise.resolve({ modifiedCount: 1 });
        }
        return Promise.resolve({ modifiedCount: 0 });
      }
      if (update && update.$set && update.$set['streak.current'] !== undefined) {
        const banned = filter['streak.lastDate']?.$nin || [];
        if (!banned.includes(state.streak.lastDate)) {
          state.streak.current = 1;
          state.streak.lastDate = dayKey(Date.now(), timeZone);
          return Promise.resolve({ modifiedCount: 1 });
        }
        return Promise.resolve({ modifiedCount: 0 });
      }
      if (Array.isArray(update)) {
        state.streak.best = Math.max(state.streak.best || 0, state.streak.current);
        return Promise.resolve({ modifiedCount: 1 });
      }
      return Promise.resolve({ modifiedCount: 1 });
    });
    return { state, updateOne };
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
    // IES-P1-08: the stop route now updates the user via atomic updateOne calls.
    vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
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
    vi.spyOn(Task, 'findOne').mockClear().mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});
    const create = vi.spyOn(Session, 'create').mockClear().mockImplementation(async (doc) => ({ _id: 'sess-new', ...doc }));

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: TASK_ID, startTime: future }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.startTime).toBeLessThanOrEqual(Date.now() + FUTURE_SKEW_MS);
    expect(body.startTime).toBeGreaterThan(Date.now() - 30_000);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ taskId: TASK_ID, isActive: true }));
  });

  it('POST start ignores an ancient startTime and records ~now', async () => {
    const ancient = Date.now() - 100 * DAY;
    vi.spyOn(Task, 'findOne').mockClear().mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});
    const create = vi.spyOn(Session, 'create').mockClear().mockImplementation(async (doc) => ({ _id: 'sess-new', ...doc }));

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: TASK_ID, startTime: ancient }),
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

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endTime: Date.now() + 365 * DAY }),
    });

    expect(res.status).toBe(200);
    expect(session.isActive).toBe(false);
    expect(session.endTime).toBeLessThanOrEqual(Date.now() + FUTURE_SKEW_MS);
    expect(session.activeTime).toBeLessThan(HOUR); // ~5 min elapsed, not a year
    expect(session.activeTime).toBeGreaterThan(0);
    // IES-P1-07: focusScore stays within [0, 100] on every stop.
    expect(session.focusScore).toBe(100);
    expect(session.focusScore).toBeLessThanOrEqual(100);
  });

  it('PATCH stop with endTime before startTime clamps to a sane elapsed time', async () => {
    resetMockUser();
    const session = makeActiveSession();
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
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

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/resume`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeTime: Date.now() + 365 * DAY }), // future
    });

    expect(res.status).toBe(200);
    const pause = session.pauseLog[0];
    expect(pause.resumeTime).toBeLessThanOrEqual(Date.now() + FUTURE_SKEW_MS);
    expect(session.totalPauseDuration).toBeGreaterThanOrEqual(0);
  });

  // ── IES-P1-05: offline-replay opId dedupe ──────────────────────────────────

  it('POST ignores a duplicate opId replay (no second session)', async () => {
    const existing = { _id: 'sess-dup', taskId: TASK_ID, startTime: Date.now() - 60_000, isActive: true, clientOpId: 'op-dup' };
    vi.spyOn(Task, 'findOne').mockClear().mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'findOne').mockClear().mockImplementation(async (filter) =>
      filter.clientOpId ? existing : null
    );
    const create = vi.spyOn(Session, 'create').mockClear().mockResolvedValue({});
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: TASK_ID, opId: 'op-dup' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe('sess-dup');
    expect(create).not.toHaveBeenCalled();
  });

  it('POST start stores the client opId for idempotent replay', async () => {
    vi.spyOn(Task, 'findOne').mockClear().mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});
    const create = vi.spyOn(Session, 'create').mockClear().mockImplementation(async (doc) => ({ _id: 'sess-new', ...doc }));

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: TASK_ID, opId: 'op-abc' }),
    });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ clientOpId: 'op-abc' }));
  });

  it('PATCH pause ignores an already-applied opId (no duplicate pause)', async () => {
    const session = makeActiveSession({ pauseLog: [], pauseCount: 0, appliedOpIds: ['op-pause-1'] });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/pause`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pauseTime: Date.now(), opId: 'op-pause-1' }),
    });

    expect(res.status).toBe(200);
    expect(session.pauseCount).toBe(0);
    expect(session.save).not.toHaveBeenCalled();
  });

  it('PATCH pause applies a new opId and records it', async () => {
    const session = makeActiveSession({ pauseLog: [], pauseCount: 0, appliedOpIds: [] });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/pause`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pauseTime: Date.now(), opId: 'op-pause-2' }),
    });

    expect(res.status).toBe(200);
    expect(session.pauseCount).toBe(1);
    expect(session.appliedOpIds).toContain('op-pause-2');
  });

  it('PATCH stop ignores an already-applied opId (no re-compute)', async () => {
    resetMockUser();
    const session = makeActiveSession({ isActive: true, appliedOpIds: ['op-stop-1'] });
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endTime: Date.now(), opId: 'op-stop-1' }),
    });

    expect(res.status).toBe(200);
    expect(session.isActive).toBe(true); // untouched by the duplicate replay
    expect(session.save).not.toHaveBeenCalled();
    expect(mockUser.save).not.toHaveBeenCalled();
  });

  // ── IES-P1-06: streaks key off the user's timezone, not server-local/UTC ──

  it('PATCH stop computes streak "today" from the user timezone boundary', async () => {
    resetMockUser();
    const timeZone = 'Asia/Kolkata'; // UTC+5:30 — the old UTC key / server-local boundary drifted here
    mockUser.settings = { dailyGoal: 1, timezone: timeZone };
    mockUser.streak = { current: 0, best: 0, lastDate: null };

    const { state, updateOne } = installAtomicUserMock({ current: 0, best: 0, lastDate: null }, timeZone);

    const session = makeActiveSession();
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    const findMock = vi.spyOn(Session, 'find').mockClear();
    findMock.mockImplementation((filter) => {
      if (filter.startTime) {
        return Promise.resolve([{ activeTime: 2 * HOUR }]); // ≥ 1h goal
      }
      return Promise.resolve([]); // allSessions total
    });
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const todayFilter = findMock.mock.calls[0][0];
    expect(todayFilter.startTime.$gte).toBe(localDateToUtc(dayKey(Date.now(), timeZone), timeZone).getTime());
    // IES-P1-08: the streak day-gate is applied via conditional updateOne.
    expect(state.streak.current).toBe(1);
    expect(state.streak.lastDate).toBe(dayKey(Date.now(), timeZone));
    expect(state.totalPoints).toBeGreaterThan(0);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: mockUser._id },
      { $inc: { totalPoints: expect.any(Number) } }
    );
  });

  it('PATCH stop with a UTC user keeps the UTC day boundary', async () => {
    resetMockUser();
    const timeZone = 'UTC';
    mockUser.settings = { dailyGoal: 1, timezone: timeZone };
    mockUser.streak = { current: 5, best: 5, lastDate: null };

    const { state } = installAtomicUserMock({ current: 5, best: 5, lastDate: null }, timeZone);

    const session = makeActiveSession();
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    const findMock = vi.spyOn(Session, 'find').mockClear();
    findMock.mockImplementation((filter) => {
      if (filter.startTime) return Promise.resolve([{ activeTime: 2 * HOUR }]);
      return Promise.resolve([]);
    });
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const todayFilter = findMock.mock.calls[0][0];
    expect(todayFilter.startTime.$gte).toBe(Date.parse(`${dayKey(Date.now(), 'UTC')}T00:00:00.000Z`));
    expect(state.streak.lastDate).toBe(dayKey(Date.now(), 'UTC'));
    // streak resets to 1 (lastDate was null), best stays at its max via pipeline.
    expect(state.streak.current).toBe(1);
    expect(state.streak.best).toBe(5);
  });

  // ── IES-P1-08: concurrent stops can't lose increments or double-count a day ──

  it('two concurrent stops apply both point increments and advance the streak day-gate once', async () => {
    resetMockUser();
    const timeZone = 'UTC';
    mockUser.settings = { dailyGoal: 1, timezone: timeZone };
    mockUser.streak = { current: 0, best: 0, lastDate: null };

    const { state } = installAtomicUserMock({ current: 0, best: 0, lastDate: null }, timeZone);

    const SESSION_B = '507f1f77bcf86cd799439022';
    const sessionA = makeActiveSession();
    const sessionB = makeActiveSession({ _id: SESSION_B });
    const sessionsById = { [SESSION_ID]: sessionA, [SESSION_B]: sessionB };
    vi.spyOn(Session, 'findOne').mockClear().mockImplementation(async ({ _id }) => sessionsById[_id] || null);
    const findMock = vi.spyOn(Session, 'find').mockClear();
    findMock.mockImplementation((filter) => {
      if (filter.startTime) return Promise.resolve([{ activeTime: 2 * HOUR }]);
      return Promise.resolve([]);
    });
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const stop = (id) => fetch(`${baseUrl}/api/sessions/${id}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const results = await Promise.all([stop(SESSION_ID), stop(SESSION_B)]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    // Both $inc point increments land — nothing is lost to a stale read.
    expect(state.totalPoints).toBeGreaterThan(0);
    expect(state.totalPoints).toBeGreaterThanOrEqual(2 * Math.round((5 * 60_000 / 60000) * 1));
    // The day-gate let only ONE stop count today.
    expect(state.streak.current).toBe(1);
    expect(state.streak.lastDate).toBe(dayKey(Date.now(), timeZone));
    expect(state.streak.best).toBe(1);
  });

  it('PATCH stop treats a 0h dailyGoal as met (no silent 8h fallback)', async () => {
    resetMockUser();
    const timeZone = 'UTC';
    // P1-07 allows dailyGoal 0..24; `|| 8` would silently upgrade 0h to 8h and
    // skip the streak update entirely. 0h must mean "goal already met".
    mockUser.settings = { dailyGoal: 0, timezone: timeZone };
    mockUser.streak = { current: 0, best: 0, lastDate: null };

    const { state } = installAtomicUserMock({ current: 0, best: 0, lastDate: null }, timeZone);

    const session = makeActiveSession();
    vi.spyOn(Session, 'findOne').mockClear().mockResolvedValue(session);
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]); // 0 active time today
    vi.spyOn(Task, 'findById').mockClear().mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockClear().mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(state.streak.current).toBe(1);
    expect(state.streak.lastDate).toBe(dayKey(Date.now(), timeZone));
  });
});
