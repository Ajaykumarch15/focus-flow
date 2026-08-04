// @vitest-environment node
// IES-P2-06 · Global + workspace search — auth-gated, scoped by membership or
// the caller's own data, normalized result contract, bounded limits.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const User = require('../models/User');
const searchRouter = require('../routes/search');

const SECRET = 'p2-06-test-search-32char-len';
const OWNER_ID = '5f0000000000000000000c01';
const DEV_ID = '5f0000000000000000000c03';
const WS_ID = '5f0000000000000000000c10';
const PROJ_ID = '5f0000000000000000000c20';
const TEAM_ID = '5f0000000000000000000c30';
const TASK_ID = '5f0000000000000000000c40';
const WORKLOG_ID = '5f0000000000000000000c50';

const signToken = (id = OWNER_ID) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id = OWNER_ID) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function user(id) {
  return { _id: id, name: 'User', email: 'user@focusflow.io', role: 'user', tokenVersion: 0, deletedAt: null };
}

function mockUser(u) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve(u) }));
}

function wsDoc({ members = [{ userId: OWNER_ID, role: 'Owner' }, { userId: DEV_ID, role: 'Developer' }] } = {}) {
  return {
    _id: WS_ID,
    name: 'Acme AI Engineering',
    type: 'Startup',
    icon: '⚡',
    description: 'Core platform engineering workspace',
    createdAt: '2026-01-15T00:00:00.000Z',
    settings: { allowMemberInvites: true, requireReviewForDone: true, autoSyncTimerWorkLogs: true, defaultVisibility: 'Workspace' },
    members,
    createdBy: OWNER_ID,
  };
}

// Facet mocks: the route calls Model.find({...}).limit(n).
function mockFacet(model, list) {
  return vi.spyOn(model, 'find').mockReturnValue({ limit: () => Promise.resolve(list) });
}

const projectDoc = { _id: PROJ_ID, name: 'Auth Gateway', description: 'OAuth + JWT hardening', workspaceRef: WS_ID, nameKey: 'auth gateway' };
const teamDoc = { _id: TEAM_ID, name: 'Platform', description: 'Core platform squad', workspaceRef: WS_ID };
const taskDoc = { _id: TASK_ID, title: 'Fix login loop', description: 'Session restore bug', userId: OWNER_ID };
const worklogDoc = { _id: WORKLOG_ID, title: 'Session restore investigation', currentWork: 'Debugging login loop', plan: 'Fix and test', userId: OWNER_ID };

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = 'http://localhost:5173';

  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-P2-06 · auth + validation', () => {
  it('rejects an anonymous search with 401', async () => {
    const res = await fetch(`${baseUrl}/api/search?q=gateway`);
    expect(res.status).toBe(401);
  });

  it('rejects a missing query with 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/search`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(400);
  });

  it('rejects a blank query with 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/search?q=%20%20`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized query with 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/search?q=${'a'.repeat(200)}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(400);
  });
});

describe('IES-P2-06 · workspace scope', () => {
  it('404s when the workspace does not exist', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Workspace, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/search?q=gateway&workspaceId=${WS_ID}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(404);
  });

  it('403s a caller who is not a member of the workspace', async () => {
    mockUser(user('5f0000000000000000000c99'));
    vi.spyOn(Workspace, 'findById').mockResolvedValue(wsDoc());

    const res = await fetch(`${baseUrl}/api/search?q=gateway&workspaceId=${WS_ID}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(403);
  });

  it('returns workspace-scoped projects, teams, and members', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Workspace, 'findById').mockResolvedValue(wsDoc());
    mockFacet(Project, [projectDoc]);
    mockFacet(Team, [teamDoc]);
    const userSpy = mockFacet(User, [{ _id: DEV_ID, name: 'Dev User', email: 'dev@focusflow.io' }]);

    const res = await fetch(`${baseUrl}/api/search?q=gateway&workspaceId=${WS_ID}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.query).toBe('gateway');
    expect(body.workspaceId).toBe(WS_ID);

    expect(body.projects).toEqual([
      expect.objectContaining({ kind: 'project', id: PROJ_ID, title: 'Auth Gateway', url: `/w/${WS_ID}/projects` }),
    ]);
    expect(body.teams).toEqual([
      expect.objectContaining({ kind: 'team', id: TEAM_ID, title: 'Platform', url: `/w/${WS_ID}/teams` }),
    ]);
    expect(body.members).toEqual([
      expect.objectContaining({ kind: 'member', id: DEV_ID, title: 'Dev User', url: `/w/${WS_ID}/members/${DEV_ID}` }),
    ]);
    expect(body.tasks).toEqual([]);
    expect(body.workspaces).toEqual([]);

    // Member search is restricted to the workspace's own member ids.
    const memberFilter = userSpy.mock.calls[0][0];
    expect(memberFilter._id.$in).toEqual(expect.arrayContaining([OWNER_ID, DEV_ID]));
  });
});

describe('IES-P2-06 · personal scope', () => {
  it('returns the caller’s tasks, worklogs, projects, and workspaces', async () => {
    mockUser(user(OWNER_ID));
    mockFacet(Task, [taskDoc]);
    mockFacet(WorkLog, [worklogDoc]);
    mockFacet(Project, [{ ...projectDoc, workspaceRef: null }]);
    mockFacet(Workspace, [wsDoc()]);

    const res = await fetch(`${baseUrl}/api/search?q=login`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.workspaceId).toBeUndefined();
    expect(body.tasks).toEqual([
      expect.objectContaining({ kind: 'task', id: TASK_ID, title: 'Fix login loop', url: `/tasks/${TASK_ID}` }),
    ]);
    expect(body.worklogs).toEqual([
      expect.objectContaining({ kind: 'worklog', id: WORKLOG_ID, url: `/worklog/${WORKLOG_ID}` }),
    ]);
    expect(body.projects).toEqual([
      expect.objectContaining({ kind: 'project', id: PROJ_ID, title: 'Auth Gateway', url: '/team' }),
    ]);
    expect(body.workspaces).toEqual([
      expect.objectContaining({ kind: 'workspace', id: WS_ID, title: 'Acme AI Engineering', url: `/w/${WS_ID}/overview` }),
    ]);
    expect(body.teams).toEqual([]);
    expect(body.members).toEqual([]);
  });

  it('caps each facet at the requested limit', async () => {
    mockUser(user(OWNER_ID));
    let capturedLimit;
    vi.spyOn(Task, 'find').mockImplementation(() => ({ limit: (n) => { capturedLimit = n; return Promise.resolve([]); } }));
    vi.spyOn(WorkLog, 'find').mockReturnValue({ limit: () => Promise.resolve([]) });
    vi.spyOn(Project, 'find').mockReturnValue({ limit: () => Promise.resolve([]) });
    vi.spyOn(Workspace, 'find').mockReturnValue({ limit: () => Promise.resolve([]) });

    const res = await fetch(`${baseUrl}/api/search?q=login&limit=7`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);
    expect(capturedLimit).toBe(7);
  });
});
