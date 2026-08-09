// @vitest-environment node
// EEP2-P3.2.1–P3.2.4: Milestone/Phase/Module CRUD gates (DDS §7), same-project
// validation at 3 levels, null-out deletes, Feature.moduleId create/patch/query,
// plus a P3.2.5 mount smoke.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Phase = require('../models/Phase');
const Module = require('../models/Module');
const Feature = require('../models/Feature');
const Activity = require('../models/Activity');
const milestoneRouter = require('../routes/milestones');
const phaseRouter = require('../routes/phases');
const moduleRouter = require('../routes/modules');
const featureRouter = require('../routes/features');

const SECRET = 'spine-routes-test-secret-32char';
const OWNER_ID = '5f0000000000000000000e01';
const DEV_ID = '5f0000000000000000000e03';
const VIEWER_ID = '5f0000000000000000000e04';
const OUTSIDER_ID = '5f0000000000000000000e05';
const OTHER_PROJECT_ID = '5f0000000000000000000e06';
const WS_ID = '5f0000000000000000000e10';
const PROJECT_ID = '5f0000000000000000000e11';
const MILESTONE_ID = '5f0000000000000000000e21';
const PHASE_ID = '5f0000000000000000000e22';
const MODULE_ID = '5f0000000000000000000e23';
const FEATURE_ID = '5f0000000000000000000e24';
const OWNER_USER_ID = '5f0000000000000000000e31';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function user(id, role = 'user') {
  return { _id: id, name: 'User', email: 'u@focusflow.io', role, tokenVersion: 0, deletedAt: null };
}
function member(userId, role) {
  return { userId, role };
}
const ALL_MEMBERS = [member(OWNER_ID, 'Owner'), member(DEV_ID, 'Developer'), member(VIEWER_ID, 'Viewer')];
const projectDoc = () => ({ _id: PROJECT_ID, name: 'Core Platform', workspaceRef: WS_ID });
const milestoneDoc = () => ({ _id: MILESTONE_ID, projectRef: PROJECT_ID, workspaceRef: WS_ID, name: 'GA Launch', status: 'planned' });
const phaseDoc = () => ({ _id: PHASE_ID, projectRef: PROJECT_ID, workspaceRef: WS_ID, milestoneRef: MILESTONE_ID, name: 'Phase 1' });
const moduleDoc = () => ({ _id: MODULE_ID, projectRef: PROJECT_ID, workspaceRef: WS_ID, phaseRef: PHASE_ID, name: 'Auth' });
const featureDoc = () => ({ _id: FEATURE_ID, projectRef: PROJECT_ID, workspaceRef: WS_ID, sprintRef: null, moduleRef: null, name: 'Login' });

function mockUser(u) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve(u) }));
}
function mockWorkspace(members) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: WS_ID, members }),
  }));
}
function mockProject() {
  vi.spyOn(Project, 'findById').mockResolvedValue(projectDoc());
}
function mockActivity() {
  vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use('/api/milestones', milestoneRouter);
  app.use('/api/phases', phaseRouter);
  app.use('/api/modules', moduleRouter);
  app.use('/api/features', featureRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('EEP2-P3.2.1 · /api/milestones', () => {
  it('lists milestones to a workspace member', async () => {
    mockUser(user(OWNER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Milestone, 'find').mockImplementation((f) => ({ sort: () => Promise.resolve([milestoneDoc()]) }));

    const res = await fetch(`${baseUrl}/api/milestones?projectId=${PROJECT_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(200);
    expect((await res.json())[0].name).toBe('GA Launch');
  });

  it('rejects a non-member with 403', async () => {
    mockUser(user(OUTSIDER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    const res = await fetch(`${baseUrl}/api/milestones?projectId=${PROJECT_ID}`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('lets an editor create, deriving workspaceRef from the project', async () => {
    mockUser(user(DEV_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    mockActivity();
    let created;
    vi.spyOn(Milestone, 'create').mockImplementation(async (data) => { created = data; return { _id: MILESTONE_ID, ...data }; });

    const res = await fetch(`${baseUrl}/api/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ projectId: PROJECT_ID, name: 'Beta', status: 'planned' }),
    });
    expect(res.status).toBe(201);
    expect(created.workspaceRef).toBe(WS_ID);
    expect(created.createdBy).toBe(DEV_ID);
  });

  it('blocks a Viewer from creating (403)', async () => {
    mockUser(user(VIEWER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    const res = await fetch(`${baseUrl}/api/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(VIEWER_ID) },
      body: JSON.stringify({ projectId: PROJECT_ID, name: 'Beta' }),
    });
    expect(res.status).toBe(403);
  });

  it('lets an Owner delete and nulls phase.milestoneRef; blocks a Developer', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Milestone, 'findById').mockResolvedValue(milestoneDoc());
    mockWorkspace(ALL_MEMBERS);
    mockActivity();
    vi.spyOn(Milestone, 'findByIdAndDelete').mockResolvedValue(milestoneDoc());
    const phaseUpdate = vi.spyOn(Phase, 'updateMany').mockResolvedValue({});

    const ok = await fetch(`${baseUrl}/api/milestones/${MILESTONE_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OWNER_ID) } });
    expect(ok.status).toBe(200);
    expect(phaseUpdate).toHaveBeenCalledWith({ milestoneRef: MILESTONE_ID }, { $set: { milestoneRef: null } });

    vi.spyOn(Milestone, 'findById').mockResolvedValue(milestoneDoc());
    mockWorkspace(ALL_MEMBERS);
    mockUser(user(DEV_ID));
    const denied = await fetch(`${baseUrl}/api/milestones/${MILESTONE_ID}`, { method: 'DELETE', headers: { Cookie: cookie(DEV_ID) } });
    expect(denied.status).toBe(403);
  });
});

