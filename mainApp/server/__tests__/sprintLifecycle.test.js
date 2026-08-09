// @vitest-environment node
// EEP2-P4.1.1/P4.1.2/P4.1.3/P4.1.4 · Sprint lifecycle (DDS §4.11, §6.1, §10).
//
//  • P4.1.1  model: status vocabulary draft|planned|active|completed + the
//           committed/commitmentDate/committedBy fields.
//  • P4.1.2  API: create/update carry goals/capacity/dates; editor gate on
//           create; date + numeric validation.
//  • P4.1.3  API: the lifecycle state machine (no skipping), startDate guard,
//           and a `sprint.state_changed` Activity on every transition.
//  • P4.1.4  API: the Owner/Admin commit endpoint; the commitment is a one-way
//           latch (idempotent) and the committed scope is frozen.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Sprint = require('../models/Sprint');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Activity = require('../models/Activity');
const sprintRouter = require('../routes/sprints');
const {
  SPRINT_STATUSES,
  TRANSITIONS,
  isSprintStatus,
  nextStatuses,
  canTransition,
  assertTransition,
} = require('../utils/sprintState');

const SECRET = 'r1-p4-sprint-lifecycle-test-secret-32c';
const OWNER_ID = '5f0000000000000000000d01';
const ADMIN_ID = '5f0000000000000000000d02';
const DEV_ID = '5f0000000000000000000d03';
const VIEWER_ID = '5f0000000000000000000d04';
const OUTSIDER_ID = '5f0000000000000000000d05';
const WS_ID = '5f0000000000000000000d10';
const PROJECT_ID = '5f0000000000000000000d11';
const SPRINT_ID = '5f0000000000000000000d12';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function user(id, role = 'user') {
  return { _id: id, name: 'User', email: 'user@focusflow.io', role, tokenVersion: 0, deletedAt: null };
}

function mockUser(u) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve(u) }));
}

function member(userId, role) {
  return { userId, role };
}

function projectDoc() {
  return { _id: PROJECT_ID, name: 'Core Platform', workspaceRef: WS_ID };
}

function mockWorkspace(members) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: WS_ID, members }),
  }));
}

function sprintDoc(over = {}) {
  return {
    _id: SPRINT_ID,
    projectRef: PROJECT_ID,
    workspaceRef: WS_ID,
    name: 'Sprint 1',
    goal: 'Ship',
    startDate: new Date('2026-01-05T00:00:00.000Z'),
    endDate: new Date('2026-01-19T00:00:00.000Z'),
    status: 'draft',
    committed: false,
    commitmentDate: null,
    committedBy: null,
    createdBy: OWNER_ID,
    ...over,
  };
}

const ALL_MEMBERS = [
  member(OWNER_ID, 'Owner'),
  member(ADMIN_ID, 'Admin'),
  member(DEV_ID, 'Developer'),
  member(VIEWER_ID, 'Viewer'),
];

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use('/api/sprints', sprintRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// ── P4.1.3 · state machine (pure) ──────────────────────────────────────────────
describe('EEP2-P4.1.3 · sprint lifecycle state machine', () => {
  it('owns the full status vocabulary draft|planned|active|completed', () => {
    expect(SPRINT_STATUSES).toEqual(['draft', 'planned', 'active', 'completed']);
    for (const s of SPRINT_STATUSES) expect(isSprintStatus(s)).toBe(true);
    expect(isSprintStatus('future')).toBe(false);
    expect(isSprintStatus('nope')).toBe(false);
  });

  it('allows exactly the forward chain plus completed → active reopen', () => {
    expect(TRANSITIONS).toEqual({
      draft: ['planned'],
      planned: ['active'],
      active: ['completed'],
      completed: ['active'],
    });
    expect(canTransition('draft', 'planned')).toBe(true);
    expect(canTransition('planned', 'active')).toBe(true);
    expect(canTransition('active', 'completed')).toBe(true);
    expect(canTransition('completed', 'active')).toBe(true);
  });

  it('forbids skipping states (no draft → active / planned → completed)', () => {
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('draft', 'completed')).toBe(false);
    expect(canTransition('planned', 'completed')).toBe(false);
    expect(canTransition('active', 'draft')).toBe(false);
    expect(canTransition('completed', 'draft')).toBe(false);
    expect(canTransition('completed', 'completed')).toBe(false);
  });

  it('assertTransition returns {from,to} on a legal move and rejects skips with 400', () => {
    expect(assertTransition('draft', 'planned')).toEqual({ from: 'draft', to: 'planned' });
    expect(() => assertTransition('draft', 'active')).toThrow(/cannot skip states/);
    expect(() => assertTransition('planned', 'completed')).toThrow(/cannot skip states/);
    expect(() => assertTransition('draft', 'bogus')).toThrow(/Unknown sprint status/);
    expect(() => assertTransition('bogus', 'draft')).toThrow(/Unknown sprint status/);
  });

  it('guards planned → active on startDate (now >= startDate)', () => {
    const now = new Date('2026-01-10T00:00:00.000Z').getTime();
    expect(assertTransition('planned', 'active', { now, startDate: new Date('2026-01-05T00:00:00.000Z') })).toEqual({
      from: 'planned',
      to: 'active',
    });
    expect(() =>
      assertTransition('planned', 'active', { now, startDate: new Date('2099-01-05T00:00:00.000Z') })
    ).toThrow(/cannot start before its startDate/);
  });

  it('nextStatuses returns the reachable states for a status', () => {
    expect(nextStatuses('draft')).toEqual(['planned']);
    expect(nextStatuses('completed')).toEqual(['active']);
    expect(nextStatuses('bogus')).toEqual([]);
  });
});

