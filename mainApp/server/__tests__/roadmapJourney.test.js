// @vitest-environment node
// B12 - Basic Roadmap V1 end-to-end user journey through the REAL routes:
// create roadmap -> add phase -> add milestone -> link/create task ->
// work (tracked time) -> complete task -> milestone/phase auto-cascade ->
// progress updates -> health inputs -> analytics -> roadmap delete leaves
// the task (and its focus data) untouched.
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

const USER_A = '5f00000000000000000000a1';
const ROADMAP_ID = '507f1f77bcf86cd7994390a1';
const PHASE_ID = '507f1f77bcf86cd7994390b1';
const MILESTONE_ID = '507f1f77bcf86cd7994390c1';
const TASK_ID = '507f1f77bcf86cd7994390d1';
const FOCUS_MS = 7200000; // 2h accumulated by the focus timer BEFORE completion

function makeUser(_id) {
  return {
    _id,
    name: 'B12 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B12 · end-to-end roadmap journey', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }
  const authHeaders = () => ({ authorization: `Bearer ${signToken()}`, 'content-type': 'application/json' });

  function spy(model, method, impl) {
    const s = vi.spyOn(model, method);
    s.mockReset();
    s.mockImplementation(impl);
    return s;
  }

  // Mutable world shared across a single journey run.
  let roadmapDoc;
  let phaseDoc;
  let milestoneDoc;
  let taskState; // current task fields (mutates on PATCH)

  function freshWorld() {
    roadmapDoc = {
      _id: ROADMAP_ID, userId: USER_A, title: 'Learn Systems Design',
      description: '', type: 'learning', status: 'active', icon: 'Map',
      color: '#0ea5e9', startDate: null, targetDate: null,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      toObject() { const { toObject, ...rest } = this; return { ...rest }; },
    };
    phaseDoc = {
      _id: PHASE_ID, userId: USER_A, roadmapId: ROADMAP_ID,
      title: 'Foundations', description: '', status: 'upcoming', order: 0,
      startDate: null, targetDate: null,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      toObject() { const { toObject, ...rest } = this; return { ...rest }; },
      save: async () => phaseDoc,
    };
    milestoneDoc = {
      _id: MILESTONE_ID, userId: USER_A, roadmapId: ROADMAP_ID, phaseId: PHASE_ID,
      title: 'Understand Big-O', description: '', status: 'todo', order: 0,
      targetDate: null,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      toObject() { const { toObject, ...rest } = this; return { ...rest }; },
      save: async () => milestoneDoc,
    };
    taskState = {
      _id: TASK_ID, userId: USER_A, title: 'Read CLRS ch. 3',
      description: '', priority: 'high', status: 'todo', category: 'Work',
      tags: [], subtasks: [], roadmapRef: ROADMAP_ID, phaseRef: PHASE_ID,
      milestoneRef: MILESTONE_ID, totalTime: FOCUS_MS, sessions: [{ startedAt: '2026-08-23T10:00:00.000Z' }],
      workspaceRef: null, createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-23T12:00:00.000Z',
      toObject() { const { toObject, ...rest } = this; return { ...rest }; },
    };
  }

  // ── Per-step finder wiring (re-spied between steps; each request completes
  // before the next begins so resetting mid-journey is safe). ──

  /** GET /api/roadmaps/:id — RP/RM chains .sort(), Task awaited bare. */
  function wireDetailFinders() {
    spy(Roadmap, 'findOne', (filter) =>
      Promise.resolve(String(filter._id) === ROADMAP_ID && String(filter.userId) === USER_A ? roadmapDoc : null));
    spy(RoadmapPhase, 'find', () => ({ sort: () => Promise.resolve([phaseDoc]) }));
    spy(RoadmapMilestone, 'find', () => ({ sort: () => Promise.resolve([milestoneDoc]) }));
    spy(Task, 'find', (filter) => {
      if ('milestoneRef' in filter) return Promise.resolve([{ ...taskState }]);
      return Promise.resolve([{ ...taskState }]);
    });
  }

  /** Cascade context for completing the linked task. */
  function wireCascade(saves) {
    milestoneDoc.save = async () => { saves.milestone = milestoneDoc.status; return milestoneDoc; };
    phaseDoc.save = async () => { saves.phase = phaseDoc.status; return phaseDoc; };
    spy(RoadmapMilestone, 'findById', () => Promise.resolve(milestoneDoc));
    spy(Task, 'find', (filter) => {
      if ('milestoneRef' in filter) return Promise.resolve([{ ...taskState }]);
      return Promise.resolve([]);
    });
    spy(RoadmapPhase, 'findById', () => Promise.resolve(phaseDoc));
    spy(RoadmapMilestone, 'find', () => Promise.resolve([milestoneDoc]));
    spy(RoadmapPhase, 'find', () => ({ sort: () => Promise.resolve([phaseDoc]) }));
  }

  /** GET /api/roadmaps/analytics — FIFO aggregate buckets for one roadmap. */
  function wireAnalytics() {
    spy(Roadmap, 'find', () => ({ sort: () => Promise.resolve([roadmapDoc]) }));
    spy(RoadmapPhase, 'find', () => Promise.resolve([phaseDoc]));
    const chain = (docs) => ({ sort: () => ({ limit: () => ({ select: () => Promise.resolve(docs) }) }) });
    spy(Task, 'find', () => chain([{ ...taskState }]));
    spy(RoadmapMilestone, 'find', () => chain([milestoneDoc]));
    spy(RoadmapPhase, 'aggregate', () => Promise.resolve([]));
    const rmQueue = [
      [{ _id: ROADMAP_ID, total: 1, completed: 1 }],
      [{ _id: PHASE_ID, total: 1, completed: 1 }],
      [{ _id: null, count: 1 }],
      [{ _id: null, count: 1 }],
    ];
    spy(RoadmapMilestone, 'aggregate', () => Promise.resolve(rmQueue.shift() ?? []));
    const tQueue = [
      [{ _id: ROADMAP_ID, total: 1, completed: 1, focusedTimeMs: FOCUS_MS }],
      [{ _id: '2026-08-24', count: 1 }],
      [{ _id: null, count: 1, roadmapIds: [ROADMAP_ID] }],
    ];
    spy(Task, 'aggregate', () => Promise.resolve(tQueue.shift() ?? []));
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b12-test-secret-at-least-32-chars-long!!';
    mockUser = makeUser(USER_A);

    spy(User, 'findById', (id) => ({
      select: () => Promise.resolve(String(id) === String(mockUser._id) ? mockUser : null),
    }));
    spy(Activity, 'create', () => Promise.resolve());

    const app = express();
    app.use(express.json());
    app.use('/api/roadmaps', require('../routes/personalRoadmaps'));
    app.use('/api/tasks', require('../routes/tasks'));
    app.use((err, _req, res, _next) => {
      res.status(err.status || err.statusCode || 500).json({ message: err.message });
    });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  const req = (method, url, body) =>
    fetch(`${baseUrl}${url}`, {
      method,
      headers: authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it('walks the full journey: create → phase → milestone → task → work → complete → cascades → analytics', async () => {
    freshWorld();

    // ── 1. Create Roadmap ──────────────────────────────────────────────────
    spy(Roadmap, 'create', (payload) => Promise.resolve({ ...roadmapDoc, ...payload, toObject: roadmapDoc.toObject }));
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    let res = await req('POST', '/api/roadmaps', { title: 'Learn Systems Design', type: 'learning' });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created._id).toBe(ROADMAP_ID);

    // ── 2. Add Phase ───────────────────────────────────────────────────────
    // Scoped finders serve BOTH call shapes: bare awaits for ownership checks
    // and the .sort().select().lean() chain used by deterministic order append.
    const orderChain = (result) => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve(result) }) }),
    });
    spy(RoadmapPhase, 'findOne', (f) => {
      if ('roadmapId' in f && !('_id' in f)) return orderChain(null); // order lookup
      return Promise.resolve(phaseDoc); // ownership check
    });
    spy(RoadmapMilestone, 'findOne', (f) => {
      if ('phaseId' in f && !('_id' in f)) return orderChain(null); // order lookup
      return Promise.resolve(milestoneDoc); // ownership check
    });

    spy(Roadmap, 'findOne', (filter) =>
      Promise.resolve(String(filter._id) === ROADMAP_ID && String(filter.userId) === USER_A ? roadmapDoc : null));
    spy(RoadmapPhase, 'create', (payload) => Promise.resolve({ ...phaseDoc, ...payload }));
    res = await req('POST', `/api/roadmaps/${ROADMAP_ID}/phases`, { title: 'Foundations' });
    expect(res.status).toBe(201);
    const phase = await res.json();
    expect(phase._id).toBe(PHASE_ID);

    // ── 3. Add Milestone ───────────────────────────────────────────────────
    spy(RoadmapMilestone, 'create', (payload) => Promise.resolve({ ...milestoneDoc, ...payload }));
    res = await req('POST', `/api/roadmaps/phases/${PHASE_ID}/milestones`, { title: 'Understand Big-O' });
    expect(res.status).toBe(201);
    const milestone = await res.json();
    expect(milestone.phaseId).toBe(PHASE_ID);
    expect(milestone.roadmapId).toBe(ROADMAP_ID);

    // ── 4. Create Task linked to the milestone ─────────────────────────────
    // resolveRoadmapLink runs FOR REAL against the scoped findOne mocks.
    spy(Task, 'create', (payload) => Promise.resolve({
      ...taskState, ...payload, _id: TASK_ID, totalTime: FOCUS_MS, sessions: taskState.sessions,
    }));
    res = await req('POST', '/api/tasks', {
      title: 'Read CLRS ch. 3', description: '', priority: 'high', status: 'todo',
      category: 'Work', color: '#0ea5e9', tags: [], subtasks: [],
      roadmapRef: ROADMAP_ID, phaseRef: PHASE_ID, milestoneRef: MILESTONE_ID,
    });
    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.milestoneRef).toBe(MILESTONE_ID);

    // ── 5. Duplicate link is idempotent (double-click safety) ─────────────
    const linkWrites = [];
    spy(Task, 'findOne', (f) =>
      Promise.resolve(String(f._id) === TASK_ID ? { ...taskState } : null));
    spy(Task, 'findByIdAndUpdate', (_id, update) => {
      linkWrites.push(update);
      return Promise.resolve({ ...taskState });
    });
    for (let i = 0; i < 2; i++) {
      res = await req('POST', '/api/roadmaps/link-task', {
        taskId: TASK_ID, roadmapId: ROADMAP_ID, phaseId: PHASE_ID, milestoneId: MILESTONE_ID,
      });
      expect(res.status).toBe(200);
    }
    // Both writes are pure $set of identical refs — no data loss possible.
    expect(linkWrites).toHaveLength(2);
    expect(linkWrites[1].$set).toEqual(linkWrites[0].$set);
    expect(taskState.milestoneRef).toBe(MILESTONE_ID);

    // ── 6. Pre-work snapshot: zero progress, focus time already tracked ────
    wireDetailFinders();
    res = await req('GET', `/api/roadmaps/${ROADMAP_ID}`);
    expect(res.status).toBe(200);
    let detail = await res.json();
    expect(detail.progress).toBe(0);
    expect(detail.progressEmpty).toBe(false); // milestone exists, just nothing done
    expect(detail.totalTime).toBe(FOCUS_MS);  // timer data intact pre-completion
    expect(detail.milestones[0].totalTasks).toBe(1);
    expect(detail.milestones[0].completedTasks).toBe(0);

    // Health inputs for the frontend core: active + 0% + live target would be
    // "Behind"; with NO target date it stays honestly "On Track" (B10 rule).
    expect(detail.status).toBe('active');
    expect(detail.targetDate).toBeNull();

    // ── 7. Complete the task via the Tasks API → cascade fires ────────────
    const saves = {};
    wireCascade(saves);
    spy(Task, 'findOne', () => ({ select: () => Promise.resolve({ ...taskState }) }));
    spy(Task, 'findOneAndUpdate', (_filter, update) => {
      taskState = { ...taskState, ...update.$set, updatedAt: '2026-08-24T10:00:00.000Z' };
      return Promise.resolve({ ...taskState });
    });
    res = await req('PATCH', `/api/tasks/${TASK_ID}`, { status: 'completed' });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('completed');

    // Auto-status cascade: all tasks done → milestone completed → phase completed.
    expect(saves.milestone).toBe('completed');
    expect(saves.phase).toBe('completed');
    // Focus data untouched by completion (Timer/Sessions non-interference).
    expect(taskState.totalTime).toBe(FOCUS_MS);
    expect(taskState.sessions).toHaveLength(1);

    // ── 8. Post-work detail: progress fully propagated ─────────────────────
    wireDetailFinders();
    res = await req('GET', `/api/roadmaps/${ROADMAP_ID}`);
    detail = await res.json();
    expect(detail.milestoneCompleted).toBe(1);
    expect(detail.milestoneTotal).toBe(1);
    expect(detail.progress).toBe(100);
    expect(detail.completedTasks).toBe(1);
    expect(detail.totalTasks).toBe(1);
    expect(detail.phases[0].status).toBe('completed');   // cascade visible in payload
    expect(detail.phases[0].progress).toBe(100);
    expect(detail.milestones[0].status).toBe('completed');
    expect(detail.milestones[0].progress).toBe(100);
    expect(detail.totalTime).toBe(FOCUS_MS);

    // ── 9. Analytics reflect the completed work + tracked time ─────────────
    wireAnalytics();
    res = await req('GET', '/api/roadmaps/analytics?days=30');
    expect(res.status).toBe(200);
    const analytics = await res.json();
    expect(analytics.overview.completedTasks).toBe(1);
    expect(analytics.overview.focusedTimeMs).toBe(FOCUS_MS);
    // Roadmap status is user-controlled and still 'active', so it is counted.
    expect(analytics.overview.activeRoadmaps).toBe(1);
    expect(analytics.activity.activeDays).toBe(1);
    expect(analytics.today.tasksCompleted).toBe(1);
  });

  it('deleting the roadmap unlinks but never deletes tasks or their focus history', async () => {
    freshWorld();
    spy(Roadmap, 'findOne', (filter) =>
      Promise.resolve(String(filter._id) === ROADMAP_ID && String(filter.userId) === USER_A ? roadmapDoc : null));

    const phaseDeleteMany = spy(RoadmapPhase, 'deleteMany', () => Promise.resolve());
    const msDeleteMany = spy(RoadmapMilestone, 'deleteMany', () => Promise.resolve());
    const taskDeleteMany = spy(Task, 'deleteMany', () => Promise.resolve());
    const taskUpdateManyCalls = [];
    spy(Task, 'updateMany', (filter, update) => {
      taskUpdateManyCalls.push({ filter, update });
      return Promise.resolve();
    });
    spy(Roadmap, 'findByIdAndDelete', () => Promise.resolve(roadmapDoc));

    const res = await req('DELETE', `/api/roadmaps/${ROADMAP_ID}`);
    expect(res.status).toBe(200);
    expect(phaseDeleteMany).toHaveBeenCalled();
    expect(msDeleteMany).toHaveBeenCalled();

    // The task itself survives with refs cleared and data intact.
    expect(taskDeleteMany).not.toHaveBeenCalled();
    expect(taskUpdateManyCalls).toHaveLength(1);
    expect(taskUpdateManyCalls[0].update.$set).toEqual({
      roadmapRef: null, phaseRef: null, milestoneRef: null,
    });
    expect(taskUpdateManyCalls[0].filter.userId).toBe(USER_A);
  });

  it('rejects links that belong to another user before any Task is written', async () => {
    freshWorld();
    // The refs exist for SOMEONE ELSE; user-scoped lookups find nothing.
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(null));
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve(null));
    const taskCreateSpy = spy(Task, 'create', () => Promise.resolve({ ...taskState }));

    const res = await req('POST', '/api/tasks', {
      title: 'Sneaky task', description: '', priority: 'medium', status: 'todo',
      category: 'Work', color: '#0ea5e9', tags: [], subtasks: [],
      roadmapRef: ROADMAP_ID, phaseRef: PHASE_ID, milestoneRef: MILESTONE_ID,
    });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('Roadmap not found');
    // Auth boundary held: no Task document was ever created.
    expect(taskCreateSpy).not.toHaveBeenCalled();
  });
});
