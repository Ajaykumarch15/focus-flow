// @vitest-environment node
// B7 - Progress Engine: centralized math + full completion lifecycle.
// Verifies: 0% -> partial -> 50% -> 100% -> reopen (progress decreases),
// explicit empty states, and that every roadmap response derives progress
// from live task/milestone state (never stored, never stale).
import { describe, it, expect } from 'vitest';

describe('B7 - pct() core math', () => {
  it('computes unweighted ratios and clamps to 0..100', () => {
    expect(pct(0, 4)).toBe(0);
    expect(pct(1, 4)).toBe(25);
    expect(pct(2, 4)).toBe(50);
    expect(pct(3, 5)).toBe(60);
    expect(pct(4, 4)).toBe(100);
    expect(pct(-2, 4)).toBe(0); // clamp low
    expect(pct(9, 4)).toBe(100); // clamp high
  });

  it('returns null for empty denominators (explicit no-data state)', () => {
    expect(pct(0, 0)).toBe(null);
    expect(pct(5, 0)).toBe(null);
    expect(pct(3, NaN)).toBe(null);
    expect(pct(3, undefined)).toBe(null);
    // Never fabricates a misleading value:
    expect(pct(0, 0)).not.toBe(100);
  });

  it('hierarchy helpers map to pct and serialize keeps numeric contract', () => {
    expect(milestoneProgress(1, 2)).toBe(50);
    expect(phaseProgress(1, 3)).toBe(33);
    expect(roadmapProgress(2, 2)).toBe(100);
    expect(serializeProgress(null)).toEqual({ progress: 0, progressEmpty: true });
    expect(serializeProgress(50)).toEqual({ progress: 50, progressEmpty: false });
  });
});

// -- LIFECYCLE through the real API ---------------------------------------
// One roadmap -> one phase -> one milestone. The shared taskStore mutates
// between GETs to simulate link / complete / reopen / unlink. Milestone
// status mirrors its tasks exactly like the cascade engine does, so phase
// and roadmap rollups can be asserted too.
import http from 'node:http';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { pct, milestoneProgress, phaseProgress, roadmapProgress, serializeProgress } =
  require('../utils/roadmapProgress');
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
const ROADMAP_ID = '507f1f77bcf86cd7994390a1';
const PHASE_ID = '507f1f77bcf86cd7994390b1';
const MILESTONE_ID = '507f1f77bcf86cd7994390c1';
const T1 = '507f1f77bcf86cd7994390d1';
const T2 = '507f1f77bcf86cd7994390d2';

function makeUser(_id) {
  return {
    _id,
    name: 'B7 Tester',
    email: `${_id.slice(-6)}@example.com`,
    settings: { timezone: 'UTC', dailyGoal: 8 },
    streak: { current: 0, best: 0, lastDate: null },
    totalPoints: 0,
    tokenVersion: 0,
  };
}