describe('EEP2-P3.2.2 · /api/phases same-project', () => {
  it('rejects a Phase under a Milestone from another project (400)', async () => {
    mockUser(user(OWNER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Milestone, 'findById').mockResolvedValue({ _id: MILESTONE_ID, projectRef: OTHER_PROJECT_ID });

    const res = await fetch(`${baseUrl}/api/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ projectId: PROJECT_ID, milestoneId: MILESTONE_ID, name: 'Phase 1' }),
    });
    expect(res.status).toBe(400);
  });

  it('revalidates the new parent on PATCH re-parent', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Phase, 'findById').mockResolvedValue(phaseDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Milestone, 'findById').mockResolvedValue({ _id: MILESTONE_ID, projectRef: OTHER_PROJECT_ID });

    const res = await fetch(`${baseUrl}/api/phases/${PHASE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ milestoneId: MILESTONE_ID }),
    });
    expect(res.status).toBe(400);
  });
});

describe('EEP2-P3.2.3 · /api/modules', () => {
  it('rejects an ownerId that is not a workspace member (400)', async () => {
    mockUser(user(OWNER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Phase, 'findById').mockResolvedValue({ _id: PHASE_ID, projectRef: PROJECT_ID });

    const res = await fetch(`${baseUrl}/api/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ projectId: PROJECT_ID, phaseId: PHASE_ID, name: 'Auth', ownerId: OWNER_USER_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('lets an Owner delete and nulls feature.moduleRef', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Module, 'findById').mockResolvedValue(moduleDoc());
    mockWorkspace(ALL_MEMBERS);
    mockActivity();
    vi.spyOn(Module, 'findByIdAndDelete').mockResolvedValue(moduleDoc());
    const featureUpdate = vi.spyOn(Feature, 'updateMany').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/modules/${MODULE_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(200);
    expect(featureUpdate).toHaveBeenCalledWith({ moduleRef: MODULE_ID }, { $set: { moduleRef: null } });
  });
});

describe('EEP2-P3.2.4 · Feature.moduleId', () => {
  it('filters by moduleId after validating it belongs to the project', async () => {
    mockUser(user(OWNER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Module, 'findById').mockResolvedValue({ _id: MODULE_ID, projectRef: PROJECT_ID });
    let filter;
    vi.spyOn(Feature, 'find').mockImplementation((f) => { filter = f; return { sort: () => Promise.resolve([featureDoc()]) }; });

    const res = await fetch(`${baseUrl}/api/features?projectId=${PROJECT_ID}&moduleId=${MODULE_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(200);
    expect(filter.moduleRef).toBe(MODULE_ID);
  });

  it('rejects a cross-project module filter (400)', async () => {
    mockUser(user(OWNER_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Module, 'findById').mockResolvedValue({ _id: MODULE_ID, projectRef: OTHER_PROJECT_ID });
    const res = await fetch(`${baseUrl}/api/features?projectId=${PROJECT_ID}&moduleId=${MODULE_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });
    expect(res.status).toBe(400);
  });

  it('creates a feature with moduleRef from moduleId', async () => {
    mockUser(user(DEV_ID));
    mockProject();
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Module, 'findById').mockResolvedValue({ _id: MODULE_ID, projectRef: PROJECT_ID });
    mockActivity();
    let created;
    vi.spyOn(Feature, 'create').mockImplementation(async (data) => { created = data; return { _id: FEATURE_ID, ...data }; });

    const res = await fetch(`${baseUrl}/api/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ projectId: PROJECT_ID, name: 'Login', moduleId: MODULE_ID }),
    });
    expect(res.status).toBe(201);
    expect(created.moduleRef).toBe(MODULE_ID);
  });

  it('moves a feature between modules without touching sprintRef', async () => {
    mockUser(user(DEV_ID));
    vi.spyOn(Feature, 'findById').mockResolvedValue(featureDoc());
    mockWorkspace(ALL_MEMBERS);
    vi.spyOn(Module, 'findById').mockResolvedValue({ _id: MODULE_ID, projectRef: PROJECT_ID });
    mockActivity();
    let patch;
    vi.spyOn(Feature, 'findByIdAndUpdate').mockImplementation(async (id, update) => { patch = update.$set; return { ...featureDoc(), ...update.$set }; });

    const res = await fetch(`${baseUrl}/api/features/${FEATURE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ moduleId: MODULE_ID }),
    });
    expect(res.status).toBe(200);
    expect(patch.moduleRef).toBe(MODULE_ID);
    expect(patch.sprintRef).toBeUndefined();
  });
});

describe('EEP2-P3.2.5 · router mounting', () => {
  it('mounts milestones/phases/modules in server/index.js alongside existing routers', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    expect(index).toContain("require('./routes/milestones')");
    expect(index).toContain("require('./routes/phases')");
    expect(index).toContain("require('./routes/modules')");
    expect(index).toContain("app.use('/api/milestones', milestoneRoutes)");
    expect(index).toContain("app.use('/api/phases', phaseRoutes)");
    expect(index).toContain("app.use('/api/modules', moduleRoutes)");
    expect(index).toContain("app.use('/api/features', featureRoutes)");
  });
});
