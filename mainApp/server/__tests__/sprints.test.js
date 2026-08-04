// @vitest-environment node
// IES-R1 · Sprint CRUD routes (docs/migration-recommendation-1.md §5) —
// member read gate, non-Viewer create/update gate, Owner/Admin delete gate,
// startDate < endDate validation, workspace scoping from the owning Project,
// and the DELETE null-out of child refs (no cascade).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Sprint = require('../models/Sprint');
const Feature = require('../models/Feature');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Activity = require('../models/Activity');
const sprintRouter = require('../routes/sprints');

const SECRET = 'r1-p3-sprints-test-secret-32chars-long';
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

// Workspace.findById(...).select('members') — shared by resolveProjectWorkspace
// and scopeToWorkspace.
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

describe('IES-R1 · GET /api/sprints?projectId=', () => {
  it('lists sprints for a member, scoped by projectRef', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    let filter;
    vi.spyOn(Sprint, 'find').mockImplementation((f) => {
      filter = f;
      return { sort: () => Promise.resolve([sprintDoc()]) };
    });

    const res = await fetch(`${baseUrl}/api/sprints?projectId=${PROJECT_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(200);
    expect(filter).toEqual({ projectRef: PROJECT_ID });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Sprint 1');
  });

  it('rejects a non-member with 403', async () => {
    mockUser(user(OUTSIDER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);

    const res = await fetch(`${baseUrl}/api/sprints?projectId=${PROJECT_ID}`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('404s when the project does not exist', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/sprints?projectId=${PROJECT_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed projectId with 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/sprints?projectId=not-an-id`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(400);
  });
});

describe('IES-R1 · POST /api/sprints', () => {
  const body = {
    projectId: PROJECT_ID,
    name: 'Sprint 2',
    startDate: '2026-02-01T00:00:00.000Z',
    endDate: '2026-02-14T00:00:00.000Z',
    goal: 'Launch',
    capacityHours: 80,
    targetVelocity: 20,
  };

  it('derives workspaceRef from the owning Project and writes sprint.created', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    let created;
    vi.spyOn(Sprint, 'create').mockImplementation(async (data) => {
      created = data;
      return { _id: SPRINT_ID, ...data };
    });
    const activity = vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(201);
    expect(created.workspaceRef).toBe(WS_ID);
    expect(created.projectRef).toBe(PROJECT_ID);
    expect(created.createdBy).toBe(OWNER_ID);
    expect(activity.mock.calls[0][0].action).toBe('sprint.created');
    expect(activity.mock.calls[0][0].workspaceRef).toBe(WS_ID);
  });

  it('lets a Developer create (non-Viewer editor gate)', async () => {
    mockUser(user(DEV_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'create').mockResolvedValue({ _id: SPRINT_ID });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
  });

  it('forbids a Viewer and a non-member from creating', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    const create = vi.spyOn(Sprint, 'create');

    mockUser(user(VIEWER_ID));
    const viewer = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(VIEWER_ID) },
      body: JSON.stringify(body),
    });
    expect(viewer.status).toBe(403);
    expect(create).not.toHaveBeenCalled();

    mockUser(user(OUTSIDER_ID));
    const outsider = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OUTSIDER_ID) },
      body: JSON.stringify(body),
    });
    expect(outsider.status).toBe(403);
  });

  it('rejects startDate >= endDate with 400', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    const create = vi.spyOn(Sprint, 'create').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ ...body, startDate: '2026-02-14T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('IES-R1 · PATCH /api/sprints/:id', () => {
  it('lets an editor update goal/capacity and revalidates the date range', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate').mockResolvedValue(sprintDoc({ goal: 'Ship v2' }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ goal: 'Ship v2', capacityHours: 100 }),
    });
    expect(res.status).toBe(200);
    const [, update] = findByIdAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ goal: 'Ship v2', capacityHours: 100 });
  });

  it('rejects a date patch that inverts the range', async () => {
    mockUser(user(DEV_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ startDate: '2026-02-14T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(400);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('forbids a Viewer from updating', async () => {
    mockUser(user(VIEWER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Sprint, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(VIEWER_ID) },
      body: JSON.stringify({ goal: 'nope' }),
    });
    expect(res.status).toBe(403);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('IES-R1 · DELETE /api/sprints/:id', () => {
  it('lets an Owner delete and nulls child refs (no cascade)', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    const del = vi.spyOn(Sprint, 'findByIdAndDelete').mockResolvedValue(sprintDoc());
    const featUpdate = vi.spyOn(Feature, 'updateMany').mockResolvedValue({});
    const taskUpdate = vi.spyOn(Task, 'updateMany').mockResolvedValue({});
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OWNER_ID) } });

    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith(SPRINT_ID);
    expect(featUpdate).toHaveBeenCalledWith({ sprintRef: SPRINT_ID }, { $set: { sprintRef: null } });
    expect(taskUpdate).toHaveBeenCalledWith({ sprintRef: SPRINT_ID }, { $set: { sprintRef: null } });
  });

  it('lets an Admin delete but forbids Developer/Viewer/non-member', async () => {
    vi.spyOn(Sprint, 'findById').mockResolvedValue(sprintDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findByIdAndDelete').mockResolvedValue({});
    vi.spyOn(Feature, 'updateMany').mockResolvedValue({});
    vi.spyOn(Task, 'updateMany').mockResolvedValue({});
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    mockUser(user(ADMIN_ID));
    const admin = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, { method: 'DELETE', headers: { Cookie: cookie(ADMIN_ID) } });
    expect(admin.status).toBe(200);

    for (const id of [DEV_ID, VIEWER_ID]) {
      mockUser(user(id));
      const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, { method: 'DELETE', headers: { Cookie: cookie(id) } });
      expect(res.status).toBe(403);
    }

    mockUser(user(OUTSIDER_ID));
    const outsider = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(outsider.status).toBe(403);
  });

  it('404s when the sprint does not exist', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(404);
  });
});
