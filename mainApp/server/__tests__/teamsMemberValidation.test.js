// @vitest-environment node
// IES-P2-02 · team member validation + indexes — membership writes reject
// nonexistent / soft-deleted ids instead of silently dropping them, the Team
// model indexes `members` + `createdBy` (member-based queries), and
// GET /api/teams?memberId= filters by member (admins any user, non-admin self).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Activity = require('../models/Activity');
const teamsRouter = require('../routes/teams');

const SECRET = 'p2-02-test-team-members-32char';
const ADMIN_ID = '5f0000000000000000000a12';
const USER_ID = '5f0000000000000000000d01';
const OWNER_ID = '5f0000000000000000000d02';
const WS_ID = '5f0000000000000000000d10';
const TEAM_ID = '5f0000000000000000000b10';
const M1 = '5f0000000000000000000b01';
const M2 = '5f0000000000000000000b02';
const GHOST = '5f0000000000000000000bad';

const signToken = (id = USER_ID) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function user(id, role = 'user') {
  return { _id: id, name: 'User', email: 'user@focusflow.io', role, tokenVersion: 0, deletedAt: null };
}

function mockUser(u) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve(u) }));
}

function mockWorkspaceManager(role) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ members: [{ userId: OWNER_ID, role }] }),
  }));
}

function mockMemberLookup(ids) {
  return vi.spyOn(User, 'find').mockImplementation(() => ({
    select: () => Promise.resolve(ids.map((id) => ({ _id: id }))),
  }));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = 'http://localhost:5173';

  const app = express();
  app.use(express.json());
  app.use('/api/teams', teamsRouter);
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

describe('IES-P2-02 · Team model indexes', () => {
  it('declares members (multikey) and createdBy indexes for member-based queries', () => {
    const indexKeys = Team.schema.indexes().map(([key]) => key);
    expect(indexKeys).toContainEqual({ members: 1 });
    expect(indexKeys).toContainEqual({ createdBy: 1 });
    expect(indexKeys).toContainEqual({ workspaceRef: 1 });
  });
});

describe('IES-P2-02 · POST /api/teams member validation', () => {
  it('rejects a create when a member id does not resolve to an active user', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceManager('Owner');
    const userFind = mockMemberLookup([M1]);
    const saveSpy = vi.spyOn(Team.prototype, 'save');

    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ name: 'Frontend', description: 'Frontend team', workspaceId: WS_ID, members: [M1, GHOST] }),
    });

    expect(res.status).toBe(404);
    expect(userFind).toHaveBeenCalledWith({ _id: { $in: [M1, GHOST] }, deletedAt: null });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('creates a team with only resolved active member ids', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceManager('Owner');
    mockMemberLookup([M1, M2]);
    let captured;
    vi.spyOn(Team.prototype, 'save').mockImplementation(function () {
      captured = this.members;
      return Promise.resolve();
    });
    vi.spyOn(Team.prototype, 'populate').mockResolvedValue({
      _id: TEAM_ID, name: 'Frontend', members: [{ _id: M1 }, { _id: M2 }], workspaceRef: WS_ID,
    });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ name: 'Frontend', description: 'Frontend team', workspaceId: WS_ID, members: [M1, M2] }),
    });

    expect(res.status).toBe(201);
    expect(captured.map(String)).toEqual([M1, M2]);
  });
});

describe('IES-P2-02 · PATCH /api/teams/:id member validation', () => {
  it('rejects a patch that references a nonexistent member', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceManager('Admin');
    vi.spyOn(Team, 'findById').mockResolvedValue({ _id: TEAM_ID, name: 'Frontend', members: [], workspaceRef: WS_ID });
    mockMemberLookup([M1]);
    const findByIdAndUpdate = vi.spyOn(Team, 'findByIdAndUpdate');

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ members: [M1, GHOST] }),
    });

    expect(res.status).toBe(404);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('persists resolved member ids when all are active users', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceManager('Admin');
    vi.spyOn(Team, 'findById').mockResolvedValue({ _id: TEAM_ID, name: 'Frontend', members: [], workspaceRef: WS_ID });
    mockMemberLookup([M1, M2]);
    const findByIdAndUpdate = vi.spyOn(Team, 'findByIdAndUpdate').mockImplementation(() => ({
      populate: () =>
        Promise.resolve({
          _id: TEAM_ID, name: 'Frontend', members: [{ _id: M1 }, { _id: M2 }], workspaceRef: WS_ID,
        }),
    }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ members: [M1, M2] }),
    });

    expect(res.status).toBe(200);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(TEAM_ID, { members: [M1, M2] }, { new: true });
  });
});

describe('IES-P2-02 · POST /api/teams/:id/members validation', () => {
  it('returns 404 for a nonexistent user', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceManager('Admin');
    vi.spyOn(Team, 'findById').mockResolvedValue({ _id: TEAM_ID, name: 'Frontend', members: [], workspaceRef: WS_ID });
    mockMemberLookup([]);

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ userId: GHOST }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 409 when the user is already a member', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceManager('Admin');
    vi.spyOn(Team, 'findById').mockResolvedValue({ _id: TEAM_ID, name: 'Frontend', members: [M1], workspaceRef: WS_ID });
    mockMemberLookup([M1]);

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ userId: M1 }),
    });

    expect(res.status).toBe(409);
  });
});

describe('IES-P2-02 · member-based queries', () => {
  it('lets an admin list teams by any member id', async () => {
    mockUser(user(ADMIN_ID, 'admin'));
    let query;
    vi.spyOn(Team, 'find').mockImplementation((q) => {
      query = q;
      return { populate: () => Promise.resolve([]) };
    });

    const res = await fetch(`${baseUrl}/api/teams?memberId=${M1}`, { headers: { Cookie: cookie(ADMIN_ID) } });

    expect(res.status).toBe(200);
    expect(query).toEqual({ members: M1 });
  });

  it('lets a non-admin list their own team memberships within their workspaces', async () => {
    mockUser(user(USER_ID));
    vi.spyOn(Workspace, 'find').mockImplementation(() => ({
      select: () => Promise.resolve([{ _id: WS_ID }]),
    }));
    let query;
    vi.spyOn(Team, 'find').mockImplementation((q) => {
      query = q;
      return { populate: () => Promise.resolve([]) };
    });

    const res = await fetch(`${baseUrl}/api/teams?memberId=${USER_ID}`, { headers: { Cookie: cookie(USER_ID) } });

    expect(res.status).toBe(200);
    expect(query).toEqual({ members: USER_ID, workspaceRef: { $in: [WS_ID] } });
  });

  it('forbids a non-admin from querying another user’s memberships', async () => {
    mockUser(user(USER_ID));

    const res = await fetch(`${baseUrl}/api/teams?memberId=${M1}`, { headers: { Cookie: cookie(USER_ID) } });

    expect(res.status).toBe(403);
  });
});

describe('IES-P2-02 · populate returns real users', () => {
  it('GET /api/teams/:id returns populated active member docs', async () => {
    mockUser(user(OWNER_ID));
    const member = { _id: M1, name: 'M1', email: 'm1@x.com', avatar: '', role: 'user' };
    vi.spyOn(Team, 'findById').mockImplementation(() => ({
      populate: () => Promise.resolve({ _id: TEAM_ID, name: 'Frontend', members: [member], workspaceRef: WS_ID }),
    }));
    vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve({ members: [{ userId: OWNER_ID, role: 'Owner' }] }),
    }));

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}`, { headers: { Cookie: cookie(OWNER_ID) } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0]._id).toBe(M1);
  });
});
