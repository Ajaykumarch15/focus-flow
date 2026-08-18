// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const Schedule = require('../models/Schedule');
const Session = require('../models/Session');
const scheduleRouter = require('../routes/schedules');

const USER_ID = '5f00000000000000000000ab';
const TASK_ID = '507f1f77bcf86cd799439012';
const SCHEDULE_ID = '507f1f77bcf86cd799439099';

describe('Schedule API Endpoints', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'schedule-test-secret-at-least-32-chars-long';
    mockUser = {
      _id: USER_ID,
      name: 'Schedule Tester',
      email: 'schedule@example.com',
      settings: { timezone: 'UTC', dailyGoal: 8 },
      streak: { current: 1, best: 2, lastDate: null },
    };

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));

    const app = express();
    app.use(express.json());
    app.use('/api/schedules', scheduleRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  it('GET /api/schedules returns schedules for user', async () => {
    const mockSchedule = {
      _id: SCHEDULE_ID,
      userId: USER_ID,
      taskId: { _id: TASK_ID, title: 'System Design' },
      date: '2026-08-17',
      startTime: '09:00',
      endTime: '10:30',
      status: 'scheduled',
      notes: 'Study chapter 1',
      toObject: () => ({
        _id: SCHEDULE_ID,
        userId: USER_ID,
        taskId: { _id: TASK_ID, title: 'System Design' },
        date: '2026-08-17',
        startTime: '09:00',
        endTime: '10:30',
        status: 'scheduled',
        notes: 'Study chapter 1',
      }),
    };

    vi.spyOn(Schedule, 'find').mockImplementation(() => ({
      populate: () => ({
        sort: () => Promise.resolve([mockSchedule]),
      }),
    }));

    vi.spyOn(Session, 'find').mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/schedules?date=2026-08-17`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].date).toBe('2026-08-17');
    expect(data[0].startTime).toBe('09:00');
  });

  it('POST /api/schedules creates a new schedule entry', async () => {
    const mockTask = { _id: TASK_ID, userId: USER_ID, title: 'System Design' };
    vi.spyOn(Task, 'findOne').mockResolvedValue(mockTask);
    vi.spyOn(Schedule, 'find').mockImplementation(() => ({
      populate: () => Promise.resolve([]),
    }));

    const createdSchedule = {
      _id: SCHEDULE_ID,
      userId: USER_ID,
      taskId: TASK_ID,
      date: '2026-08-17',
      startTime: '09:00',
      endTime: '10:30',
      status: 'scheduled',
    };

    vi.spyOn(Schedule, 'create').mockResolvedValue(createdSchedule);
    vi.spyOn(Schedule, 'findById').mockImplementation(() => ({
      populate: () => Promise.resolve({ ...createdSchedule, taskId: mockTask }),
    }));

    const res = await fetch(`${baseUrl}/api/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signToken()}`,
      },
      body: JSON.stringify({
        taskId: TASK_ID,
        date: '2026-08-17',
        startTime: '09:00',
        endTime: '10:30',
        notes: 'Chapter 1',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.schedule).toBeDefined();
    expect(data.schedule.startTime).toBe('09:00');
  });

  it('DELETE /api/schedules/:id removes schedule entry', async () => {
    vi.spyOn(Schedule, 'findOneAndDelete').mockResolvedValue({ _id: SCHEDULE_ID });

    const res = await fetch(`${baseUrl}/api/schedules/${SCHEDULE_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
