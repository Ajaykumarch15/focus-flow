import { describe, it, expect } from 'vitest';
import { computeFeatureCompletionRate } from '../ReportsAnalyticsPage';

describe('computeFeatureCompletionRate (IES-P1-20)', () => {
  it('returns null for an empty task set instead of fabricating 100%', () => {
    expect(computeFeatureCompletionRate([])).toBeNull();
  });

  it('returns 0 when no features are done', () => {
    expect(computeFeatureCompletionRate([
      { sprintStatus: 'todo' },
      { sprintStatus: 'in-progress' },
    ])).toBe(0);
  });

  it('returns the rounded completion percentage', () => {
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
});
