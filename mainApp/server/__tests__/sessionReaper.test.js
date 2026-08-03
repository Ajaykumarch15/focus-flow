// @vitest-environment node
// IES-P1-26 · pause/resume & zombie session handling.
//   - The reaper closes active sessions whose client stopped heartbeating.
//   - Freshly-active sessions are untouched; "active now" stays accurate.
//   - The PATCH /:id/heartbeat route refreshes lastHeartbeat atomically.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const WorkLog = require('../models/WorkLog');
const sessionsRouter = require('../routes/sessions');
const { STALE_MS, closeStaleSession, reapStaleSessions } = require('../jobs/reaper');

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const HOUR = 3_600_000;
const SESSION_ID = '507f1f77bcf86cd799439011';
const TASK_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';

function makeSession(overrides = {}) {
  return {
    _id: SESSION_ID,
    userId: USER_ID,
    taskId: TASK_ID,
    startTime: NOW - 3 * HOUR,
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

describe('reapStaleSessions · IES-P1-26 zombie reclaim', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('closes a zombie whose last heartbeat is stale and credits nothing after it', async () => {
    const lastAlive = NOW - 20 * MIN;
    const zombie = makeSession({ lastHeartbeat: lastAlive });
    vi.spyOn(Session, 'find').mockImplementation(async (filter) =>
      filter.isActive && filter.$or ? [zombie] : []
    );
    vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({});

    const closed = await reapStaleSessions({ now: NOW });

    expect(closed).toBe(1);
    expect(zombie.isActive).toBe(false);
    expect(zombie.endTime).toBe(lastAlive);
    expect(zombie.activeTime).toBe(lastAlive - zombie.startTime);
    expect(zombie.save).toHaveBeenCalledTimes(1);
  });

  it('closes an open pause at the last heartbeat before finalizing', async () => {
    const lastAlive = NOW - 20 * MIN;
    const zombie = makeSession({
      lastHeartbeat: lastAlive,
      pauseLog: [{ pauseStart: lastAlive - 5 * MIN }],
      totalPauseDuration: 0,
    });
    vi.spyOn(Session, 'find').mockImplementation(async (filter) =>
      filter.isActive && filter.$or ? [zombie] : []
    );
    vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({});

    await reapStaleSessions({ now: NOW });

    expect(zombie.pauseLog[0].resumeTime).toBe(lastAlive);
    expect(zombie.totalPauseDuration).toBe(5 * MIN);
    expect(zombie.activeTime).toBe(lastAlive - zombie.startTime - 5 * MIN);
  });

  it('scans by heartbeat cutoff and legacy start-time (never a fresh unmigrated doc)', async () => {
    vi.spyOn(Session, 'find').mockResolvedValue([]);
    vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({});

    await reapStaleSessions({ now: NOW });

    expect(Session.find).toHaveBeenCalledWith({
      isActive: true,
      $or: [
        { lastHeartbeat: { $lt: NOW - STALE_MS } },
        { lastHeartbeat: { $exists: false }, startTime: { $lt: NOW - STALE_MS } },
      ],
    });
  });

  it('does not touch active sessions whose heartbeat is fresh', async () => {
    const live = makeSession({ lastHeartbeat: NOW - 30_000 });
    vi.spyOn(Session, 'find').mockResolvedValue([]);
    vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({});

    const closed = await reapStaleSessions({ now: NOW });

    expect(closed).toBe(0);
    expect(live.isActive).toBe(true);
    expect(live.save).not.toHaveBeenCalled();
  });

  it('recomputes affected task totals after reclaiming zombies', async () => {
    const zombie = makeSession({ lastHeartbeat: NOW - 20 * MIN });
    vi.spyOn(Session, 'find').mockImplementation(async (filter) => {
      if (filter.isActive && filter.$or) return [zombie];
      if (filter.taskId && !filter.$or) return [{ activeTime: 2 * HOUR }, { activeTime: HOUR }];
      return [];
    });
    const update = vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({});

    await reapStaleSessions({ now: NOW });

    expect(update).toHaveBeenCalledWith({ _id: TASK_ID }, { totalTime: 3 * HOUR, status: 'todo' });
  });
});

describe('closeStaleSession · IES-P1-26 unit', () => {
  it('caps end at startTime for legacy docs that never heartbeated', async () => {
    const session = makeSession({ startTime: NOW - HOUR, lastHeartbeat: undefined, pauseLog: [], totalPauseDuration: 0 });
    const closed = await closeStaleSession(session, NOW);

    expect(closed.endTime).toBe(NOW - HOUR);
    expect(closed.activeTime).toBe(0);
    expect(closed.isActive).toBe(false);
  });
});

describe('PATCH /api/sessions/:id/heartbeat · IES-P1-26', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p1-26-test-secret-at-least-32-chars-long';
    mockUser = { _id: USER_ID, name: 'HB', email: 'hb@example.com' };

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

  it('refreshes lastHeartbeat on the active session owned by the user', async () => {
    const stamped = { _id: SESSION_ID, lastHeartbeat: NOW };
    const findOneAndUpdate = vi.spyOn(Session, 'findOneAndUpdate').mockResolvedValue(stamped);

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/heartbeat`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lastHeartbeat: NOW });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: SESSION_ID, userId: USER_ID, isActive: true },
      { $set: { lastHeartbeat: expect.any(Number) } },
      expect.objectContaining({ new: true })
    );
  });

  it('404s when the session is gone or was already reaped', async () => {
    vi.spyOn(Session, 'findOneAndUpdate').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/heartbeat`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(404);
  });

  it('rejects a fabricated future heartbeat via serverTime', async () => {
    const stamped = { _id: SESSION_ID, lastHeartbeat: NOW };
    const findOneAndUpdate = vi.spyOn(Session, 'findOneAndUpdate').mockResolvedValue(stamped);

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/heartbeat`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ at: Date.now() + 365 * 24 * HOUR }),
    });

    expect(res.status).toBe(200);
    const updatedAt = findOneAndUpdate.mock.calls[0][1].$set.lastHeartbeat;
    expect(updatedAt).toBeLessThanOrEqual(Date.now() + 5 * MIN);
  });

  it('PATCH stop records lastHeartbeat alongside the close', async () => {
    const session = makeSession({ startTime: Date.now() - 5 * MIN, pauseLog: [], totalPauseDuration: 0 });
    vi.spyOn(Session, 'findOne').mockResolvedValue(session);
    vi.spyOn(Session, 'find').mockResolvedValue([]);
    vi.spyOn(Task, 'findById').mockResolvedValue(null);
    vi.spyOn(Task, 'findByIdAndUpdate').mockResolvedValue({});
    vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    const res = await fetch(`${baseUrl}/api/sessions/${SESSION_ID}/stop`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(session.isActive).toBe(false);
    expect(session.lastHeartbeat).toBe(session.endTime);
    expect(session.lastHeartbeat).toBeGreaterThanOrEqual(session.startTime);
  });
});
