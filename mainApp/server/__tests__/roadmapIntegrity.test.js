// @vitest-environment node
// B2 (Basic Roadmap V1): data-model stabilization — CRUD + ownership boundaries
// for the Roadmap → Phase → Milestone → Task link layer.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const Roadmap = require('../models/Roadmap');
const RoadmapPhase = require('../models/RoadmapPhase');
const RoadmapMilestone = require('../models/RoadmapMilestone');
const tasksRouter = require('../routes/tasks');
const roadmapsRouter = require('../routes/personalRoadmaps');

const USER_A = '5f00000000000000000000a1';
const USER_B = '5f00000000000000000000b2';
const ROADMAP_ID = '507f1f77bcf86cd7994390a1';
const OTHER_ROADMAP_ID = '507f1f77bcf86cd7994390a2';
const PHASE_ID = '507f1f77bcf86cd7994390b1';
const OTHER_PHASE_ID = '507f1f77bcf86cd7994390b2';
const MILESTONE_ID = '507f1f77bcf86cd7994390c1';

function makeUser(_id) {
  return {
    _id,
    name: 'B2 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B2 · roadmap data-layer integrity', () => {
  let tasksServer;
  let roadmapsServer;
  let tasksBaseUrl;
  let roadmapsBaseUrl;
  let mockUser;

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function authHeaders() {
    return { authorization: `Bearer ${signToken()}`, 'content-type': 'application/json' };
  }

  async function startApp(router, mountPath) {
    const app = express();
    app.use(express.json());
    app.use(mountPath, router);
    // Mirror the production global error handler so zod/http errors come back
    // as JSON instead of Express's default HTML error page.
    app.use((err, _req, res, _next) => {
      res.status(err.status || err.statusCode || 500).json({ message: err.message });
    });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    // Include the mount path so callers can append route segments directly.
    return { server, baseUrl: `http://127.0.0.1:${server.address().port}${mountPath}` };
  }

  // taskCreateSchema requires every base field explicitly (no defaults), so
  // request bodies must ship a complete valid payload.
  const taskBody = (extra = {}) => ({
    title: 'T',
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Work',
    color: '#0ea5e9',
    tags: [],
    subtasks: [],
    ...extra,
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b2-test-secret-at-least-32-chars-long!!';
    mockUser = makeUser(USER_A);

    vi.spyOn(User, 'findById').mockImplementation((id) => ({
      select: () => Promise.resolve(String(id) === String(mockUser._id) ? mockUser : null),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());

    ({ server: tasksServer, baseUrl: tasksBaseUrl } = await startApp(tasksRouter, '/api/tasks'));
    ({ server: roadmapsServer, baseUrl: roadmapsBaseUrl } = await startApp(roadmapsRouter, '/api/roadmaps'));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await Promise.all([
      new Promise((resolve) => tasksServer.close(resolve)),
      new Promise((resolve) => roadmapsServer.close(resolve)),
    ]);
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function mockFindOne(model, impl) {
    vi.spyOn(model, 'findOne').mockImplementation(impl);
  }

  function post(url, body, headers = authHeaders()) {
    return fetch(`${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  const ownedChain = () => ({
    roadmapRef: ROADMAP_ID,
    phaseRef: PHASE_ID,
    milestoneRef: MILESTONE_ID,
  });

  // ── POST /api/tasks · roadmap-link validation ──────────────────────────────

  describe('POST /api/tasks rejects invalid roadmap links', () => {
    it('404s a roadmap owned by another user and never creates the task', async () => {
      mockFindOne(Roadmap, () => Promise.resolve(null)); // roadmap belongs to someone else
      const createSpy = vi.spyOn(Task, 'create');

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), ...ownedChain() });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: 'Roadmap not found' });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('404s a phase owned by another user', async () => {
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () => Promise.resolve(null));
      const createSpy = vi.spyOn(Task, 'create');

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), ...ownedChain() });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: 'Phase not found' });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('404s a milestone owned by another user', async () => {
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () => Promise.resolve({ _id: PHASE_ID, roadmapId: ROADMAP_ID }));
      mockFindOne(RoadmapMilestone, () => Promise.resolve(null));
      const createSpy = vi.spyOn(Task, 'create');

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), ...ownedChain() });
      expect(res.status).toBe(404);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('400s when the phase belongs to a different roadmap', async () => {
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () =>
        Promise.resolve({ _id: PHASE_ID, roadmapId: OTHER_ROADMAP_ID }),
      );
      const createSpy = vi.spyOn(Task, 'create');

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), ...ownedChain() });
      expect(res.status).toBe(400);
      expect((await res.json()).message).toMatch(/Phase does not belong/i);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('400s when the milestone belongs to a different phase', async () => {
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () => Promise.resolve({ _id: PHASE_ID, roadmapId: ROADMAP_ID }));
      mockFindOne(RoadmapMilestone, () =>
        Promise.resolve({ _id: MILESTONE_ID, phaseId: OTHER_PHASE_ID, roadmapId: ROADMAP_ID }),
      );
      const createSpy = vi.spyOn(Task, 'create');

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), ...ownedChain() });
      expect(res.status).toBe(400);
      expect((await res.json()).message).toMatch(/Milestone does not belong/i);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('rejects malformed ids at the zod boundary (400, no task created)', async () => {
      const createSpy = vi.spyOn(Task, 'create');

      const res = await post(`${tasksBaseUrl}`, taskBody({ roadmapRef: 'not-an-objectid' }));
      expect(res.status).toBe(400);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('accepts a fully consistent owned chain and passes refs through', async () => {
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () => Promise.resolve({ _id: PHASE_ID, roadmapId: ROADMAP_ID }));
      mockFindOne(RoadmapMilestone, () =>
        Promise.resolve({ _id: MILESTONE_ID, phaseId: PHASE_ID, roadmapId: ROADMAP_ID }),
      );
      const created = { _id: '507f1f77bcf86cd7994390ff', title: 'T', totalTime: 0 };
      const createSpy = vi.spyOn(Task, 'create').mockResolvedValue(created);

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), ...ownedChain() });
      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          roadmapRef: ROADMAP_ID,
          phaseRef: PHASE_ID,
          milestoneRef: MILESTONE_ID,
        }),
      );
    });

    it('allows partial links (e.g. roadmap-only) when consistent', async () => {
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      const createSpy = vi.spyOn(Task, 'create').mockResolvedValue({ _id: 'x', title: 'T' });

      const res = await post(`${tasksBaseUrl}`, { ...taskBody(), roadmapRef: ROADMAP_ID });
      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ roadmapRef: ROADMAP_ID }));
    });

    it('skips all link checks when no refs are provided', async () => {
      const roadmapSpy = vi.spyOn(Roadmap, 'findOne').mockClear();
      const createSpy = vi.spyOn(Task, 'create').mockResolvedValue({ _id: 'y', title: 'T' });

      const res = await post(`${tasksBaseUrl}`, { ...taskBody() });
      expect(res.status).toBe(201);
      expect(roadmapSpy).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalled();
    });
  });

  // ── POST /api/roadmaps/link-task · chain ownership (regression lock-in) ────

  describe('POST /api/roadmaps/link-task ownership boundaries', () => {
    const linkBody = () => ({
      taskId: '507f1f77bcf86cd799439033',
      roadmapId: ROADMAP_ID,
      phaseId: PHASE_ID,
      milestoneId: MILESTONE_ID,
    });

    it('refuses to link against another user\'s roadmap', async () => {
      mockFindOne(Task, () => Promise.resolve({ _id: linkBody().taskId, userId: USER_A }));
      mockFindOne(Roadmap, () => Promise.resolve(null));

      const res = await post(`${roadmapsBaseUrl}/link-task`, linkBody());
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: 'Roadmap not found' });
    });

    it('refuses to link against another user\'s phase even when ids line up', async () => {
      mockFindOne(Task, () => Promise.resolve({ _id: linkBody().taskId, userId: USER_A }));
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () => Promise.resolve(null)); // phase owned by USER_B

      const res = await post(`${roadmapsBaseUrl}/link-task`, linkBody());
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: 'Phase not found' });
    });

    it('links atomically across the full owned chain', async () => {
      mockFindOne(Task, () => Promise.resolve({ _id: linkBody().taskId, userId: USER_A }));
      mockFindOne(Roadmap, () => Promise.resolve({ _id: ROADMAP_ID, userId: USER_A }));
      mockFindOne(RoadmapPhase, () => Promise.resolve({ _id: PHASE_ID, roadmapId: ROADMAP_ID }));
      mockFindOne(RoadmapMilestone, () =>
        Promise.resolve({ _id: MILESTONE_ID, phaseId: PHASE_ID, roadmapId: ROADMAP_ID }),
      );
      const updateSpy = vi
        .spyOn(Task, 'findByIdAndUpdate')
        .mockResolvedValue({ _id: linkBody().taskId });

      const res = await post(`${roadmapsBaseUrl}/link-task`, linkBody());
      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        linkBody().taskId,
        expect.objectContaining({
          $set: {
            roadmapRef: ROADMAP_ID,
            phaseRef: PHASE_ID,
            milestoneRef: MILESTONE_ID,
          },
        }),
        expect.anything(),
      );
    });
  });

  // ── Model-level referential guards ────────────────────────────────────────

  describe('model pre-validate guards', () => {
    it('RoadmapMilestone rejects a phase from a different roadmap', async () => {
      vi.spyOn(RoadmapPhase, 'findById').mockReturnValue({
        select: () => Promise.resolve({ _id: PHASE_ID, roadmapId: OTHER_ROADMAP_ID }),
      });

      const ms = new RoadmapMilestone({
        userId: USER_A,
        roadmapId: ROADMAP_ID,
        phaseId: PHASE_ID,
        title: 'M',
      });
      await expect(ms.validate()).rejects.toThrow(/does not belong/i);
    });

    it('RoadmapMilestone accepts a consistent phase reference', async () => {
      vi.spyOn(RoadmapPhase, 'findById').mockReturnValue({
        select: () => Promise.resolve({ _id: PHASE_ID, roadmapId: ROADMAP_ID }),
      });

      const ms = new RoadmapMilestone({
        userId: USER_A,
        roadmapId: ROADMAP_ID,
        phaseId: PHASE_ID,
        title: 'M',
      });
      await expect(ms.validate()).resolves.toBeUndefined();
    });

    it('RoadmapMilestone skips the guard on status-only saves (cascade path)', async () => {
      const spy = vi.spyOn(RoadmapPhase, 'findById').mockClear();

      // hydrate simulates a document loaded from the DB: no path is "modified"
      // until we touch it — exactly how cascadeTaskStatusChange saves milestones.
      const ms = RoadmapMilestone.hydrate({
        _id: MILESTONE_ID,
        userId: USER_A,
        roadmapId: ROADMAP_ID,
        phaseId: PHASE_ID,
        title: 'M',
        status: 'in-progress',
      });

      ms.status = 'completed';
      await expect(ms.validate()).resolves.toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });

    it('RoadmapPhase rejects a non-existent roadmap', async () => {
      vi.spyOn(Roadmap, 'findById').mockReturnValue({
        select: () => Promise.resolve(null),
      });

      const phase = new RoadmapPhase({ userId: USER_A, roadmapId: ROADMAP_ID, title: 'P' });
      await expect(phase.validate()).rejects.toThrow(/Roadmap does not exist/i);
    });

    it('RoadmapPhase accepts an existing roadmap and skips guard when unchanged', async () => {
      vi.spyOn(Roadmap, 'findById').mockReturnValue({
        select: () => Promise.resolve({ _id: ROADMAP_ID }),
      });

      const phase = new RoadmapPhase({ userId: USER_A, roadmapId: ROADMAP_ID, title: 'P' });
      await expect(phase.validate()).resolves.toBeUndefined();

      const spy = vi.spyOn(Roadmap, 'findById').mockClear();
      const loaded = RoadmapPhase.hydrate({
        _id: PHASE_ID,
        userId: USER_A,
        roadmapId: ROADMAP_ID,
        title: 'P',
        status: 'upcoming',
      });
      loaded.status = 'active';
      await expect(loaded.validate()).resolves.toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── Schema field inventory (V1 target structure) ──────────────────────────

  describe('schema shape matches V1 target', () => {
    it('Roadmap has exactly the V1 fields', () => {
      const paths = Object.keys(Roadmap.schema.paths);
      for (const field of [
        'userId', 'title', 'description', 'type', 'status',
        'icon', 'color', 'startDate', 'targetDate', 'createdAt', 'updatedAt',
      ]) {
        expect(paths).toContain(field);
      }
    });

    it('RoadmapPhase has exactly the V1 fields', () => {
      const paths = Object.keys(RoadmapPhase.schema.paths);
      for (const field of [
        'userId', 'roadmapId', 'title', 'description', 'order', 'status',
        'startDate', 'targetDate', 'createdAt', 'updatedAt',
      ]) {
        expect(paths).toContain(field);
      }
    });

    it('RoadmapMilestone has exactly the V1 fields', () => {
      const paths = Object.keys(RoadmapMilestone.schema.paths);
      for (const field of [
        'userId', 'roadmapId', 'phaseId', 'title', 'description', 'order',
        'status', 'targetDate', 'createdAt', 'updatedAt',
      ]) {
        expect(paths).toContain(field);
      }
    });

    it('milestone.phaseId is required (no orphan milestones)', () => {
      expect(RoadmapMilestone.schema.path('phaseId').isRequired).toBe(true);
    });

    it('Task keeps optional denormalized roadmap refs (no RoadmapTask model)', () => {
      const paths = Task.schema.paths;
      expect(paths.roadmapRef.options.ref).toBe('Roadmap');
      expect(paths.phaseRef.options.ref).toBe('RoadmapPhase');
      expect(paths.milestoneRef.options.ref).toBe('RoadmapMilestone');
      expect(Object.keys(Task.schema.indexes().map(([, opts]) => opts))).toBeDefined();
      const indexKeys = Task.schema.indexes().map(([spec]) => JSON.stringify(spec));
      expect(indexKeys).toContain(JSON.stringify({ userId: 1, phaseRef: 1 }));
    });
  });
});