describe('B7 - progress lifecycle through the API', () => {
  let server;
  let baseUrl;
  let mockUser;
  // Live linked-task store mutated by each scenario step.
  let taskStore;

  const taskDoc = (id, status, linked = true) => ({
    _id: id,
    userId: USER_A,
    title: `task-${id.slice(-2)}`,
    status,
    priority: 'medium',
    totalTime: 0,
    sessions: [],
    subtasks: [],
    tags: [],
    deadline: null,
    roadmapRef: linked ? ROADMAP_ID : null,
    phaseRef: linked ? PHASE_ID : null,
    milestoneRef: linked ? MILESTONE_ID : null,
  });

  // Cascade semantics: a milestone is completed iff it has tasks and all are done.
  const milestoneStatus = () =>
    taskStore.length > 0 && taskStore.every(t => t.status === 'completed') ? 'completed' : 'in-progress';

  const milestoneDoc = () => ({
    _id: MILESTONE_ID,
    roadmapId: ROADMAP_ID,
    phaseId: PHASE_ID,
    userId: USER_A,
    title: 'Chapter 1',
    order: 0,
    get status() { return milestoneStatus(); },
    toObject() { const { status, ...rest } = this; return { ...rest, status }; },
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'b7-test-secret-at-least-32-chars-long!!';
    mockUser = makeUser(USER_A);

    vi.spyOn(User, 'findById').mockImplementation((id) => ({
      select: () => Promise.resolve(String(id) === String(mockUser._id) ? mockUser : null),
    }));
    vi.spyOn(Activity, 'create').mockResolvedValue();

    vi.spyOn(Roadmap, 'findOne').mockImplementation(() =>
      Promise.resolve({
        _id: ROADMAP_ID, userId: USER_A, title: 'Learn Systems', type: 'learning', status: 'active',
        toObject() { const { ...rest } = this; delete rest.toObject; return rest; },
      }));

    vi.spyOn(RoadmapPhase, 'find').mockImplementation(() => ({
      sort: () => Promise.resolve([{
        _id: PHASE_ID, roadmapId: ROADMAP_ID, userId: USER_A,
        title: 'Foundations', order: 0, status: 'active',
        toObject() { const { ...rest } = this; delete rest.toObject; return rest; },
      }]),
    }));

    // Milestone list route chains .sort(); detail route gets a bare promise.
    vi.spyOn(RoadmapMilestone, 'find').mockImplementation((filter) => {
      const docs = [milestoneDoc()].filter(m => !filter || !filter.phaseId || true);
      return {
        sort: () => Promise.resolve(docs),
      };
    });

    // Detail route: Task.find({roadmapRef, userId}) -> plain array.
    // Available-tasks route: Task.find({userId, milestoneRef:null,...}) -> .select().sort().limit()
    vi.spyOn(Task, 'find').mockImplementation((filter) => {
      if (filter && filter.roadmapRef) return Promise.resolve(taskStore);
      return {
        select: () => ({
          sort: () => ({ limit: () => Promise.resolve(taskStore.filter(t => !t.milestoneRef && t.status !== 'completed')) }),
        }),
      };
    });

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

  function signToken() {
    return jwt.sign({ id: mockUser._id.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  const getDetail = async () => {
    const res = await fetch(`${baseUrl}/${ROADMAP_ID}`, {
      headers: { authorization: `Bearer ${signToken()}`, 'content-type': 'application/json' },
    });
    expect(res.status).toBe(200);
    return res.json();
  };

  it('walks 0% -> partial -> 50% -> 100% -> reopen with correct decrease', async () => {
    // 1) Milestone exists, nothing linked -> explicit empty AT TASK LEVEL,
    //    never misleading. Roadmap/phase are NOT empty: they have a milestone
    //    (their own denominator), and honestly report 0% of it done.
    taskStore = [];
    let d = await getDetail();
    expect(d.milestones[0].progressEmpty).toBe(true);
    expect(d.milestones[0].progress).toBe(0);
    expect(d.milestones[0].totalTasks).toBe(0);
    expect(d.progressEmpty).toBe(false); // has a milestone -> real measured %
    expect(d.progress).toBe(0);
    expect(d.phases[0].progressEmpty).toBe(false); // phase HAS milestones

    // 2) Link two todo tasks -> measured, real 0%.
    taskStore = [taskDoc(T1, 'todo'), taskDoc(T2, 'todo')];
    d = await getDetail();
    expect(d.progressEmpty).toBeFalsy();
    expect(d.milestones[0].progressEmpty).toBeFalsy();
    expect(d.milestones[0].progress).toBe(0);
    expect(d.milestones[0].completedTasks).toBe(0);
    expect(d.milestones[0].totalTasks).toBe(2);
    expect(d.phases[0].progress).toBe(0); // phase counts milestones, not tasks
    expect(d.progress).toBe(0);

    // 3) Complete one of two -> exactly 50%.
    taskStore[1].status = 'completed';
    d = await getDetail();
    expect(d.milestones[0].progress).toBe(50);
    expect(d.milestones[0].completedTasks).toBe(1);
    // milestone not yet complete -> phase & roadmap stay at 0
    expect(d.phases[0].progress).toBe(0);
    expect(d.progress).toBe(0);

    // 4) Complete both -> milestone completes -> phase & roadmap hit 100%.
    taskStore[0].status = 'completed';
    d = await getDetail();
    expect(d.milestones[0].progress).toBe(100);
    expect(d.milestones[0].status).toBe('completed'); // cascade reflected
    expect(d.phases[0].progress).toBe(100);
    expect(d.progress).toBe(100);

    // 5) Reopen one task -> milestone reopens, ALL levels decrease correctly.
    taskStore[1].status = 'todo';
    d = await getDetail();
    expect(d.milestones[0].status).toBe('in-progress');
    expect(d.milestones[0].progress).toBe(50);
    expect(d.phases[0].progress).toBe(0);
    expect(d.progress).toBe(0);

    // 6) Unlink everything -> explicit empty state again.
    taskStore.forEach(t => { t.milestoneRef = null; t.phaseRef = null; t.roadmapRef = null; });
    d = await getDetail();
    expect(d.milestones[0].progressEmpty).toBe(true);
    expect(d.milestones[0].progress).toBe(0);
  });
});
