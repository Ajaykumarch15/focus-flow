import { describe, it, expect } from 'vitest';
import {
  selectProjectTimelineEvents,
  filterTimelineEvents,
  groupTimelineEventsByDay,
} from '../projectTimelineSelectors';
import { dayKey } from '../../utils/time';
import type {
  CentralBlocker,
  CollaborativeTask,
  Feature,
  Project,
  Sprint,
  WorkspaceActivity,
  WorkspaceMember,
} from '../../types/collaboration';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  workspaceId: 'ws-1',
  name: 'AI Copilot',
  key: 'FF',
  description: '',
  members: [],
  teamIds: [],
  status: 'active',
  milestones: [],
  createdAt: '2026-01-05',
  ...overrides,
});

const sprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  name: 'Sprint 12',
  startDate: '2026-03-01',
  endDate: '2026-03-14',
  goal: '',
  status: 'completed',
  capacityHours: 160,
  targetVelocity: 80,
  ...overrides,
});

const feature = (overrides: Partial<Feature> = {}): Feature => ({
  id: 'f1',
  projectId: 'p1',
  workspaceId: 'ws-1',
  name: 'Inline completions',
  description: '',
  type: 'feature',
  labels: [],
  estimatedHours: 8,
  status: 'in_progress',
  order: 1,
  createdAt: '2026-02-01',
  ...overrides,
});

const task = (overrides: Partial<CollaborativeTask> = {}): CollaborativeTask => ({
  id: 't1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  sprintId: 's1',
  featureId: 'f1',
  title: 'Wire the model endpoint',
  description: '',
  sprintStatus: 'in_progress',
  priority: 'high',
  ownerId: 'm-1',
  assigneeId: 'm-1',
  followerIds: [],
  labels: [],
  dependencies: [],
  estimatedHours: 8,
  actualHours: 0,
  subtasks: [],
  createdAt: '2026-02-20',
  updatedAt: '2026-03-10',
  ...overrides,
});

const blocker = (overrides: Partial<CentralBlocker> = {}): CentralBlocker => ({
  id: 'b1',
  workspaceId: 'ws-1',
  taskId: 't1',
  title: 'Model latency spikes',
  severity: 'high',
  ownerId: 'm-1',
  reporterId: 'm-2',
  status: 'open',
  impactDescription: '',
  createdAt: '2026-03-08',
  ...overrides,
});

const member = (id: string, name: string): WorkspaceMember => ({
  id,
  name,
  email: `${id}@focusflow.io`,
  role: 'Developer',
  teams: [],
  status: 'available',
  joinedAt: '2026-01-01',
});

const activity = (overrides: Partial<WorkspaceActivity>): WorkspaceActivity => ({
  id: 'a-1',
  workspaceId: 'ws-1',
  actor: { id: 'm-1', name: 'Ada Lovelace' },
  action: 'task.created',
  details: {},
  timestamp: '2026-03-09T10:00:00.000Z',
  ...overrides,
});

const p1 = project();

