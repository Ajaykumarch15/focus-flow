import { describe, it, expect } from 'vitest';
import type { Feature } from '@collab/types/collaboration';
import {
  orderBacklog, filterBacklog, assignFeatureToSprint,
  type BacklogFilters,
} from '../ProjectBacklog';

const feature = (overrides: Partial<Feature>): Feature => ({
  id: `f-${Math.random()}`,
  projectId: 'p1',
  workspaceId: 'w1',
  name: 'Feature',
  description: '',
  type: 'feature',
  labels: [],
  ownerId: 'u1',
  estimatedHours: 8,
  status: 'backlog',
  order: 0,
  createdAt: '2026-01-01',
  ...overrides,
});

const noFilters: BacklogFilters = { search: '', status: 'all', type: 'all', owner: 'all', label: 'all' };

describe('orderBacklog (R1-P6-T3)', () => {
  it('returns only sprint-less features', () => {
    const inSprint = feature({ id: 'a', sprintId: 's1' });
    const free = feature({ id: 'b' });
    expect(orderBacklog([inSprint, free]).map((f) => f.id)).toEqual(['b']);
  });

  it('orders backlog features by the server `order` field', () => {
    const items = [
      feature({ id: 'z', order: 3 }),
      feature({ id: 'a', order: 0 }),
      feature({ id: 'm', order: 1 }),
    ];
    expect(orderBacklog(items).map((f) => f.id)).toEqual(['a', 'm', 'z']);
  });

  it('returns an empty list when every feature is committed', () => {
    expect(orderBacklog([feature({ sprintId: 's1' }), feature({ sprintId: 's2' })])).toEqual([]);
  });
});

describe('filterBacklog (R1-P6-T3)', () => {
  it('matches search across name and description (case-insensitive)', () => {
    const items = [
      feature({ id: 'a', name: 'Auth Gateway' }),
      feature({ id: 'b', name: 'Billing', description: 'handles webhooks' }),
      feature({ id: 'c', name: 'Notes' }),
    ];
    expect(filterBacklog(items, { ...noFilters, search: 'gateway' }).map((f) => f.id)).toEqual(['a']);
    expect(filterBacklog(items, { ...noFilters, search: 'WEBHOOKS' }).map((f) => f.id)).toEqual(['b']);
    expect(filterBacklog(items, { ...noFilters, search: 'zzz' })).toEqual([]);
  });

  it('filters by status', () => {
    const items = [
      feature({ id: 'a', status: 'backlog' }),
      feature({ id: 'b', status: 'in_progress' }),
    ];
    expect(filterBacklog(items, { ...noFilters, status: 'in_progress' }).map((f) => f.id)).toEqual(['b']);
  });

  it('filters by work-item type', () => {
    const items = [
      feature({ id: 'a', type: 'feature' }),
      feature({ id: 'b', type: 'bug' }),
    ];
    expect(filterBacklog(items, { ...noFilters, type: 'bug' }).map((f) => f.id)).toEqual(['b']);
  });

  it('filters by owner id', () => {
    const items = [
      feature({ id: 'a', ownerId: 'u1' }),
      feature({ id: 'b', ownerId: 'u2' }),
      feature({ id: 'c', ownerId: undefined }),
    ];
    expect(filterBacklog(items, { ...noFilters, owner: 'u2' }).map((f) => f.id)).toEqual(['b']);
  });

  it('filters by label membership', () => {
    const items = [
      feature({ id: 'a', labels: ['backend', 'p1'] }),
      feature({ id: 'b', labels: ['frontend'] }),
    ];
    expect(filterBacklog(items, { ...noFilters, label: 'p1' }).map((f) => f.id)).toEqual(['a']);
    expect(filterBacklog(items, { ...noFilters, label: 'all' }).map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('combines filters with AND semantics', () => {
    const items = [
      feature({ id: 'a', type: 'bug', status: 'backlog', name: 'Crash on login' }),
      feature({ id: 'b', type: 'bug', status: 'done', name: 'Crash on login' }),
    ];
    const result = filterBacklog(items, { ...noFilters, type: 'bug', status: 'backlog', search: 'crash' });
    expect(result.map((f) => f.id)).toEqual(['a']);
  });
});

describe('assignFeatureToSprint drag-drop handler (R1-P6-T3)', () => {
  it('commits a backlog feature into a sprint by setting sprintId', () => {
    const items = [feature({ id: 'a' }), feature({ id: 'b' })];
    const next = assignFeatureToSprint(items, 'a', 's1');
    expect(next.find((f) => f.id === 'a')?.sprintId).toBe('s1');
    expect(next.find((f) => f.id === 'b')?.sprintId).toBeUndefined();
  });

  it('un-tethers a feature back to the backlog with a null sprintId', () => {
    const items = [feature({ id: 'a', sprintId: 's1' })];
    const next = assignFeatureToSprint(items, 'a', null);
    expect(next.find((f) => f.id === 'a')?.sprintId).toBeUndefined();
  });

  it('leaves the other features untouched', () => {
    const items = [feature({ id: 'a' }), feature({ id: 'b', sprintId: 's9' })];
    const next = assignFeatureToSprint(items, 'a', 's2');
    expect(next.find((f) => f.id === 'b')?.sprintId).toBe('s9');
  });

  it('is a pure map — the input list is not mutated', () => {
    const items = [feature({ id: 'a' })];
    const next = assignFeatureToSprint(items, 'a', 's1');
    expect(items[0].sprintId).toBeUndefined();
    expect(next[0].sprintId).toBe('s1');
  });
});
