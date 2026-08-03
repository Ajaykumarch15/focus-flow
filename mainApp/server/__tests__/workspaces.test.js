// @vitest-environment node
// IES-P2-01 · Workspace backend — CRUD, membership (invite/join/role/remove),
// ownership scoping, auth, validation, and the JSON contract the frontend
// `Workspace` type (src/types/collaboration.ts) expects.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Workspace = require('../models/Workspace');
const Team = require('../models/Team');
const Project = require('../models/Project');
const User = require('../models/User');
const Activity = require('../models/Activity');
const workspaceRouter = require('../routes/workspaces');
const { encodeCursor } = require('../utils/pagination');

const SECRET = 'p2-01-test-workspaces-32char';
const OWNER_ID = '5f0000000000000000000c01';
const ADMIN_ID = '5f0000000000000000000c02';
const DEV_ID = '5f0000000000000000000c03';
const OUTSIDER_ID = '5f0000000000000000000c04';
const NEW_MEMBER_ID = '5f0000000000000000000c05';
const WS_ID = '5f0000000000000000000c10';
const WS2_ID = '5f0000000000000000000c11';

const signToken = (id = OWNER_ID) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function user(id, role = 'user') {
  return { _id: id, name: 'User', email: 'user@focusflow.io', role, tokenVersion: 0, deletedAt: null };
}

function mockUser(u) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve(u) }));
}

// Populated member entry (userId is a populated subdoc).
function member(userId, role = 'Developer', joinedAt = '2026-01-15T00:00:00.000Z', name = 'User') {
  return { userId: { _id: userId, name, email: `${name.toLowerCase()}@focusflow.io`, avatar: '', role: 'user' }, role, joinedAt };
}

function wsDoc({ id = WS_ID, members, createdBy = OWNER_ID, settings = {}, save = vi.fn().mockResolvedValue(undefined), ...over } = {}) {
  return {
    _id: id,
    name: 'Acme AI Engineering',
    type: 'Startup',
    icon: '⚡',
    description: 'Core platform engineering workspace',
    createdAt: '2026-01-15T00:00:00.000Z',
    settings: {
      allowMemberInvites: true,
      requireReviewForDone: true,
      autoSyncTimerWorkLogs: true,
      defaultVisibility: 'Workspace',
      ...settings,
    },
    members: members || [member(OWNER_ID, 'Owner', '2026-01-15T00:00:00.000Z', 'Owner')],
    createdBy,
    save,
    ...over,
  };
}

// findById must support BOTH `await Workspace.findById(id)` and
// `await Workspace.findById(id).populate(...)`.
function mockFindById(doc) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    populate: () => Promise.resolve(doc),
    then: (resolve) => resolve(doc),
    catch: () => undefined,
  }));
}

function mockFind(list) {
  let query;
  const spy = vi.spyOn(Workspace, 'find').mockImplementation((q) => {
    query = q;
    return { sort: () => ({ populate: () => Promise.resolve(list) }) };
  });
  return { spy, query: () => query };
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = 'http://localhost:5173';

  const app = express();
  app.use(express.json());
  app.use('/api/workspaces', workspaceRouter);
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

describe('IES-P2-01 · auth required', () => {
  it('rejects an anonymous GET / with 401', async () => {
    const res = await fetch(`${baseUrl}/api/workspaces`);
    expect(res.status).toBe(401);
  });

  it('rejects an anonymous POST / with 401', async () => {
    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('IES-P2-01 · POST / creates a workspace owned by the caller', () => {
  it('seeds the creator as an Owner member and returns the contract shape', async () => {
    mockUser(user(OWNER_ID));
    let createdData;
    vi.spyOn(Workspace, 'create').mockImplementation(async (data) => {
      createdData = data;
      return { _id: WS_ID, ...data };
    });
    mockFindById(wsDoc());
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ name: 'Acme AI Engineering', type: 'Startup', description: 'Core platform' }),
    });

    expect(res.status).toBe(201);
    expect(createdData.createdBy).toBe(OWNER_ID);
    expect(createdData.members).toEqual([expect.objectContaining({ userId: OWNER_ID, role: 'Owner' })]);

    const body = await res.json();
    expect(body.id).toBe(WS_ID);
    expect(body.name).toBe('Acme AI Engineering');
    expect(body.type).toBe('Startup');
    expect(body.icon).toBe('⚡');
    expect(body.role).toBe('Owner');
    expect(body.membersCount).toBe(1);
    expect(body.projectsCount).toBe(0);
    expect(body.settings).toEqual({
      allowMemberInvites: true,
      requireReviewForDone: true,
      autoSyncTimerWorkLogs: true,
      defaultVisibility: 'Workspace',
    });
    expect(Array.isArray(body.members)).toBe(true);
  });

  it('rejects a missing name with a 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ type: 'Startup' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid type with a 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ name: 'X', type: 'Galaxy' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('IES-P2-01 · GET / lists only the caller’s workspaces', () => {
  it('scopes by createdBy OR membership and computes project counts', async () => {
    mockUser(user(OWNER_ID));
    const { query } = mockFind([wsDoc(), wsDoc({ id: WS2_ID, name: 'Personal Sandbox', type: 'Personal' })]);
    vi.spyOn(Project, 'aggregate').mockResolvedValue([{ _id: WS_ID, count: 3 }]);

    const res = await fetch(`${baseUrl}/api/workspaces`, { headers: { Cookie: cookie() } });

    expect(res.status).toBe(200);
    expect(query()).toEqual({ $or: [{ createdBy: OWNER_ID }, { 'members.userId': OWNER_ID }] });

    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].projectsCount).toBe(3);
    expect(body[1].projectsCount).toBe(0);
    expect(body[0].role).toBe('Owner');
  });
});

