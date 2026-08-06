// @vitest-environment node
// EEP2-P5.4.1 · Worklog panel data source — task-scoped persisted worklog rows
// (GET /api/worklogs/by-task/:taskId). Covers the empty-before-first-log state,
// the read-only effective-total computation shared with the writer, the heavy
// array trim, the invalid-taskId gate, and the user scoping of the query.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const workLogsRouter = require('../routes/workLogs');

const HOUR = 3_600_000;
const MINUTE = 60_000;
const SECRET = 'p5-4-1-by-task-test-secret-at-least-32';
const USER_ID = '5f00000000000000000000ab';
const OTHER_ID = '5f00000000000000000000cd';
const LOG_ID = '5f00000000000000000000ac';
const TASK_ID = '507f1f77bcf86cd799439012';
const S1_ID = '507f1f77bcf86cd799439021';
const S2_ID = '507f1f77bcf86cd799439022';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

const S1 = {
  _id: S1_ID, taskId: TASK_ID,
  startTime: Date.UTC(2026, 7, 2, 10, 0),
  endTime: Date.UTC(2026, 7, 2, 11, 0),
  activeTime: HOUR,
  totalPauseDuration: 0,
  pauseLog: [],
  isActive: false,
};
const S2 = {
  _id: S2_ID, taskId: TASK_ID,
  startTime: Date.UTC(2026, 7, 2, 11, 30),
  endTime: Date.UTC(2026, 7, 2, 12, 0),
  activeTime: 30 * MINUTE,
  totalPauseDuration: 0,
  pauseLog: [],
  isActive: false,
};

let server;
let baseUrl;

function mockUser() {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({
      _id: USER_ID, name: 'By Task', email: 'bt@focusflow.io', role: 'user', avatar: '',
      tokenVersion: 0, deletedAt: null, settings: { timezone: 'UTC' },
    }),
  }));
}

function findChain(logs) {
  return {
    populate: () => ({ populate: () => Promise.resolve(logs) }),
  };
}

// toObject reflects live doc state — syncWorkLogsBulk recomputes workEntries /
// totalActiveMs in place, so the serialized response must carry the mutation.
function makeLog(overrides = {}) {
  const doc = {
    _id: LOG_ID,
    userId: USER_ID,
    taskRef: TASK_ID,
    title: 'Board task worklog',
    workEntries: [],
    totalActiveMs: 0,
    timelineEntries: [{ timestamp: Date.now(), type: 'note', title: 'init' }],
    progressSnapshots: [{ period: 'Morning', text: 'x' }],
    attachments: [{ name: 'a', url: 'https://x' }],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  doc.toObject = () => {
    const { save: _save, toObject: _toObject, ...rest } = doc;
    return rest;
  };
  return doc;
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use('/api/worklogs', workLogsRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('EEP2-P5.4.1 · GET /api/worklogs/by-task/:taskId', () => {
  it('returns [] before the task has any persisted worklog rows', async () => {
    mockUser();
    const findSpy = vi.spyOn(WorkLog, 'find').mockReturnValue(findChain([]));

    const res = await fetch(`${baseUrl}/api/worklogs/by-task/${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(findSpy).toHaveBeenCalledWith({ userId: USER_ID, taskRef: TASK_ID });
  });

  it('returns the caller\'s linked worklog with read-only effective totals', async () => {
    mockUser();
    const log = makeLog();
    vi.spyOn(WorkLog, 'find').mockReturnValue(findChain([log]));
    const sessionFind = vi.spyOn(Session, 'find').mockResolvedValue([S1, S2]);

    const res = await fetch(`${baseUrl}/api/worklogs/by-task/${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    // IES-P1-02: GET computes the same totals the session-stop writer persists.
    expect(body[0].totalActiveMs).toBe(1.5 * HOUR);
    expect(body[0].workEntries).toHaveLength(1);
    expect(body[0].workEntries[0].activeMs).toBe(1.5 * HOUR);
    expect(body[0].workEntries[0].sessionIds).toEqual([S1_ID, S2_ID]);
    // Read-only: the GET never writes, even though the entries were computed.
    expect(log.save).not.toHaveBeenCalled();
    // IES-P1-03: one batched session query — taskId arrives as an $in keyed set.
    expect(sessionFind).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      taskId: expect.objectContaining({ $in: [TASK_ID] }),
    }));
  });

  it('strips the heavy arrays from the panel payload (lean response)', async () => {
    mockUser();
    vi.spyOn(WorkLog, 'find').mockReturnValue(findChain([makeLog()]));
    vi.spyOn(Session, 'find').mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/worklogs/by-task/${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].timelineEntries).toBeUndefined();
    expect(body[0].progressSnapshots).toBeUndefined();
    expect(body[0].attachments).toBeUndefined();
    expect(body[0].workEntries).toBeDefined();
  });

  it('only returns the caller\'s own worklogs (user-scoped query)', async () => {
    mockUser();
    const findSpy = vi.spyOn(WorkLog, 'find').mockReturnValue(findChain([makeLog()]));
    vi.spyOn(Session, 'find').mockResolvedValue([]);

    await fetch(`${baseUrl}/api/worklogs/by-task/${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, taskRef: TASK_ID })
    );
  });

  it('rejects a malformed taskId with 400', async () => {
    mockUser();

    const res = await fetch(`${baseUrl}/api/worklogs/by-task/not-an-objectid`, {
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(400);
  });

  it('scopes every read to the caller — another user gets an empty result, never foreign rows', async () => {
    // A different signed-in user queries the same task: the query is pinned to
    // THEIR userId, so they can never see the owner's worklog rows.
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve({
        _id: OTHER_ID, name: 'Other', email: 'o@focusflow.io', role: 'user', avatar: '',
        tokenVersion: 0, deletedAt: null, settings: { timezone: 'UTC' },
      }),
    }));
    const findSpy = vi.spyOn(WorkLog, 'find').mockReturnValue(findChain([]));

    const res = await fetch(`${baseUrl}/api/worklogs/by-task/${TASK_ID}`, {
      headers: { Cookie: cookie(OTHER_ID) },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(findSpy).toHaveBeenCalledWith({ userId: OTHER_ID, taskRef: TASK_ID });
  });
});
