import { describe, it, expect } from 'vitest';
import { selectTeamToday } from '../missionControlSelectors';

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    title: 'Ship the dashboard',
    priority: 'medium',
    assigneeId: 'm-1',
    sprintStatus: 'in_progress',
    gitContext: undefined,
    updatedAt: '2026-08-05T09:00:00Z',
    ...overrides,
  } as const;
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm-1',
    name: 'Ada',
    status: 'in_focus',
    currentFocusTask: 'Ship the dashboard',
    currentFocusTimeMs: 1_800_000,
    ...overrides,
  } as const;
}

describe('selectTeamToday (S3-T4 Mission Control)', () => {
  it('returns empty buckets when there are no tasks or members', () => {
    expect(selectTeamToday([], [], null)).toEqual({ working: [], inProgress: [] });
  });

  it('lists only in_focus members as working now', () => {
    const members = [
      member({ id: 'm-1', status: 'in_focus' }),
      member({ id: 'm-2', status: 'available' }),
      member({ id: 'm-3', status: 'offline' }),
      member({ id: 'm-4', status: 'in_meeting' }),
    ];
    const view = selectTeamToday([], members as any, null);
    expect(view.working.map((w) => w.memberId)).toEqual(['m-1']);
  });

  it('surfaces an honest null focus task when a member has none recorded', () => {
    const members = [member({ id: 'm-1', currentFocusTask: undefined, currentFocusTimeMs: undefined })];
    const view = selectTeamToday([], members as any, null);
    expect(view.working[0]).toEqual({
      memberId: 'm-1', memberName: 'Ada', focusTask: null, focusTimeMs: null,
    });
  });

  it('includes only in_progress tasks, never backlog/review/done', () => {
    const tasks = [
      task({ id: 't-1', sprintStatus: 'in_progress' }),
      task({ id: 't-2', sprintStatus: 'review' }),
      task({ id: 't-3', sprintStatus: 'done' }),
      task({ id: 't-4', sprintStatus: 'backlog' }),
    ];
    expect(selectTeamToday(tasks as any, [], null).inProgress.map((t) => t.taskId)).toEqual(['t-1']);
  });

  it('resolves the assignee name from the member roster', () => {
    const tasks = [task({ id: 't-1', assigneeId: 'm-1' })];
    const view = selectTeamToday(tasks as any, [member({ id: 'm-1' })] as any, null);
    expect(view.inProgress[0].assigneeName).toBe('Ada');
  });

  it('keeps assigneeName null when the assignee is not on the roster', () => {
    const tasks = [task({ id: 't-1', assigneeId: 'ghost' })];
    expect(selectTeamToday(tasks as any, [], null).inProgress[0].assigneeName).toBeNull();
  });

  it('marks a task assignedToMe only for the current user', () => {
    const tasks = [
      task({ id: 't-1', assigneeId: 'm-1' }),
      task({ id: 't-2', assigneeId: 'm-2' }),
    ];
    const view = selectTeamToday(tasks as any, [member({ id: 'm-1' })] as any, 'm-1');
    expect(view.inProgress.find((t) => t.taskId === 't-1')?.assignedToMe).toBe(true);
    expect(view.inProgress.find((t) => t.taskId === 't-2')?.assignedToMe).toBe(false);
  });

  it('carries the git branch when present and null otherwise', () => {
    const withBranch = task({ id: 't-1', gitContext: { branch: 'feat/dashboard' } });
    const without = task({ id: 't-2', gitContext: undefined });
    const view = selectTeamToday([withBranch, without] as any, [], null);
    expect(view.inProgress.find((t) => t.taskId === 't-1')?.branch).toBe('feat/dashboard');
    expect(view.inProgress.find((t) => t.taskId === 't-2')?.branch).toBeNull();
  });

  it('ranks assigned-to-me first, then priority, then recency', () => {
    const tasks = [
      task({ id: 'urgent-other', priority: 'urgent', assigneeId: 'm-2', updatedAt: '2026-08-05T09:00:00Z' }),
      task({ id: 'mine-low', priority: 'low', assigneeId: 'm-1', updatedAt: '2026-08-04T09:00:00Z' }),
      task({ id: 'high-new', priority: 'high', assigneeId: 'm-2', updatedAt: '2026-08-05T11:00:00Z' }),
      task({ id: 'high-old', priority: 'high', assigneeId: 'm-2', updatedAt: '2026-08-05T08:00:00Z' }),
    ];
    const view = selectTeamToday(tasks as any, [member({ id: 'm-1' })] as any, 'm-1');
    expect(view.inProgress.map((t) => t.taskId)).toEqual([
      'mine-low', 'urgent-other', 'high-new', 'high-old',
    ]);
  });

  it('respects the limit', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task({ id: `t-${i}`, updatedAt: `2026-08-05T0${i}:00:00Z` }));
    expect(selectTeamToday(tasks as any, [], null, 3).inProgress).toHaveLength(3);
  });
});
