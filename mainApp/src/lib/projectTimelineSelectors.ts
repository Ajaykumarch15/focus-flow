import type {
  CentralBlocker,
  CollaborativeTask,
  Feature,
  Project,
  Sprint,
  WorkspaceActivity,
  WorkspaceMember,
} from '../types/collaboration';
import { activityActionLabel } from './collaborationActivity';
import { dayKey } from '../utils/time';

// P1-T2: the project timeline merges two honest, project-scoped sources —
// (1) the real workspace activity feed, filtered to events whose details
// reference this project's entities, and (2) events derived from the flat
// collaboration store (releases, blockers, sprint boundaries, task lifecycle)
// that the feed cannot express. Every timestamp comes from data; nothing is
// fabricated.

export type TimelineEntityType = 'task' | 'feature' | 'sprint' | 'release' | 'blocker' | 'project' | 'session';
export type TimelineFilter = 'all' | TimelineEntityType;

export interface TimelineEvent {
  id: string;
  timestamp: string;
  dayKey: string;
  entityType: TimelineEntityType;
  kind: string;
  actionLabel: string;
  detail: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetTitle?: string;
}

export interface TimelineDay {
  dayKey: string;
  events: TimelineEvent[];
}

const ACTIVITY_ENTITY: Record<string, TimelineEntityType> = {
  'project.created': 'project',
  'feature.created': 'feature',
  'feature.updated': 'feature',
  'feature.deleted': 'feature',
  'sprint.created': 'sprint',
  'sprint.updated': 'sprint',
  'sprint.deleted': 'sprint',
  'task.created': 'task',
  'task.completed': 'task',
  'task.deleted': 'task',
  'session.started': 'session',
  'session.completed': 'session',
};

const ACTION_LABELS: Record<string, string> = {
  'project.created': 'Project created',
  'feature.created': 'Feature added',
  'feature.updated': 'Feature updated',
  'feature.deleted': 'Feature removed',
  'sprint.created': 'Sprint planned',
  'sprint.updated': 'Sprint updated',
  'sprint.deleted': 'Sprint removed',
  'task.created': 'Task created',
  'task.completed': 'Task completed',
  'task.deleted': 'Task removed',
  'session.started': 'Session started',
  'session.completed': 'Session completed',
};

function timelineActionLabel(action: string): string {
  return ACTION_LABELS[action] || activityActionLabel(action) || action;
}

interface ProjectRefs {
  taskIds: Set<string>;
  featureIds: Set<string>;
  sprintIds: Set<string>;
  projectName: string;
}

function collectProjectRefs(
  project: Project,
  tasks: CollaborativeTask[],
  features: Feature[],
  sprints: Sprint[],
): ProjectRefs {
  return {
    taskIds: new Set(tasks.map((t) => t.id)),
    featureIds: new Set(features.map((f) => f.id)),
    sprintIds: new Set(sprints.map((s) => s.id)),
    projectName: project.name,
  };
}

function activityMatchesProject(act: WorkspaceActivity, refs: ProjectRefs): boolean {
  const d = act.details ?? {};
  if (d.taskId && refs.taskIds.has(String(d.taskId))) return true;
  if (d.featureId && refs.featureIds.has(String(d.featureId))) return true;
  if (d.sprintId && refs.sprintIds.has(String(d.sprintId))) return true;
  if (d.projectName && d.projectName === refs.projectName) return true;
  return false;
}

function entityIdFromDetails(act: WorkspaceActivity): string | undefined {
  const d = act.details ?? {};
  return d.taskId ?? d.featureId ?? d.sprintId ?? undefined;
}

function timelineDetail(act: WorkspaceActivity, refs: ProjectRefs): string {
  const d = act.details ?? {};
  switch (act.action) {
    case 'task.created':
    case 'task.completed':
    case 'task.deleted':
      return d.taskTitle ? `Task: ${d.taskTitle}` : '';
    case 'feature.created':
    case 'feature.updated':
    case 'feature.deleted':
      return d.featureName ? `Feature: ${d.featureName}` : '';
    case 'sprint.created':
    case 'sprint.updated':
    case 'sprint.deleted':
      return d.sprintName ? `Sprint: ${d.sprintName}` : '';
    case 'session.started':
      return d.taskTitle ? `Started work on "${d.taskTitle}"` : 'Started a session';
    case 'session.completed':
      return d.activeMs ? `Finished a session (${Math.round(Number(d.activeMs) / 60000)}m)` : 'Finished a session';
    case 'project.created':
      return `Project: ${refs.projectName}`;
    default:
      return '';
  }
}

function fromActivity(act: WorkspaceActivity, refs: ProjectRefs): TimelineEvent {
  return {
    id: `activity:${act.id}`,
    timestamp: act.timestamp,
    dayKey: dayKey(act.timestamp),
    entityType: ACTIVITY_ENTITY[act.action] ?? 'project',
    kind: act.action,
    actionLabel: timelineActionLabel(act.action),
    detail: timelineDetail(act, refs),
    actorId: act.actor?.id,
    actorName: act.actor?.name,
    targetId: entityIdFromDetails(act),
  };
}

