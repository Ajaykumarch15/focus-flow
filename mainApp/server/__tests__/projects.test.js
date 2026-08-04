// @vitest-environment node
// IES-P1-12 · project uniqueness + regex hardening — the create route must
// never interpolate user input into a RegExp, and case-insensitive duplicates
// must be blocked at the DB (unique `{ userId, nameKey }`) with a friendly 400.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const projectRouter = require('../routes/projects');

const SECRET = 'p1-12-test-project-secret-32char';
const USER_ID = '5f0000000000000000000d3';

const signToken = () => jwt.sign({ id: USER_ID, tv: 0 }, SECRET, { expiresIn: '30d' });

let server;
let baseUrl;

function authUser() {
  return {
    _id: USER_ID,
    name: 'Project User',
    email: 'project@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    googleConnected: false,
  };
}

function mockFindById(user = authUser()) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

function mockFindOne(value) {
  return vi.spyOn(Project, 'findOne').mockResolvedValue(value);
}

function mockCreate(valueOrError) {
  return vi.spyOn(Project, 'create').mockImplementation(async () => {
    if (valueOrError instanceof Error) throw valueOrError;
    return valueOrError;
  });
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

describe('IES-P1-12 · model — case-insensitive uniqueness at the DB', () => {
  it('declares the unique (userId, nameKey) index', () => {
    const hasUnique = Project.schema.indexes().some(
      ([key, opts]) =>
        JSON.stringify(key) === JSON.stringify({ userId: 1, nameKey: 1 }) && opts.unique === true
    );
    expect(hasUnique, 'Project is missing the unique (userId, nameKey) index').toBe(true);
  });

  it('no longer declares the case-sensitive (userId, name) unique index', () => {
    const hasOld = Project.schema.indexes().some(
      ([key, opts]) => JSON.stringify(key) === JSON.stringify({ userId: 1, name: 1 }) && opts.unique === true
    );
    expect(hasOld).toBe(false);
  });

  it('derives nameKey (lowercased, trimmed) before validation', async () => {
    const doc = new Project({ userId: new Types.ObjectId(), name: '  Acme API v2 ' });
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.name).toBe('Acme API v2');
    expect(doc.nameKey).toBe('acme api v2');
  });

  it('keeps nameKey in lockstep even when it was set to something else', async () => {
    const doc = new Project({ userId: new Types.ObjectId(), name: 'Foo' });
    doc.nameKey = 'stale';
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.nameKey).toBe('foo');
  });

  it('deriveNameKey handles regex metacharacters and whitespace', () => {
    expect(Project.deriveNameKey('  Acme (2) [prod] +  ')).toBe('acme (2) [prod] +');
    expect(Project.deriveNameKey('Über API')).toBe('über api');
  });
});

describe('IES-P1-12 · POST /api/projects — no regex path, duplicates blocked', () => {
  it('rejects unauthenticated callers', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });

  it('matches by exact lowercased nameKey — no $regex interpolation of user input', async () => {
    mockFindById();
    const findOneSpy = mockFindOne(null);
    mockCreate({ _id: 'p1', name: 'Acme (2) [prod] +', nameKey: 'acme (2) [prod] +' });

    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken()}` },
      body: JSON.stringify({ name: '  Acme (2) [prod] +  ' }),
    });

    expect(res.status).toBe(201);
    expect(findOneSpy).toHaveBeenCalledWith({ userId: USER_ID, workspaceRef: null, nameKey: 'acme (2) [prod] +' });
    const findCall = findOneSpy.mock.calls[0][0];
    expect(findCall).not.toHaveProperty('$regex');
    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, name: 'Acme (2) [prod] +' })
    );
  });

  it('rejects a case-insensitive duplicate with a 400 and never creates', async () => {
    mockFindById();
    mockFindOne({ _id: 'existing', nameKey: 'acme' });
    const createSpy = vi.spyOn(Project, 'create').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken()}` },
      body: JSON.stringify({ name: 'ACME' }),
    });

    expect(res.status).toBe(400);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('maps a DB duplicate-key race (E11000) to the same friendly 400', async () => {
    mockFindById();
    mockFindOne(null);
    const duplicateKeyError = Object.assign(new Error('duplicate'), { code: 11000 });
    mockCreate(duplicateKeyError);

    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken()}` },
      body: JSON.stringify({ name: 'Race Project' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('A project with this name already exists');
  });
});
