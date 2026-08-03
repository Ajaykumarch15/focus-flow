// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const workLogsRouter = require('../routes/workLogs');
const { localDateToUtc } = require('../utils/dates');
const {
  sessionActiveMs,
  buildEffectiveWorkEntries,
  applyEffectiveWorkEntries,
  syncTaskWorkLogs,
} = require('../utils/worklogSync');

const MINUTE = 60_000;
const HOUR = 3_600_000;
const USER_ID = '5f00000000000000000000ab';
const LOG_ID = '5f00000000000000000000ac';
const TASK_ID = '507f1f77bcf86cd799439012';
const S1_ID = '507f1f77bcf86cd799439021';
const S2_ID = '507f1f77bcf86cd799439022';
const S3_ID = '507f1f77bcf86cd799439023';
const S4_ID = '507f1f77bcf86cd799439024';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations', 'migrations');

// Two stopped sessions on the same UTC day: total 90 min (5_400_000 ms).
const S1 = {
  _id: S1_ID,
  startTime: Date.UTC(2026, 7, 2, 10, 0),
  endTime: Date.UTC(2026, 7, 2, 11, 0),
  activeTime: HOUR,
  totalPauseDuration: 0,
  pauseLog: [],
  isActive: false,
};
const S2 = {
  _id: S2_ID,
  startTime: Date.UTC(2026, 7, 2, 11, 30),
  endTime: Date.UTC(2026, 7, 2, 12, 0),
  activeTime: 30 * MINUTE,
  totalPauseDuration: 0,
  pauseLog: [],
  isActive: false,
};

// Near-midnight sessions that split differently by timezone:
// S3 ends 23:30 IST on 08-02; S4 starts 00:00 IST on 08-03.
const S3 = {
  _id: S3_ID,
  startTime: Date.UTC(2026, 7, 2, 18, 0),
  endTime: Date.UTC(2026, 7, 2, 18, 30),
  activeTime: 30 * MINUTE,
  totalPauseDuration: 0,
  pauseLog: [],
  isActive: false,
};
const S4 = {
  _id: S4_ID,
  startTime: Date.UTC(2026, 7, 2, 18, 30),
  endTime: Date.UTC(2026, 7, 2, 20, 30),
  activeTime: 2 * HOUR,
  totalPauseDuration: 0,
  pauseLog: [],
  isActive: false,
};

describe('IES-P1-02 · buildEffectiveWorkEntries (timezone-aware grouping)', () => {
  it('collapses both sessions to one day in UTC but splits across the IST midnight', () => {
    const utc = buildEffectiveWorkEntries([S3, S4], 'UTC');
    expect(utc).toHaveLength(1);
    expect(utc[0].activeMs).toBe(2.5 * HOUR);

    const ist = buildEffectiveWorkEntries([S3, S4], 'Asia/Kolkata');
    expect(ist).toHaveLength(2);
    expect(ist[0]._dayKey).toBe('2026-08-02');
    expect(ist[0].activeMs).toBe(30 * MINUTE);
    expect(ist[1]._dayKey).toBe('2026-08-03');
    expect(ist[1].activeMs).toBe(2 * HOUR);
  });

  it('sums activeMs and merges session bounds per day', () => {
    const entries = buildEffectiveWorkEntries([S1, S2], 'UTC');
    expect(entries).toHaveLength(1);
    expect(entries[0].activeMs).toBe(1.5 * HOUR);
    expect(entries[0].startedAt).toBe(S1.startTime);
    expect(entries[0].endedAt).toBe(S2.endTime);
    expect(entries[0].sessionIds).toEqual([S1_ID, S2_ID]);
  });

  it('counts running time for a live session up to `now` and pause boundaries', () => {
    const live = { _id: 'live', startTime: 1_000_000, pauseLog: [], totalPauseDuration: 0, isActive: true };
    const entries = buildEffectiveWorkEntries([live], 'UTC', 1_000_000 + 25 * MINUTE);
    expect(entries[0].activeMs).toBe(25 * MINUTE);

    const paused = {
      _id: 'paused',
      startTime: 1_000_000,
      pauseLog: [{ pauseStart: 1_000_000 + 10 * MINUTE }],
      totalPauseDuration: 0,
      isActive: true,
    };
    const pausedEntries = buildEffectiveWorkEntries([paused], 'UTC', 1_000_000 + 40 * MINUTE);
    expect(pausedEntries[0].activeMs).toBe(10 * MINUTE);
  });

  it('sessionActiveMs uses recorded activeTime for stopped sessions', () => {
    expect(sessionActiveMs(S1, Date.now())).toBe(HOUR);
  });
});

