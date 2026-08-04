// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Habit = require('../models/Habit');
const taskRoutes = require('../routes/tasks');
const habitRoutes = require('../routes/habits');
const errorHandler = require('../middleware/errorHandler');
const { notFoundHandler } = errorHandler;
const { z, objectId, dateInput, intInRange, requiredString, validate } = require('../utils/validation');

const SECRET = 'p0-16-test-secret-at-least-32-chars-long';
const USER_ID = '5f0000000000000000000d1';
const VALID_OID = '507f1f77bcf86cd799439011';

let server;
let baseUrl;
let apiUrl;

function mockUser() {
  return {
    _id: USER_ID,
    name: 'Validation User',
    email: 'val@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function mockFindById(user) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;

  const sampleSchema = z.object({
    title: requiredString(200, 'title', 'Title is required'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    targetMinutes: intInRange(1, 1440, 'targetMinutes').optional(),
    deadline: dateInput.optional(),
    tags: z.array(z.string().max(50)).max(50, 'Too many tags').optional(),
  });
  const paramsSchema = z.object({ id: objectId });

  const app = express();
  app.use(express.json());
  app.post('/echo', validate(sampleSchema), (req, res) => res.json(req.body));
  app.get('/p/:id', validate(null, { params: paramsSchema }), (req, res) => res.json({ id: req.params.id }));
  app.get('/q', validate(null, { query: z.object({ from: z.coerce.number().finite().optional() }) }), (req, res) => res.json(req.query));
  app.use(notFoundHandler);
  app.use(errorHandler);

  const api = express();
  api.use(express.json());
  api.use('/api/tasks', taskRoutes);
  api.use('/api/habits', habitRoutes);
  api.use(notFoundHandler);
  api.use(errorHandler);

  server = http.createServer((req, res) => {
    const base = req.url.startsWith('/api') ? api : app;
    base(req, res);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  apiUrl = baseUrl;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-P0-16 · validate middleware — accept paths', () => {
  it('accepts valid input and coerces numeric strings', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '  Ship feature  ', targetMinutes: '30', deadline: '2025-01-15', tags: ['a', 'b'], priority: 'high' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Ship feature');
    expect(body.targetMinutes).toBe(30);
  });

  it('accepts a valid ObjectId param', async () => {
    const res = await fetch(`${baseUrl}/p/${VALID_OID}`);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(VALID_OID);
  });

  it('accepts valid query timestamps', async () => {
    const res = await fetch(`${baseUrl}/q?from=1750000000000`);
    expect(res.status).toBe(200);
    expect((await res.json()).from).toBe(1750000000000);
  });
});

describe('IES-P0-16 · validate middleware — reject paths', () => {
  it('rejects a missing required title with a structured 400', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('Title is required');
  });

  it('rejects an invalid enum value', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x', priority: 'banana' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects NaN numeric input instead of coercing to 0', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x', targetMinutes: 'abc' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid deadline date string', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x', deadline: 'not-a-date' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized arrays (would bloat the document)', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x', tags: new Array(51).fill('y') }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Too many tags');
  });

  it('rejects an invalid ObjectId param', async () => {
    const res = await fetch(`${baseUrl}/p/not-an-id`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-numeric query timestamp', async () => {
    const res = await fetch(`${baseUrl}/q?from=abc`);
    expect(res.status).toBe(400);
  });
});

describe('IES-P0-16 · integration through real routers', () => {
  const cookieHeader = (token) => `ff_session=${token}`;

  it('task PATCH rejects a malformed ObjectId in the URL before hitting the DB', async () => {
    mockFindById(mockUser());
    const res = await fetch(`${apiUrl}/api/tasks/not-an-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jwt.sign({ id: USER_ID, tv: 0 }, SECRET)) },
      body: JSON.stringify({ title: 'x' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('habit create rejects NaN targetMinutes before persisting', async () => {
    mockFindById(mockUser());
    const res = await fetch(`${apiUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jwt.sign({ id: USER_ID, tv: 0 }, SECRET)) },
      body: JSON.stringify({ title: 'Meditate', targetMinutes: 'abc' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('habit create with a valid body reaches the handler (accept path)', async () => {
    mockFindById(mockUser());
    const createSpy = vi.spyOn(Habit, 'create').mockResolvedValue({ _id: 'abc', title: 'Meditate', targetMinutes: 30 });
    const res = await fetch(`${apiUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jwt.sign({ id: USER_ID, tv: 0 }, SECRET)) },
      body: JSON.stringify({ title: 'Meditate', targetMinutes: '30' }),
    });
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalled();
    expect(createSpy.mock.calls[0][0].targetMinutes).toBe(30);
  });
});