describe('IES-P2-01 · GET /:id membership scoping', () => {
  it('returns the workspace for a member', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer')] }));
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(2);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { headers: { Cookie: cookie() } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(WS_ID);
    expect(body.membersCount).toBe(2);
    expect(body.projectsCount).toBe(2);
    expect(body.members.map((m) => m.role)).toEqual(['Owner', 'Developer']);
  });

  it('forbids a non-member with 403', async () => {
    mockUser(user(OUTSIDER_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner')] }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('404s for a missing workspace', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(null);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(404);
  });
});

describe('IES-P2-01 · PATCH /:id ownership + settings merge', () => {
  it('lets an Owner update fields and merges settings', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    const updated = wsDoc({
      name: 'Acme AI Platform',
      settings: {
        allowMemberInvites: false,
        requireReviewForDone: true,
        autoSyncTimerWorkLogs: true,
        defaultVisibility: 'Workspace',
      },
    });
    const findByIdAndUpdate = vi.spyOn(Workspace, 'findByIdAndUpdate').mockImplementation(() => ({
      populate: () => Promise.resolve(updated),
    }));
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ name: 'Acme AI Platform', settings: { allowMemberInvites: false } }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Acme AI Platform');
    expect(body.settings.allowMemberInvites).toBe(false);

    const [, updates] = findByIdAndUpdate.mock.calls[0];
    expect(updates.settings).toEqual({
      allowMemberInvites: false,
      requireReviewForDone: true,
      autoSyncTimerWorkLogs: true,
      defaultVisibility: 'Workspace',
    });
  });

  it('forbids a Developer from updating', async () => {
    mockUser(user(DEV_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer')] }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ name: 'Hijack' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('IES-P2-01 · DELETE /:id owner-only + cascade', () => {
  it('lets the Owner delete and cascades teams + detaches projects', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    const teamDelete = vi.spyOn(Team, 'deleteMany').mockResolvedValue({});
    const projectUpdate = vi.spyOn(Project, 'updateMany').mockResolvedValue({});
    const wsDelete = vi.spyOn(Workspace, 'findByIdAndDelete').mockResolvedValue({ _id: WS_ID });

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { method: 'DELETE', headers: { Cookie: cookie() } });

    expect(res.status).toBe(200);
    expect(teamDelete).toHaveBeenCalledWith({ workspaceRef: WS_ID });
    expect(projectUpdate).toHaveBeenCalledWith({ workspaceRef: WS_ID }, { $set: { workspaceRef: null } });
    expect(wsDelete).toHaveBeenCalledWith(WS_ID);
  });

  it('forbids a non-owner from deleting', async () => {
    mockUser(user(ADMIN_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(ADMIN_ID, 'Admin')] }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { method: 'DELETE', headers: { Cookie: cookie(ADMIN_ID) } });
    expect(res.status).toBe(403);
  });
});

describe('IES-P2-01 · member invite (POST /:id/members)', () => {
  it('adds a user by email as a manager and returns the member list', async () => {
    mockUser(user(OWNER_ID));
    const ws = wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(ADMIN_ID, 'Admin', undefined, 'Admin')] });
    mockFindById(ws);
    vi.spyOn(User, 'findOne').mockImplementation(() => ({
      select: () => Promise.resolve({ _id: NEW_MEMBER_ID }),
    }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ email: 'new@focusflow.io', role: 'Manager' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveLength(3);
    const added = body.find((m) => m.id === NEW_MEMBER_ID);
    expect(added.role).toBe('Manager');
    expect(ws.save).toHaveBeenCalled();
  });

  it('forbids a Developer from inviting', async () => {
    mockUser(user(DEV_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer')] }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ email: 'new@focusflow.io' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown user with 404 and a duplicate invite with 409', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    vi.spyOn(User, 'findOne').mockImplementation(() => ({
      select: () => Promise.resolve(null),
    }));

    const notFound = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ email: 'ghost@focusflow.io' }),
    });
    expect(notFound.status).toBe(404);

    // Existing member invite → 409 (member already in the workspace).
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer')] }));
    vi.spyOn(User, 'findOne').mockImplementation(() => ({
      select: () => Promise.resolve({ _id: DEV_ID }),
    }));

    const dup = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ userId: DEV_ID }),
    });
    expect(dup.status).toBe(409);
  });

  it('rejects an invite without userId or email', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ role: 'Developer' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('IES-P2-01 · self-join (POST /:id/join)', () => {
  it('joins as Developer when invites are enabled', async () => {
    mockUser(user(OUTSIDER_ID));
    const ws = wsDoc();
    mockFindById(ws);
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/join`, { method: 'POST', headers: { Cookie: cookie(OUTSIDER_ID) } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('Developer');
    expect(ws.save).toHaveBeenCalled();
  });

  it('rejects self-join when invites are disabled', async () => {
    mockUser(user(OUTSIDER_ID));
    mockFindById(wsDoc({ settings: { allowMemberInvites: false } }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/join`, { method: 'POST', headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('is idempotent for an existing member', async () => {
    mockUser(user(DEV_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer')] }));
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/join`, { method: 'POST', headers: { Cookie: cookie(DEV_ID) } });
    expect(res.status).toBe(200);
  });
});

describe('IES-P2-01 · member role changes (PATCH /:id/members/:userId)', () => {
  it('lets an Admin promote a Developer', async () => {
    mockUser(user(ADMIN_ID));
    const ws = wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(ADMIN_ID, 'Admin', undefined, 'Admin'), member(DEV_ID, 'Developer')] });
    mockFindById(ws);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(ADMIN_ID) },
      body: JSON.stringify({ role: 'Manager' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.find((m) => m.id === DEV_ID).role).toBe('Manager');
  });

  it('never allows changing the owner role', async () => {
    mockUser(user(ADMIN_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(ADMIN_ID, 'Admin', undefined, 'Admin')] }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${OWNER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(ADMIN_ID) },
      body: JSON.stringify({ role: 'Viewer' }),
    });
    expect(res.status).toBe(400);
  });

  it('forbids a Developer from changing roles', async () => {
    mockUser(user(DEV_ID));
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer'), member(ADMIN_ID, 'Admin', undefined, 'Admin')] }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${ADMIN_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(DEV_ID) },
      body: JSON.stringify({ role: 'Viewer' }),
    });
    expect(res.status).toBe(403);
  });

  it('requires a role in the body', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('IES-P2-01 · member removal (DELETE /:id/members/:userId)', () => {
  it('lets an Owner remove a Developer and pulls them from teams', async () => {
    mockUser(user(OWNER_ID));
    const ws = wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner'), member(DEV_ID, 'Developer')] });
    mockFindById(ws);
    const teamPull = vi.spyOn(Team, 'updateMany').mockResolvedValue({});
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, { method: 'DELETE', headers: { Cookie: cookie() } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(teamPull).toHaveBeenCalledWith({ workspaceRef: WS_ID }, { $pull: { members: DEV_ID } });
  });

  it('blocks removing the owner and non-members', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());

    const owner = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${OWNER_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie() },
    });
    expect(owner.status).toBe(400);

    const missing = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${OUTSIDER_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie() },
    });
    expect(missing.status).toBe(404);
  });
});

describe('IES-P2-03 · workspace role authorization matrix', () => {
  const MANAGER_ID = '5f0000000000000000000c06';
  const VIEWER_ID = '5f0000000000000000000c07';
  const ROLES = ['Owner', 'Admin', 'Manager', 'Developer', 'Viewer'];
  const ROLE_IDS = { Owner: OWNER_ID, Admin: ADMIN_ID, Manager: MANAGER_ID, Developer: DEV_ID, Viewer: VIEWER_ID };
  const ALL_MEMBERS = [
    member(OWNER_ID, 'Owner', undefined, 'Owner'),
    member(ADMIN_ID, 'Admin', undefined, 'Admin'),
    member(MANAGER_ID, 'Manager', undefined, 'Manager'),
    member(DEV_ID, 'Developer'),
    member(VIEWER_ID, 'Viewer', undefined, 'Viewer'),
  ];
  const cloneMembers = () => ALL_MEMBERS.map((m) => ({ ...m, userId: { ...m.userId } }));
  const baseDoc = () => wsDoc({ members: cloneMembers(), createdBy: OWNER_ID });

  it('GET /:id — any member may read; non-members (incl. platform admins) get 403', async () => {
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    for (const role of ROLES) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { headers: { Cookie: cookie(ROLE_IDS[role]) } });
      expect(res.status, `${role} should be able to read the workspace`).toBe(200);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('GET /:id/activity — any member may read the feed; non-members get 403', async () => {
    vi.spyOn(Activity, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ populate: () => Promise.resolve([]) }) }) });
    for (const role of ROLES) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity`, { headers: { Cookie: cookie(ROLE_IDS[role]) } });
      expect(res.status, `${role} should be able to read the feed`).toBe(200);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('PATCH /:id — only Owner/Admin may update workspace settings', async () => {
    vi.spyOn(Workspace, 'findByIdAndUpdate').mockReturnValue({ populate: () => Promise.resolve(baseDoc()) });
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
    for (const role of ['Owner', 'Admin']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(ROLE_IDS[role]) },
        body: JSON.stringify({ name: 'Renamed' }),
      });
      expect(res.status, `${role} should be able to update`).toBe(200);
    }
    for (const role of ['Manager', 'Developer', 'Viewer']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(ROLE_IDS[role]) },
        body: JSON.stringify({ name: 'Renamed' }),
      });
      expect(res.status, `${role} should be denied`).toBe(403);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OUTSIDER_ID) },
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /:id/members — only Owner/Admin may invite members', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue({ select: () => Promise.resolve({ _id: NEW_MEMBER_ID }) });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
    for (const role of ['Owner', 'Admin']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(ROLE_IDS[role]) },
        body: JSON.stringify({ userId: NEW_MEMBER_ID }),
      });
      expect(res.status, `${role} should be able to invite`).toBe(201);
    }
    for (const role of ['Manager', 'Developer', 'Viewer']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(ROLE_IDS[role]) },
        body: JSON.stringify({ userId: NEW_MEMBER_ID }),
      });
      expect(res.status, `${role} should be denied`).toBe(403);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OUTSIDER_ID) },
      body: JSON.stringify({ userId: NEW_MEMBER_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /:id/members/:userId — only Owner/Admin may change roles', async () => {
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
    for (const role of ['Owner', 'Admin']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(ROLE_IDS[role]) },
        body: JSON.stringify({ role: 'Manager' }),
      });
      expect(res.status, `${role} should be able to change roles`).toBe(200);
    }
    for (const role of ['Manager', 'Developer', 'Viewer']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie(ROLE_IDS[role]) },
        body: JSON.stringify({ role: 'Manager' }),
      });
      expect(res.status, `${role} should be denied`).toBe(403);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OUTSIDER_ID) },
      body: JSON.stringify({ role: 'Manager' }),
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /:id/members/:userId — only Owner/Admin may remove members', async () => {
    vi.spyOn(Team, 'updateMany').mockResolvedValue({});
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
    for (const role of ['Owner', 'Admin']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
        method: 'DELETE',
        headers: { Cookie: cookie(ROLE_IDS[role]) },
      });
      expect(res.status, `${role} should be able to remove`).toBe(200);
    }
    for (const role of ['Manager', 'Developer', 'Viewer']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
        method: 'DELETE',
        headers: { Cookie: cookie(ROLE_IDS[role]) },
      });
      expect(res.status, `${role} should be denied`).toBe(403);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/members/${DEV_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(OUTSIDER_ID) },
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /:id — only the Owner may delete the workspace', async () => {
    vi.spyOn(Team, 'deleteMany').mockResolvedValue({});
    vi.spyOn(Project, 'updateMany').mockResolvedValue({});
    vi.spyOn(Workspace, 'findByIdAndDelete').mockResolvedValue({});
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    mockUser(user(OWNER_ID));
    mockFindById(baseDoc());
    const ok = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OWNER_ID) } });
    expect(ok.status).toBe(200);

    for (const role of ['Admin', 'Manager', 'Developer', 'Viewer']) {
      mockUser(user(ROLE_IDS[role]));
      mockFindById(baseDoc());
      const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { method: 'DELETE', headers: { Cookie: cookie(ROLE_IDS[role]) } });
      expect(res.status, `${role} should not delete`).toBe(403);
    }
    mockUser(user(OUTSIDER_ID, 'admin'));
    mockFindById(baseDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}`, { method: 'DELETE', headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });
});

describe('IES-P2-04 · workspace activity feed (GET /:id/activity)', () => {
  const feedDoc = (id, t) => ({
    _id: id,
    userId: { _id: OWNER_ID, name: 'Owner', email: 'owner@focusflow.io', avatar: '' },
    action: 'workspace.created',
    details: { workspaceName: 'Acme AI Engineering' },
    workspaceRef: WS_ID,
    createdAt: new Date(t),
  });

  it('returns the { items, hasMore, nextCursor } contract scoped to the workspace', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    let filter;
    vi.spyOn(Activity, 'find').mockImplementation((f) => {
      filter = f;
      return { sort: () => ({ limit: () => ({ populate: () => Promise.resolve([feedDoc('5f0000000000000000000022', 3000), feedDoc('5f0000000000000000000021', 2000)]) }) }) };
    });

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity?limit=10`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(filter.workspaceRef).toBe(WS_ID);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].action).toBe('workspace.created');
    expect(typeof body.hasMore).toBe('boolean');
    expect(body.nextCursor).toBeNull();
  });

  it('paginates newest-first with a keyset cursor filter', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    let filter;
    vi.spyOn(Activity, 'find').mockImplementation((f) => {
      filter = f;
      return { sort: () => ({ limit: () => ({ populate: () => Promise.resolve([feedDoc('5f0000000000000000000022', 4000), feedDoc('5f0000000000000000000021', 3000)]) }) }) };
    });

    const cursor = encodeCursor(2000, '5f0000000000000000000001');
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity?limit=2&cursor=${cursor}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(filter.workspaceRef).toBe(WS_ID);
    expect(filter.$or).toEqual([
      { createdAt: { $lt: 2000 } },
      { createdAt: 2000, _id: { $lt: '5f0000000000000000000001' } },
    ]);
    expect(body.items).toHaveLength(2);
    expect(body.hasMore).toBe(false);
  });

  it('reports hasMore and a nextCursor when a page is full', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    const docs = [feedDoc('5f0000000000000000000022', 3000), feedDoc('5f0000000000000000000021', 2000), feedDoc('5f0000000000000000000020', 1000)];
    vi.spyOn(Activity, 'find').mockImplementation(() => ({ sort: () => ({ limit: () => ({ populate: () => Promise.resolve(docs) }) }) }));

    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity?limit=2`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBeTruthy();
  });

  it('rejects non-members with 403', async () => {
    mockUser(user(OUTSIDER_ID));
    mockFindById(wsDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity`, { headers: { Cookie: cookie(OUTSIDER_ID) } });
    expect(res.status).toBe(403);
  });

  it('404s when the workspace does not exist', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(null);
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid cursor with 400', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    const bad = Buffer.from('not-json').toString('base64url');
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity?cursor=${bad}`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range limit with 400', async () => {
    mockUser(user(OWNER_ID));
    mockFindById(wsDoc());
    const res = await fetch(`${baseUrl}/api/workspaces/${WS_ID}/activity?limit=1000`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(400);
  });

  it('writes workspace-scoped events on workspace create', async () => {
    const create = vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
    mockUser(user(OWNER_ID));
    let createdData;
    vi.spyOn(Workspace, 'create').mockImplementation(async (data) => {
      createdData = data;
      return { _id: WS_ID, ...data, save: vi.fn().mockResolvedValue(undefined) };
    });
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    mockFindById(wsDoc({ members: [member(OWNER_ID, 'Owner', undefined, 'Owner')], createdBy: OWNER_ID }));

    await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ name: 'Acme AI Engineering' }),
    });
    const event = create.mock.calls.map(([a]) => a).find((a) => a.action === 'workspace.created');
    expect(createdData.members[0].role).toBe('Owner');
    expect(event.workspaceRef).toBe(WS_ID);
  });
});
