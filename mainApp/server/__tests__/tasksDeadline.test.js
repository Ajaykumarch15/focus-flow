// @vitest-environment node
// IES-P1-06: task deadlines are calendar dates in the user's timezone. The
// route re-encodes whatever the client sends as the tz-midnight instant, so
// `dayKey(deadline, tz)` always round-trips to the picked date — no drift for
// negative-offset timezones and no double-encoding via UTC midnight.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const tasksRouter = require('../routes/tasks');
const { localDateToUtc } = require('../utils/dates');

const TASK_ID = '507f1f77bcf86cd799439012';
const TIMEZONE = 'Asia/Kolkata';

describe('POST/PATCH /api/tasks · IES-P1-06 deadline encoding', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function taskBody(extra = {}) {
    return {
      title: 'Ship feature',
      description: '',
      priority: 'medium',
      status: 'todo',
      category: 'Work',
      color: '#0ea5e9',
      tags: [],
      subtasks: [],
      ...extra,
    };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p1-06-deadline-test-secret-at-least-32-chars';
    mockUser = {
      _id: '5f00000000000000000000ab',
      name: 'Deadline Test',
      email: 'dl@example.com',
      settings: { timezone: TIMEZONE },
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

  it('stores a raw YYYY-MM-DD deadline as the user-timezone midnight', async () => {
    const create = vi.spyOn(Task, 'create').mockClear().mockResolvedValue({ _id: TASK_ID, deadline: new Date() });

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(taskBody({ deadline: '2026-07-10' })),
    });

    expect(res.status).toBe(201);
    const expected = localDateToUtc('2026-07-10', TIMEZONE);
    expect(create.mock.calls[0][0].deadline.getTime()).toBe(expected.getTime());
  });

  it('decodes an ISO/epoch deadline through the user timezone before encoding', async () => {
    const create = vi.spyOn(Task, 'create').mockClear().mockResolvedValue({ _id: TASK_ID, deadline: new Date() });

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(taskBody({ deadline: '2026-07-10T00:00:00.000Z' })),
    });

    expect(res.status).toBe(201);
    const expected = localDateToUtc('2026-07-10', TIMEZONE);
    expect(create.mock.calls[0][0].deadline.getTime()).toBe(expected.getTime());
  });

  it('PATCH with deadline: null clears the deadline', async () => {
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate').mockClear()
      .mockResolvedValue({ _id: TASK_ID, deadline: null });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline: null }),
    });

    expect(res.status).toBe(200);
    const set = findOneAndUpdate.mock.calls[0][1].$set;
    expect(set.deadline).toBeNull();
  });
});
