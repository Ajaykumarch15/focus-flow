// @vitest-environment node
// EEP2-P2.2.1/P2.2.2 · Project Info gap (DDS §4.4):
//   GET  /api/projects/:id — member-gated single-project read (404/403)
//   PATCH /api/projects/:id — meta fields editor-gated; members[]/teamIds[]/
//     settings Owner/Admin-gated; member/team refs validated against the
//     workspace; Activity('project.updated') written; sync-drive untouched.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Team = require('../models/Team');
const Activity = require('../models/Activity');
const projectRouter = require('../routes/projects');

const SECRET = 'p2-2-project-info-secret-32char'; // secret-scan:allow (fake test-only fixture)
const USER_ID = '5f0000000000000000000d03';
const OTHER_USER = '5f0000000000000000000d04';
const WS_ID = '5f0000000000000000000e01';
const PROJECT_ID = '6f00000000000000000000a1';
const TEAM_ID = '6f00000000000000000000b2';

const signToken = (id = USER_ID) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });

let server;
let baseUrl;

function authUser(overrides = {}) {
  return {
    _id: USER_ID,
    name: 'Project User',
    email: 'project@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    googleConnected: false,
    ...overrides,
  };
}

function wsDoc(members) {
  return { _id: WS_ID, members };
}

const roleMember = (userId, role) => ({ userId: new Types.ObjectId(userId), role });

// Plain-doc stand-in for a mongoose Project doc with a `save` spy.
function projectDoc(overrides = {}) {
  return {
    _id: PROJECT_ID,
    userId: USER_ID,
    name: 'Acme API',
    workspaceRef: WS_ID,
    description: '',
    key: '',
    status: 'active',
    members: [],
    teamIds: [],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockAuth(user = authUser()) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

function mockWorkspace(ws) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(ws),
  }));
}

function mockProjectFindById(doc) {
  return vi.spyOn(Project, 'findById').mockResolvedValue(doc);
}

function mockActiveUsers(users) {
  // `users` = array of { _id } docs (or raw ids) returned by .select('_id').
  return vi.spyOn(User, 'find').mockImplementation(() => ({
    select: () => Promise.resolve(users),
  }));
}

function mockTeams(teams) {
  return vi.spyOn(Team, 'find').mockImplementation(() => ({
    select: () => Promise.resolve(teams),
  }));
}

function mockActivity() {
  return vi.spyOn(Activity, 'create').mockResolvedValue({});
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = 'http://localhost:5173';
  delete process.env.NODE_ENV;

  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectRouter);
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

function request(path, { method = 'GET', body, token = signToken() } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('EEP2-P2.2.1 · GET /api/projects/:id — member-gated read', () => {
  it('rejects unauthenticated callers', async () => {
    const res = await request('/api/projects/' + PROJECT_ID, { token: null });
    expect(res.status).toBe(401);
  });

  it('404s for a missing project', async () => {
    mockAuth();
    mockProjectFindById(null);
    const res = await request('/api/projects/' + PROJECT_ID);
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('Project not found');
  });

  it('lets any workspace member read (incl. Viewer)', async () => {
    mockAuth(authUser());
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Viewer')]));
    mockProjectFindById(projectDoc());
    const res = await request('/api/projects/' + PROJECT_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe(PROJECT_ID);
    expect(body.name).toBe('Acme API');
  });

  it('403s a non-member of the workspace', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(OTHER_USER, 'Owner')]));
    mockProjectFindById(projectDoc());
    const res = await request('/api/projects/' + PROJECT_ID);
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('You are not a member of this workspace');
  });

  it('lets the creator read a personal project', async () => {
    mockAuth();
    mockProjectFindById(projectDoc({ workspaceRef: null }));
    const res = await request('/api/projects/' + PROJECT_ID);
    expect(res.status).toBe(200);
    expect((await res.json()).workspaceRef).toBeNull();
  });

  it('403s reading someone else\u2019s personal project', async () => {
    mockAuth();
    mockProjectFindById(projectDoc({ workspaceRef: null, userId: OTHER_USER }));
    const res = await request('/api/projects/' + PROJECT_ID);
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('You do not have access to this project');
  });
});

