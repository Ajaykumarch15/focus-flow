// @vitest-environment node
// IES-P1-25 · register TOCTOU / duplicate-key handling + password/email policy.
//   - Concurrent registers for the same email: exactly one 201, one 409 — the
//     unique-index race (E11000) is mapped to a friendly conflict, never a raw
//     Mongo error leaking to the client.
//   - Weak (<12 char) passwords and malformed emails are rejected at the schema.
//
// The register route mounts a strict per-IP limiter whose store is shared across
// every test in this file, so it is neutralized here BEFORE auth.js destructures
// it at load time. Everything is loaded through the same (native) require graph
// to keep a single mongoose instance — mixing ESM imports would double-compile
// the models and trip OverwriteModelError.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const rateLimitMiddleware = require('../middleware/rateLimit');
rateLimitMiddleware.createAuthLoginLimiter = () => (_req, _res, next) => next();
rateLimitMiddleware.createAuthRegisterLimiter = () => (_req, _res, next) => next();
rateLimitMiddleware.createApiLimiter = () => (_req, _res, next) => next();

const express = require('express');
const User = require('../models/User');
const authRouter = require('../routes/auth');
const errorHandler = require('../middleware/errorHandler');

const SECRET = 'p1-25-register-policy-test-secret-32char';

let server;
let baseUrl;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(async () => {
  process.env.JWT_SECRET = SECRET;
  server = http.createServer(buildApp());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => server.close(resolve));
});

function postRegister(body) {
  return fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = { name: 'Ada', email: 'ada@example.com', password: 'correct-horse-battery-staple' };

describe('IES-P1-25 · register duplicate handling', () => {
  it('two concurrent registers for one email yield one 201 and one 409 (no raw E11000)', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'hashPassword').mockResolvedValue('hashed');
    let calls = 0;
    vi.spyOn(User, 'create').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { _id: '5f0000000000000000000abc', name: 'Ada', email: validBody.email, tokenVersion: 0 };
      const dup = new Error('E11000 duplicate key error');
      dup.code = 11000;
      throw dup;
    });

    const [a, b] = await Promise.all([postRegister(validBody), postRegister(validBody)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflict = a.status === 409 ? a : b;
    const conflictBody = await conflict.json();
    expect(conflictBody.message).toBe('An account with this email already exists');
    expect(JSON.stringify(conflictBody)).not.toMatch(/E11000|duplicate key/i);

    const ok = a.status === 201 ? a : b;
    expect(await ok.json()).toMatchObject({ user: { email: validBody.email } });
  });

  it('returns 409 with a friendly message when the email already exists', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({ _id: '5f0000000000000000000abc' });

    const res = await postRegister(validBody);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('An account with this email already exists');
  });
});

describe('IES-P1-25 · password/email policy', () => {
  it('rejects a weak password (< 12 chars) with a validation error', async () => {
    const res = await postRegister({ ...validBody, password: 'short8!' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('at least 12 characters');
  });

  it('rejects a malformed email at the schema', async () => {
    const res = await postRegister({ ...validBody, email: 'not-an-email' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('Invalid email');
  });

  it('accepts a compliant register (201)', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'hashPassword').mockResolvedValue('hashed');
    vi.spyOn(User, 'create').mockResolvedValue({ _id: '5f0000000000000000000abd', name: 'Ada', email: validBody.email, tokenVersion: 0 });

    const res = await postRegister(validBody);
    expect(res.status).toBe(201);
  });
});
