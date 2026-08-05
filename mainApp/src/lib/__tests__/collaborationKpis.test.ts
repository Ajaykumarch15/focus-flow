import { describe, it, expect } from 'vitest';
import { computeFeatureCompletionRate, computeVelocity } from '../collaborationKpis';

describe('computeVelocity (R1-P6-T5 · S4-T2 canonical home)', () => {
  it('returns 0 delivered for an empty sprint instead of a fabricated number', () => {
    expect(computeVelocity([], 80)).toEqual({ delivered: 0, pct: 0 });
  });

  it('returns 0 when no tasks are done', () => {
    expect(computeVelocity([
      { sprintStatus: 'in_progress', estimatedHours: 8 },
      { sprintStatus: 'review', estimatedHours: 5 },
      { sprintStatus: 'backlog', estimatedHours: 3 },
    ], 80)).toEqual({ delivered: 0, pct: 0 });
  });

  it('sums only the estimated hours of done tasks', () => {
    expect(computeVelocity([
      { sprintStatus: 'done', estimatedHours: 8 },
      { sprintStatus: 'done', estimatedHours: 13 },
      { sprintStatus: 'in_progress', estimatedHours: 999 },
      { sprintStatus: 'review', estimatedHours: 999 },
    ], 80)).toEqual({ delivered: 21, pct: 26 });
  });

  it('treats missing estimated hours as zero contribution', () => {
    expect(computeVelocity([
      { sprintStatus: 'done', estimatedHours: 0 },
      { sprintStatus: 'done', estimatedHours: undefined as unknown as number },
      { sprintStatus: 'done', estimatedHours: 5 },
    ], 80)).toEqual({ delivered: 5, pct: 6 });
  });

  it('reports a null pct when the target velocity is zero (no false 0%)', () => {
    expect(computeVelocity([{ sprintStatus: 'done', estimatedHours: 5 }], 0)).toEqual({ delivered: 5, pct: null });
  });

  it('caps a delivered amount above target at a truthful pct (not capped)', () => {
    expect(computeVelocity([{ sprintStatus: 'done', estimatedHours: 10 }], 8)).toEqual({ delivered: 10, pct: 125 });
  });
});

describe('computeFeatureCompletionRate (IES-P1-20 / R1-P6-T5)', () => {
  it('returns null for an empty set instead of fabricating 100%', () => {
    expect(computeFeatureCompletionRate([])).toBeNull();
  });

  it('returns 0 when nothing is done (task shape)', () => {
    expect(computeFeatureCompletionRate([
      { sprintStatus: 'todo' },
      { sprintStatus: 'in-progress' },
    ])).toBe(0);
  });

  it('returns the rounded completion percentage (task shape)', () => {
    expect(computeFeatureCompletionRate([
      { sprintStatus: 'done' },
      { sprintStatus: 'done' },
      { sprintStatus: 'todo' },
    ])).toBe(67);
  });

  it('returns 100 when every feature is done', () => {
    expect(computeFeatureCompletionRate([
      { sprintStatus: 'done' },
      { sprintStatus: 'done' },
    ])).toBe(100);
  });

  it('computes the live Feature completion rate from feature `status`', () => {
    expect(computeFeatureCompletionRate([
      { status: 'done' },
      { status: 'done' },
      { status: 'backlog' },
    ])).toBe(67);
  });

  it('treats a feature with status done as complete', () => {
    expect(computeFeatureCompletionRate([
      { status: 'done' },
      { status: 'in_progress' },
      { status: 'review' },
    ])).toBe(33);
  });
});