// ── P4.1.2 · create default + validation ───────────────────────────────────────
describe('EEP2-P4.1.2 · create/update sprint (goals, capacity, dates)', () => {
  const createBody = {
    projectId: PROJECT_ID,
    name: 'Sprint 2',
    startDate: '2026-02-01T00:00:00.000Z',
    endDate: '2026-02-14T00:00:00.000Z',
    goal: 'Launch',
    capacityHours: 80,
    targetVelocity: 20,
  };

  it('creates a sprint in draft with an editor gate (Developer yes, Viewer no)', async () => {
    mockUser(user(DEV_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    let created;
    vi.spyOn(Sprint, 'create').mockImplementation(async (data) => {
      created = data;
      return { _id: SPRINT_ID, ...data };
    });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify(createBody),
    });
    expect(res.status).toBe(201);
    expect(created.status).toBe('draft');

    mockUser(user(VIEWER_ID));
    const viewer = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(VIEWER_ID) },
      body: JSON.stringify(createBody),
    });
    expect(viewer.status).toBe(403);
  });

  it('rejects a negative capacityHours with 400 before the DB write', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    const create = vi.spyOn(Sprint, 'create');

    const res = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ ...createBody, capacityHours: -10 }),
    });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an unknown status in PATCH with 400 (schema enum)', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ status: 'future' }),
    });
    expect(res.status).toBe(400);
  });
});

// ── P4.1.3 · PATCH status transitions ──────────────────────────────────────────
describe('EEP2-P4.1.3 · PATCH status transitions (no skip + Activity)', () => {
  async function patchStatus(from, to, over = {}) {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc({ status: from, ...over }));
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi
      .spyOn(Sprint, 'findByIdAndUpdate')
      .mockResolvedValue(sprintDoc({ status: to }));
    const activity = vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ status: to }),
    });
    return { res, findByIdAndUpdate, activity };
  }

  it('walks the forward chain draft→planned→active→completed', async () => {
    for (const [from, to] of [
      ['draft', 'planned'],
      ['planned', 'active'],
      ['active', 'completed'],
    ]) {
      const { res, findByIdAndUpdate, activity } = await patchStatus(from, to);
      expect(res.status).toBe(200);
      expect(findByIdAndUpdate).toHaveBeenCalledWith(SPRINT_ID, { $set: { status: to } }, expect.anything());
      expect(activity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sprint.state_changed',
          details: expect.objectContaining({ from, to }),
        })
      );
    }
  });

  it('allows completed → active reopen', async () => {
    const { res } = await patchStatus('completed', 'active');
    expect(res.status).toBe(200);
  });

  it('rejects skipped states (draft → active, planned → completed) with 400', async () => {
    for (const [from, to] of [
      ['draft', 'active'],
      ['planned', 'completed'],
    ]) {
      const { res, findByIdAndUpdate, activity } = await patchStatus(from, to);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain('cannot skip states');
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
      expect(activity).not.toHaveBeenCalled();
    }
  });

  it('guards planned → active on startDate', async () => {
    const { res } = await patchStatus('planned', 'active', { startDate: new Date('2099-01-05T00:00:00.000Z') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('cannot start before its startDate');
  });

  it('writes sprint.updated (not state_changed) for a non-status edit', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findByIdAndUpdate').mockResolvedValue(sprintDoc({ goal: 'Ship v2' }));
    const activity = vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ goal: 'Ship v2' }),
    });
    expect(res.status).toBe(200);
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({ action: 'sprint.updated' }));
  });
});

