// @vitest-environment node
// IES-P1-10: WorkLog arrays are bounded (no 16 MB ceiling); list responses are
// lean. IES-P1-11: `$push`/update routes enable `runValidators: true` and the
// subdoc schemas reject empty/over-long values — invalid subdocs can't persist.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const WorkLog = require('../models/WorkLog');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const { ARRAY_CAPS, pruneWorkLogArrays } = require('../utils/worklogLimits');
const workLogsRouter = require('../routes/workLogs');
const tasksRouter = require('../routes/tasks');

const USER_ID = '5f00000000000000000000ab';
const LOG_ID = '5f00000000000000000000ac';
const TASK_ID = '507f1f77bcf86cd799439012';

function validate(doc) {
  return doc.validate().then(() => null).catch((err) => err);
}

describe('IES-P1-10 · pruneWorkLogArrays caps every unbounded array', () => {
  it('trims each capped array to its limit, keeping the newest items', () => {
    const doc = {
      timelineEntries: Array.from({ length: 900 }, (_, i) => ({ title: `t${i}` })),
      workEntries: Array.from({ length: 5000 }, (_, i) => ({ date: new Date(), activeMs: i })),
      completedItems: Array.from({ length: 3000 }, (_, i) => ({ text: `c${i}` })),
      decisions: Array.from({ length: 700 }, (_, i) => ({ title: `d${i}` })),
      blockerList: Array.from({ length: 300 }, (_, i) => ({ title: `b${i}` })),
      progressSnapshots: Array.from({ length: 700 }, (_, i) => ({ text: `s${i}` })),
      links: Array.from({ length: 700 }, (_, i) => ({ label: `l${i}`, url: 'https://x' })),
      attachments: Array.from({ length: 300 }, (_, i) => ({ name: `a${i}`, url: 'https://x' })),
      tags: Array.from({ length: 200 }, (_, i) => `tag${i}`),
      gitRef: { commitIds: Array.from({ length: 200 }, (_, i) => `c${i}`) },
      tomorrowPlan: { unfinishedItems: Array.from({ length: 200 }, (_, i) => `u${i}`) },
    };

    const changed = pruneWorkLogArrays(doc);

    expect(doc.timelineEntries).toHaveLength(ARRAY_CAPS.timelineEntries);
    expect(doc.workEntries).toHaveLength(ARRAY_CAPS.workEntries);
    expect(doc.completedItems).toHaveLength(ARRAY_CAPS.completedItems);
    expect(doc.decisions).toHaveLength(ARRAY_CAPS.decisions);
    expect(doc.blockerList).toHaveLength(ARRAY_CAPS.blockerList);
    expect(doc.progressSnapshots).toHaveLength(ARRAY_CAPS.progressSnapshots);
    expect(doc.links).toHaveLength(ARRAY_CAPS.links);
    expect(doc.attachments).toHaveLength(ARRAY_CAPS.attachments);
    expect(doc.tags).toHaveLength(ARRAY_CAPS.tags);
    expect(doc.gitRef.commitIds).toHaveLength(100);
    expect(doc.tomorrowPlan.unfinishedItems).toHaveLength(100);

    // Newest kept: the tail of each trimmed array survives.
    expect(doc.timelineEntries[ARRAY_CAPS.timelineEntries - 1].title).toBe('t899');
    expect(doc.completedItems[ARRAY_CAPS.completedItems - 1].text).toBe('c2999');
    expect(doc.workEntries[ARRAY_CAPS.workEntries - 1].activeMs).toBe(4999);
    expect(changed).toEqual(expect.arrayContaining(['timelineEntries', 'workEntries', 'gitRef.commitIds']));
  });

  it('is a no-op for arrays already within their caps', () => {
    const doc = { timelineEntries: [{ title: 'a' }], tags: ['x'], workEntries: [] };
    const changed = pruneWorkLogArrays(doc);
    expect(changed).toEqual([]);
    expect(doc.timelineEntries).toHaveLength(1);
  });

  it('never exceeds 16 MB: worst-case budget is far under the ceiling', () => {
    let bytes = 0;
    for (const [field, cap] of Object.entries(ARRAY_CAPS)) {
      // ~250 bytes per subdoc is a generous upper bound for the real schemas.
      bytes += cap * 250;
    }
    bytes += 100 * 100; // commitIds + unfinishedItems
    expect(bytes).toBeLessThan(16 * 1024 * 1024);
    expect(bytes).toBeLessThan(4 * 1024 * 1024);
  });
});

describe('IES-P1-11 · WorkLog subdoc validators reject bad subdocuments', () => {
  const userId = new mongoose.Types.ObjectId();

  it('rejects an empty timeline title', async () => {
    const err = await validate(new WorkLog({
      userId,
      title: 'Log',
      timelineEntries: [{ title: '   ' }],
    }));
    expect(err).not.toBeNull();
    expect(err.errors['timelineEntries.0.title']).toBeDefined();
  });

  it('rejects a blank completed item text', async () => {
    const err = await validate(new WorkLog({
      userId,
      title: 'Log',
      completedItems: [{ text: '' }],
    }));
    expect(err.errors['completedItems.0.text']).toBeDefined();
  });

  it('rejects an over-long timeline title (past the 300 cap)', async () => {
    const err = await validate(new WorkLog({
      userId,
      title: 'Log',
      timelineEntries: [{ title: 'x'.repeat(301) }],
    }));
    expect(err.errors['timelineEntries.0.title']).toBeDefined();
  });

  it('accepts a healthy subdocument', async () => {
    const err = await validate(new WorkLog({
      userId,
      title: 'Log',
      timelineEntries: [{ title: 'Started session' }],
      completedItems: [{ text: 'Shipped feature' }],
      links: [{ label: 'PR', url: 'https://github.com/x' }],
    }));
    expect(err).toBeNull();
  });
});