function deriveProjectEvents(
  project: Project,
  tasks: CollaborativeTask[],
  features: Feature[],
  sprints: Sprint[],
  blockers: CentralBlocker[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: `derived:project.created:${project.id}`,
    timestamp: project.createdAt,
    dayKey: dayKey(project.createdAt),
    entityType: 'project',
    kind: 'project.created',
    actionLabel: 'Project created',
    detail: `Project: ${project.name}`,
    targetId: project.id,
    targetTitle: project.name,
  });

  for (const t of tasks) {
    events.push({
      id: `derived:task.created:${t.id}`,
      timestamp: t.createdAt,
      dayKey: dayKey(t.createdAt),
      entityType: 'task',
      kind: 'task.created',
      actionLabel: 'Task created',
      detail: `Task: ${t.title}`,
      actorId: t.ownerId,
      targetId: t.id,
      targetTitle: t.title,
    });
    if (t.sprintStatus === 'done') {
      events.push({
        id: `derived:task.completed:${t.id}`,
        timestamp: t.updatedAt,
        dayKey: dayKey(t.updatedAt),
        entityType: 'task',
        kind: 'task.completed',
        actionLabel: 'Task completed',
        detail: `Task: ${t.title}`,
        actorId: t.ownerId,
        targetId: t.id,
        targetTitle: t.title,
      });
    }
  }

  for (const f of features) {
    events.push({
      id: `derived:feature.created:${f.id}`,
      timestamp: f.createdAt,
      dayKey: dayKey(f.createdAt),
      entityType: 'feature',
      kind: 'feature.created',
      actionLabel: 'Feature added',
      detail: `Feature: ${f.name}`,
      targetId: f.id,
      targetTitle: f.name,
    });
  }

  for (const b of blockers) {
    events.push({
      id: `derived:blocker.raised:${b.id}`,
      timestamp: b.createdAt,
      dayKey: dayKey(b.createdAt),
      entityType: 'blocker',
      kind: 'blocker.raised',
      actionLabel: 'Blocker raised',
      detail: `${b.severity}: ${b.title}`,
      actorId: b.reporterId,
      targetId: b.id,
      targetTitle: b.title,
    });
  }

  for (const ms of project.milestones) {
    const completed = ms.status === 'completed';
    events.push({
      id: `derived:${completed ? 'release.shipped' : 'milestone.due'}:${ms.id}`,
      timestamp: ms.dueDate,
      dayKey: dayKey(ms.dueDate),
      entityType: 'release',
      kind: completed ? 'release.shipped' : 'milestone.due',
      actionLabel: completed ? 'Release shipped' : 'Milestone due',
      detail: `${ms.title} (${ms.targetPoints} pts)`,
      targetId: ms.id,
      targetTitle: ms.title,
    });
  }

  for (const s of sprints) {
    if (s.status === 'active' || s.status === 'completed') {
      events.push({
        id: `derived:sprint.started:${s.id}`,
        timestamp: s.startDate,
        dayKey: dayKey(s.startDate),
        entityType: 'sprint',
        kind: 'sprint.started',
        actionLabel: 'Sprint started',
        detail: s.name,
        targetId: s.id,
        targetTitle: s.name,
      });
    }
    if (s.status === 'completed') {
      events.push({
        id: `derived:sprint.ended:${s.id}`,
        timestamp: s.endDate,
        dayKey: dayKey(s.endDate),
        entityType: 'sprint',
        kind: 'sprint.ended',
        actionLabel: 'Sprint ended',
        detail: s.name,
        targetId: s.id,
        targetTitle: s.name,
      });
    }
  }

  return events;
}

function dedupeKey(e: TimelineEvent): string {
  return `${e.entityType}:${e.kind}:${e.targetId ?? ''}:${e.dayKey}`;
}

export interface ProjectTimelineInput {
  project: Project;
  tasks: CollaborativeTask[];
  features: Feature[];
  sprints: Sprint[];
  blockers: CentralBlocker[];
  activities: WorkspaceActivity[];
  members: WorkspaceMember[];
}

export function selectProjectTimelineEvents(input: ProjectTimelineInput): TimelineEvent[] {
  const { project, tasks, features, sprints, blockers, activities, members } = input;
  const refs = collectProjectRefs(project, tasks, features, sprints);

  const workspaceEvents = activities
    .filter((a) => a.workspaceId === project.workspaceId)
    .filter((a) => activityMatchesProject(a, refs))
    .map((a) => fromActivity(a, refs));

  const memberNames = new Map(members.map((m) => [m.id, m.name]));
  const derivedEvents = deriveProjectEvents(project, tasks, features, sprints, blockers)
    .map((e) => (e.actorId && memberNames.has(e.actorId) ? { ...e, actorName: memberNames.get(e.actorId) } : e));

  // Workspace-feed events win over derived duplicates (they carry the real actor).
  const activityKeys = new Set(workspaceEvents.map(dedupeKey));
  const merged = [...workspaceEvents, ...derivedEvents.filter((e) => !activityKeys.has(dedupeKey(e)))];

  return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function filterTimelineEvents(events: TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  return filter === 'all' ? events : events.filter((e) => e.entityType === filter);
}

export function groupTimelineEventsByDay(events: TimelineEvent[]): TimelineDay[] {
  const byDay = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const list = byDay.get(e.dayKey) ?? [];
    list.push(e);
    byDay.set(e.dayKey, list);
  }
  return [...byDay.entries()]
    .map(([dayKeyValue, dayEvents]) => ({ dayKey: dayKeyValue, events: dayEvents }))
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}
