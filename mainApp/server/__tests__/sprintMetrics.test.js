// @vitest-environment node
// EEP2-P4.2.2/P4.2.3 · capacity + velocity math (DDS §10).
// Pure unit tests for utils/sprintMetrics.js — no database.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  sumEstimated,
  computeSprintLoad,
  computeSprintStats,
  assertWithinCapacity,
} = require('../utils/sprintMetrics');

const sprint = (over = {}) => ({ _id: '5f0000000000000000000a01', ...over });
const feature = (estimatedHours, status = 'backlog', id = 'f') => ({ _id: id, estimatedHours, status });
const task = (estimatedHours, sprintStatus = 'backlog', id = 't') => ({ _id: id, estimatedHours, sprintStatus });

describe('sumEstimated', () => {
  it('sums estimatedHours, treating missing/absent as 0', () => {
    expect(sumEstimated([feature(3), feature(4), feature(0), feature(5)])).toBe(12);
    expect(sumEstimated([])).toBe(0);
    expect(sumEstimated([{ _id: 'x' }, { _id: 'y', estimatedHours: '2' }])).toBe(2);
  });
});

describe('computeSprintLoad', () => {
  it('adds feature and task hours into a single total', () => {
    const load = computeSprintLoad([feature(6), feature(2)], [task(3), task(1)]);
    expect(load).toEqual({ featureHours: 8, taskHours: 4, total: 12 });
  });

  it('returns zero when empty', () => {
    expect(computeSprintLoad()).toEqual({ featureHours: 0, taskHours: 0, total: 0 });
  });
});

describe('computeSprintStats', () => {
  it('returns zeros for an empty sprint without a budget', () => {
    const stats = computeSprintStats({ sprint: sprint(), features: [], tasks: [] });
    expect(stats).toMatchObject({
      capacityHours: 0,
      targetVelocity: 0,
      load: 0,
      loadPct: 0,
      remainingHours: 0,
      overCapacity: false,
      velocity: 0,
      completedCount: { features: 0, tasks: 0 },
    });
    expect(stats.sprintId).toBe('5f0000000000000000000a01');
  });

  it('computes load, capacity pct and remaining hours', () => {
    const stats = computeSprintStats({
      sprint: sprint({ capacityHours: 100, targetVelocity: 80 }),
      features: [feature(20, 'ready'), feature(40, 'in_progress')],
      tasks: [task(15, 'ready')],
    });
    expect(stats.load).toBe(75);
    expect(stats.loadPct).toBe(75);
    expect(stats.remainingHours).toBe(25);
    expect(stats.overCapacity).toBe(false);
    expect(stats.loadBreakdown).toEqual({ features: 60, tasks: 15 });
  });

  it('reports overCapacity when load exceeds the budget and does not cap loadPct', () => {
    const stats = computeSprintStats({
      sprint: sprint({ capacityHours: 10 }),
      features: [feature(8), feature(5)],
      tasks: [task(2)],
    });
    expect(stats.load).toBe(15);
    expect(stats.overCapacity).toBe(true);
    expect(stats.loadPct).toBe(150);
    expect(stats.remainingHours).toBe(0);
  });

  it('treats capacityHours 0 as uncapped (never overCapacity)', () => {
    const stats = computeSprintStats({ sprint: sprint(), features: [feature(99)] });
    expect(stats.overCapacity).toBe(false);
    expect(stats.loadPct).toBe(0);
  });

  it('velocity counts completed items ONLY — done Features + done Tasks', () => {
    const stats = computeSprintStats({
      sprint: sprint(),
      features: [
        feature(10, 'done', 'f1'),
        feature(5, 'backlog', 'f2'),
        feature(4, 'review', 'f3'),
        feature(2, 'in_progress', 'f4'),
      ],
      tasks: [
        task(3, 'done', 't1'),
        task(2, 'ready', 't2'),
        task(1, 'done', 't3'),
      ],
    });
    expect(stats.velocity).toBe(14); // 10 (f1) + 3 (t1) + 1 (t3)
    expect(stats.velocityBreakdown).toEqual({ features: 10, tasks: 4 });
    expect(stats.completedCount).toEqual({ features: 1, tasks: 2 });
  });
});

describe('assertWithinCapacity', () => {
  it('allows when capacityHours is 0 (uncapped)', () => {
    expect(assertWithinCapacity({ sprint: sprint(), features: [feature(500)], incomingHours: 100 })).toBeNull();
  });

  it('allows at or under the budget', () => {
    expect(assertWithinCapacity({ sprint: sprint({ capacityHours: 20 }), features: [feature(5)], tasks: [task(5)], incomingHours: 10 })).toBeNull();
  });

  it('rejects with 409 when the projected load exceeds the budget', () => {
    const err = assertWithinCapacity({ sprint: sprint({ capacityHours: 20 }), features: [feature(5)], tasks: [task(6)], incomingHours: 10 });
    expect(err.status).toBe(409);
    expect(err.message).toContain('21h exceeds the 20h sprint capacity');
  });

  it('rejects when the sprint is already over capacity', () => {
    const err = assertWithinCapacity({ sprint: sprint({ capacityHours: 10 }), features: [feature(12)], incomingHours: 0 });
    expect(err.status).toBe(409);
  });
});
