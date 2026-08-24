// @vitest-environment node
// B3 (Basic Roadmap V1): top-level Roadmap CRUD lifecycle —
// create → list → open → edit → close/archive → delete,
// plus ownership scoping and the "tasks survive delete" guarantee.
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
    name: 'B3 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B3 · roadmap CRUD lifecycle', () => {
  let server;
  let baseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function authHeaders() {
    return { authorization: `Bearer ${signToken()}`, 'content-type': 'application/json' };
  }

  // Re-spy safely across tests: resets leaked call history + stale impls.
  function spy(model, method, impl) {
    const s = vi.spyOn(model, method);
    s.mockReset();
    s.mockImplementation(impl);
    return s;
  }

  const sorted = (docs) => ({ sort: () => Promise.resolve(docs) });

  function roadmapDoc(overrides = {}) {
    const base = {
      _id: ROADMAP_ID,
      userId: USER_A,
      title: 'Learn Systems Design',
      description: '',
      type: 'learning',
      status: 'planning',
      icon: 'Map',
      color: '#0ea5e9',
      startDate: null,
      targetDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
    return { ...base, toObject: () => ({ ...base }) };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b3-test-secret-at-least-32-chars-long!!';
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
  const patch = (url, body, headers = authHeaders()) =>
    fetch(`${baseUrl}${url}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const del = (url, headers = authHeaders()) => fetch(`${baseUrl}${url}`, { method: 'DELETE', headers });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401', async () => {
    const res = await get('/', {});
    expect(res.status).toBe(401);
  });

  // ── CREATE ──────────────────────────────────────────────────────────────────

  it('creates a roadmap scoped to the authenticated user with zeroed enrichment', async () => {
    const createSpy = spy(Roadmap, 'create', (payload) =>
      Promise.resolve(roadmapDoc(payload)));
    spy(Roadmap, 'findOne', () => Promise.resolve(null));

    const res = await post('/', {
      title: 'Learn Systems Design',
      description: 'Deep dive',
      type: 'learning',
      status: 'planning',
      icon: 'BookOpen',
      color: '#6366f1',
      startDate: '2026-09-01',
      targetDate: '2026-12-31',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(createSpy).toHaveBeenCalledOnce();
    expect(createSpy.mock.calls[0][0]).toMatchObject({
      title: 'Learn Systems Design',
      type: 'learning',
      userId: USER_A,
    });
    expect(body.phaseCount).toBe(0);
    expect(body.milestoneTotal).toBe(0);
    expect(body.progress).toBe(0);
  });

  it('400s an invalid create body and never hits the model', async () => {
    const createSpy = spy(Roadmap, 'create', () => Promise.resolve(roadmapDoc()));
    const res = await post('/', { description: 'no title' });
    expect(res.status).toBe(400);
    expect(createSpy).not.toHaveBeenCalled();
  });

  // ── LIST ────────────────────────────────────────────────────────────────────

  it('lists roadmaps with enrichment math (progress, milestone/task counts)', async () => {
    spy(Roadmap, 'find', () => sorted([roadmapDoc()]));
    spy(RoadmapPhase, 'aggregate', () => Promise.resolve([{ _id: ROADMAP_ID, count: 3 }]));
    spy(RoadmapMilestone, 'aggregate', () =>
      Promise.resolve([{ _id: ROADMAP_ID, total: 4, completed: 1 }]));
    const taskAggSpy = spy(Task, 'aggregate', () =>
      Promise.resolve([{ _id: ROADMAP_ID, totalTasks: 5, completedTasks: 2, totalTime: 3600000 }]));

    const res = await get('/');
    expect(res.status).toBe(200);
    const [item] = await res.json();
    expect(item._id).toBe(ROADMAP_ID);
    expect(item.phaseCount).toBe(3);
    expect(item.milestoneTotal).toBe(4);
    expect(item.milestoneCompleted).toBe(1);
    expect(item.totalTasks).toBe(5);
    expect(item.completedTasks).toBe(2);
    expect(item.totalTime).toBe(3600000);
    expect(item.progress).toBe(25); // round(1/4 * 100)
    // Task aggregation stays user-scoped even though roadmap ids come from our docs.
    const matchStage = taskAggSpy.mock.calls[0][0][0].$match;
    expect(String(matchStage.userId)).toBe(USER_A);
  });

  // ── OPEN ────────────────────────────────────────────────────────────────────

  it('opens a roadmap as an assembled detail document', async () => {
    spy(Roadmap, 'findOne', (filter) =>
      Promise.resolve(
        String(filter.userId) === USER_A && String(filter._id) === ROADMAP_ID ? roadmapDoc() : null));
    spy(RoadmapPhase, 'find', () => sorted([
      { _id: PHASE_ID, roadmapId: ROADMAP_ID, userId: USER_A, title: 'Foundations', order: 2, status: 'upcoming', toObject() { return { ...this }; } },
    ]));
    spy(RoadmapMilestone, 'find', () => sorted([
      { _id: MILESTONE_ID, phaseId: PHASE_ID, status: 'completed', toObject() { return { ...this }; } },
    ]));
    spy(Task, 'find', () => Promise.resolve([
      { _id: TASK_ID, title: 'Read DDIA ch.1', status: 'completed', priority: 'high', totalTime: 1800000, milestoneRef: MILESTONE_ID, phaseRef: PHASE_ID, deadline: null },
    ]));

    const res = await get(`/${ROADMAP_ID}`);
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.title).toBe('Learn Systems Design');
    expect(detail.phases).toHaveLength(1);
    expect(detail.phases[0].milestoneTotal).toBe(1);
    expect(detail.phases[0].progress).toBe(100);
    expect(detail.milestones[0].totalTasks).toBe(1);
    expect(detail.progress).toBe(100);
    // Tasks surface as summaries keyed by `id`, not raw docs.
    expect(detail.tasks[0]).toMatchObject({ id: TASK_ID, title: 'Read DDIA ch.1' });
    expect(detail.totalTasks).toBe(1);
    expect(detail.totalTime).toBe(1800000);
  });

  it('404s another user\'s roadmap on open (never leaks existence)', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    const res = await get(`/${ROADMAP_ID}`);
    expect(res.status).toBe(404);
  });

  it('400s a malformed roadmap id', async () => {
    const res = await get('/not-an-objectid');
    expect(res.status).toBe(400);
  });

  // ── EDIT ────────────────────────────────────────────────────────────────────

  it('edits only allowlisted fields and returns the updated document', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    const updateSpy = spy(Roadmap, 'findByIdAndUpdate', (_id, patchArg) =>
      Promise.resolve(roadmapDoc(patchArg)));

    const res = await patch(`/${ROADMAP_ID}`, {
      title: 'Master Systems Design',
      description: 'Updated',
      type: 'career',
      startDate: '2026-10-01',
      targetDate: '2027-03-31',
      icon: 'Rocket',
      color: '#ec4899',
      // Rogue keys must never reach the patch:
      userId: USER_B,
      __proto__: { polluted: true },
      $set: { status: 'archived' },
    });

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledOnce();
    const [, patchArg, opts] = updateSpy.mock.calls[0];
    expect(patchArg).toEqual({
      title: 'Master Systems Design',
      description: 'Updated',
      type: 'career',
      startDate: '2026-10-01',
      targetDate: '2027-03-31',
      icon: 'Rocket',
      color: '#ec4899',
    });
    expect(opts).toEqual({ new: true, runValidators: true });
    const body = await res.json();
    expect(body.title).toBe('Master Systems Design');
  });

  it('archives a roadmap via status patch (close flow)', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(Roadmap, 'findByIdAndUpdate', (_id, patchArg) =>
      Promise.resolve(roadmapDoc(patchArg)));

    const res = await patch(`/${ROADMAP_ID}`, { status: 'archived' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('archived');
  });

  it('404s editing another user\'s roadmap and never updates', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    const updateSpy = spy(Roadmap, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await patch(`/${ROADMAP_ID}`, { title: 'Hijacked' });
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('400s invalid patch values and never touches the database record', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    const updateSpy = spy(Roadmap, 'findByIdAndUpdate', () => Promise.resolve(null));

    const badStatus = await patch(`/${ROADMAP_ID}`, { status: 'paused-x' });
    expect(badStatus.status).toBe(400);
    const emptyTitle = await patch(`/${ROADMAP_ID}`, { title: '   ' });
    expect(emptyTitle.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // ── DELETE (tasks must survive) ─────────────────────────────────────────────

  it('deletes the roadmap + children and UNLINKS tasks without deleting them', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    const phaseDelSpy = spy(RoadmapPhase, 'deleteMany', () => Promise.resolve({ deletedCount: 2 }));
    const milestoneDelSpy = spy(RoadmapMilestone, 'deleteMany', () => Promise.resolve({ deletedCount: 4 }));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 5 }));
    const taskDeleteSpy = spy(Task, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const rmDeleteSpy = spy(Roadmap, 'findByIdAndDelete', () => Promise.resolve(roadmapDoc()));

    const res = await del(`/${ROADMAP_ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Roadmap deleted' });

    expect(phaseDelSpy).toHaveBeenCalledWith({ roadmapId: ROADMAP_ID, userId: USER_A });
    expect(milestoneDelSpy).toHaveBeenCalledWith({ roadmapId: ROADMAP_ID, userId: USER_A });
    // Linked tasks survive: refs are nulled, never bulk-deleted.
    expect(taskUpdateSpy).toHaveBeenCalledWith(
      { roadmapRef: ROADMAP_ID, userId: USER_A },
      { $set: { roadmapRef: null, phaseRef: null, milestoneRef: null } },
    );
    expect(taskDeleteSpy).not.toHaveBeenCalled();
    expect(rmDeleteSpy).toHaveBeenCalledOnce();
    expect(rmDeleteSpy.mock.calls[0][0]).toBe(ROADMAP_ID);
  });

  it("404s deleting another user's roadmap and cascades nothing", async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    const phaseDelSpy = spy(RoadmapPhase, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const milestoneDelSpy = spy(RoadmapMilestone, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
    const rmDeleteSpy = spy(Roadmap, 'findByIdAndDelete', () => Promise.resolve(null));

    const res = await del(`/${ROADMAP_ID}`);
    expect(res.status).toBe(404);
    expect(phaseDelSpy).not.toHaveBeenCalled();
    expect(milestoneDelSpy).not.toHaveBeenCalled();
    expect(taskUpdateSpy).not.toHaveBeenCalled();
    expect(rmDeleteSpy).not.toHaveBeenCalled();
  });
});
