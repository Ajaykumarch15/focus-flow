// @vitest-environment node
// IES-P1-23 · team surfaces exclude soft-deleted users — membership populate
// matches deletedAt: null, nulls are dropped from responses, writes only store
// active member ids, and analytics queries are scoped to active members.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const teamsRouter = require('../routes/teams');

const SECRET = 'p1-23-test-teams-soft-delete-32char';
const ADMIN_ID = '5f0000000000000000000a12';
const TEAM_ID = '5f0000000000000000000b10';
const M1 = '5f0000000000000000000b01';
const M2 = '5f0000000000000000000b02';
const M3_DELETED = '5f0000000000000000000b03';

const signToken = () => jwt.sign({ id: ADMIN_ID, tv: 0 }, SECRET, { expiresIn: '30d' });

let server;
let baseUrl;

function adminUser() {
  return {
    _id: ADMIN_ID,
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    tokenVersion: 0,
    deletedAt: null,
  };
}

function mockFindById() {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(adminUser()),
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

const auth = () => ({ Authorization: `Bearer ${signToken()}` });

describe('IES-P1-23 · GET /api/teams excludes deleted members', () => {
  it('populates members with a deletedAt: null match and drops nulls', async () => {
    mockFindById();
    let populateOpts;
    const team = {
      _id: TEAM_ID,
      name: 'Core',
      members: [
        { _id: M1, name: 'M1', email: 'm1@x.com', avatar: '', role: 'user' },
        null, // the deleted member that populate's match leaves behind
      ],
    };
    vi.spyOn(Team, 'find').mockImplementation(() => ({
      populate: (opts) => {
        populateOpts = opts;
        return Promise.resolve([team]);
      },
    }));

    const res = await fetch(`${baseUrl}/api/teams`, { headers: auth() });

    expect(res.status).toBe(200);
    expect(populateOpts).toEqual({
      path: 'members',
      select: 'name email avatar role',
      match: { deletedAt: null },
    });
    const body = await res.json();
    expect(body[0].members).toHaveLength(1);
    expect(body[0].members[0]._id).toBe(M1);
  });
});

describe('IES-P1-23 · team analytics exclude deleted members', () => {
  it('scopes session/task queries to active member ids only', async () => {
    mockFindById();
    const team = {
      _id: TEAM_ID,
      name: 'Core',
      members: [{ _id: M1, name: 'M1', email: 'm1@x.com' }, null],
    };
    let populateOpts;
    vi.spyOn(Team, 'findById').mockImplementation(() => ({
      populate: (opts) => {
        populateOpts = opts;
        return Promise.resolve(team);
      },
    }));
    const sessionFind = vi.spyOn(Session, 'find').mockImplementation(() => ({
      populate: () => Promise.resolve([]),
    }));
    vi.spyOn(Task, 'find').mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}/analytics`, { headers: auth() });

    expect(res.status).toBe(200);
    expect(populateOpts).toEqual({ path: 'members', select: 'name email', match: { deletedAt: null } });

    const [completedFilter, activeFilter] = sessionFind.mock.calls.map((c) => c[0]);
    expect(completedFilter.userId.$in).toEqual([M1]);
    expect(activeFilter.userId.$in).toEqual([M1]);

    const body = await res.json();
    expect(body.summary.activeMembers).toBe(1);
    expect(body.memberBreakdown).toHaveLength(1);
  });
});

describe('IES-P1-23 · team writes only store active members', () => {
  it('POST /api/teams filters members to active users', async () => {
    mockFindById();
    const userFind = vi.spyOn(User, 'find').mockImplementation(() => ({
      select: () => Promise.resolve([{ _id: M1 }, { _id: M2 }]),
    }));
    vi.spyOn(Team.prototype, 'save').mockResolvedValue(undefined);
    vi.spyOn(Team.prototype, 'populate').mockImplementation(function () {
      return Promise.resolve(this);
    });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ name: 'Core', description: 'Core team', members: [M1, M2, M3_DELETED] }),
    });

    expect(res.status).toBe(201);
    expect(userFind).toHaveBeenCalledWith({ _id: { $in: [M1, M2, M3_DELETED] }, deletedAt: null });
    const body = await res.json();
    expect(body.members).toEqual([M1, M2]);
  });

  it('PATCH /api/teams/:id persists only active members', async () => {
    mockFindById();
    const userFind = vi.spyOn(User, 'find').mockImplementation(() => ({
      select: () => Promise.resolve([{ _id: M1 }]),
    }));
    const findByIdAndUpdate = vi.spyOn(Team, 'findByIdAndUpdate').mockImplementation(() => ({
      populate: () =>
        Promise.resolve({
          _id: TEAM_ID,
          name: 'Core',
          members: [{ _id: M1, name: 'M1', email: 'm1@x.com', avatar: '', role: 'user' }],
        }),
    }));

    const res = await fetch(`${baseUrl}/api/teams/${TEAM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ name: 'Core', members: [M1, M3_DELETED] }),
    });

    expect(res.status).toBe(200);
    expect(userFind).toHaveBeenCalledWith({ _id: { $in: [M1, M3_DELETED] }, deletedAt: null });
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      TEAM_ID,
      { name: 'Core', members: [M1] },
      { new: true }
    );
  });
});
