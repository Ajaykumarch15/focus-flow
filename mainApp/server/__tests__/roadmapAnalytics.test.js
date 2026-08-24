// @vitest-environment node
// B11 - Basic Roadmap Analytics: server-side aggregation, focused time from
// the existing Task.totalTime, strict user ownership, correct math across the
// required scenarios (empty / active / completed / multiple of everything /
// tracked time).
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
const RA = '507f1f77bcf86cd7994390a1'; // active roadmap "Alpha"
const RB = '507f1f77bcf86cd7994390b2'; // completed roadmap "Beta"
const P1 = '507f1f77bcf86cd7994390c1';
const P2 = '507f1f77bcf86cd7994390c2';

function makeUser(_id) {
  return {
    _id,
    name: 'B11 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B11 - analytics through the API', () => {
  let server;
  let baseUrl;
  let mockUser;
  const captured = { pipelines: [], filters: [] };

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

  // FIFO aggregate stubs mirroring the handler's fixed call order. Queues are
  // created OUTSIDE the mock callbacks so each call consumes the next bucket.
  function stubAggregates({ rmBuckets = [], phaseMsBuckets = [], taskBuckets = [], dayBuckets = [], todayTasks = [], todayMilestones = [], windowedMilestones = [] } = {}) {
    spy(RoadmapPhase, 'aggregate', () => Promise.resolve([]));
    const rmQueue = [rmBuckets, phaseMsBuckets, todayMilestones, windowedMilestones];
    spy(RoadmapMilestone, 'aggregate', (pipeline) => {
      captured.pipelines.push({ model: 'RM', pipeline });
      return Promise.resolve(rmQueue.shift() ?? []);
    });
    const taskQueue = [taskBuckets, dayBuckets, todayTasks];
    spy(Task, 'aggregate', (pipeline) => {
      captured.pipelines.push({ model: 'T', pipeline });
      return Promise.resolve(taskQueue.shift() ?? []);
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b11-test-secret-at-least-32-chars-long!!';
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

  const get = (url) => fetch(`${baseUrl}${url}`, { headers: authHeaders() });

  it('returns an all-zero payload for a user with no roadmaps (and skips aggregation)', async () => {
    spy(Roadmap, 'find', () => ({ sort: () => Promise.resolve([]) }));
    const aggSpies = [
      spy(RoadmapPhase, 'aggregate', () => Promise.resolve([])),
      spy(RoadmapMilestone, 'aggregate', () => Promise.resolve([])),
      spy(Task, 'aggregate', () => Promise.resolve([])),
    ];

    const res = await get('/analytics');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview).toEqual({
      progress: 0, activeRoadmaps: 0, completedMilestones: 0,
      totalMilestones: 0, completedTasks: 0, totalTasks: 0, focusedTimeMs: 0,
    });
    expect(body.roadmaps).toEqual([]);
    aggSpies.forEach(s => expect(s).not.toHaveBeenCalled());
  });

  it('computes multi-roadmap analytics with tracked time, ownership-scoped', async () => {
    // Story: Alpha (active) + Beta (completed), multiple phases/milestones/tasks.
    const roadmaps = [
      { _id: RB, title: 'Beta', status: 'completed', color: '#fff', icon: 'rocket' },
      { _id: RA, title: 'Alpha', status: 'active', color: '#abc', icon: 'book' },
    ];
    spy(Roadmap, 'find', (filter) => {
      captured.filters.push({ model: 'Roadmap', filter });
      return { sort: () => Promise.resolve(roadmaps) };
    });
    spy(RoadmapPhase, 'find', (filter) => {
      captured.filters.push({ model: 'RP.find', filter });
      return Promise.resolve([
        { _id: P1, roadmapId: RA, title: 'Foundations', status: 'completed', order: 0 },
        { _id: P2, roadmapId: RA, title: 'Advanced', status: 'active', order: 1 },
      ]);
    });
    spy(Task, 'find', (filter) => {
      captured.filters.push({ model: 'T.find', filter });
      return {
        sort: () => ({
          limit: () => ({
            select: () => Promise.resolve([
              { title: 'task-late', updatedAt: '2026-08-20T10:00:00Z', roadmapRef: RA },
              { title: 'task-early', updatedAt: '2026-08-01T10:00:00Z', roadmapRef: RA },
            ]),
          }),
        }),
      };
    });
    spy(RoadmapMilestone, 'find', (filter) => {
      captured.filters.push({ model: 'RM.find', filter });
      return {
        sort: () => ({
          limit: () => ({
            select: () => Promise.resolve([
              { title: 'ms-late', updatedAt: '2026-08-19T10:00:00Z', roadmapId: RB },
              { title: 'ms-old', updatedAt: '2026-07-01T10:00:00Z', roadmapId: RA },
            ]),
          }),
        }),
      };
    });

    stubAggregates({
      rmBuckets: [{ _id: RB, total: 2, completed: 2 }, { _id: RA, total: 4, completed: 2 }],
      phaseMsBuckets: [{ _id: P1, total: 2, completed: 2 }, { _id: P2, total: 2, completed: 0 }],
      taskBuckets: [
        { _id: RA, total: 5, completed: 3, focusedTimeMs: 5400000 }, // 3 x 30min focus sessions
        { _id: RB, total: 2, completed: 2, focusedTimeMs: 3600000 },
      ],
      dayBuckets: [{ _id: '2026-08-01', count: 2 }, { _id: '2026-08-02', count: 1 }],
      todayTasks: [{ _id: null, count: 2, roadmapIds: [RA] }],
      todayMilestones: [{ _id: null, count: 1 }],
    });

    const res = await get('/analytics');
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    // Overview matches actual roadmap state across BOTH roadmaps.
    expect(body.overview).toEqual({
      progress: 67,            // 4/6 milestones completed
      activeRoadmaps: 1,       // only Alpha (completed Beta excluded)
      completedMilestones: 4,
      totalMilestones: 6,
      completedTasks: 5,
      totalTasks: 7,
      focusedTimeMs: 9000000,  // 5400000 + 3600000
    });

    // Per-roadmap rows stay independent.
    const alpha = body.roadmaps.find(r => r.title === 'Alpha');
    const beta = body.roadmaps.find(r => r.title === 'Beta');
    expect(alpha.progress).toBe(50);           // 2/4
    expect(alpha.focusedTimeMs).toBe(5400000); // tracked time per roadmap
    expect(alpha.phaseCompleted).toBe(1);
    expect(alpha.taskTotal).toBe(5);
    expect(beta.progress).toBe(100);           // 2/2
    expect(beta.focusedTimeMs).toBe(3600000);

    // Phase stats honor multiple phases with independent rollups.
    expect(body.phases.map(p => p.title)).toEqual(['Foundations', 'Advanced']);
    expect(body.phases[0]).toMatchObject({ progress: 100, milestoneTotal: 2, milestoneCompleted: 2, roadmapTitle: 'Alpha' });
    expect(body.phases[1]).toMatchObject({ progress: 0, milestoneTotal: 2, milestoneCompleted: 0 });

    // Recent activity merges tasks+milestones newest-first.
    expect(body.recentActivity[0]).toMatchObject({ type: 'task', title: 'task-late' });
    expect(body.recentActivity.map(a => a.title)).toEqual([
      'task-late', 'ms-late', 'task-early', 'ms-old',
    ]);

    // Today's stats from aggregated buckets.
    expect(body.today).toEqual({ tasksCompleted: 2, milestonesCompleted: 1, activeRoadmaps: 1 });

    // Unwindowed activity reports totals; activeDays = distinct day buckets.
    expect(body.activity.activeDays).toBe(2);

    // OWNERSHIP: every aggregation and find is scoped to the auth user.
    for (const { pipeline } of captured.pipelines) {
      expect(pipeline[0].$match.userId).toBeDefined();
    }
    for (const { filter } of captured.filters) {
      expect(filter.userId ?? filter.$match?.userId ?? true).toBeDefined();
      if ('userId' in filter) expect(String(filter.userId)).toBe(USER_A);
    }
    // Aggregation $in lists derive ONLY from the user's own roadmaps.
    const rmMatch = captured.pipelines.find(p => p.model === 'RM')?.pipeline?.[0]?.$match;
    expect(String(rmMatch.roadmapId.$in[0]) === RB || String(rmMatch.roadmapId.$in[1]) === RA).toBe(true);
  });

  it('?days=N windows activity counts server-side without touching totals', async () => {
    const roadmaps = [{ _id: RA, title: 'Alpha', status: 'active', color: '#abc', icon: 'book' }];
    spy(Roadmap, 'find', () => ({ sort: () => Promise.resolve(roadmaps) }));
    spy(RoadmapPhase, 'find', () => Promise.resolve([]));
    spy(RoadmapMilestone, 'find', () => ({
      sort: () => ({ limit: () => ({ select: () => Promise.resolve([]) }) }),
    }));
    spy(Task, 'find', () => ({
      sort: () => ({ limit: () => ({ select: () => Promise.resolve([]) }) }),
    }));

    let daysWindowApplied = false;
    spy(RoadmapMilestone, 'aggregate', (pipeline) => {
      if (pipeline[1]?.$group?._id === '$roadmapId') return Promise.resolve([{ _id: RA, total: 4, completed: 2 }]);
      if (pipeline[1]?.$group?._id === '$phaseId') return Promise.resolve([]);
      if (pipeline[0].$match.updatedAt && !pipeline[0].$match.roadmapId) return Promise.resolve([]); // today
      daysWindowApplied = !!pipeline[0].$match.updatedAt?.$gte;
      return Promise.resolve([{ _id: null, count: 1 }]); // windowed milestone completions
    });
    spy(Task, 'aggregate', (pipeline) => {
      const group = pipeline[1]?.$group;
      if (group?._id === '$roadmapRef') return Promise.resolve([{ _id: RA, total: 5, completed: 3, focusedTimeMs: 5400000 }]);
      if (group && group._id && typeof group._id === 'object' && group._id.$dateToString) {
        daysWindowApplied = !!pipeline[0].$match.updatedAt?.$gte;
        return Promise.resolve([{ _id: '2026-08-01', count: 3 }]);
      }
      return Promise.resolve([{ _id: null, count: 0, roadmapIds: [] }]);
    });

    const res = await get('/analytics?days=30');
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    expect(daysWindowApplied).toBe(true);
    expect(body.overview.completedTasks).toBe(3);   // totals unaffected by window
    expect(body.overview.totalTasks).toBe(5);
    expect(body.activity.activeDays).toBe(1);       // one distinct day bucket
    expect(body.activity.completedTasks).toBe(3);   // windowed sum of bucket counts
    expect(body.activity.completedMilestones).toBe(1); // windowed via its own aggregate
  });
});
