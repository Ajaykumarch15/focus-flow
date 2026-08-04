import { describe, it, expect } from 'vitest';
import type { CollaborativeTask } from '../../../types/collaboration';
import { computeFeatureProgress, groupTasksByFeature } from '../FeaturesPage';

const task = (overrides: Partial<{ id: string; featureId?: string; sprintStatus: string; title: string }>): CollaborativeTask => ({
  id: overrides.id ?? `t-${Math.random()}`,
  workspaceId: 'w1',
  projectId: 'p1',
  featureId: overrides.featureId,
  title: overrides.title ?? 'Task',
  description: '',
  sprintStatus: (overrides.sprintStatus ?? 'backlog') as CollaborativeTask['sprintStatus'],
  priority: 'medium',
  ownerId: 'u1',
  followerIds: [],
  labels: [],
  dependencies: [],
  estimatedHours: 0,
  actualHours: 0,
  subtasks: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

describe('computeFeatureProgress (R1-P6-T2)', () => {
  it('returns null pct for an empty linked-task set instead of fabricating 0/100', () => {
    expect(computeFeatureProgress([])).toEqual({ done: 0, total: 0, pct: null });
  });

  it('returns 0 when no linked task is done', () => {
    expect(computeFeatureProgress([
      { sprintStatus: 'in_progress' },
      { sprintStatus: 'review' },
    ])).toEqual({ done: 0, total: 2, pct: 0 });
  });

  it('rounds the done/total ratio to a percentage', () => {
    expect(computeFeatureProgress([
      { sprintStatus: 'done' },
      { sprintStatus: 'done' },
      { sprintStatus: 'in_progress' },
    ])).toEqual({ done: 2, total: 3, pct: 67 });
  });

  it('returns 100 when every linked task is done', () => {
    expect(computeFeatureProgress([
      { sprintStatus: 'done' },
      { sprintStatus: 'done' },
    ])).toEqual({ done: 2, total: 2, pct: 100 });
  });
});

describe('groupTasksByFeature (R1-P6-T2)', () => {
  it('returns an empty map for an empty task set', () => {
    expect(groupTasksByFeature([]).size).toBe(0);
  });

  it('groups tasks by featureRef', () => {
    const tasks = [
      task({ id: 'a1', featureId: 'f1' }),
      task({ id: 'a2', featureId: 'f1' }),
      task({ id: 'b1', featureId: 'f2' }),
    ];
    const map = groupTasksByFeature(tasks);
    expect(map.get('f1')?.map((t) => t.id)).toEqual(['a1', 'a2']);
    expect(map.get('f2')?.map((t) => t.id)).toEqual(['b1']);
  });

  it('skips tasks with no featureRef (sprint-board-only tasks)', () => {
    const tasks = [task({ id: 'orphan', featureId: undefined })];
    expect(groupTasksByFeature(tasks).size).toBe(0);
  });
});
