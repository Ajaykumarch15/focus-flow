import { describe, it, expect } from 'vitest';
import {
  computeSprintVelocity, computeAssignedWork, computePendingReviews,
  computeUpcomingDeadlines, computeWorkspaceProgress,
} from '../TeamWorkspace';

describe('computeSprintVelocity (R1-P6-T1)', () => {
  it('returns 0 for an empty sprint task set instead of fabricating a number', () => {
    expect(computeSprintVelocity([])).toBe(0);
  });

  it('returns 0 when no tasks are done', () => {
    expect(computeSprintVelocity([
      { sprintStatus: 'in_progress', estimatedHours: 8 },
      { sprintStatus: 'review', estimatedHours: 5 },
      { sprintStatus: 'backlog', estimatedHours: 3 },
    ])).toBe(0);
  });

  it('sums only the estimated hours of done tasks', () => {
    expect(computeSprintVelocity([
      { sprintStatus: 'done', estimatedHours: 8 },
      { sprintStatus: 'done', estimatedHours: 13 },
      { sprintStatus: 'in_progress', estimatedHours: 999 },
      { sprintStatus: 'review', estimatedHours: 999 },
    ])).toBe(21);
  });

  it('treats missing estimated hours as zero contribution', () => {
    expect(computeSprintVelocity([
      { sprintStatus: 'done', estimatedHours: 0 },
      { sprintStatus: 'done', estimatedHours: undefined as unknown as number },
      { sprintStatus: 'done', estimatedHours: 5 },
    ])).toBe(5);
  });
});

describe('computeAssignedWork (UX-R1 Mission Control)', () => {
  const tasks = [
    { assigneeId: 'u-1', sprintStatus: 'in_progress', estimatedHours: 8 },
    { assigneeId: 'u-1', sprintStatus: 'backlog', estimatedHours: 5 },
    { assigneeId: 'u-1', sprintStatus: 'done', estimatedHours: 99 },
    { assigneeId: 'u-2', sprintStatus: 'in_progress', estimatedHours: 10 },
    { assigneeId: undefined, sprintStatus: 'in_progress', estimatedHours: 2 },
  ] as const;

  it('counts only open work assigned to the user', () => {
    expect(computeAssignedWork(tasks as any, 'u-1')).toEqual({ count: 2, hours: 13 });
  });

  it('ignores unassigned and other-user tasks', () => {
    expect(computeAssignedWork(tasks as any, 'u-2')).toEqual({ count: 1, hours: 10 });
  });

  it('returns zeroes for an unknown/null user', () => {
    expect(computeAssignedWork(tasks as any, null)).toEqual({ count: 0, hours: 0 });
  });
});

describe('computePendingReviews (UX-R1 Mission Control)', () => {
  const tasks = [
    { reviewerId: 'u-1', sprintStatus: 'review' },
    { reviewerId: 'u-1', sprintStatus: 'review' },
    { reviewerId: 'u-1', sprintStatus: 'done' },
    { reviewerId: 'u-2', sprintStatus: 'review' },
    { reviewerId: undefined, sprintStatus: 'review' },
  ] as const;

  it('counts only review-status tasks assigned to the reviewer', () => {
    expect(computePendingReviews(tasks as any, 'u-1')).toBe(2);
    expect(computePendingReviews(tasks as any, 'u-2')).toBe(1);
    expect(computePendingReviews(tasks as any, null)).toBe(0);
  });
});

describe('computeUpcomingDeadlines (UX-R1 Mission Control)', () => {
  const from = new Date('2026-08-04T12:00:00Z');
  const items = [
    { title: 'Sprint ends: Sprint 24', dueDate: '2026-08-06T00:00:00Z' },
    { title: 'Alpha · Launch checklist', dueDate: '2026-08-12T00:00:00Z' }, // outside 7-day horizon
    { title: 'Past deadline', dueDate: '2026-08-01T00:00:00Z' },
    { title: 'No date', dueDate: '' },
  ];

  it('returns only dated deadlines within the horizon, soonest first', () => {
    expect(computeUpcomingDeadlines(items, 7, from).map((i) => i.title)).toEqual(['Sprint ends: Sprint 24']);
  });

  it('respects a custom horizon', () => {
    expect(computeUpcomingDeadlines(items, 20, from).map((i) => i.title)).toEqual([
      'Sprint ends: Sprint 24',
      'Alpha · Launch checklist',
    ]);
  });
});

describe('computeWorkspaceProgress (UX-R1 Mission Control)', () => {
  it('reports zeros when there are no tasks', () => {
    expect(computeWorkspaceProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('computes done/total percentage', () => {
    expect(computeWorkspaceProgress([
      { sprintStatus: 'done' },
      { sprintStatus: 'done' },
      { sprintStatus: 'in_progress' },
      { sprintStatus: 'backlog' },
    ])).toEqual({ done: 2, total: 4, pct: 50 });
  });
});
