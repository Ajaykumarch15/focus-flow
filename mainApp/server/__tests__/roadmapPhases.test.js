// @vitest-environment node
// B4 (Basic Roadmap V1): Phase management under a Roadmap -
// create (deterministic auto-order) - list - edit - reorder - delete,
// with ownership scoping and the "tasks survive" guarantee at every step.
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
const PHASE_A = '507f1f77bcf86cd7994390b1';
const PHASE_B = '507f1f77bcf86cd7994390b2';
const PHASE_C = '507f1f77bcf86cd7994390b3';
const MILESTONE_ID = '507f1f77bcf86cd7994390c1';
const TASK_ID = '507f1f77bcf86cd7994390d1';

function makeUser(_id) {
  return {
    _id,
    name: 'B4 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B4 - phase management', () => {
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

  const sorted = (docs) => ({ sort: () => Promise.resolve(docs) });

  function roadmapDoc(overrides = {}) {
    const base = {
      _id: ROADMAP_ID,
      userId: USER_A,
      title: 'Learn Rust',
      type: 'learning',
      status: 'active',
      ...overrides,
    };
    return { ...base, toObject: () => ({ ...base }) };
  }

  function phaseDoc(_id, order, overrides = {}) {
    const base = {
      _id,
      userId: USER_A,
      roadmapId: ROADMAP_ID,
      title: `Phase ${order}`,
      description: '',
      order,
      status: 'upcoming',
      startDate: null,
      targetDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
    return { ...base, toObject: () => ({ ...base }) };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b4-test-secret-at-least-32-chars-long!!';
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

  const post = (url, body, headers = authHeaders()) =>
    fetch(`${baseUrl}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const get = (url, headers = authHeaders()) => fetch(`${baseUrl}${url}`, { headers });
  const patch = (url, body, headers = authHeaders()) =>
    fetch(`${baseUrl}${url}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const del = (url, headers = authHeaders()) => fetch(`${baseUrl}${url}`, { method: 'DELETE', headers });

  // - CREATE -

  it('appends a deterministic order when the client omits it', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    // Current last phase sits at order 2 - the new one must land on 3.
    spy(RoadmapPhase, 'findOne', () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve({ order: 2 }) }) }),
    }));
    const createSpy = spy(RoadmapPhase, 'create', (payload) =>
      Promise.resolve(phaseDoc(PHASE_A, payload.order)));

    const res = await post(`/${ROADMAP_ID}/phases`, { title: 'Ship It' });
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledOnce();
    expect(createSpy.mock.calls[0][0].order).toBe(3);
    expect(String(createSpy.mock.calls[0][0].roadmapId)).toBe(ROADMAP_ID);
    expect(String(createSpy.mock.calls[0][0].userId)).toBe(USER_A);
    const body = await res.json();
    expect(body.order).toBe(3);
  });

  it('starts ordering at 0 for the first phase', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'findOne', () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
    }));
    const createSpy = spy(RoadmapPhase, 'create', (payload) =>
      Promise.resolve(phaseDoc(PHASE_A, payload.order)));

    await post(`/${ROADMAP_ID}/phases`, { title: 'Foundations' });
    expect(createSpy.mock.calls[0][0].order).toBe(0);
  });

  it('never trusts a client roadmapId that points elsewhere', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'findOne', () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
    }));
    const createSpy = spy(RoadmapPhase, 'create', (payload) =>
      Promise.resolve(phaseDoc(PHASE_A, payload.order)));

    const res = await post(`/${ROADMAP_ID}/phases`, { title: 'X', roadmapId: '507f1f77bcf86cd799439099' });
    expect(res.status).toBe(201);
    // The verified URL-derived roadmap wins over the body value.
    expect(String(createSpy.mock.calls[0][0].roadmapId)).toBe(ROADMAP_ID);
  });

  it("404s creating under another user's roadmap", async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    const createSpy = spy(RoadmapPhase, 'create', () => Promise.resolve(phaseDoc(PHASE_A, 0)));

    const res = await post(`/${ROADMAP_ID}/phases`, { title: 'Nope' });
    expect(res.status).toBe(404);
    expect(createSpy).not.toHaveBeenCalled();
  });

  // - LIST -

  it('lists phases ordered by order with milestone progress enrichment', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'find', () => sorted([phaseDoc(PHASE_A, 0), phaseDoc(PHASE_B, 1)]));
    spy(RoadmapMilestone, 'find', () => Promise.resolve([
      { phaseId: PHASE_A, status: 'completed', toObject() { return { ...this }; } },
      { phaseId: PHASE_A, status: 'todo', toObject() { return { ...this }; } },
    ]));

    const res = await get(`/${ROADMAP_ID}/phases`);
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.map(p => p.order)).toEqual([0, 1]);
    expect(list[0].milestoneTotal).toBe(2);
    expect(list[0].progress).toBe(50);
    expect(list[1].progress).toBe(0);
  });

  // - EDIT -

  it('edits phase fields but strips raw order changes', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(phaseDoc(PHASE_A, 1)));
    const updateSpy = spy(RoadmapPhase, 'findByIdAndUpdate', (_id, patchArg) =>
      Promise.resolve(phaseDoc(PHASE_A, 1, patchArg)));

    const res = await patch(`/phases/${PHASE_A}`, {
      title: 'Renamed',
      description: 'Updated',
      status: 'active',
      startDate: '2026-10-01',
      targetDate: '2026-11-30',
      order: 99, // must be ignored - ordering only changes via reorder
    });

    expect(res.status).toBe(200);
    const [, patchArg] = updateSpy.mock.calls[0];
    expect(patchArg).toEqual({
      title: 'Renamed',
      description: 'Updated',
      status: 'active',
      startDate: '2026-10-01',
      targetDate: '2026-11-30',
    });
    expect(patchArg.order).toBeUndefined();
  });

  it("404s editing another user's phase", async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(null));
    const updateSpy = spy(RoadmapPhase, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await patch(`/phases/${PHASE_A}`, { title: 'Hijacked' });
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // - REORDER -

  it('reorders a full permutation to dense 0..n-1 and preserves every phase', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'find', () => ({ select: () => Promise.resolve([
      phaseDoc(PHASE_A, 0), phaseDoc(PHASE_B, 1), phaseDoc(PHASE_C, 2),
    ]) }));
    const bulkSpy = spy(RoadmapPhase, 'bulkWrite', () => Promise.resolve({ modifiedCount: 3 }));

    const res = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: [PHASE_C, PHASE_A, PHASE_B] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Phases reordered' });
    expect(bulkSpy).toHaveBeenCalledOnce();
    const ops = bulkSpy.mock.calls[0][0];
    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({ updateOne: { filter: { _id: PHASE_C, roadmapId: ROADMAP_ID }, update: { $set: { order: 0 } } } });
    expect(ops[1].updateOne.update.$set.order).toBe(1);
    expect(ops[2].updateOne.update.$set.order).toBe(2);
  });

  it('rejects a reorder payload with duplicate ids', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'find', () => ({ select: () => Promise.resolve([phaseDoc(PHASE_A, 0), phaseDoc(PHASE_B, 1)]) }));
    const bulkSpy = spy(RoadmapPhase, 'bulkWrite', () => Promise.resolve({}));

    const res = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: [PHASE_A, PHASE_A] });
    expect(res.status).toBe(400);
    expect(bulkSpy).not.toHaveBeenCalled();
  });

  it('rejects a partial reorder payload missing a phase', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'find', () => ({ select: () => Promise.resolve([
      phaseDoc(PHASE_A, 0), phaseDoc(PHASE_B, 1), phaseDoc(PHASE_C, 2),
    ]) }));
    const bulkSpy = spy(RoadmapPhase, 'bulkWrite', () => Promise.resolve({}));

    const res = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: [PHASE_C, PHASE_A] });
    expect(res.status).toBe(400);
    expect(bulkSpy).not.toHaveBeenCalled();
  });

  it("rejects a reorder payload containing another user's phase", async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));
    spy(RoadmapPhase, 'find', () => ({ select: () => Promise.resolve([phaseDoc(PHASE_A, 0)]) }));
    const bulkSpy = spy(RoadmapPhase, 'bulkWrite', () => Promise.resolve({}));

    const res = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: [PHASE_A, PHASE_B] });
    expect(res.status).toBe(400);
    expect(bulkSpy).not.toHaveBeenCalled();
  });

  it("404s reordering under another user's roadmap", async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(null));
    const findSpy = spy(RoadmapPhase, 'find', () => ({ select: () => Promise.resolve([]) }));

    const res = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: [PHASE_A] });
    expect(res.status).toBe(404);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('400s invalid reorder payloads (empty list, malformed id)', async () => {
    spy(Roadmap, 'findOne', () => Promise.resolve(roadmapDoc()));

    const empty = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: [] });
    expect(empty.status).toBe(400);

    spy(RoadmapPhase, 'find', () => ({ select: () => Promise.resolve([phaseDoc(PHASE_A, 0)]) }));
    const malformed = await post(`/${ROADMAP_ID}/phases/reorder`, { phaseIds: ['garbage'] });
    expect(malformed.status).toBe(400);
  });

  // - DELETE (tasks must survive) -

  it('deletes a phase + its milestones and UNLINKS tasks without deleting them', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(phaseDoc(PHASE_A, 0)));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 2 }));
    const taskDeleteSpy = spy(Task, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const milestoneDelSpy = spy(RoadmapMilestone, 'deleteMany', () => Promise.resolve({ deletedCount: 3 }));
    const phaseDelSpy = spy(RoadmapPhase, 'findByIdAndDelete', () => Promise.resolve(phaseDoc(PHASE_A, 0)));

    const res = await del(`/phases/${PHASE_A}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Phase deleted' });
    expect(taskUpdateSpy).toHaveBeenCalledWith(
      { phaseRef: PHASE_A, userId: USER_A },
      { $set: { phaseRef: null, milestoneRef: null } },
    );
    expect(taskDeleteSpy).not.toHaveBeenCalled();
    expect(milestoneDelSpy).toHaveBeenCalledWith({ phaseId: PHASE_A, userId: USER_A });
    expect(phaseDelSpy).toHaveBeenCalledWith(PHASE_A);
  });

  it("404s deleting another user's phase and cascades nothing", async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(null));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
    const milestoneDelSpy = spy(RoadmapMilestone, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const phaseDelSpy = spy(RoadmapPhase, 'findByIdAndDelete', () => Promise.resolve(null));

    const res = await del(`/phases/${PHASE_A}`);
    expect(res.status).toBe(404);
    expect(taskUpdateSpy).not.toHaveBeenCalled();
    expect(milestoneDelSpy).not.toHaveBeenCalled();
    expect(phaseDelSpy).not.toHaveBeenCalled();
  });
});
