// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const protect = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');
const { notFoundHandler, normalizeError } = errorHandler;

const SECRET = 'p0-14-test-secret-at-least-32-chars-long';
const USER_ID = '5f0000000000000000000d1';

// IES-P0-14: no raw err.message leaks, JSON 404, sanitized 5xx.
describe('errorHandler.normalizeError', () => {
  it('keeps crafted 4xx errors with status, code and message', () => {
    const err = new Error('Invalid report date');
    err.status = 400;
    const { status, body } = normalizeError(err);
    expect(status).toBe(400);
    expect(body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid report date' } });
  });

  it('maps Mongoose ValidationError to a structured 400', () => {
    const err = new Error('validation failed');
    err.name = 'ValidationError';
    err.errors = { title: { message: 'title is required' } };
    const { status, body } = normalizeError(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('title is required');
  });

  it('maps Mongoose CastError to a structured 400 without echoing raw values', () => {
    const err = new Error('Cast to ObjectId failed for value "NaN" at path "_id"');
    err.name = 'CastError';
    err.path = '_id';
    const { status, body } = normalizeError(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_PARAMETER');
    expect(body.error.message).toBe('Invalid value for "_id"');
    expect(JSON.stringify(body)).not.toContain('NaN');
  });

  it('maps duplicate-key errors to 409 CONFLICT', () => {
    const err = new Error('dup key');
    err.code = 11000;
    const { status, body } = normalizeError(err);
    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('sanitizes unknown errors as 500 — raw message never leaks', () => {
    const err = new Error('MongoServerError: bad auth: password="hunter2"');
    const { status, body } = normalizeError(err);
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' } });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});

let server;
let baseUrl;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;

  const app = express();
  app.use(express.json());

  app.get('/boom', (_req, _res, next) => next(new Error('secret internal detail: "db-password"')));
  app.get('/four-hundred', (_req, _res, next) => {
    const err = new Error('Invalid report date');
    err.status = 400;
    next(err);
  });
  app.get('/cast-error', (_req, _res, next) => {
    const err = new Error('bad cast');
    err.name = 'CastError';
    err.path = 'taskId';
    next(err);
  });
  app.get('/protected', protect, (_req, res) => res.json({ ok: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);

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

describe('IES-P0-14 · JSON 404 catch-all', () => {
  it('returns { error: { code: NOT_FOUND } } for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
});

describe('IES-P0-14 · sanitized 5xx', () => {
  it('returns a generic message and never the raw error text', async () => {
    const res = await fetch(`${baseUrl}/boom`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' } });
    expect(JSON.stringify(body)).not.toContain('db-password');
  });
});

describe('IES-P0-14 · structured 4xx from next(err)', () => {
  it('keeps crafted 4xx errors with their message and code', async () => {
    const res = await fetch(`${baseUrl}/four-hundred`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid report date' } });
  });

  it('maps CastError to 400 INVALID_PARAMETER', async () => {
    const res = await fetch(`${baseUrl}/cast-error`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMETER');
  });
});

describe('IES-P0-14 · protect distinguishes auth failure from DB error', () => {
  it('DB failure in protect becomes a sanitized 500, not a misleading 401', async () => {
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.reject(new Error('Mongo connection lost')),
    }));
    const token = jwt.sign({ id: USER_ID, tv: 0 }, SECRET);
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Cookie: `ff_session=${token}` },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('still returns 401 for a bad token', async () => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Cookie: 'ff_session=not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });
});
