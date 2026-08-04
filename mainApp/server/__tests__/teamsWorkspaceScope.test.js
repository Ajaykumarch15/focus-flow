// @vitest-environment node
// IES-P2-01 · team routes become workspace-scoped for non-admins while the
// admin surface (list-all + analytics) is preserved.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const teamsRouter = require('../routes/teams');

const SECRET = 'p2-01-test-teams-scope-32char';
const ADMIN_ID = '5f0000000000000000000a12';
const USER_ID = '5f0000000000000000000d01';
const OWNER_ID = '5f0000000000000000000d02';
const WS_ID = '5f0000000000000000000d10';
const TEAM_ID = '5f0000000000000000000b10';
const M1 = '5f0000000000000000000b01';

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

function mockWorkspaceMembers(role) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ members: [{ userId: OWNER_ID, role }] }),
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

describe('IES-P2-01 · GET /api/teams scoping', () => {
  it('lists only teams in the caller’s workspaces for a non-admin', async () => {
    mockUser(user(USER_ID));
    vi.spyOn(Workspace, 'find').mockImplementation(() => ({
      select: () => Promise.resolve([{ _id: WS_ID }]),
    }));
    let query;
    vi.spyOn(Team, 'find').mockImplementation((q) => {
      query = q;
      return { populate: () => Promise.resolve([]) };
    });

    const res = await fetch(`${baseUrl}/api/teams`, { headers: { Cookie: cookie(USER_ID) } });
    expect(res.status).toBe(200);
    expect(query).toEqual({ workspaceRef: { $in: [WS_ID] } });
  });

  it('returns an empty list when the user belongs to no workspaces', async () => {
    mockUser(user(USER_ID));
    vi.spyOn(Workspace, 'find').mockImplementation(() => ({
      select: () => Promise.resolve([]),
    }));
    let query;
    vi.spyOn(Team, 'find').mockImplementation((q) => {
      query = q;
      return { populate: () => Promise.resolve([]) };
    });

    const res = await fetch(`${baseUrl}/api/teams`, { headers: { Cookie: cookie(USER_ID) } });
    expect(res.status).toBe(200);
    expect(query).toEqual({ _id: { $in: [] } });
  });

  it('still lists ALL teams for an admin', async () => {
    mockUser(user(ADMIN_ID, 'admin'));
    let query;
    vi.spyOn(Team, 'find').mockImplementation((q) => {
      query = q;
      return { populate: () => Promise.resolve([]) };
    });

    const res = await fetch(`${baseUrl}/api/teams`, { headers: { Cookie: cookie(ADMIN_ID) } });
    expect(res.status).toBe(200);
    expect(query).toEqual({});
  });
});

describe('IES-P2-01 · POST /api/teams creation rules', () => {
  it('requires workspaceId for a non-admin', async () => {
    mockUser(user(USER_ID));
    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ name: 'Frontend', description: 'Frontend team', members: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('forbids a non-manager from creating a team in a workspace', async () => {
    mockUser(user(USER_ID));
    mockWorkspaceMembers('Developer');
    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ name: 'Frontend', description: 'Frontend team', workspaceId: WS_ID, members: [] }),
    });
    expect(res.status).toBe(403);
  });

  it('lets a workspace Owner create a workspace-scoped team', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceMembers('Owner');
    let captured;
    const saveSpy = vi.spyOn(Team.prototype, 'save').mockImplementation(function () {
      captured = { workspaceRef: this.workspaceRef, createdBy: this.createdBy };
      return Promise.resolve();
    });
    vi.spyOn(Team.prototype, 'populate').mockResolvedValue({ _id: TEAM_ID, name: 'Frontend', workspaceRef: WS_ID, members: [] });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ name: 'Frontend', description: 'Frontend team', workspaceId: WS_ID, members: [] }),
    });

    expect(res.status).toBe(201);
    expect(saveSpy).toHaveBeenCalled();
    expect(String(captured.workspaceRef)).toBe(WS_ID);
    expect(String(captured.createdBy)).toBe(OWNER_ID);
    const body = await res.json();
    expect(body.workspaceRef).toBe(WS_ID);
  });

  it('still lets an admin create a team without a workspace', async () => {
    mockUser(user(ADMIN_ID, 'admin'));
    let captured;
    const saveSpy = vi.spyOn(Team.prototype, 'save').mockImplementation(function () {
      captured = { workspaceRef: this.workspaceRef, createdBy: this.createdBy };
      return Promise.resolve();
    });
    vi.spyOn(Team.prototype, 'populate').mockResolvedValue({ _id: TEAM_ID, name: 'Core', members: [] });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(ADMIN_ID) },
      body: JSON.stringify({ name: 'Core', description: 'Core team', members: [] }),
    });
    expect(res.status).toBe(201);
    expect(String(captured.createdBy)).toBe(ADMIN_ID);
    expect(captured.workspaceRef ?? null).toBeFalsy();
  });
});

describe('IES-P2-01 · team mutation ownership', () => {
  it('forbids a non-admin from editing a legacy (workspace-less) team', async () => {
    mockUser(user(USER_ID));
    vi.spyOn(Team, 'findById').mockResolvedValue({ _id: TEAM_ID, name: 'Core', members: [], workspaceRef: null });

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ name: 'Hijack' }),
    });
    expect(res.status).toBe(403);
  });

  it('lets a workspace Admin update a workspace team', async () => {
    mockUser(user(OWNER_ID));
    mockWorkspaceMembers('Admin');
    vi.spyOn(Team, 'findById').mockResolvedValue({ _id: TEAM_ID, name: 'Frontend', members: [], workspaceRef: WS_ID });
    vi.spyOn(Team, 'findByIdAndUpdate').mockImplementation(() => ({
      populate: () => Promise.resolve({ _id: TEAM_ID, name: 'Frontend v2', members: [], workspaceRef: WS_ID }),
    }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ name: 'Frontend v2' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('IES-P2-01 · analytics stays admin-only', () => {
  it('allows an admin', async () => {
    mockUser(user(ADMIN_ID, 'admin'));
    vi.spyOn(Team, 'findById').mockImplementation(() => ({
      populate: () => Promise.resolve({ _id: TEAM_ID, name: 'Core', members: [{ _id: M1, name: 'M1', email: 'm1@x.com' }] }),
    }));
    vi.spyOn(Session, 'find').mockImplementation(() => ({ populate: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}/analytics`, { headers: { Cookie: cookie(ADMIN_ID) } });
    expect(res.status).toBe(200);
  });

  it('forbids a non-admin with 403', async () => {
    mockUser(user(USER_ID));
    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}/analytics`, { headers: { Cookie: cookie(USER_ID) } });
    expect(res.status).toBe(403);
  });
});