describe('IES-P1-11 · tasks subtask validators', () => {
  it('rejects a blank subtask title at the model', async () => {
    const err = await validate(new Task({
      userId: new mongoose.Types.ObjectId(),
      title: 'Task',
      subtasks: [{ title: '' }],
    }));
    expect(err.errors['subtasks.0.title']).toBeDefined();
  });

  it('accepts a valid subtask', async () => {
    const err = await validate(new Task({
      userId: new mongoose.Types.ObjectId(),
      title: 'Task',
      subtasks: [{ title: 'Wire up API' }],
    }));
    expect(err).toBeNull();
  });
});

describe('IES-P1-10/11 · worklog routes — $slice caps, runValidators, lean list', () => {
  let server;
  let baseUrl;
  let mockUser;
  let findOneAndUpdateSpy;
  let findSpy;
  let sessionFindSpy;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function findOneAndUpdateChain(log) {
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
    process.env.JWT_SECRET = 'p1-10-test-secret-at-least-32-chars-long';
    mockUser = { _id: USER_ID, name: 'Limits Test', email: 'limits@example.com', settings: { timezone: 'UTC' } };

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    findOneAndUpdateSpy = vi.spyOn(WorkLog, 'findOneAndUpdate');
    findSpy = vi.spyOn(WorkLog, 'find');
    sessionFindSpy = vi.spyOn(Session, 'find');

    const app = express();
    app.use(express.json());
    app.use('/api/worklogs', workLogsRouter);
    app.use('/api/tasks', tasksRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('POST timeline pushes with $slice (never over the cap) + runValidators', async () => {
    const log = { _id: LOG_ID, title: 'L' };
    findOneAndUpdateSpy.mockClear().mockReturnValue(findOneAndUpdateChain(log));

    const res = await fetch(`${baseUrl}/api/worklogs/${LOG_ID}/timeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Shipped feature', description: 'details' }),
    });

    expect(res.status).toBe(200);
    expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
      { _id: LOG_ID, userId: mockUser._id },
      {
        $push: {
          timelineEntries: {
            $each: [expect.objectContaining({ title: 'Shipped feature', type: 'note' })],
            $slice: -ARRAY_CAPS.timelineEntries,
          },
        },
      },
      { new: true, runValidators: true }
    );
  });

  it('POST completed pushes $slice on both completedItems and timelineEntries', async () => {
    const log = { _id: LOG_ID, title: 'L' };
    findOneAndUpdateSpy.mockClear().mockReturnValue(findOneAndUpdateChain(log));

    const res = await fetch(`${baseUrl}/api/worklogs/${LOG_ID}/completed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Done thing', category: 'feature' }),
    });

    expect(res.status).toBe(200);
    const [, update, options] = findOneAndUpdateSpy.mock.calls[0];
    expect(update.$push.completedItems.$slice).toBe(-ARRAY_CAPS.completedItems);
    expect(update.$push.timelineEntries.$slice).toBe(-ARRAY_CAPS.timelineEntries);
    expect(options).toEqual({ new: true, runValidators: true });
  });

  it('rejects an empty timeline title at the route (zod min 1)', async () => {
    findOneAndUpdateSpy.mockClear();

    const res = await fetch(`${baseUrl}/api/worklogs/${LOG_ID}/timeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });

    expect(res.status).toBe(400);
    expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
  });

  it('rejects an empty subtask title at the task route', async () => {
    const taskUpdateSpy = vi.spyOn(Task, 'findOneAndUpdate').mockReturnValue(findOneAndUpdateChain({ _id: TASK_ID }));

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/subtasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });

    expect(res.status).toBe(400);
    expect(taskUpdateSpy).not.toHaveBeenCalled();
  });

  it('GET / list strips the heavy arrays but keeps the ones the list view renders', async () => {
    const log = {
      _id: LOG_ID,
      userId: mockUser._id,
      title: 'L',
      timelineEntries: [{ title: 'old' }],
      progressSnapshots: [{ text: 'x' }],
      attachments: [{ name: 'a', url: 'https://x' }],
      workEntries: [{ date: new Date(), activeMs: 1000 }],
      completedItems: [{ text: 'done' }],
      decisions: [{ title: 'd' }],
      blockerList: [{ title: 'b' }],
      links: [{ label: 'l', url: 'https://x' }],
      totalActiveMs: 1000,
    };
    findSpy.mockClear().mockReturnValue(findChain([log]));
    sessionFindSpy.mockClear().mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/worklogs`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].timelineEntries).toBeUndefined();
    expect(body[0].progressSnapshots).toBeUndefined();
    expect(body[0].attachments).toBeUndefined();
    expect(body[0].workEntries).toHaveLength(1);
    expect(body[0].completedItems).toHaveLength(1);
    expect(body[0].decisions).toHaveLength(1);
    expect(body[0].links).toHaveLength(1);
  });

  it('GET /:id still returns the full document (detail view keeps arrays)', async () => {
    const log = {
      _id: LOG_ID,
      userId: mockUser._id,
      title: 'L',
      timelineEntries: [{ title: 'old' }],
      workEntries: [],
      totalActiveMs: 0,
    };
    const findOneSpy = vi.spyOn(WorkLog, 'findOne').mockReturnValue(findOneAndUpdateChain(log));
    sessionFindSpy.mockClear().mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/worklogs/${LOG_ID}`, {
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timelineEntries).toHaveLength(1);
    expect(findOneSpy).toHaveBeenCalled();
  });
});
