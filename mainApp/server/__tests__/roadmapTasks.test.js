// @vitest-environment node
// B6 (Basic Roadmap V1): Task <-> Milestone linking -
// availability listing, link, MOVE between milestones, and unlink.
// Guarantees: reuse of the plain Task model (only *_Ref fields ever change),
// full ownership chain validation, and tasks never destroyed by roadmap ops.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Roadmap = require('../models/Roadmap');
const RoadmapPhase = require('../models/RoadmapPhase');
const RoadmapMilestone = require('../models/RoadmapMilestone');
const Task = require('../models/Task');
const roadmapsRouter = require('../routes/personalRoadmaps');

const USER_A = '5f00000000000000000000a1';
const USER_B = '5f00000000000000000000b2';
const ROADMAP_ID = '507f1f77bcf86cd7994390a1';
const PHASE_ID = '507f1f77bcf86cd7994390b1';
const MILESTONE_ID = '507f1f77bcf86cd7994390c1';
const TASK_ID = '507f1f77bcf86cd7994390d1';

function makeUser(_id) {
  return {
    _id,
    name: 'B6 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B6 - task linking', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function authHeaders() {
    return { authorization: `Bearer ${signToken()}`, 'content-type': 'application/json' };
  }

  function spy(model, method, impl) {
    const s = vi.spyOn(model, method);
    s.mockReset();
    s.mockImplementation(impl);
    return s;
  }

  // A fully-loaded real-world task: timer, sessions, subtasks, tags...
  // Link operations must never touch any of these.
  const fullTask = {
    _id: TASK_ID,
    userId: USER_A,
    title: 'Read DDIA ch.3',
    status: 'in-progress',
    priority: 'high',
    totalTime: 5400000,
    sessions: [{ startedAt: '2026-08-01T10:00:00Z', ms: 1800000 }],
    subtasks: [{ title: 'LSM trees', done: true }],
    tags: ['reading'],
    deadline: '2026-09-30',
    roadmapRef: null,
    phaseRef: null,
    milestoneRef: null,
  };

  const ownedChain = () => ({
    taskId: TASK_ID,
    roadmapId: ROADMAP_ID,
    phaseId: PHASE_ID,
    milestoneId: MILESTONE_ID,
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b6-test-secret-at-least-32-chars-long!!';
    mockUser = makeUser(USER_A);

    spy(User, 'findById', (id) => ({
      select: () => Promise.resolve(String(id) === String(mockUser._id) ? mockUser : null),
    }));
    spy(Activity, 'create', () => Promise.resolve());

    const app = express();
    app.use(express.json());
    app.use('/api/roadmaps', roadmapsRouter);
    app.use((err, _req, res, _next) => {
      res.status(err.status || err.statusCode || 500).json({ message: err.message });
    });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/roadmaps`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  const get = (url, headers = authHeaders()) => fetch(`${baseUrl}${url}`, { headers });
  const post = (url, body, headers = authHeaders()) =>
    fetch(`${baseUrl}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const del = (url, headers = authHeaders()) => fetch(`${baseUrl}${url}`, { method: 'DELETE', headers });

  // -- AVAILABLE TASKS ------------------------------------------------------

  it('offers only the user\'s unlinked, non-completed tasks for linking', async () => {
    const findSpy = spy(Task, 'find', () => ({
      select: () => ({ sort: () => ({ limit: () => Promise.resolve([fullTask]) }) }),
    }));

    const res = await get('/available-tasks');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([fullTask]);

    const [filter] = findSpy.mock.calls[0];
    expect(filter).toEqual({
      userId: USER_A,
      milestoneRef: null,
      status: { $ne: 'completed' },
    });
  });

  // -- LINK -----------------------------------------------------------------

  it('links an existing task by setting ONLY the three refs', async () => {
    spy(Task, 'findOne', () => Promise.resolve({ ...fullTask }));
    spy(Roadmap, 'findOne', () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_ID, userId: USER_A, roadmapId: ROADMAP_ID }));
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve({ _id: MILESTONE_ID, userId: USER_A, phaseId: PHASE_ID, roadmapId: ROADMAP_ID }));
    const updateSpy = spy(Task, 'findByIdAndUpdate', (_id, update) =>
      Promise.resolve({ ...fullTask, ...update.$set }));

    const res = await post('/link-task', ownedChain());

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledOnce();
    const [, update, opts] = updateSpy.mock.calls[0];
    // The $set payload is refs-only: timer, sessions, subtasks, tags, etc. untouched.
    expect(update).toEqual({
      $set: { roadmapRef: ROADMAP_ID, phaseRef: PHASE_ID, milestoneRef: MILESTONE_ID },
    });
    expect(opts).toEqual({ new: true, runValidators: true });
    const body = await res.json();
    expect(body.totalTime).toBe(5400000); // preserved
    expect(body.sessions).toHaveLength(1); // preserved
  });

  it('moves an already-linked task to another milestone atomically', async () => {
    const OTHER_ROADMAP = '507f1f77bcf86cd7994390a2';
    const OTHER_PHASE = '507f1f77bcf86cd7994390b4';
    const OTHER_MILESTONE = '507f1f77bcf86cd7994390c5';

    spy(Task, 'findOne', () => Promise.resolve({
      ...fullTask,
      roadmapRef: ROADMAP_ID,
      phaseRef: PHASE_ID,
      milestoneRef: MILESTONE_ID,
    }));
    spy(Roadmap, 'findOne', () => Promise.resolve({ _id: OTHER_ROADMAP, userId: USER_A }));
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: OTHER_PHASE, userId: USER_A, roadmapId: OTHER_ROADMAP }));
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve({ _id: OTHER_MILESTONE, userId: USER_A, phaseId: OTHER_PHASE, roadmapId: OTHER_ROADMAP }));
    const updateSpy = spy(Task, 'findByIdAndUpdate', (_id, update) =>
      Promise.resolve({ ...fullTask, ...update.$set }));

    const res = await post('/link-task', {
      taskId: TASK_ID,
      roadmapId: OTHER_ROADMAP,
      phaseId: OTHER_PHASE,
      milestoneId: OTHER_MILESTONE,
    });

    expect(res.status).toBe(200);
    // A single atomic update swaps the whole chain - no unlink/link window.
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][1].$set).toEqual({
      roadmapRef: OTHER_ROADMAP,
      phaseRef: OTHER_PHASE,
      milestoneRef: OTHER_MILESTONE,
    });
  });

  // -- UNLINK ---------------------------------------------------------------

  it('unlinks a task by clearing its three refs without deleting anything', async () => {
    spy(Task, 'findOne', () => Promise.resolve({
      ...fullTask,
      roadmapRef: ROADMAP_ID,
      phaseRef: PHASE_ID,
      milestoneRef: MILESTONE_ID,
    }));
    const updateSpy = spy(Task, 'findByIdAndUpdate', (_id, update) =>
      Promise.resolve({ ...fullTask, ...update.$set }));
    const deleteOneSpy = spy(Task, 'deleteOne', () => Promise.resolve());
    const deleteManySpy = spy(Task, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));

    const res = await del(`/unlink-task/${TASK_ID}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Task unlinked' });
    expect(updateSpy).toHaveBeenCalledWith(
      TASK_ID,
      { $set: { roadmapRef: null, phaseRef: null, milestoneRef: null } },
    );
    expect(deleteOneSpy).not.toHaveBeenCalled();
    expect(deleteManySpy).not.toHaveBeenCalled();
  });

  it("404s unlinking another user's task and modifies nothing", async () => {
    spy(Task, 'findOne', () => Promise.resolve(null));
    const updateSpy = spy(Task, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await del(`/unlink-task/${TASK_ID}`);
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
