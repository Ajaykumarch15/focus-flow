import { describe, it, expect } from 'vitest';
import {
  selectSprintFeatures,
  selectSprintCapacity,
  selectSprintVelocity,
  selectSprintRemaining,
  selectSprintByDate,
  type SprintCapacity,
} from '../sprintSelectors';
import type { Feature, Sprint, CollaborativeTask } from '../../types/collaboration';

// EEP2-P4.3.1 (s1: 5 selectors; s2: units mirror P4.2.x — all estimates are
// hours, and load/velocity follow the server computeSprintStats semantics).

const feature = (overrides: Partial<Feature>): Feature => ({
  id: 'f1',
  projectId: 'p1',
  workspaceId: 'ws-1',
  name: 'Feature',
  description: '',
  type: 'feature',
  labels: [],
  estimatedHours: 8,
  status: 'backlog',
  order: 0,
  createdAt: '2026-01-01',
  ...overrides,
});

const task = (overrides: Partial<CollaborativeTask>): CollaborativeTask => ({
  id: 't1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  title: 'Task',
  description: '',
  sprintStatus: 'backlog',
  priority: 'medium',
  ownerId: 'm1',
  followerIds: [],
  labels: [],
  dependencies: [],
  estimatedHours: 4,
  actualHours: 0,
  subtasks: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

const sprint = (overrides: Partial<Sprint>): Sprint => ({
  id: 's1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  name: 'Sprint 1',
  startDate: '2026-01-01',
  endDate: '2026-01-07',
  goal: '',
  status: 'draft',
  capacityHours: 160,
  targetVelocity: 80,
  ...overrides,
});

describe('selectSprintFeatures (P4.3.1)', () => {
  it('returns only features carrying the sprintRef, in order', () => {
    const features = [
      feature({ id: 'f2', sprintId: 's1', order: 2 }),
      feature({ id: 'f1', sprintId: 's1', order: 1 }),
      feature({ id: 'f3', sprintId: 's2' }),
      feature({ id: 'f4' }), // backlog — no sprintRef
    ];
    expect(selectSprintFeatures('s1', features).map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('treats undefined sprintId as the Project Backlog (sprint-less)', () => {
    const features = [
      feature({ id: 'f1', sprintId: 's1' }),
      feature({ id: 'f2' }),
      feature({ id: 'f3' }),
    ];
    expect(selectSprintFeatures(undefined, features).map((f) => f.id)).toEqual(['f2', 'f3']);
  });

  it('does not mutate the input array', () => {
    const input = [
      feature({ id: 'f2', sprintId: 's1', order: 2 }),
      feature({ id: 'f1', sprintId: 's1', order: 1 }),
    ];
    const snapshot = input.map((f) => f.id);
    selectSprintFeatures('s1', input);
    expect(input.map((f) => f.id)).toEqual(snapshot);
  });
});

describe('selectSprintCapacity (P4.3.1)', () => {
  it('sums feature + task estimatedHours against capacityHours (units = hours)', () => {
    const plan: SprintCapacity = selectSprintCapacity(
      sprint({ capacityHours: 100 }),
      [feature({ estimatedHours: 40 }), feature({ estimatedHours: 20 })],
      [task({ estimatedHours: 10 }), task({ estimatedHours: 30 })],
    );
    expect(plan.capacityHours).toBe(100);
    expect(plan.load).toBe(100);
    expect(plan.loadBreakdown).toEqual({ features: 60, tasks: 40 });
    expect(plan.loadPct).toBe(100);
    expect(plan.remainingHours).toBe(0);
    expect(plan.overCapacity).toBe(false);
  });

  it('flags over-capacity when load exceeds the budget', () => {
    const plan = selectSprintCapacity(
      sprint({ capacityHours: 50 }),
      [feature({ estimatedHours: 60 })],
      [],
    );
    expect(plan.overCapacity).toBe(true);
    expect(plan.remainingHours).toBe(0); // clamped — never negative
    expect(plan.loadPct).toBe(120);
  });

  it('treats capacityHours 0 as uncapped (no guard, loadPct 0)', () => {
    const plan = selectSprintCapacity(
      sprint({ capacityHours: 0 }),
      [feature({ estimatedHours: 500 })],
      [],
    );
    expect(plan.overCapacity).toBe(false);
    expect(plan.loadPct).toBe(0);
    expect(plan.remainingHours).toBe(0);
  });

  it('handles a missing sprint honestly (no fabrication of numbers)', () => {
    const plan = selectSprintCapacity(null, [feature({ estimatedHours: 8 })], []);
    expect(plan.capacityHours).toBe(0);
    expect(plan.load).toBe(8);
    expect(plan.overCapacity).toBe(false);
  });

  it('ignores malformed estimates instead of NaN-ing the total', () => {
    const plan = selectSprintCapacity(
      sprint({ capacityHours: 10 }),
      [{ ...feature({ estimatedHours: 0 }), estimatedHours: Number.NaN }],
      [task({ estimatedHours: 3 })],
    );
    expect(plan.load).toBe(3);
    expect(Number.isFinite(plan.loadPct)).toBe(true);
  });
});

describe('selectSprintVelocity (P4.3.1)', () => {
  it('counts completed items only — done features + done tasks', () => {
    const velocity = selectSprintVelocity(
      [
        feature({ id: 'done-f', status: 'done', estimatedHours: 30 }),
        feature({ id: 'open-f', status: 'in_progress', estimatedHours: 20 }),
      ],
      [
        task({ id: 'done-t', sprintStatus: 'done', estimatedHours: 10 }),
        task({ id: 'review-t', sprintStatus: 'review', estimatedHours: 5 }),
      ],
    );
    expect(velocity.velocity).toBe(40);
    expect(velocity.velocityBreakdown).toEqual({ features: 30, tasks: 10 });
    expect(velocity.completedCount).toEqual({ features: 1, tasks: 1 });
  });

  it('returns a zeroed shape when nothing is complete', () => {
    expect(selectSprintVelocity([feature({ status: 'backlog' })], [])).toEqual({
      velocity: 0,
      velocityBreakdown: { features: 0, tasks: 0 },
      completedCount: { features: 0, tasks: 0 },
    });
  });
});

describe('selectSprintRemaining (P4.3.1)', () => {
  it('is capacity minus load, clamped at zero', () => {
    expect(selectSprintRemaining(sprint({ capacityHours: 100 }), [feature({ estimatedHours: 40 })], [task({ estimatedHours: 10 })])).toBe(50);
    expect(selectSprintRemaining(sprint({ capacityHours: 20 }), [feature({ estimatedHours: 40 })], [])).toBe(0);
  });
});

describe('selectSprintByDate (P4.3.1)', () => {
  const sprints = [
    sprint({ id: 's1', startDate: '2026-01-01', endDate: '2026-01-07' }),
    sprint({ id: 's2', startDate: '2026-01-08', endDate: '2026-01-14' }),
  ];

  it('matches a date inside the time-box (inclusive both ends)', () => {
    expect(selectSprintByDate(sprints, '2026-01-01')?.id).toBe('s1');
    expect(selectSprintByDate(sprints, '2026-01-07')?.id).toBe('s1');
    expect(selectSprintByDate(sprints, '2026-01-10')?.id).toBe('s2');
    expect(selectSprintByDate(sprints, '2026-01-14')?.id).toBe('s2');
  });

  it('accepts a Date object and slices to the calendar day', () => {
    expect(selectSprintByDate(sprints, new Date('2026-01-05T23:59:00Z'))?.id).toBe('s1');
  });

  it('returns null for a date with no covering sprint (honest gap)', () => {
    expect(selectSprintByDate(sprints, '2026-02-01')).toBeNull();
  });
});