describe('projectTimelineSelectors (P1-T2)', () => {
  it('scopes workspace activity to the project via taskId/featureId/sprintId/projectName', () => {
    const activities = [
      activity({ id: 'a-task', action: 'task.created', details: { taskId: 't1', taskTitle: 'Wire the model endpoint' } }),
      activity({ id: 'a-feature', action: 'feature.created', details: { featureId: 'f1', featureName: 'Inline completions' } }),
      activity({ id: 'a-sprint', action: 'sprint.created', details: { sprintId: 's1', sprintName: 'Sprint 12' } }),
      activity({ id: 'a-project', action: 'project.created', details: { projectName: 'AI Copilot' } }),
      activity({ id: 'a-foreign-task', action: 'task.created', details: { taskId: 'other-task', taskTitle: 'Elsewhere' } }),
      activity({ id: 'a-workspace', action: 'workspace.updated', details: { workspaceName: 'ws' } }),
      activity({ id: 'a-other-ws', action: 'task.created', details: { taskId: 't1' }, workspaceId: 'ws-2' }),
    ];
    const events = selectProjectTimelineEvents({
      project: p1,
      tasks: [task()],
      features: [feature()],
      sprints: [sprint()],
      blockers: [],
      activities,
      members: [],
    });
    const workspaceKinds = events.filter((e) => e.id.startsWith('activity:')).map((e) => e.id);
    expect(workspaceKinds).toEqual(expect.arrayContaining(['activity:a-task', 'activity:a-feature', 'activity:a-sprint', 'activity:a-project']));
    expect(workspaceKinds).not.toContain('activity:a-foreign-task');
    expect(workspaceKinds).not.toContain('activity:a-workspace');
    expect(workspaceKinds).not.toContain('activity:a-other-ws');
  });

  it('derives project-scoped events from the collaboration store', () => {
    const events = selectProjectTimelineEvents({
      project: project({ milestones: [
        { id: 'ms-1', title: 'Beta', dueDate: '2026-03-20', status: 'completed', targetPoints: 40 },
        { id: 'ms-2', title: 'GA', dueDate: '2026-06-01', status: 'planning', targetPoints: 80 },
      ] }),
      tasks: [task(), task({ id: 't2', title: 'Shipped', sprintStatus: 'done' })],
      features: [feature()],
      sprints: [sprint(), sprint({ id: 's2', status: 'active' })],
      blockers: [blocker(), blocker({ id: 'b2', status: 'resolved' })],
      activities: [],
      members: [member('m-1', 'Ada Lovelace'), member('m-2', 'Grace Hopper')],
    });
    const kinds = events.map((e) => `${e.kind}:${e.targetId ?? ''}`).sort();
    expect(kinds).toContain('project.created:p1');
    expect(kinds).toContain('task.created:t1');
    expect(kinds).toContain('task.completed:t2');
    expect(kinds).toContain('feature.created:f1');
    expect(kinds).toContain('blocker.raised:b1');
    expect(kinds).toContain('blocker.raised:b2');
    expect(kinds).toContain('release.shipped:ms-1');
    expect(kinds).toContain('milestone.due:ms-2');
    expect(kinds).toContain('sprint.started:s1');
    expect(kinds).toContain('sprint.ended:s1');
    expect(kinds).toContain('sprint.started:s2');
    expect(kinds).not.toContain('sprint.ended:s2');

    const blockerEvent = events.find((e) => e.kind === 'blocker.raised' && e.targetId === 'b1');
    expect(blockerEvent?.actorName).toBe('Grace Hopper');
    expect(blockerEvent?.detail).toBe('high: Model latency spikes');
  });

  it('keeps workspace-feed events over derived duplicates (real actor wins)', () => {
    const activities = [activity({
      id: 'a-task',
      action: 'task.created',
      details: { taskId: 't1', taskTitle: 'Wire the model endpoint' },
      timestamp: '2026-02-20T09:00:00.000Z',
    })];
    const events = selectProjectTimelineEvents({
      project: p1,
      tasks: [task()],
      features: [],
      sprints: [],
      blockers: [],
      activities,
      members: [member('m-1', 'Ada Lovelace')],
    });
    const taskCreated = events.filter((e) => e.kind === 'task.created' && e.targetId === 't1');
    expect(taskCreated).toHaveLength(1);
    expect(taskCreated[0].id).toBe('activity:a-task');
    expect(taskCreated[0].actorName).toBe('Ada Lovelace');
  });

  it('sorts events newest-first across sources', () => {
    const events = selectProjectTimelineEvents({
      project: project({ createdAt: '2026-03-10T08:00:00.000Z' }),
      tasks: [task({ createdAt: '2026-03-08T08:00:00.000Z', sprintStatus: 'done', updatedAt: '2026-03-09T08:00:00.000Z' })],
      features: [],
      sprints: [],
      blockers: [],
      activities: [],
      members: [],
    });
    const times = events.map((e) => new Date(e.timestamp).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('groups events by day, days newest-first, events grouped in order', () => {
    const tA = '2026-03-12T09:00:00.000Z';
    const tB = '2026-03-10T09:00:00.000Z';
    const tProject = '2026-03-10T08:00:00.000Z';
    const events = selectProjectTimelineEvents({
      project: project({ createdAt: tProject }),
      tasks: [
        task({ id: 't-a', createdAt: tA }),
        task({ id: 't-b', createdAt: tB }),
      ],
      features: [],
      sprints: [],
      blockers: [],
      activities: [],
      members: [],
    });
    const days = groupTimelineEventsByDay(events);
    const expectedKeys = [...new Set([dayKey(tA), dayKey(tProject), dayKey(tB)])].sort((a, b) => b.localeCompare(a));
    expect(days.map((d) => d.dayKey)).toEqual(expectedKeys);
    expect(days[0].events[0].targetId).toBe('t-a');
  });

  it('filters by entity type, "all" returns everything', () => {
    const events = selectProjectTimelineEvents({
      project: p1,
      tasks: [task()],
      features: [],
      sprints: [],
      blockers: [blocker()],
      activities: [],
      members: [],
    });
    const filtered = filterTimelineEvents(events, 'blocker');
    expect(filtered.every((e) => e.entityType === 'blocker')).toBe(true);
    expect(filtered.map((e) => e.targetId)).toContain('b1');
    expect(filterTimelineEvents(events, 'all')).toHaveLength(events.length);
  });

  it('always surfaces project creation, and nothing else when there is no data', () => {
    const events = selectProjectTimelineEvents({
      project: p1,
      tasks: [],
      features: [],
      sprints: [],
      blockers: [],
      activities: [],
      members: [],
    });
    expect(events.map((e) => e.kind)).toEqual(['project.created']);
    expect(events[0].detail).toBe('Project: AI Copilot');
    expect(groupTimelineEventsByDay(events)).toHaveLength(1);
  });
});
