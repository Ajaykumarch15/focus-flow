import { describe, it, expect } from 'vitest';
import {
  selectCurrentSprint,
  selectProjectTasks,
  selectProjectMembers,
  selectProjectTeams,
  selectActiveFeatures,
  selectProjectBlockers,
  selectRecentWork,
  selectMilestonesByDate,
  selectProjectHealth,
  selectProjectOverview,
} from '../projectOverviewSelectors';
import type {
  CentralBlocker,
  CollaborativeTask,
  Feature,
  Project,
  ProjectMilestone,
  Sprint,
  WorkspaceMember,
  WorkspaceTeam,
} from '../../types/collaboration';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  workspaceId: 'ws-1',
  name: 'AI Copilot',
  key: 'FF',
  description: 'Engineering overview target',
  members: ['m-1', 'm-2'],
  teamIds: ['t-1'],
  status: 'active',
  milestones: [],
  createdAt: '2026-01-01',
  ...overrides,
});

const sprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  name: 'Sprint 12 — Ship Copilot',
  startDate: '2026-03-01',
  endDate: '2026-03-14',
  goal: 'Ship the assistant to production',
  status: 'active',
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
  estimatedHours: 16,
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

const member = (overrides: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  id: 'm-1',
  name: 'Ada Lovelace',
  email: 'ada@focusflow.io',
  role: 'Developer',
  teams: [],
  status: 'available',
  joinedAt: '2026-01-01',
  ...overrides,
});

const team = (overrides: Partial<WorkspaceTeam> = {}): WorkspaceTeam => ({
  id: 't-1',
  name: 'AI',
  description: '',
  memberIds: ['m-1'],
  color: '#8b5cf6',
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
  impactDescription: 'Blocks code review',
  createdAt: '2026-03-08',
  ...overrides,
});

const milestone = (overrides: Partial<ProjectMilestone> = {}): ProjectMilestone => ({
  id: 'ms-1',
  title: 'Beta release',
  dueDate: '2026-03-20',
  status: 'active',
  targetPoints: 40,
  ...overrides,
});

