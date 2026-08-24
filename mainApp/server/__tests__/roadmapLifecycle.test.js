// @vitest-environment node
// B8 - Status & Lifecycle: transition rules, completion cascades, paused-vs-
// active accuracy, and the no-task-mutation guarantee.
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
const {
  ROADMAP_TRANSITIONS,
  PHASE_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  canTransition,
} = require('../utils/roadmapLifecycle');

const USER_A = '5f00000000000000000000a1';
const ROADMAP_ID = '507f1f77bcf86cd7994390a1';
const PHASE_ID = '507f1f77bcf86cd7994390b1';
const OTHER_PHASE_ID = '507f1f77bcf86cd7994390b2';
const MILESTONE_ID = '507f1f77bcf86cd7994390c1';

function makeUser(_id) {
  return {
    _id,
    name: 'B8 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B8 - transition tables (pure)', () => {
  it('encodes the documented lifecycle', () => {
    // planning -> active -> completed is THE happy path
    expect(canTransition(ROADMAP_TRANSITIONS, 'planning', 'active')).toBe(true);
    expect(canTransition(ROADMAP_TRANSITIONS, 'active', 'completed')).toBe(true);
    // shortcuts that skip "started work" are illegal
    expect(canTransition(ROADMAP_TRANSITIONS, 'planning', 'completed')).toBe(false);
    expect(canTransition(ROADMAP_TRANSITIONS, 'archived', 'planning')).toBe(false);
    // pause round-trip and reopen are legal; terminal-ish states guarded
    expect(canTransition(ROADMAP_TRANSITIONS, 'active', 'paused')).toBe(true);
    expect(canTransition(ROADMAP_TRANSITIONS, 'paused', 'active')).toBe(true);
    expect(canTransition(ROADMAP_TRANSITIONS, 'completed', 'active')).toBe(true);

    expect(canTransition(PHASE_TRANSITIONS, 'upcoming', 'completed')).toBe(false);
    expect(canTransition(PHASE_TRANSITIONS, 'active', 'completed')).toBe(true);
    expect(canTransition(PHASE_TRANSITIONS, 'completed', 'active')).toBe(true);

    expect(canTransition(MILESTONE_TRANSITIONS, 'todo', 'in-progress')).toBe(true);
    expect(canTransition(MILESTONE_TRANSITIONS, 'completed', 'todo')).toBe(true);
  });

  it('always allows same-value patches (no-op) but not unknown statuses', () => {
    expect(canTransition(ROADMAP_TRANSITIONS, 'active', 'active')).toBe(true);
    expect(canTransition(MILESTONE_TRANSITIONS, 'completed', 'completed')).toBe(true);
    expect(canTransition(PHASE_TRANSITIONS, 'bogus', 'active')).toBe(false);
  });
});

describe('B8 - lifecycle through the API', () => {
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

  const doc = (extra) => ({
    toObject() { const copy = { ...this }; delete copy.toObject; return copy; },
    ...extra,
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b8-test-secret-at-least-32-chars-long!!';
    mockUser = makeUser(USER_A);

    spy(User, 'findById', (id) => ({
      select: () => Promise.resolve(String(id) === String(mockUser._id) ? mockUser : null),
    }));
    spy(Activity, 'create', () => Promise.resolve());

    const app = express();
    app.use(express.json());
    app.use('/api/roadmaps', require('../routes/personalRoadmaps'));
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

  const patch = (url, body) =>
    fetch(`${baseUrl}${url}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
  const get = (url) => fetch(`${baseUrl}${url}`, { headers: authHeaders() });

  // -- ROADMAP TRANSITIONS --------------------------------------------------

  it('accepts legal roadmap transitions and persists them for refreshes', async () => {
    const stored = doc({ _id: ROADMAP_ID, userId: USER_A, title: 'Learn Systems', status: 'planning' });
    spy(Roadmap, 'findOne', () => Promise.resolve(stored));
    const updateSpy = spy(Roadmap, 'findByIdAndUpdate', (_id, p) =>
      Promise.resolve(doc({ ...stored, ...p })));
    const phaseCascadeSpy = spy(RoadmapPhase, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
    const msCascadeSpy = spy(RoadmapMilestone, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));

    const res = await patch(`/${ROADMAP_ID}`, { status: 'active' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'active' });
    expect(updateSpy.mock.calls[0][1].status).toBe('active');
    // Non-completion transitions must NOT cascade anything.
    expect(phaseCascadeSpy).not.toHaveBeenCalled();
    expect(msCascadeSpy).not.toHaveBeenCalled();
  });

  it('rejects illegal roadmap transitions with a clear 400', async () => {
    const stored = doc({ _id: ROADMAP_ID, userId: USER_A, status: 'planning' });
    spy(Roadmap, 'findOne', () => Promise.resolve(stored));
    const updateSpy = spy(Roadmap, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await patch(`/${ROADMAP_ID}`, { status: 'completed' });
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('completing a roadmap cascades phases+milestones but NEVER touches tasks', async () => {
    const stored = doc({ _id: ROADMAP_ID, userId: USER_A, status: 'active' });
    spy(Roadmap, 'findOne', () => Promise.resolve(stored));
    spy(Roadmap, 'findByIdAndUpdate', (_id, p) => Promise.resolve(doc({ ...stored, ...p })));
    const phaseCascadeSpy = spy(RoadmapPhase, 'updateMany',
      (filter, update) => Promise.resolve({ modifiedCount: 1, filter, update }));
    const msCascadeSpy = spy(RoadmapMilestone, 'updateMany',
      (filter, update) => Promise.resolve({ modifiedCount: 3, filter, update }));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));

    const res = await patch(`/${ROADMAP_ID}`, { status: 'completed' });
    expect(res.status).toBe(200);

    expect(phaseCascadeSpy).toHaveBeenCalledOnce();
    expect(msCascadeSpy).toHaveBeenCalledOnce();
    // Scope: only this user's incomplete children of THIS roadmap.
    expect(phaseCascadeSpy.mock.calls[0][0]).toEqual({
      roadmapId: ROADMAP_ID, userId: USER_A, status: { $ne: 'completed' },
    });
    expect(msCascadeSpy.mock.calls[0][0]).toEqual({
      roadmapId: ROADMAP_ID, userId: USER_A, status: { $ne: 'completed' },
    });
    expect(phaseCascadeSpy.mock.calls[0][1]).toEqual({ $set: { status: 'completed' } });
    expect(msCascadeSpy.mock.calls[0][1]).toEqual({ $set: { status: 'completed' } });

    // Hard guarantee: roadmap operations never mutate Tasks.
    expect(taskUpdateSpy).not.toHaveBeenCalled();
  });

  it('re-completing an already-completed roadmap does not re-cascade', async () => {
    const stored = doc({ _id: ROADMAP_ID, userId: USER_A, status: 'completed' });
    spy(Roadmap, 'findOne', () => Promise.resolve(stored));
    spy(Roadmap, 'findByIdAndUpdate', (_id, p) => Promise.resolve(doc({ ...stored, ...p })));
    const phaseCascadeSpy = spy(RoadmapPhase, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));

    const res = await patch(`/${ROADMAP_ID}`, { status: 'completed' }); // no-op status
    expect(res.status).toBe(200);
    expect(phaseCascadeSpy).not.toHaveBeenCalled();
  });

  it('reopening a completed roadmap does not auto-reopen children', async () => {
    const stored = doc({ _id: ROADMAP_ID, userId: USER_A, status: 'completed' });
    spy(Roadmap, 'findOne', () => Promise.resolve(stored));
    spy(Roadmap, 'findByIdAndUpdate', (_id, p) => Promise.resolve(doc({ ...stored, ...p })));
    const phaseCascadeSpy = spy(RoadmapPhase, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
    const msCascadeSpy = spy(RoadmapMilestone, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));

    const res = await patch(`/${ROADMAP_ID}`, { status: 'active' });
    expect(res.status).toBe(200);
    expect(phaseCascadeSpy).not.toHaveBeenCalled();
    expect(msCascadeSpy).not.toHaveBeenCalled();
  });

  // -- PHASE TRANSITIONS ------------------------------------------------------

  it('rejects upcoming->completed phase shortcut', async () => {
    const stored = doc({ _id: PHASE_ID, userId: USER_A, roadmapId: ROADMAP_ID, status: 'upcoming' });
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(stored));
    const updateSpy = spy(RoadmapPhase, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await patch(`/phases/${PHASE_ID}`, { status: 'completed' });
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('completing a phase cascades ONLY its milestones', async () => {
    const stored = doc({ _id: PHASE_ID, userId: USER_A, roadmapId: ROADMAP_ID, status: 'active' });
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(stored));
    spy(RoadmapPhase, 'findByIdAndUpdate', (_id, p) => Promise.resolve(doc({ ...stored, ...p })));
    const msCascadeSpy = spy(RoadmapMilestone, 'updateMany',
      (filter, update) => Promise.resolve({ modifiedCount: 2, filter, update }));
    const roadmapMsSpy = spy(RoadmapMilestone, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await patch(`/phases/${PHASE_ID}`, { status: 'completed' });
    expect(res.status).toBe(200);
    expect(msCascadeSpy).toHaveBeenCalledOnce();
    expect(msCascadeSpy.mock.calls[0][0]).toEqual({
      phaseId: PHASE_ID, userId: USER_A, status: { $ne: 'completed' },
    });
    // No roadmap-wide milestone sweep happens on phase completion.
    expect(roadmapMsSpy).not.toHaveBeenCalled();
  });

  // -- MILESTONE TRANSITIONS --------------------------------------------------

  it('validates milestone transitions without side effects', async () => {
    const stored = doc({ _id: MILESTONE_ID, userId: USER_A, phaseId: PHASE_ID, status: 'todo' });
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve(stored));

    const bad = await patch(`/milestones/${MILESTONE_ID}`, { status: 'bogus-status' });
    // bogus isn't in the table -> rejected even though schema allows any enum member? 
    // (schema enum rejects unknown values first; either way it must not be 200)
    expect(bad.status).toBeGreaterThanOrEqual(400);

    spy(RoadmapMilestone, 'findByIdAndUpdate', (_id, p) => Promise.resolve(doc({ ...stored, ...p })));
    const ok = await patch(`/milestones/${MILESTONE_ID}`, { status: 'in-progress' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: 'in-progress' });
  });

  // -- PAUSED vs ACTIVE ACCURACY ------------------------------------------------

  it('overview counts paused/completed/archived roadmaps as NOT active', async () => {
    const roadmaps = [
      doc({ _id: 'a1', status: 'active', title: 'A' }),
      doc({ _id: 'a2', status: 'planning', title: 'B' }),
      doc({ _id: 'a3', status: 'paused', title: 'C' }),
      doc({ _id: 'a4', status: 'completed', title: 'D' }),
      doc({ _id: 'a5', status: 'archived', title: 'E' }),
    ];
    spy(Roadmap, 'find', () => ({ sort: () => Promise.resolve(roadmaps) }));
    // B11: analytics aggregates server-side; stub every pipeline as empty.
    spy(RoadmapPhase, 'find', () => Promise.resolve([]));
    spy(RoadmapPhase, 'aggregate', () => Promise.resolve([]));
    spy(RoadmapMilestone, 'find', () => ({
      sort: () => ({ limit: () => ({ select: () => Promise.resolve([]) }) }),
    }));
    spy(RoadmapMilestone, 'aggregate', () => Promise.resolve([]));
    spy(Task, 'find', () => ({
      sort: () => ({ limit: () => ({ select: () => Promise.resolve([]) }) }),
    }));
    spy(Task, 'aggregate', () => Promise.resolve([]));

    const res = await get('/analytics');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.activeRoadmaps).toBe(2); // active + planning only
  });
});
