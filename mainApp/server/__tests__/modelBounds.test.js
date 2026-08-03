// @vitest-environment node
// IES-P1-07: schema-level bounds on Session and User. Validation is exercised
// via `validate()` (no DB connection needed) so hostile input can never poison
// a document on the next save.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Session = require('../models/Session');
const User = require('../models/User');
const { Types } = require('mongoose');

const userId = new Types.ObjectId();
const taskId = new Types.ObjectId();

function validate(doc) {
  return doc.validate().then(() => null).catch((err) => err);
}

describe('IES-P1-07 · Session schema bounds', () => {
  function makeSession(overrides = {}) {
    return new Session({
      userId,
      taskId,
      startTime: 1000,
      isActive: false,
      activeTime: 0,
      totalPauseDuration: 0,
      pauseCount: 0,
      focusScore: 0,
      ...overrides,
    });
  }

  it('accepts a healthy closed session', async () => {
    const err = await validate(makeSession({ activeTime: 25 * 60 * 1000, focusScore: 85 }));
    expect(err).toBeNull();
  });

  it('rejects a negative activeTime', async () => {
    const err = await validate(makeSession({ activeTime: -1 }));
    expect(err).not.toBeNull();
    expect(err.errors.activeTime).toBeDefined();
  });

  it('rejects a negative totalPauseDuration', async () => {
    const err = await validate(makeSession({ totalPauseDuration: -5 }));
    expect(err.errors.totalPauseDuration).toBeDefined();
  });

  it('rejects a negative pauseCount', async () => {
    const err = await validate(makeSession({ pauseCount: -1 }));
    expect(err.errors.pauseCount).toBeDefined();
  });

  it('rejects a focusScore above 100', async () => {
    const err = await validate(makeSession({ focusScore: 150 }));
    expect(err.errors.focusScore).toBeDefined();
  });

  it('rejects a negative focusScore', async () => {
    const err = await validate(makeSession({ focusScore: -3 }));
    expect(err.errors.focusScore).toBeDefined();
  });

  it('bounds are inclusive (0 and 100 are valid)', async () => {
    const err = await validate(makeSession({ focusScore: 100, activeTime: 0 }));
    expect(err).toBeNull();
  });
});

describe('IES-P1-07 · User schema bounds', () => {
  function makeUser(overrides = {}) {
    return new User({
      name: 'Tester',
      email: 'tester@example.com',
      passwordHash: 'hash',
      streak: { current: 0, best: 0 },
      totalPoints: 0,
      settings: { dailyGoal: 8 },
      ...overrides,
    });
  }

  it('accepts a healthy profile', async () => {
    const err = await validate(makeUser());
    expect(err).toBeNull();
  });

  it('rejects a non-email email format', async () => {
    const err = await validate(makeUser({ email: 'not-an-email' }));
    expect(err).not.toBeNull();
    expect(err.errors.email).toBeDefined();
  });

  it('rejects an over-long name', async () => {
    const err = await validate(makeUser({ name: 'x'.repeat(101) }));
    expect(err.errors.name).toBeDefined();
  });

  it('rejects an over-long avatar', async () => {
    const err = await validate(makeUser({ avatar: 'a'.repeat(2001) }));
    expect(err.errors.avatar).toBeDefined();
  });

  it('rejects negative streak.current / streak.best', async () => {
    const err = await validate(makeUser({ streak: { current: -1, best: 0 } }));
    expect(err.errors['streak.current']).toBeDefined();

    const err2 = await validate(makeUser({ streak: { current: 0, best: -2 } }));
    expect(err2.errors['streak.best']).toBeDefined();
  });

  it('rejects negative totalPoints', async () => {
    const err = await validate(makeUser({ totalPoints: -1 }));
    expect(err.errors.totalPoints).toBeDefined();
  });

  it('bounds settings.dailyGoal to 0..24', async () => {
    const err = await validate(makeUser({ settings: { dailyGoal: 25 } }));
    expect(err.errors['settings.dailyGoal']).toBeDefined();

    const err2 = await validate(makeUser({ settings: { dailyGoal: -1 } }));
    expect(err2.errors['settings.dailyGoal']).toBeDefined();

    const ok = await validate(makeUser({ settings: { dailyGoal: 24 } }));
    expect(ok).toBeNull();
  });
});
