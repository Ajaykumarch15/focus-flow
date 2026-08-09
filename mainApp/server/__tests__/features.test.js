// @vitest-environment node
// IES-R1 · Feature/work-item CRUD routes incl. the Project Backlog
// (docs/migration-recommendation-1.md §5, §9.1/§9.2) — backlog query via
// `sprintRef: null`, sprint↔feature same-project revalidation, filters,
// member read gate, non-Viewer create/update gate, Owner/Admin delete gate,
// and the DELETE null-out of task featureRef (no cascade).
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
const featureRouter = require('../routes/features');

const SECRET = 'r1-p3-features-test-secret-32char';
const OWNER_ID = '5f0000000000000000000e01';
const ADMIN_ID = '5f0000000000000000000e02';
const DEV_ID = '5f0000000000000000000e03';
const VIEWER_ID = '5f0000000000000000000e04';
const OUTSIDER_ID = '5f0000000000000000000e05';
const OTHER_PROJECT_ID = '5f0000000000000000000e06';
const WS_ID = '5f0000000000000000000e10';
const PROJECT_ID = '5f0000000000000000000e11';
const SPRINT_ID = '5f0000000000000000000e12';
const FEATURE_ID = '5f0000000000000000000e13';

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

function featureDoc(over = {}) {
  return {
    _id: FEATURE_ID,
    projectRef: PROJECT_ID,
    workspaceRef: WS_ID,
    sprintRef: null,
    name: 'Auth flow',
    description: '',
    type: 'feature',
    labels: [],
    estimatedHours: 0,
    status: 'backlog',
    order: 0,
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
  app.use('/api/features', featureRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-R1 · GET /api/features?projectId=&backlog=&sprintId=&type=&status=', () => {
  it('lists the Project Backlog via sprintRef: null', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    let filter;
    vi.spyOn(Feature, 'find').mockImplementation((f) => {
      filter = f;
      return { sort: () => Promise.resolve([featureDoc()]) };
    });

    const res = await fetch(`${baseUrl}/api/features?projectId=${PROJECT_ID}&backlog=true`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(200);
    expect(filter).toEqual({ projectRef: PROJECT_ID, sprintRef: null });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Auth flow');
  });

  it('filters by sprintId, type and status after validating the sprint', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID });
    let filter;
    vi.spyOn(Feature, 'find').mockImplementation((f) => {
      filter = f;
      return { sort: () => Promise.resolve([]) };
    });

    const res = await fetch(`${baseUrl}/api/features?projectId=${PROJECT_ID}&sprintId=${SPRINT_ID}&type=bug&status=ready`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(200);
    expect(filter).toEqual({ projectRef: PROJECT_ID, sprintRef: SPRINT_ID, type: 'bug', status: 'ready' });
  });

  it('rejects a sprint from another project with 400', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: OTHER_PROJECT_ID });

    const res = await fetch(`${baseUrl}/api/features?projectId=${PROJECT_ID}&sprintId=${SPRINT_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(400);
  });

  it('rejects a non-member with 403', async () => {
    mockUser(user(OUTSIDER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);

    const res = await fetch(`${baseUrl}/api/features?projectId=${PROJECT_ID}`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });
});

describe('IES-R1 · POST /api/features', () => {
  const body = { projectId: PROJECT_ID, name: 'OAuth', type: 'feature' };

  it('derives workspaceRef from the project and accepts a same-project sprintId', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    let created;
    vi.spyOn(Feature, 'create').mockImplementation(async (data) => {
      created = data;
      return { _id: FEATURE_ID, ...data };
    });
    const activity = vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ ...body, sprintId: SPRINT_ID, estimatedHours: 4 }),
    });

    expect(res.status).toBe(201);
    expect(created.workspaceRef).toBe(WS_ID);
    expect(created.sprintRef).toBe(SPRINT_ID);
    expect(created.estimatedHours).toBe(4);
    expect(activity.mock.calls[0][0].action).toBe('feature.created');
    expect(activity.mock.calls[0][0].workspaceRef).toBe(WS_ID);
  });

  it('rejects creating into a sprint that is over capacity with 409', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, capacityHours: 8 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000e20', estimatedHours: 5 }]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    const create = vi.spyOn(Feature, 'create');

    const res = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ ...body, sprintId: SPRINT_ID, estimatedHours: 4 }),
    });

    expect(res.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts creating into a sprint that stays within capacity', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, capacityHours: 8 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000e20', estimatedHours: 5 }]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    const create = vi.spyOn(Feature, 'create').mockImplementation(async (data) => ({ _id: FEATURE_ID, ...data }));

    const res = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ ...body, sprintId: SPRINT_ID, estimatedHours: 3 }),
    });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('creates a backlog feature when sprintId is absent', async () => {
    mockUser(user(DEV_ID));
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);
    let created;
    vi.spyOn(Feature, 'create').mockImplementation(async (data) => {
      created = data;
      return { _id: FEATURE_ID, ...data };
    });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    expect(created.sprintRef).toBeNull();
  });

  it('forbids a Viewer and rejects a cross-project sprint', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
    mockWorkspace(ALL_MEMBERS);

    mockUser(user(VIEWER_ID));
    const create = vi.spyOn(Feature, 'create');
    const viewer = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(VIEWER_ID) },
      body: JSON.stringify(body),
    });
    expect(viewer.status).toBe(403);
    expect(create).not.toHaveBeenCalled();

    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: OTHER_PROJECT_ID });
    const cross = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ ...body, sprintId: SPRINT_ID }),
    });
    expect(cross.status).toBe(400);
  });
});

describe('IES-R1 · PATCH /api/features/:id', () => {
  it('lets an editor move a feature into a same-project sprint', async () => {
    mockUser(user(DEV_ID));
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    const findByIdAndUpdate = vi.spyOn(Feature, 'findByIdAndUpdate').mockResolvedValue(featureDoc({ sprintRef: SPRINT_ID }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ sprintId: SPRINT_ID }),
    });
    expect(res.status).toBe(200);
    const [, update] = findByIdAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ sprintRef: SPRINT_ID });
  });

  it('rejects moving a feature into an over-capacity sprint with 409', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc({ estimatedHours: 4 }));
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, capacityHours: 8 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000e20', estimatedHours: 8 }]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    const findByIdAndUpdate = vi.spyOn(Feature, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ sprintId: SPRINT_ID }),
    });

    expect(res.status).toBe(409);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects re-estimating a feature inside a sprint over capacity with 409', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc({ sprintRef: SPRINT_ID, estimatedHours: 1 }));
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, capacityHours: 8 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000e20', estimatedHours: 7 }]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    const findByIdAndUpdate = vi.spyOn(Feature, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ estimatedHours: 2 }),
    });

    expect(res.status).toBe(409);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('lets an editor move a feature back to the backlog (sprintId: null)', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc({ sprintRef: SPRINT_ID }));
    mockWorkspace(ALL_MEMBERS);
    const findByIdAndUpdate = vi.spyOn(Feature, 'findByIdAndUpdate').mockResolvedValue(featureDoc({ sprintRef: null }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ sprintId: null }),
    });
    expect(res.status).toBe(200);
    const [, update] = findByIdAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ sprintRef: null });
  });

  it('rejects moving into a sprint of another project and forbids Viewers', async () => {
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc());
    mockWorkspace(ALL_MEMBERS);

    mockUser(user(OWNER_ID));
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: OTHER_PROJECT_ID });
    const cross = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ sprintId: SPRINT_ID }),
    });
    expect(cross.status).toBe(400);

    mockUser(user(VIEWER_ID));
    const findByIdAndUpdate = vi.spyOn(Feature, 'findByIdAndUpdate');
    const viewer = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(VIEWER_ID) },
      body: JSON.stringify({ name: 'nope' }),
    });
    expect(viewer.status).toBe(403);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('IES-R1 · DELETE /api/features/:id', () => {
  it('lets an Owner delete and nulls featureRef on tasks', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc());
    mockWorkspace(ALL_MEMBERS);
    const del = vi.spyOn(Feature, 'findByIdAndDelete').mockResolvedValue(featureDoc());
    const taskUpdate = vi.spyOn(Task, 'updateMany').mockResolvedValue({});
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OWNER_ID) } });

    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith(FEATURE_ID);
    expect(taskUpdate).toHaveBeenCalledWith({ featureRef: FEATURE_ID }, { $set: { featureRef: null } });
  });

  it('forbids a Developer and a non-member from deleting', async () => {
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc());
    mockWorkspace(ALL_MEMBERS);

    mockUser(user(DEV_ID));
    const dev = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, { method: 'DELETE', headers: { Cookie: cookie(DEV_ID) } });
    expect(dev.status).toBe(403);

    mockUser(user(OUTSIDER_ID));
    const outsider = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(outsider.status).toBe(403);
  });
});
