// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

// IES-P1-27: naming/type drift cleanup — shared time constants, deduped tz
// helpers, the folded `problem` virtual, and epoch-ms close/reopen stamps.
const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const workLogsRouter = require('../routes/workLogs');
const reportRouter = require('../routes/reports');
const dates = require('../utils/dates');
const sessionTime = require('../utils/sessionTime');

const WORKLOG_ID = '507f1f77bcf86cd799439015';

describe('IES-P1-27 · shared time constants', () => {
  it('defines FUTURE_SKEW_MS / MAX_SESSION_AGE_MS once in dates.js and re-exports via sessionTime', () => {
    expect(dates.FUTURE_SKEW_MS).toBe(5 * 60 * 1000);
    expect(dates.MAX_SESSION_AGE_MS).toBe(24 * 60 * 60 * 1000);
    expect(sessionTime.FUTURE_SKEW_MS).toBe(dates.FUTURE_SKEW_MS);
    expect(sessionTime.MAX_SESSION_AGE_MS).toBe(dates.MAX_SESSION_AGE_MS);
  });

  it('serverTime still honors the shared bounds', () => {
    const now = 1_700_000_000_000;
    expect(sessionTime.serverTime(now + dates.FUTURE_SKEW_MS + 1, { now })).toBe(now);
    expect(sessionTime.serverTime(now - dates.MAX_SESSION_AGE_MS - 1, { now })).toBe(now);
    expect(sessionTime.serverTime(now - dates.MAX_SESSION_AGE_MS, { now })).toBe(now - dates.MAX_SESSION_AGE_MS);
  });
});

describe('IES-P1-27 · reports.js shares tz helpers (no local copies)', () => {
  it('exposes the same helper surface via router.helpers', () => {
    const { userTimezone, dayKey, localDateToUtc, dayRange, isValidDateKey, buildDayReport } = reportRouter.helpers;
    const tz = 'Asia/Kolkata';
    const ts = new Date('2026-07-10T12:00:00.000Z').getTime();

    expect(userTimezone({ settings: { timezone: tz } })).toBe(tz);
    expect(userTimezone({})).toBe('UTC');
    expect(dayKey(ts, tz)).toBe(dates.dayKey(ts, tz));
    expect(localDateToUtc('2026-07-10', tz).getTime()).toBe(dates.localDateToUtc('2026-07-10', tz).getTime());

    const range = dayRange('2026-07-10', tz);
    expect(range.start.getTime()).toBe(dates.localDateToUtc('2026-07-10', tz).getTime());
    expect(range.end.getTime()).toBe(dates.localDateToUtc('2026-07-11', tz).getTime());

    expect(isValidDateKey('2026-07-10')).toBe(true);
    expect(isValidDateKey('nope')).toBe(false);
    expect(typeof buildDayReport).toBe('function');
  });
});

describe('IES-P1-27 · WorkLog model drift cleanup', () => {
  it('no longer declares `problem` as a stored schema path (virtual only)', () => {
    expect(WorkLog.schema.paths.problem).toBeUndefined();
    expect(WorkLog.schema.virtuals.problem).toBeDefined();
  });

  it('`problem` virtual reads and writes problemFlow.problem', () => {
    const log = new WorkLog({ problem: 'legacy write', title: 'T' });
    expect(log.problemFlow.problem).toBe('legacy write');
    expect(log.problem).toBe('legacy write');

    log.problemFlow = { problem: 'canonical', investigation: 'i' };
    expect(log.problem).toBe('canonical');

    log.problem = 'via setter';
    expect(log.problemFlow.problem).toBe('via setter');
  });

  it('serializes the virtual so legacy clients still read log.problem', () => {
    const log = new WorkLog({ problemFlow: { problem: 'the bug' }, title: 'T' });
    const json = log.toJSON();
    expect(json.problem).toBe('the bug');
    expect(json.problemFlow.problem).toBe('the bug');
    expect(Object.prototype.hasOwnProperty.call(json, 'problem')).toBe(true);
  });

  it('declares closedAt/reopenedAt as epoch-ms Number paths', () => {
    expect(WorkLog.schema.paths.closedAt.instance).toBe('Number');
    expect(WorkLog.schema.paths.reopenedAt.instance).toBe('Number');
  });
});

describe('IES-P1-27 · worklog routes fold legacy fields', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function mockFindOneAndUpdate(result) {
    return vi.spyOn(WorkLog, 'findOneAndUpdate').mockClear().mockImplementation(() => ({
      populate: () => ({
        populate: () => Promise.resolve(result),
      }),
    }));
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p1-27-test-secret-at-least-32-chars-long';
    mockUser = {
      _id: '5f00000000000000000000ab',
      googleConnected: false,
      settings: { timezone: 'UTC' },
    };

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

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

  it('POST / folds a legacy top-level `problem` into problemFlow.problem', async () => {
    const created = {
      _id: 'log-1',
      title: 'T',
      problemFlow: { problem: 'x' },
      workEntries: [],
      totalActiveMs: 0,
      populate: async () => created,
    };
    const create = vi.spyOn(WorkLog, 'create').mockClear().mockResolvedValue(created);

    const res = await fetch(`${baseUrl}/api/worklogs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', problem: 'fold me' }),
    });

    expect(res.status).toBe(201);
    const arg = create.mock.calls[0][0];
    expect(arg.problemFlow.problem).toBe('fold me');
    expect(arg.problem).toBe('fold me');
  });

  it('PATCH /:id folds a legacy `problem` into problemFlow.problem', async () => {
    const findOneAndUpdate = mockFindOneAndUpdate({ _id: 'log-1', title: 'T' });

    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem: 'legacy text' }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ 'problemFlow.problem': 'legacy text' });
  });

  it('PATCH /:id lets an explicit problemFlow.problem win over the legacy field', async () => {
    const findOneAndUpdate = mockFindOneAndUpdate({ _id: 'log-1', title: 'T' });

    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem: 'legacy text', 'problemFlow.problem': 'canonical' }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ 'problemFlow.problem': 'canonical' });
  });

  it('PATCH /:id still rejects a body with nothing updatable after folding', async () => {
    const findOneAndUpdate = vi.spyOn(WorkLog, 'findOneAndUpdate').mockClear();
    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '5f00000000000000000000cd' }),
    });
    expect(res.status).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('POST /:id/close writes epoch-ms closedAt (number, not Date)', async () => {
    const findOneAndUpdate = mockFindOneAndUpdate({ _id: 'log-1', title: 'T' });

    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(typeof update.$set.closedAt).toBe('number');
    expect(update.$set.closedAt).toBeGreaterThan(0);
    expect(update.$set.isActive).toBe(false);
    expect(update.$set.status).toBe('done');
  });

  it('POST /:id/continue writes epoch-ms reopenedAt and clears closedAt', async () => {
    const findOneAndUpdate = mockFindOneAndUpdate({ _id: 'log-1', title: 'T' });

    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}/continue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(typeof update.$set.reopenedAt).toBe('number');
    expect(update.$set.reopenedAt).toBeGreaterThan(0);
    expect(update.$set.closedAt).toBeNull();
  });
});