describe('projectOverviewSelectors (P1-T1)', () => {
  it('selects the active sprint for a project, ignoring other statuses/projects', () => {
    const sprints = [
      sprint({ id: 's-draft', status: 'draft' }),
      sprint({ status: 'active' }),
      sprint({ id: 's-done', status: 'completed' }),
      sprint({ id: 's-other', projectId: 'p2', status: 'active' }),
    ];
    expect(selectCurrentSprint(sprints, 'p1')?.id).toBe('s1');
    expect(selectCurrentSprint(sprints, 'p2')?.id).toBe('s-other');
    expect(selectCurrentSprint([], 'p1')).toBeNull();
  });

  it('filters tasks by projectId', () => {
    const tasks = [task(), task({ id: 't-other', projectId: 'p2' })];
    expect(selectProjectTasks(tasks, 'p1').map((t) => t.id)).toEqual(['t1']);
  });

  it('resolves member and team ids in project order', () => {
    const members = [member(), member({ id: 'm-2', name: 'Grace Hopper' })];
    const teams = [team()];
    expect(selectProjectMembers(members, ['m-2', 'm-1']).map((m) => m.name)).toEqual(['Grace Hopper', 'Ada Lovelace']);
    expect(selectProjectTeams(teams, ['t-1', 'missing']).map((t) => t.name)).toEqual(['AI']);
  });

  it('surfaces ready/in_progress features with progress, excluding backlog/done and other projects', () => {
    const features = [
      feature(),
      feature({ id: 'f2', name: 'Suggestions', status: 'ready' }),
      feature({ id: 'f3', name: 'Backlog item', status: 'backlog' }),
      feature({ id: 'f4', name: 'Shipped', status: 'done' }),
      feature({ id: 'f5', name: 'Other project', projectId: 'p2', status: 'in_progress' }),
    ];
    const tasks = [task({ featureId: 'f1' }), task({ id: 't-done', featureId: 'f1', sprintStatus: 'done' }), task({ id: 't-unlinked', featureId: 'f-other' })];
    const views = selectActiveFeatures(features, tasks, 'p1');
    expect(views.map((v) => v.feature.id)).toEqual(['f1', 'f2']);
    expect(views[0].progress).toEqual({ done: 1, total: 2, pct: 50 });
    expect(views[1].progress).toEqual({ done: 0, total: 0, pct: null });
  });

  it('attributes blockers through task ids, sorts by severity, and resolves task titles', () => {
    const blockers = [
      blocker({ id: 'b-low', severity: 'low' }),
      blocker({ id: 'b-critical', severity: 'critical' }),
      blocker({ id: 'b-other', taskId: 't-other-project' }),
      blocker({ id: 'b-unlinked', taskId: undefined }),
    ];
    const projectTasks = [task()];
    const views = selectProjectBlockers(blockers, projectTasks);
    expect(views.map((b) => b.id)).toEqual(['b-critical', 'b-low']);
    expect(views[0].taskTitle).toBe('Wire the model endpoint');
    expect(views[1].taskTitle).toBe('Wire the model endpoint');
  });

  it('returns the most recently updated open/done work, bounded by limit', () => {
    const tasks = [
      task({ id: 't-new', sprintStatus: 'in_progress', updatedAt: '2026-03-12' }),
      task({ id: 't-mid', sprintStatus: 'done', updatedAt: '2026-03-11' }),
      task({ id: 't-old', sprintStatus: 'backlog', updatedAt: '2026-03-10' }),
      task({ id: 't-other', sprintStatus: 'done', updatedAt: '2026-03-09' }),
    ];
    const recent = selectRecentWork(tasks, 2);
    expect(recent.map((t) => t.id)).toEqual(['t-new', 't-mid']);
  });

  it('orders milestones by due date', () => {
    const ms = [milestone({ id: 'm-late', dueDate: '2026-04-01' }), milestone({ id: 'm-early', dueDate: '2026-02-01' })];
    expect(selectMilestonesByDate(ms).map((m) => m.id)).toEqual(['m-early', 'm-late']);
  });

  it('computes health without fabricating zeros when no data exists', () => {
    const tasks = [task(), task({ id: 't-done', sprintStatus: 'done' }), task({ id: 't-review', sprintStatus: 'review' })];
    const features = [feature(), feature({ id: 'f-done', status: 'done' })];
    const blockers = [blocker({ status: 'open' }), blocker({ id: 'b-resolved', status: 'resolved' })];

    const health = selectProjectHealth(sprint(), tasks, features, blockers, tasks);
    expect(health.velocity).toEqual({ delivered: 8, pct: 10 });
    expect(health.featureCompletion).toBe(50);
    expect(health.openBlockers).toBe(1);
    expect(health.pendingReviews).toBe(1);

    const empty = selectProjectHealth(null, [], [], [], []);
    expect(empty.velocity).toEqual({ delivered: 0, pct: null });
    expect(empty.featureCompletion).toBeNull();
    expect(empty.openBlockers).toBe(0);
    expect(empty.pendingReviews).toBe(0);
  });

  it('composes the full project overview view', () => {
    const sprints = [sprint()];
    const features = [feature(), feature({ id: 'f-backlog', status: 'backlog' })];
    const tasks = [task(), task({ id: 't-done', sprintStatus: 'done', updatedAt: '2026-03-11' })];
    const members = [member(), member({ id: 'm-2', name: 'Grace Hopper' })];
    const teams = [team()];
    const blockers = [blocker()];

    const view = selectProjectOverview({ project: project(), sprints, features, tasks, members, teams, blockers });

    expect(view.project.name).toBe('AI Copilot');
    expect(view.members.map((m) => m.name)).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(view.teams[0].name).toBe('AI');
    expect(view.currentSprint?.id).toBe('s1');
    expect(view.activeFeatures.map((v) => v.feature.id)).toEqual(['f1']);
    expect(view.teamProgress).toEqual({ done: 1, total: 2, pct: 50 });
    expect(view.sprintProgress).toEqual({ done: 1, total: 2, pct: 50 });
    expect(view.recentWork.map((t) => t.id)).toEqual(['t-done', 't1']);
    expect(view.blockers[0].taskTitle).toBe('Wire the model endpoint');
    expect(view.milestones).toEqual([]);
    expect(view.health.pendingReviews).toBe(0);
  });
});