describe('EEP2-P2.2.2 · PATCH /api/projects/:id — role split + ref validation', () => {
  it('404s for a missing project', async () => {
    mockAuth();
    mockProjectFindById(null);
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { description: 'x' },
    });
    expect(res.status).toBe(404);
  });

  it('403s a non-member trying to edit a workspace project', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(OTHER_USER, 'Owner')]));
    mockProjectFindById(projectDoc());
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { description: 'x' },
    });
    expect(res.status).toBe(403);
  });

  it('lets an editor (Developer) persist meta fields and writes an Activity', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Developer')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    const activity = mockActivity();

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { description: 'Faster search', key: 'FS', status: 'on_hold' },
    });

    expect(res.status).toBe(200);
    expect(doc.description).toBe('Faster search');
    expect(doc.key).toBe('FS');
    expect(doc.status).toBe('on_hold');
    expect(doc.save).toHaveBeenCalled();
    expect(activity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        action: 'project.updated',
        workspaceRef: WS_ID,
      })
    );
  });

  it('rejects meta edits from a Viewer', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Viewer')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { description: 'nope' },
    });
    expect(res.status).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('rejects members/teamIds/settings edits from a Developer', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Developer')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { members: [OTHER_USER] },
    });
    expect(res.status).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('lets an Owner persist members that are active workspace members', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Owner'), roleMember(OTHER_USER, 'Developer')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    mockActiveUsers([{ _id: new Types.ObjectId(OTHER_USER) }]);
    mockActivity();

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { members: [OTHER_USER] },
    });

    expect(res.status).toBe(200);
    expect(doc.members.map(String)).toEqual([OTHER_USER]);
    expect(doc.save).toHaveBeenCalled();
  });

  it('lets an Admin persist settings', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Admin')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    mockActivity();

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { settings: { defaultVisibility: 'Private' } },
    });

    expect(res.status).toBe(200);
    expect(doc.settings).toEqual({ defaultVisibility: 'Private' });
    expect(doc.save).toHaveBeenCalled();
  });

  it('400s members that are not workspace members', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Owner')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    mockActiveUsers([{ _id: new Types.ObjectId(OTHER_USER) }]);

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { members: [OTHER_USER] },
    });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('members must belong to the workspace');
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('400s members that are not active users', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Owner')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    mockActiveUsers([]); // OTHER_USER is soft-deleted → not found

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { members: [OTHER_USER] },
    });

    expect(res.status).toBe(400);
  });

  it('400s teamIds that reference teams outside the workspace', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Owner')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    mockTeams([]); // no team in this workspace

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { teamIds: [TEAM_ID] },
    });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('teamIds must reference teams in this workspace');
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('persists teamIds that reference teams in the project workspace', async () => {
    mockAuth();
    mockWorkspace(wsDoc([roleMember(USER_ID, 'Admin')]));
    const doc = projectDoc();
    mockProjectFindById(doc);
    mockTeams([{ _id: new Types.ObjectId(TEAM_ID) }]);
    mockActivity();

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { teamIds: [TEAM_ID] },
    });

    expect(res.status).toBe(200);
    expect(doc.teamIds.map(String)).toEqual([TEAM_ID]);
    expect(doc.save).toHaveBeenCalled();
  });

  it('rejects an invalid status value with a 400', async () => {
    mockAuth();
    mockProjectFindById(projectDoc());
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { status: 'archived' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects a key longer than 10 characters with a 400', async () => {
    mockAuth();
    mockProjectFindById(projectDoc());
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { key: 'ABCDEFGHIJK' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-objectId members with a 400', async () => {
    mockAuth();
    mockProjectFindById(projectDoc());
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { members: ['not-an-id'] },
    });
    expect(res.status).toBe(400);
  });

  it('lets a personal-project creator edit their own meta', async () => {
    mockAuth();
    const doc = projectDoc({ workspaceRef: null });
    mockProjectFindById(doc);
    mockActivity();

    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { description: 'Personal goals' },
    });

    expect(res.status).toBe(200);
    expect(doc.description).toBe('Personal goals');
    expect(doc.save).toHaveBeenCalled();
  });

  it('403s a non-owner editing someone else\u2019s personal project', async () => {
    mockAuth();
    mockProjectFindById(projectDoc({ workspaceRef: null, userId: OTHER_USER }));
    const res = await request('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { description: 'hijack' },
    });
    expect(res.status).toBe(403);
  });
});

describe('EEP2-P2.2.2 · regression — sync-drive route untouched', () => {
  it('POST /:id/sync-drive still 400s on a not-connected user', async () => {
    mockAuth();
    vi.spyOn(Project, 'findOne').mockResolvedValue(projectDoc({ workspaceRef: null, googleFolderId: '' }));
    const res = await request(`/api/projects/${PROJECT_ID}/sync-drive`, { method: 'POST' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Google Drive is not connected');
  });
});
