import type { WorkspaceActivity } from '../types/collaboration';

// IES-P2-04: shared human-readable rendering for the real workspace activity feed.
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  'workspace.created': 'created the workspace',
  'workspace.updated': 'updated the workspace',
  'workspace.deleted': 'deleted the workspace',
  'workspace.member.invited': 'invited a member',
  'workspace.member.joined': 'joined the workspace',
  'workspace.member.roleChanged': 'changed a member role',
  'workspace.member.removed': 'removed a member',
  'project.created': 'created a project',
  'project.updated': 'updated a project',
  'team.created': 'created a team',
  'team.updated': 'updated a team',
  'team.deleted': 'deleted a team',
  'team.member.added': 'added a team member',
  'team.member.removed': 'removed a team member',
};

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] || action;
}

export function activityDetail(act: WorkspaceActivity): string {
  const d = act.details ?? {};
  switch (act.action) {
    case 'project.created':
    case 'project.updated':
      return d.projectName ? `Project: ${d.projectName}` : '';
    case 'workspace.member.roleChanged': {
      const parts = [d.workspaceName, d.role ? `role → ${d.role}` : ''].filter(Boolean);
      return parts.join(' · ');
    }
    case 'team.created':
    case 'team.updated':
    case 'team.deleted':
    case 'team.member.added':
    case 'team.member.removed':
      return d.teamName ? `Team: ${d.teamName}` : '';
    default:
      return d.workspaceName ? `Workspace: ${d.workspaceName}` : '';
  }
}
