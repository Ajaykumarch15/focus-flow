import { describe, it, expect } from 'vitest';
import { activityActionLabel, activityDetail } from '../collaborationActivity';
import type { WorkspaceActivity } from '../../types/collaboration';

const activity = (action: string, details: Record<string, unknown> = {}): WorkspaceActivity => ({
  id: `a-${action}`,
  workspaceId: 'ws-1',
  actor: { id: 'u-1', name: 'Ada Lovelace', email: 'ada@focusflow.io' },
  action,
  details,
  timestamp: '2026-01-01T00:00:00.000Z',
});

describe('activityActionLabel', () => {
  it('labels the persisted project.updated action', () => {
    expect(activityActionLabel('project.updated')).toBe('updated a project');
  });

  it('labels every action the server can emit', () => {
    const expected = [
      'workspace.created', 'workspace.updated', 'workspace.deleted',
      'workspace.member.invited', 'workspace.member.joined', 'workspace.member.roleChanged',
      'workspace.member.removed', 'project.created', 'project.updated',
      'team.created', 'team.updated', 'team.deleted', 'team.member.added', 'team.member.removed',
    ];
    for (const action of expected) {
      expect(activityActionLabel(action)).not.toBe(action);
    }
  });

  it('falls back to the raw action string for unknown actions', () => {
    expect(activityActionLabel('something.else')).toBe('something.else');
  });
});

describe('activityDetail', () => {
  it('renders the project name for project.created and project.updated', () => {
    expect(activityDetail(activity('project.created', { projectName: 'Ship it' }))).toBe('Project: Ship it');
    expect(activityDetail(activity('project.updated', { projectName: 'Ship it' }))).toBe('Project: Ship it');
  });

  it('renders no detail when projectName is absent', () => {
    expect(activityDetail(activity('project.updated', {}))).toBe('');
  });

  it('renders role changes with workspace and role', () => {
    expect(
      activityDetail(activity('workspace.member.roleChanged', { workspaceName: 'Team A', role: 'Admin' })),
    ).toBe('Team A · role → Admin');
  });

  it('renders team actions with the team name', () => {
    expect(activityDetail(activity('team.created', { teamName: 'Frontend' }))).toBe('Team: Frontend');
  });

  it('falls back to the workspace name for unhandled actions', () => {
    expect(activityDetail(activity('workspace.created', { workspaceName: 'Team A' }))).toBe('Workspace: Team A');
  });
});