describe('IES-P1-02 · applyEffectiveWorkEntries (idempotent merge)', () => {
  it('preserves `what` and `_id` for surviving days and drops stale days', () => {
    const log = {
      workEntries: [
        { _id: 'entry-a', date: new Date(Date.UTC(2026, 7, 2)), what: 'Shipped thing', activeMs: 999_999 },
        { _id: 'entry-stale', date: new Date(Date.UTC(2026, 7, 5)), what: 'gone day', activeMs: 120_000 },
      ],
    };

    const { workEntries, totalActiveMs } = applyEffectiveWorkEntries(log, [S1, S2], 'UTC');

    expect(totalActiveMs).toBe(1.5 * HOUR);
    expect(workEntries).toHaveLength(1);
    expect(workEntries[0]._id).toBe('entry-a');
    expect(workEntries[0].what).toBe('Shipped thing');
    expect(workEntries[0].activeMs).toBe(1.5 * HOUR);
  });

  it('gives new days an empty `what` and recomputes totals when sessions change', () => {
    const log = { workEntries: [] };
    const first = applyEffectiveWorkEntries(log, [S1], 'UTC');
    expect(first.workEntries[0].what).toBe('');
    expect(first.totalActiveMs).toBe(HOUR);

    const second = applyEffectiveWorkEntries(log, [S1, S2], 'UTC');
    expect(second.workEntries).toHaveLength(1);
    expect(second.workEntries[0].activeMs).toBe(1.5 * HOUR);
    expect(second.totalActiveMs).toBe(1.5 * HOUR);
  });

  it('empties entries when the task has no sessions', () => {
    const { workEntries, totalActiveMs } = applyEffectiveWorkEntries(
      { workEntries: [{ _id: 'x', date: new Date(Date.UTC(2026, 7, 2)), what: 'old', activeMs: 100 }] },
      [],
      'UTC'
    );
    expect(workEntries).toEqual([]);
    expect(totalActiveMs).toBe(0);
  });
});

describe('IES-P1-02 · worklog routes — GET is read-only, totals match the writer', () => {
  let server;
  let baseUrl;
  let mockUser;
  let findOneSpy;
  let findSpy;
  let sessionFindSpy;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function makeLog(overrides = {}) {
    return {
      _id: LOG_ID,
      userId: mockUser._id,
      taskRef: TASK_ID,
      workEntries: [],
      totalActiveMs: 0,
      save: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function findOneChain(log) {
    return {
      populate: () => ({ populate: () => Promise.resolve(log) }),
    };
  }

  function findChain(logs) {
    return {
      populate: () => ({ populate: () => ({ sort: () => Promise.resolve(logs) }) }),
    };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p1-02-test-secret-at-least-32-chars-long';
    mockUser = { _id: USER_ID, name: 'Sync Test', email: 'sync@example.com', settings: { timezone: 'UTC' } };

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    findOneSpy = vi.spyOn(WorkLog, 'findOne');
    findSpy = vi.spyOn(WorkLog, 'find');
    sessionFindSpy = vi.spyOn(Session, 'find');

    const app = express();
    app.use(express.json());
    app.use('/api/worklogs', workLogsRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /:id returns effective totals without writing', async () => {
    const log = makeLog();
    findOneSpy.mockClear().mockReturnValue(findOneChain(log));
    sessionFindSpy.mockClear().mockResolvedValue([S1, S2]);

    const res = await fetch(`${baseUrl}/api/worklogs/${LOG_ID}`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalActiveMs).toBe(1.5 * HOUR);
    expect(body.workEntries).toHaveLength(1);
    expect(body.workEntries[0].activeMs).toBe(1.5 * HOUR);
    expect(log.save).not.toHaveBeenCalled();
  });

  it('GET / (list) returns effective totals without writing', async () => {
    const log = makeLog();
    findSpy.mockClear().mockReturnValue(findChain([log]));
    sessionFindSpy.mockClear().mockResolvedValue([{ ...S1, taskId: TASK_ID }, { ...S2, taskId: TASK_ID }]);

    const res = await fetch(`${baseUrl}/api/worklogs`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].totalActiveMs).toBe(1.5 * HOUR);
    expect(log.save).not.toHaveBeenCalled();
  });

  it('GET / (list) batches the session query — no N+1 across tasks', async () => {
    const taskA = TASK_ID;
    const taskB = '507f1f77bcf86cd799439013';
    const logA = makeLog({ _id: '5f00000000000000000000ac', taskRef: taskA });
    const logB = makeLog({ _id: '5f00000000000000000000ad', taskRef: taskB });
    const logB2 = makeLog({ _id: '5f00000000000000000000ae', taskRef: taskB });

    findSpy.mockClear().mockReturnValue(findChain([logA, logB, logB2]));
    sessionFindSpy.mockClear().mockResolvedValue([
      { ...S1, taskId: taskA },
      { ...S2, taskId: taskB },
      { ...S1, taskId: taskB },
    ]);

    const res = await fetch(`${baseUrl}/api/worklogs`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);

    // One batched Session.find for all taskIds — not one per worklog.
    expect(sessionFindSpy).toHaveBeenCalledTimes(1);
    expect(sessionFindSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: mockUser._id,
        taskId: expect.objectContaining({ $in: expect.any(Array) }),
      })
    );

    const [a, b, b2] = body;
    expect(a.totalActiveMs).toBe(HOUR);
    expect(b.totalActiveMs).toBe(1.5 * HOUR);
    expect(b2.totalActiveMs).toBe(1.5 * HOUR);
    expect(logA.save).not.toHaveBeenCalled();
    expect(logB.save).not.toHaveBeenCalled();
    expect(logB2.save).not.toHaveBeenCalled();
  });

  it('session-stop writer persists exactly the totals GET computed', async () => {
    const log = makeLog();
    findSpy.mockClear().mockResolvedValue([log]);
    sessionFindSpy.mockClear().mockResolvedValue([S1, S2]);

    const saved = await syncTaskWorkLogs(USER_ID, TASK_ID, { timeZone: 'UTC' });

    expect(saved).toHaveLength(1);
    expect(log.save).toHaveBeenCalledTimes(1);
    expect(log.totalActiveMs).toBe(1.5 * HOUR);
    expect(log.workEntries).toHaveLength(1);
    expect(log.workEntries[0].activeMs).toBe(1.5 * HOUR);
    expect(log.workEntries[0].sessionIds).toEqual([S1_ID, S2_ID]);
  });

  it('groups by the user timezone on the read path (near-midnight split)', async () => {
    mockUser.settings.timezone = 'Asia/Kolkata';
    const log = makeLog();
    findOneSpy.mockClear().mockReturnValue(findOneChain(log));
    sessionFindSpy.mockClear().mockResolvedValue([S3, S4]);

    const res = await fetch(`${baseUrl}/api/worklogs/${LOG_ID}`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalActiveMs).toBe(2.5 * HOUR);
    expect(body.workEntries).toHaveLength(2);
    expect(body.workEntries[0].date).toContain('2026-08-01'); // localDateToUtc('2026-08-02', IST)
    expect(body.workEntries[1].date).toContain('2026-08-02'); // localDateToUtc('2026-08-03', IST)
    expect(log.save).not.toHaveBeenCalled();
  });
});