// ── P4.1.4 · commitment endpoint ───────────────────────────────────────────────
describe('EEP2-P4.1.4 · POST /api/sprints/:id/commit (Owner/Admin, immutable)', () => {
  it('commits a draft sprint: latches committed + commitmentDate, advances to planned', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc({ status: 'draft' }));
    mockWorkspace(ALL_MEMBERS);
    let update;
    vi.spyOn(Sprint, 'findByIdAndUpdate').mockImplementation(async (id, body) => {
      update = body;
      return sprintDoc({ status: 'planned', committed: true, commitmentDate: new Date(), committedBy: OWNER_ID });
    });
    const activity = vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}/commit`, {
      method: 'POST',
      headers: { Cookie: cookie(OWNER_ID) },
    });
    expect(res.status).toBe(200);
    expect(update.$set).toMatchObject({
      committed: true,
      committedBy: OWNER_ID,
      status: 'planned',
    });
    expect(update.$set.commitmentDate).toBeInstanceOf(Date);
    const body = await res.json();
    expect(body.committed).toBe(true);
    expect(body.status).toBe('planned');
    expect(activity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sprint.committed' })
    );
  });

  it('lets an Admin commit but forbids Developer/Viewer/non-member', async () => {
    mockUser(user(ADMIN_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc({ status: 'draft' }));
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate').mockResolvedValue(sprintDoc());
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const admin = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}/commit`, {
      method: 'POST',
      headers: { Cookie: cookie(ADMIN_ID) },
    });
    expect(admin.status).toBe(200);

    for (const id of [DEV_ID, VIEWER_ID]) {
      mockUser(user(id));
      const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}/commit`, {
        method: 'POST',
        headers: { Cookie: cookie(id) },
      });
      expect(res.status).toBe(403);
    }
    mockUser(user(OUTSIDER_ID));
    const outsider = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}/commit`, {
      method: 'POST',
      headers: { Cookie: cookie(OUTSIDER_ID) },
    });
    expect(outsider.status).toBe(403);
    expect(findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a second commit never rewrites the original commitmentDate', async () => {
    const originalCommitment = new Date('2026-01-05T00:00:00.000Z');
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(
      sprintDoc({ status: 'active', committed: true, commitmentDate: originalCommitment, committedBy: OWNER_ID })
    );
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}/commit`, {
      method: 'POST',
      headers: { Cookie: cookie(OWNER_ID) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commitmentDate).toBe(originalCommitment.toISOString());
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('404s when the sprint does not exist', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}/commit`, {
      method: 'POST',
      headers: { Cookie: cookie(OWNER_ID) },
    });
    expect(res.status).toBe(404);
  });
});

// ── P4.1.4 · committed scope is frozen ─────────────────────────────────────────
describe('EEP2-P4.1.4 · immutability after commit', () => {
  it('rejects PATCH of committed/commitmentDate/committedBy with 400', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc({ status: 'draft' }));
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ committed: false, commitmentDate: '2026-01-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(400);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects scope edits (goal/capacity/dates/name) on a committed sprint with 409', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc({ status: 'planned', committed: true }));
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate');

    for (const patch of [{ goal: 'new' }, { capacityHours: 200 }, { startDate: '2026-03-01T00:00:00.000Z' }, { name: 'X' }]) {
      const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
        body: JSON.stringify(patch),
      });
      expect(res.status).toBe(409);
    }
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('still allows lifecycle status transitions on a committed sprint', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc({ status: 'planned', committed: true }));
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi
      .spyOn(Sprint, 'findByIdAndUpdate')
      .mockResolvedValue(sprintDoc({ status: 'active', committed: true }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(200);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(SPRINT_ID, { $set: { status: 'active' } }, expect.anything());
  });
});
