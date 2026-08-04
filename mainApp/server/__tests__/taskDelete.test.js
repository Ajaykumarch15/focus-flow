// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const Session = require('../models/Session');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const tasksRouter = require('../routes/tasks');

const USER_ID = '5f00000000000000000000ab';
const TASK_ID = '507f1f77bcf86cd799439012';
const SESSION_ID = '507f1f77bcf86cd799439011';

describe('IES-P1-09 · task-delete cascade integrity', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p1-09-test-secret-at-least-32-chars-long';
    mockUser = {
      _id: USER_ID,
      name: 'Delete Test',
      email: 'delete@example.com',
      settings: { timezone: 'UTC', dailyGoal: 8 },
      streak: { current: 2, best: 3, lastDate: null },
      totalPoints: 10,
    };

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    const app = express();
    app.use(express.json());
    app.use('/api/tasks', tasksRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('strips orphaned sessionIds and recomputes totals on linked worklogs', async () => {
    const linkedLog = {
      _id: '507f1f77bcf86cd799439021',
      taskRef: TASK_ID,
      workEntries: [
        {
          _id: 'entry-1',
          date: new Date(),
          what: 'shipped the thing',
          startedAt: 1,
          endedAt: 2,
          activeMs: 60_000,
          sessionIds: [SESSION_ID],
        },
      ],
      totalActiveMs: 60_000,
      save: vi.fn().mockImplementation(async function () { return this; }),
    };

    vi.spyOn(Task, 'findOneAndDelete').mockClear().mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'deleteMany').mockClear().mockResolvedValue({ deletedCount: 1 });
    vi.spyOn(Journal, 'deleteMany').mockClear().mockResolvedValue({ deletedCount: 0 });
    vi.spyOn(WorkLog, 'find').mockClear().mockResolvedValue([linkedLog]);
    // Sessions are gone → recompute yields no entries, no orphaned ids, no stale total.
    vi.spyOn(Session, 'find').mockClear().mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    expect(linkedLog.taskRef).toBeUndefined();
    expect(linkedLog.workEntries).toEqual([]);
    expect(linkedLog.totalActiveMs).toBe(0);
    expect(linkedLog.save).toHaveBeenCalled();
  });

  it('removes the task sessions and journals as part of the cascade', async () => {
    vi.spyOn(Task, 'findOneAndDelete').mockClear().mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'deleteMany').mockClear().mockResolvedValue({ deletedCount: 3 });
    vi.spyOn(Journal, 'deleteMany').mockClear().mockResolvedValue({ deletedCount: 2 });
    vi.spyOn(WorkLog, 'find').mockClear().mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    expect(Session.deleteMany).toHaveBeenCalledWith({ taskId: TASK_ID, userId: mockUser._id });
    expect(Journal.deleteMany).toHaveBeenCalledWith({ taskId: TASK_ID, userId: mockUser._id });
  });

  it('returns 404 when the task does not exist', async () => {
    vi.spyOn(Task, 'findOneAndDelete').mockClear().mockResolvedValue(null);
    vi.spyOn(Session, 'deleteMany').mockClear();
    vi.spyOn(Journal, 'deleteMany').mockClear();
    vi.spyOn(WorkLog, 'find').mockClear();

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(404);
    expect(Session.deleteMany).not.toHaveBeenCalled();
    expect(Journal.deleteMany).not.toHaveBeenCalled();
    expect(WorkLog.find).not.toHaveBeenCalled();
  });
});