describe('IES-P1-02 · 0002 migration reconciles historical totalActiveMs', () => {
  function fakeDb({ users, worklogs, sessions }) {
    const updates = [];
    const db = {
      collection: (name) => {
        if (name === 'users') return { find: () => ({ toArray: () => Promise.resolve(users) }) };
        if (name === 'sessions') return { find: () => ({ toArray: () => Promise.resolve(sessions) }) };
        if (name === 'worklogs') {
          return {
            find: () => ({ toArray: () => Promise.resolve(worklogs) }),
            updateOne: async (filter, update) => {
              updates.push({ filter, update });
              return {};
            },
          };
        }
        throw new Error(`unexpected collection ${name}`);
      },
    };
    return { db, updates };
  }

  it('recomputes entries from the task sessions, preserving what, in the user timezone', async () => {
    const uid = new mongoose.Types.ObjectId();
    const tid = new mongoose.Types.ObjectId();
    const lid = new mongoose.Types.ObjectId();
    const sessions = [
      { ...S3, _id: new mongoose.Types.ObjectId(), userId: uid, taskId: tid },
      { ...S4, _id: new mongoose.Types.ObjectId(), userId: uid, taskId: tid },
    ];
    const worklog = {
      _id: lid,
      userId: uid,
      taskRef: tid,
      workEntries: [
        {
          _id: new mongoose.Types.ObjectId(),
          date: localDateToUtc('2026-08-03', 'Asia/Kolkata'),
          what: 'kept',
          activeMs: 999_999,
        },
      ],
      totalActiveMs: 999_999,
    };
    const { db, updates } = fakeDb({
      users: [{ _id: uid, settings: { timezone: 'Asia/Kolkata' } }],
      worklogs: [worklog],
      sessions,
    });

    const migration = require(path.join(MIGRATIONS_DIR, '0002_reconcile_worklog_totals.js'));
    await migration.up({ db });

    expect(updates).toHaveLength(1);
    expect(updates[0].filter).toEqual({ _id: lid });
    const set = updates[0].update.$set;
    expect(set.totalActiveMs).toBe(2.5 * HOUR);
    expect(set.workEntries).toHaveLength(2);

    const kept = set.workEntries.find((e) => e.what === 'kept');
    expect(kept).toBeDefined();
    expect(kept.activeMs).toBe(2 * HOUR);
  });

  it('is a no-op when there are no linked worklogs', async () => {
    const { db, updates } = fakeDb({ users: [], worklogs: [], sessions: [] });
    const migration = require(path.join(MIGRATIONS_DIR, '0002_reconcile_worklog_totals.js'));
    await migration.up({ db });
    expect(updates).toHaveLength(0);
  });
});
