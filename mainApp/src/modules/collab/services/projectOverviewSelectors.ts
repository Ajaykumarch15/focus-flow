import type {
  BlockerSeverity,
  CentralBlocker,
  CollaborativeTask,
  Feature,
  Project,
  ProjectMilestone,
  Sprint,
  WorkspaceMember,
  WorkspaceTeam,
} from '@collab/types/collaboration';
import { computeFeatureCompletionRate, computeVelocity } from './collaborationKpis';
import { computeWorkspaceProgress } from '@collab/pages/collaboration/TeamWorkspace';
import {
  computeFeatureProgress,
  groupTasksByFeature,
  type FeatureProgress,
} from '@collab/pages/collaboration/FeaturesPage';

export interface ProjectFeatureView {
  feature: Feature;
  progress: FeatureProgress;
}

export interface ProjectBlockerView {
  id: string;
  title: string;
  severity: BlockerSeverity;
  status: CentralBlocker['status'];
  impactDescription: string;
  createdAt: string;
  taskTitle?: string;
}

export interface ProjectHealthView {
  velocity: { delivered: number; pct: number | null };
  featureCompletion: number | null;
  openBlockers: number;
  pendingReviews: number;
}

export interface ProjectOverview {
  project: Project;
  members: WorkspaceMember[];
  teams: WorkspaceTeam[];
  currentSprint: Sprint | null;
  activeFeatures: ProjectFeatureView[];
  teamProgress: { done: number; total: number; pct: number };
  sprintProgress: { done: number; total: number; pct: number };
  recentWork: CollaborativeTask[];
  blockers: ProjectBlockerView[];
  milestones: ProjectMilestone[];
  health: ProjectHealthView;
}

const SEVERITY_ORDER: Record<BlockerSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function selectProjectTasks(tasks: CollaborativeTask[], projectId: string): CollaborativeTask[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export function selectProjectMembers(members: WorkspaceMember[], memberIds: string[]): WorkspaceMember[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  return memberIds.map((id) => byId.get(id)).filter((m): m is WorkspaceMember => Boolean(m));
}

export function selectProjectTeams(teams: WorkspaceTeam[], teamIds: string[]): WorkspaceTeam[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return teamIds.map((id) => byId.get(id)).filter((t): t is WorkspaceTeam => Boolean(t));
}

export function selectCurrentSprint(sprints: Sprint[], projectId: string): Sprint | null {
  return sprints.find((s) => s.projectId === projectId && s.status === 'active') ?? null;
}

export function selectActiveFeatures(
  features: Feature[],
  tasks: CollaborativeTask[],
  projectId: string,
): ProjectFeatureView[] {
  const tasksByFeature = groupTasksByFeature(tasks);
  return features
    .filter((f) => f.projectId === projectId && (f.status === 'ready' || f.status === 'in_progress'))
    .map((feature) => ({
      feature,
      progress: computeFeatureProgress(tasksByFeature.get(feature.id) ?? []),
    }))
    .sort(
      (a, b) =>
        (b.feature.status === 'in_progress' ? 1 : 0) - (a.feature.status === 'in_progress' ? 1 : 0),
    );
}

export function selectProjectBlockers(
  blockers: CentralBlocker[],
  projectTasks: CollaborativeTask[],
): ProjectBlockerView[] {
  const taskById = new Map(projectTasks.map((t) => [t.id, t]));
  return blockers
    .filter((b) => b.taskId && taskById.has(b.taskId))
    .map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
      status: b.status,
      impactDescription: b.impactDescription,
      createdAt: b.createdAt,
      taskTitle: b.taskId ? taskById.get(b.taskId)?.title : undefined,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function selectRecentWork(tasks: CollaborativeTask[], limit = 5): CollaborativeTask[] {
  return tasks
    .filter((t) => t.sprintStatus === 'done' || t.sprintStatus === 'in_progress')
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export function selectMilestonesByDate(milestones: ProjectMilestone[]): ProjectMilestone[] {
  return milestones.slice().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export function selectProjectHealth(
  sprint: Sprint | null,
  sprintTasks: CollaborativeTask[],
  projectFeatures: Feature[],
  blockers: ProjectBlockerView[],
  projectTasks: CollaborativeTask[],
): ProjectHealthView {
  return {
    velocity: sprint
      ? computeVelocity(sprintTasks, sprint.targetVelocity)
      : { delivered: 0, pct: null },
    featureCompletion: computeFeatureCompletionRate(projectFeatures),
    openBlockers: blockers.filter((b) => b.status !== 'resolved').length,
    pendingReviews: projectTasks.filter((t) => t.sprintStatus === 'review').length,
  };
}

export function selectProjectOverview(input: {
  project: Project;
  sprints: Sprint[];
  features: Feature[];
  tasks: CollaborativeTask[];
  members: WorkspaceMember[];
  teams: WorkspaceTeam[];
  blockers: CentralBlocker[];
}): ProjectOverview {
  const { project, sprints, features, tasks, members, teams, blockers } = input;
  const projectTasks = selectProjectTasks(tasks, project.id);
  const currentSprint = selectCurrentSprint(sprints, project.id);
  const sprintTasks = currentSprint ? projectTasks.filter((t) => t.sprintId === currentSprint.id) : [];
  const blockerViews = selectProjectBlockers(blockers, projectTasks);
  const projectFeatures = features.filter((f) => f.projectId === project.id);

  return {
    project,
    members: selectProjectMembers(members, project.members),
    teams: selectProjectTeams(teams, project.teamIds),
    currentSprint,
    activeFeatures: selectActiveFeatures(features, tasks, project.id),
    teamProgress: computeWorkspaceProgress(projectTasks),
    sprintProgress: computeWorkspaceProgress(sprintTasks),
    recentWork: selectRecentWork(projectTasks),
    blockers: blockerViews,
    milestones: selectMilestonesByDate(project.milestones),
    health: selectProjectHealth(currentSprint, sprintTasks, projectFeatures, blockerViews, projectTasks),
  };
}
