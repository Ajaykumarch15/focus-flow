// @vitest-environment node
// IES-P1-22 — admin PATCH /users/:userId whitelists the nested `settings`
// object: unknown keys, wrong types, and out-of-range values are rejected with
// 400, while valid partial settings persist via dotted-path $set (so untouched
// settings fields are preserved, not wiped).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const adminRouter = require('../routes/admin');
const errorHandler = require('../middleware/errorHandler');

function buildAdmin() {
  return new User({
    name: 'Settings Admin',
    email: 'admin@example.com',
    passwordHash: 'not-a-real-hash',
    role: 'admin',
  });
}

function signToken(userId) {
  return jwt.sign({ id: userId.toString(), tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

let server;
let baseUrl;

beforeAll(async () => {
  process.env.JWT_SECRET = 'p1-22-settings-test-secret-at-least-32-chars';
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAuth() {
  const admin = buildAdmin();
  vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(admin),
  }));
  return admin;
}

function mockPatch(updatedUser = { name: 'Target User', settings: {} }) {
  let updateOps;
  vi.spyOn(User, 'findByIdAndUpdate').mockImplementation((_id, ops, opts) => {
    updateOps = { ops, opts };
    return { select: () => Promise.resolve({ _id, ...updatedUser }) };
  });
  return () => updateOps;
}

function mockActivity() {
  vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve({}));
}

const targetUserId = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function patch(body) {
  return fetch(`${baseUrl}/api/admin/users/${targetUserId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${signToken(targetUserId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('IES-P1-22 · admin PATCH user settings whitelist', () => {
  it('rejects unknown settings keys with 400', async () => {
    mockAuth();
    mockPatch();
    mockActivity();

    const res = await patch({ settings: { evil: true } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/evil/);
  });

  it('rejects out-of-range numeric settings', async () => {
    mockAuth();
    mockPatch();
    mockActivity();

    for (const settings of [{ dailyGoal: 99 }, { dailyGoal: -1 }, { pomodoroWork: 0 }, { pomodoroBreak: 500 }]) {
      const res = await patch({ settings });
      expect(res.status).toBe(400);
    }
  });

  it('rejects wrong-typed values', async () => {
    mockAuth();
    mockPatch();
    mockActivity();

    // null/'' must NOT silently coerce to 0 via Number()
    for (const settings of [{ dailyGoal: 'abc' }, { glassmorphism: 'yes' }, { pomodoroWork: 'soon' }, { dailyGoal: null }, { pomodoroBreak: '' }]) {
      const res = await patch({ settings });
      expect(res.status).toBe(400);
    }
  });

  it('rejects invalid enums and malformed hex accent', async () => {
    mockAuth();
    mockPatch();
    mockActivity();

    for (const settings of [{ mode: 'neon' }, { fontSize: 'xl' }, { accentColor: 'red' }, { accentColor: '#12345' }]) {
      const res = await patch({ settings });
      expect(res.status).toBe(400);
    }
  });

  it('persists valid settings via dotted-path $set and preserves other fields', async () => {
    mockAuth();
    const getUpdateOps = mockPatch();
    mockActivity();

    const res = await patch({
      settings: { dailyGoal: 10, timezone: 'America/New_York', pomodoroWork: 50, fontSize: 'lg' },
    });
    expect(res.status).toBe(200);

    const { ops, opts } = getUpdateOps();
    expect(opts).toEqual({ new: true, runValidators: true });
    expect(ops.$set).toEqual({
      'settings.dailyGoal': 10,
      'settings.timezone': 'America/New_York',
      'settings.pomodoroWork': 50,
      'settings.fontSize': 'lg',
    });
    // Untouched settings (mode, accentColor, …) must NOT be in the update —
    // full-object replacement would wipe them.
    expect(Object.keys(ops.$set).some((k) => k.startsWith('settings.') && !['settings.dailyGoal', 'settings.timezone', 'settings.pomodoroWork', 'settings.fontSize'].includes(k))).toBe(false);
  });

  it('coerces numeric strings but still bounds them', async () => {
    mockAuth();
    const getUpdateOps = mockPatch();
    mockActivity();

    const ok = await patch({ settings: { dailyGoal: '8' } });
    expect(ok.status).toBe(200);
    expect(getUpdateOps().ops.$set['settings.dailyGoal']).toBe(8);

    const bad = await patch({ settings: { dailyGoal: '99' } });
    expect(bad.status).toBe(400);
  });

  it('rejects a settings value nested under an unknown path', async () => {
    mockAuth();
    mockPatch();
    mockActivity();

    const res = await patch({ settings: { 'glassmorphism.evil': true } });
    expect(res.status).toBe(400);
  });
});

describe('IES-P1-22 · User settings sub-schema bounds', () => {
  function makeUser(overrides = {}) {
    return new User({
      name: 'Tester',
      email: 'tester@example.com',
      passwordHash: 'hash',
      ...overrides,
    });
  }

  const validate = (doc) => doc.validate().then(() => null).catch((err) => err);

  it('accepts a healthy full settings object', async () => {
    const err = await validate(makeUser({
      settings: { mode: 'light', dailyGoal: 10, pomodoroWork: 50, pomodoroBreak: 10, timezone: 'Asia/Kolkata', accentColor: '#f97316', fontSize: 'lg', glassmorphism: false, animatedBg: false, reducedMotion: true },
    }));
    expect(err).toBeNull();
  });

  it('rejects invalid mode and fontSize enums', async () => {
    const modeErr = await validate(makeUser({ settings: { mode: 'neon' } }));
    expect(modeErr.errors['settings.mode']).toBeDefined();

    const fontSizeErr = await validate(makeUser({ settings: { fontSize: 'xl' } }));
    expect(fontSizeErr.errors['settings.fontSize']).toBeDefined();
  });

  it('bounds pomodoro durations', async () => {
    const workErr = await validate(makeUser({ settings: { pomodoroWork: 0 } }));
    expect(workErr.errors['settings.pomodoroWork']).toBeDefined();

    const breakErr = await validate(makeUser({ settings: { pomodoroBreak: 61 } }));
    expect(breakErr.errors['settings.pomodoroBreak']).toBeDefined();
  });
});
