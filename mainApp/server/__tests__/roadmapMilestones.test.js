// @vitest-environment node
// B5 (Basic Roadmap V1): Milestone management under Phases -
// create (deterministic auto-order) - list - edit - reorder - delete,
// full Roadmap -> Phase -> Milestone ownership chain, tasks-survive delete,
// and progress consistency across multiple phases.
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
const MS_A1 = '507f1f77bcf86cd7994390c1';
const MS_A2 = '507f1f77bcf86cd7994390c2';
const MS_A3 = '507f1f77bcf86cd7994390c3';
const MS_B1 = '507f1f77bcf86cd7994390c4';
const TASK_ID = '507f1f77bcf86cd7994390d1';

function makeUser(_id) {
  return {
    _id,
    name: 'B5 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B5 - milestone management', () => {
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

  function msDoc(_id, order, overrides = {}) {
    const base = {
      _id,
      userId: USER_A,
      roadmapId: ROADMAP_ID,
      phaseId: PHASE_A,
      title: `Milestone ${order}`,
      description: '',
      order,
      status: 'todo',
      targetDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
    return { ...base, toObject: () => ({ ...base }) };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b5-test-secret-at-least-32-chars-long!!';
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

  // -- CREATE -------------------------------------------------------------

  it('appends a deterministic order within the phase when omitted', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_A, userId: USER_A, roadmapId: ROADMAP_ID }));
    // Current last milestone in this phase sits at order 2 -> new one lands on 3.
    spy(RoadmapMilestone, 'findOne', () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve({ order: 2 }) }) }),
    }));
    const createSpy = spy(RoadmapMilestone, 'create', (payload) =>
      Promise.resolve(msDoc(MS_A1, payload.order)));

    const res = await post(`/phases/${PHASE_A}/milestones`, { title: 'Ship chapter 1' });
    expect(res.status).toBe(201);
    expect(createSpy.mock.calls[0][0].order).toBe(3);
    expect(String(createSpy.mock.calls[0][0].phaseId)).toBe(PHASE_A);
    // roadmapId comes from the verified phase, not from the client body.
    expect(String(createSpy.mock.calls[0][0].roadmapId)).toBe(ROADMAP_ID);
  });

  it('starts ordering at 0 for the first milestone in a phase', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_B, userId: USER_A, roadmapId: ROADMAP_ID }));
    spy(RoadmapMilestone, 'findOne', () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
    }));
    const createSpy = spy(RoadmapMilestone, 'create', (payload) =>
      Promise.resolve(msDoc(MS_B1, payload.order, { phaseId: PHASE_B })));

    await post(`/phases/${PHASE_B}/milestones`, { title: 'Kickoff' });
    expect(createSpy.mock.calls[0][0].order).toBe(0);
  });

  it('never trusts a client phaseId/roadmapId pointing elsewhere', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_A, userId: USER_A, roadmapId: ROADMAP_ID }));
    spy(RoadmapMilestone, 'findOne', () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
    }));
    const createSpy = spy(RoadmapMilestone, 'create', (payload) =>
      Promise.resolve(msDoc(MS_A1, payload.order)));

    await post(`/phases/${PHASE_A}/milestones`, {
      title: 'X',
      phaseId: '507f1f77bcf86cd799439099',
      roadmapId: '507f1f77bcf86cd799439088',
    });
    const payload = createSpy.mock.calls[0][0];
    expect(String(payload.phaseId)).toBe(PHASE_A);
    expect(String(payload.roadmapId)).toBe(ROADMAP_ID);
  });

  it("404s creating under another user's phase", async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(null));
    const createSpy = spy(RoadmapMilestone, 'create', () => Promise.resolve(msDoc(MS_A1, 0)));

    const res = await post(`/phases/${PHASE_A}/milestones`, { title: 'Nope' });
    expect(res.status).toBe(404);
    expect(createSpy).not.toHaveBeenCalled();
  });

  // -- LIST ---------------------------------------------------------------

  it('lists milestones ordered with task enrichment per milestone', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_A, userId: USER_A }));
    spy(RoadmapMilestone, 'find', () => sorted([msDoc(MS_A1, 0), msDoc(MS_A2, 1)]));
    spy(Task, 'find', () => Promise.resolve([
      { _id: TASK_ID, milestoneRef: MS_A1, status: 'completed' },
      { _id: '507f1f77bcf86cd7994390d2', milestoneRef: MS_A1, status: 'todo' },
    ]));

    const res = await get(`/phases/${PHASE_A}/milestones`);
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.map(m => m.order)).toEqual([0, 1]);
    expect(list[0].totalTasks).toBe(2);
    expect(list[0].progress).toBe(50);
    expect(list[1].totalTasks).toBe(0);
    expect(list[1].progress).toBe(0);
  });

  // -- EDIT ---------------------------------------------------------------

  it('edits milestone fields but strips raw order changes', async () => {
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve(msDoc(MS_A1, 0)));
    const updateSpy = spy(RoadmapMilestone, 'findByIdAndUpdate', (_id, patchArg) =>
      Promise.resolve(msDoc(MS_A1, 0, patchArg)));

    const res = await patch(`/milestones/${MS_A1}`, {
      title: 'Renamed',
      description: 'Updated',
      status: 'in-progress',
      targetDate: '2026-12-15',
      order: 99, // ignored - ordering changes only via reorder
    });

    expect(res.status).toBe(200);
    const [, patchArg] = updateSpy.mock.calls[0];
    expect(patchArg).toEqual({
      title: 'Renamed',
      description: 'Updated',
      status: 'in-progress',
      targetDate: '2026-12-15',
    });
    expect(patchArg.order).toBeUndefined();
  });

  it("404s editing another user's milestone", async () => {
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve(null));
    const updateSpy = spy(RoadmapMilestone, 'findByIdAndUpdate', () => Promise.resolve(null));

    const res = await patch(`/milestones/${MS_A1}`, { title: 'Hijacked' });
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // -- REORDER ------------------------------------------------------------

  it('reorders a full permutation to dense 0..n-1 within the phase', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_A, userId: USER_A }));
    spy(RoadmapMilestone, 'find', () => ({ select: () => Promise.resolve([
      msDoc(MS_A1, 0), msDoc(MS_A2, 1), msDoc(MS_A3, 2),
    ]) }));
    const bulkSpy = spy(RoadmapMilestone, 'bulkWrite', () => Promise.resolve({ modifiedCount: 3 }));

    const res = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: [MS_A3, MS_A1, MS_A2] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Milestones reordered' });
    const ops = bulkSpy.mock.calls[0][0];
    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({ updateOne: { filter: { _id: MS_A3, phaseId: PHASE_A }, update: { $set: { order: 0 } } } });
    expect(ops[1].updateOne.update.$set.order).toBe(1);
    expect(ops[2].updateOne.update.$set.order).toBe(2);
  });

  it('rejects duplicates, partial lists and foreign milestones', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_A, userId: USER_A }));
    spy(RoadmapMilestone, 'find', () => ({ select: () => Promise.resolve([
      msDoc(MS_A1, 0), msDoc(MS_A2, 1),
    ]) }));
    const bulkSpy = spy(RoadmapMilestone, 'bulkWrite', () => Promise.resolve({}));

    const dupes = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: [MS_A1, MS_A1] });
    expect(dupes.status).toBe(400);

    const partial = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: [MS_A2] });
    expect(partial.status).toBe(400);

    const foreign = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: [MS_A1, MS_B1] });
    expect(foreign.status).toBe(400);

    expect(bulkSpy).not.toHaveBeenCalled();
  });

  it("404s reordering under another user's phase", async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve(null));
    const findSpy = spy(RoadmapMilestone, 'find', () => ({ select: () => Promise.resolve([]) }));

    const res = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: [MS_A1] });
    expect(res.status).toBe(404);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('400s invalid reorder payloads (empty list, malformed id)', async () => {
    spy(RoadmapPhase, 'findOne', () => Promise.resolve({ _id: PHASE_A, userId: USER_A }));

    const empty = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: [] });
    expect(empty.status).toBe(400);

    spy(RoadmapMilestone, 'find', () => ({ select: () => Promise.resolve([msDoc(MS_A1, 0)]) }));
    const malformed = await post(`/phases/${PHASE_A}/milestones/reorder`, { milestoneIds: ['garbage'] });
    expect(malformed.status).toBe(400);
  });

  // -- DELETE (tasks must survive) ----------------------------------------

  it('deletes a milestone and unlinks its tasks WITHOUT deleting them (phaseRef preserved)', async () => {
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve(msDoc(MS_A1, 0)));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 2 }));
    const taskDeleteSpy = spy(Task, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const msDelSpy = spy(RoadmapMilestone, 'findByIdAndDelete', () => Promise.resolve(msDoc(MS_A1, 0)));

    const res = await del(`/milestones/${MS_A1}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Milestone deleted' });
    // Only the milestone link is cleared - the task remains linked to its phase.
    expect(taskUpdateSpy).toHaveBeenCalledWith(
      { milestoneRef: MS_A1, userId: USER_A },
      { $set: { milestoneRef: null } },
    );
    expect(taskDeleteSpy).not.toHaveBeenCalled();
    expect(msDelSpy).toHaveBeenCalledWith(MS_A1);
  });

  it("404s deleting another user's milestone and cascades nothing", async () => {
    spy(RoadmapMilestone, 'findOne', () => Promise.resolve(null));
    const taskUpdateSpy = spy(Task, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
    const msDelSpy = spy(RoadmapMilestone, 'findByIdAndDelete', () => Promise.resolve(null));

    const res = await del(`/milestones/${MS_A1}`);
    expect(res.status).toBe(404);
    expect(taskUpdateSpy).not.toHaveBeenCalled();
    expect(msDelSpy).not.toHaveBeenCalled();
  });

  // -- PROGRESS CONSISTENCY (multi-phase / multi-milestone) -----------------

  it('keeps progress math isolated per phase and consistent at roadmap level', async () => {
    // Phase A: 2 milestones (1 completed) -> 50%; Phase B: 1 milestone (completed) -> 100%.
    // Roadmap overall: 2/3 completed -> 67%.
    const milestones = [
      msDoc(MS_A1, 0, { phaseId: PHASE_A, status: 'completed' }),
      msDoc(MS_A2, 1, { phaseId: PHASE_A, status: 'todo' }),
      msDoc(MS_B1, 0, { phaseId: PHASE_B, status: 'completed' }),
    ];
    const phases = [
      { _id: PHASE_A, roadmapId: ROADMAP_ID, userId: USER_A, title: 'A', order: 0, status: 'active', toObject() { return { ...this }; } },
      { _id: PHASE_B, roadmapId: ROADMAP_ID, userId: USER_A, title: 'B', order: 1, status: 'upcoming', toObject() { return { ...this }; } },
    ];
    const tasks = [
      { _id: TASK_ID, milestoneRef: MS_A1, phaseRef: PHASE_A, status: 'completed', totalTime: 600000 },
      { _id: '507f1f77bcf86cd7994390d2', milestoneRef: MS_A2, phaseRef: PHASE_A, status: 'todo', totalTime: 0 },
      { _id: '507f1f77bcf86cd7994390d3', milestoneRef: MS_B1, phaseRef: PHASE_B, status: 'completed', totalTime: 1200000 },
    ];

    spy(Roadmap, 'findOne', (filter) =>
      Promise.resolve(
        String(filter.userId) === USER_A && String(filter._id) === ROADMAP_ID
          ? { _id: ROADMAP_ID, userId: USER_A, title: 'Rust', toObject() { return { ...this }; } }
          : null));
    spy(RoadmapPhase, 'find', () => sorted(phases));
    spy(RoadmapMilestone, 'find', () => sorted(milestones));
    spy(Task, 'find', () => Promise.resolve(tasks));

    const res = await get(`/${ROADMAP_ID}`);
    expect(res.status).toBe(200);
    const detail = await res.json();

    const phaseById = Object.fromEntries(detail.phases.map(p => [p._id, p]));
    expect(phaseById[PHASE_A].milestoneTotal).toBe(2);
    expect(phaseById[PHASE_A].progress).toBe(50);
    expect(phaseById[PHASE_B].milestoneTotal).toBe(1);
    expect(phaseById[PHASE_B].progress).toBe(100);

    expect(detail.milestoneTotal).toBe(3);
    expect(detail.milestoneCompleted).toBe(2);
    expect(detail.progress).toBe(67); // round(2/3 * 100)

    // Milestone rollups stay attached to their own milestones.
    const msById = Object.fromEntries(detail.milestones.map(m => [m._id, m]));
    expect(msById[MS_A1].totalTasks).toBe(1);
    expect(msById[MS_A1].completedTasks).toBe(1);
    expect(msById[MS_A2].totalTasks).toBe(1);
    expect(msById[MS_A2].completedTasks).toBe(0);
    expect(msById[MS_B1].completedTasks).toBe(1);
  });
});
