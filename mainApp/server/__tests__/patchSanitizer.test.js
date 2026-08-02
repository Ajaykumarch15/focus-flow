// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const tasksRouter = require('../routes/tasks');
const journalsRouter = require('../routes/journals');
const workLogsRouter = require('../routes/workLogs');
const { buildPatch } = require('../utils/patchSanitizer');

const WORKLOG_FIELDS = {
  title: true,
  problem: true,
  gitBranch: true,
  currentWork: true,
  plan: true,
  designNotes: true,
  blockers: true,
  status: true,
  mood: true,
  tags: true,
  problemFlow: { problem: true, investigation: true, rootCause: true, solution: true, lessonsLearned: true },
  reflection: { wentWell: true, slowedDown: true, learned: true, improvement: true, rating: true },
  moodMetrics: { energy: true, focus: true, stress: true, confidence: true, motivation: true },
  tomorrowPlan: { topPriority: true, attentionRequired: true, unfinishedItems: true },
};

const TASK_FIELDS = {
  title: true, description: true, priority: true, status: true,
  category: true, deadline: true, color: true, tags: true,
};

const JOURNAL_FIELDS = { taskId: true, content: true, mood: true, focusRating: true };

const TASK_ID = '507f1f77bcf86cd799439013';
const JOURNAL_ID = '507f1f77bcf86cd799439014';
const WORKLOG_ID = '507f1f77bcf86cd799439015';

describe('buildPatch · IES-P0-06 update field allowlisting', () => {
  it('copies only allowlisted top-level fields', () => {
    const patch = buildPatch({ title: 'Ship it', description: 'fix', status: 'completed', userId: '5f0000000000000000000001' }, TASK_FIELDS);
    expect(patch).toEqual({ title: 'Ship it', description: 'fix', status: 'completed' });
  });

  it('drops unknown fields silently', () => {
    const patch = buildPatch({ title: 'x', totalTime: 999999, __v: 1, workEntries: [] }, TASK_FIELDS);
    expect(patch).toEqual({ title: 'x' });
  });

  it('drops MongoDB operator keys ($set, $inc, ...)', () => {
    const patch = buildPatch({ title: 'x', $set: { userId: '5f0000000000000000000002' }, $inc: { totalTime: 1 } }, TASK_FIELDS);
    expect(patch).toEqual({ title: 'x' });
  });

  it('drops prototype-pollution keys', () => {
    const patch = buildPatch({ title: 'x', '__proto__': { polluted: true }, 'constructor': 'x', 'prototype': 'x' }, TASK_FIELDS);
    expect(patch).toEqual({ title: 'x' });
  });

  it('accepts nested sub-document fields via dotted paths', () => {
    const body = {
      'problemFlow.problem': 'p',
      'problemFlow.investigation': 'i',
      'problemFlow.rootCause': 'r',
      'problemFlow.solution': 's',
      'problemFlow.lessonsLearned': 'l',
      'moodMetrics.energy': 2,
      'moodMetrics.focus': 4,
      'tomorrowPlan.unfinishedItems': ['a'],
      userId: '5f0000000000000000000003',
    };
    const patch = buildPatch(body, WORKLOG_FIELDS);
    expect(patch).toEqual({
      'problemFlow.problem': 'p',
      'problemFlow.investigation': 'i',
      'problemFlow.rootCause': 'r',
      'problemFlow.solution': 's',
      'problemFlow.lessonsLearned': 'l',
      'moodMetrics.energy': 2,
      'moodMetrics.focus': 4,
      'tomorrowPlan.unfinishedItems': ['a'],
    });
  });

  it('rejects whole nested object replacement unless explicitly allowlisted', () => {
    const patch = buildPatch({ problemFlow: { problem: 'p' } }, WORKLOG_FIELDS);
    expect(patch).toEqual({});
  });

  it('rejects non-object and array bodies', () => {
    expect(buildPatch(null, TASK_FIELDS)).toEqual({});
    expect(buildPatch('string', TASK_FIELDS)).toEqual({});
    expect(buildPatch(['a'], TASK_FIELDS)).toEqual({});
    expect(buildPatch(undefined, TASK_FIELDS)).toEqual({});
  });

  it('rejects nested dotted paths that escape the allowlist (arbitrary Mongo path)', () => {
    const patch = buildPatch({ 'workEntries.0.what': 'x', 'blockerList.0.status': 'resolved' }, WORKLOG_FIELDS);
    expect(patch).toEqual({});
  });
});

describe('PATCH routes sanitize request bodies', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p0-06-test-secret-at-least-32-chars-long';
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
    app.use('/api/tasks', tasksRouter);
    app.use('/api/journals', journalsRouter);
    app.use('/api/worklogs', workLogsRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('PATCH /api/tasks/:id only persists allowlisted fields', async () => {
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate').mockClear().mockResolvedValue({
      _id: 'task-1', title: 'Ship it', status: 'todo',
    });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Ship it', userId: '5f00000000000000000000cd', totalTime: 999, $set: { status: 'completed' } }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ title: 'Ship it' });
    expect(update.$set.userId).toBeUndefined();
    expect(update.$set.totalTime).toBeUndefined();
  });

  it('PATCH /api/tasks/:id rejects a body with no updatable fields', async () => {
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate').mockClear();
    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '5f00000000000000000000cd', totalTime: 999 }),
    });
    expect(res.status).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('PATCH /api/worklogs/:id persists dotted nested fields, drops privileged ones', async () => {
    const findOneAndUpdate = vi.spyOn(WorkLog, 'findOneAndUpdate').mockClear().mockImplementation(() => ({
      populate: () => ({
        populate: () => Promise.resolve({ _id: 'log-1', title: 'T' }),
      }),
    }));

    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'problemFlow.problem': 'prod bug',
        'moodMetrics.energy': 5,
        currentWork: 'debugging',
        userId: '5f00000000000000000000cd',
        'googleDocId': 'leak',
        'taskRef': '5f00000000000000000000ef',
      }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ 'problemFlow.problem': 'prod bug', 'moodMetrics.energy': 5, currentWork: 'debugging' });
  });

  it('PATCH /api/worklogs/:id rejects a body with no updatable fields', async () => {
    const findOneAndUpdate = vi.spyOn(WorkLog, 'findOneAndUpdate').mockClear();
    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '5f00000000000000000000cd', workEntries: [] }),
    });
    expect(res.status).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('PATCH /api/journals/:id only persists allowlisted fields', async () => {
    const findOneAndUpdate = vi.spyOn(Journal, 'findOneAndUpdate').mockClear().mockResolvedValue({
      _id: 'journal-1', content: 'note', mood: 4,
    });

    const res = await fetch(`${baseUrl}/api/journals/${JOURNAL_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'note', mood: 4, userId: '5f00000000000000000000cd' }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ content: 'note', mood: 4 });
  });

  it('PATCH /api/journals/:id rejects a body with no updatable fields', async () => {
    const findOneAndUpdate = vi.spyOn(Journal, 'findOneAndUpdate').mockClear();
    const res = await fetch(`${baseUrl}/api/journals/${JOURNAL_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '5f00000000000000000000cd' }),
    });
    expect(res.status).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
