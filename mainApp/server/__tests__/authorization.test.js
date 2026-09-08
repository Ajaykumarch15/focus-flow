// @vitest-environment node
// authorization.test.js — Foundation tests for the new authorization system.
//
// Tests the permission vocabulary, relationship-resolution helpers, policy
// functions, and central can() entry point. These tests verify that Phase 1
// establishes a correct and safe authorization foundation.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ── Permission vocabulary ────────────────────────────────────────────────────

const {
  WORKSPACE_ROLES,
  LEGACY_ROLE_MAP,
  WORKSPACE,
  PROJECT,
  TEAM,
  TASK,
  DISCUSSION,
  CHANNEL,
  FILE,
  WORKLOG,
  ALL_PERMISSIONS,
  isValidPermission,
} = require('../authorization/permissions');

// ── Relationship helpers ─────────────────────────────────────────────────────

const {
  getWorkspaceRole,
  getRawWorkspaceRole,
  isWorkspaceMember,
  getProjectRole,
  isProjectManager,
  isProjectMember,
  isTeamLeader,
  isTeamMember,
  isTaskAssignee,
  isTaskReviewer,
  isResourceOwner,
} = require('../authorization/relationships');

// ── Central authorization ────────────────────────────────────────────────────

const { can } = require('../authorization/authorization');

// ── Test fixtures ────────────────────────────────────────────────────────────

function makeUser(id = 'user1') {
  return { _id: id, name: `User ${id}`, email: `user${id}@test.com` };
}

function makeWorkspace(ownerId = 'user1', members = []) {
  return {
    _id: 'ws1',
    createdBy: ownerId,
    members: [
      { userId: ownerId, role: 'Owner' },
      ...members,
    ],
  };
}

function makeProject(pmId = 'user1', members = [], workspaceRef = 'ws1') {
  return {
    _id: 'proj1',
    userId: pmId,
    members: members,
    workspaceRef: workspaceRef,
  };
}

function makeTeam(leaderId = 'user1', memberIds = [], workspaceRef = 'ws1') {
  return {
    _id: 'team1',
    leaderId: leaderId,
    members: memberIds,
    workspaceRef: workspaceRef,
  };
}

function makeTask(creatorId = 'user1', assigneeId = null, workspaceRef = null) {
  return {
    _id: 'task1',
    userId: creatorId,
    assigneeIds: assigneeId ? [assigneeId] : [],
    reviewerId: null,
    workspaceRef: workspaceRef,
  };
}

function makeWorklog(userId = 'user1') {
  return {
    _id: 'log1',
    userId: userId,
  };
}

function makeComment(authorId = 'user1', workspaceRef = null) {
  return {
    _id: 'comment1',
    authorId: authorId,
    workspaceRef: workspaceRef,
  };
}

function makeAttachment(uploaderId = 'user1', workspaceRef = null) {
  return {
    _id: 'att1',
    uploadedBy: uploaderId,
    workspaceRef: workspaceRef,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Permission Vocabulary Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Permission Vocabulary', () => {
  it('defines three canonical workspace roles', () => {
    expect(WORKSPACE_ROLES).toEqual({
      OWNER: 'Owner',
      ADMIN: 'Admin',
      MEMBER: 'Member',
    });
  });

  it('maps legacy roles to canonical roles', () => {
    expect(LEGACY_ROLE_MAP['Owner']).toBe('Owner');
    expect(LEGACY_ROLE_MAP['Admin']).toBe('Admin');
    expect(LEGACY_ROLE_MAP['Manager']).toBe('Member');
    expect(LEGACY_ROLE_MAP['Developer']).toBe('Member');
    expect(LEGACY_ROLE_MAP['Viewer']).toBe('Member');
  });

  it('defines workspace permissions with correct prefix', () => {
    expect(WORKSPACE.VIEW).toBe('workspace.view');
    expect(WORKSPACE.EDIT).toBe('workspace.edit');
    expect(WORKSPACE.DELETE).toBe('workspace.delete');
    expect(WORKSPACE.MANAGE_MEMBERS).toBe('workspace.manage_members');
    expect(WORKSPACE.MANAGE_ROLES).toBe('workspace.manage_roles');
    expect(WORKSPACE.MANAGE_BILLING).toBe('workspace.manage_billing');
    expect(WORKSPACE.TRANSFER_OWNERSHIP).toBe('workspace.transfer_ownership');
  });

  it('defines project permissions', () => {
    expect(PROJECT.VIEW).toBe('project.view');
    expect(PROJECT.CREATE).toBe('project.create');
    expect(PROJECT.EDIT).toBe('project.edit');
    expect(PROJECT.DELETE).toBe('project.delete');
    expect(PROJECT.ARCHIVE).toBe('project.archive');
    expect(PROJECT.MANAGE_MEMBERS).toBe('project.manage_members');
    expect(PROJECT.ASSIGN_MANAGER).toBe('project.assign_manager');
  });

  it('defines team permissions', () => {
    expect(TEAM.VIEW).toBe('team.view');
    expect(TEAM.CREATE).toBe('team.create');
    expect(TEAM.EDIT).toBe('team.edit');
    expect(TEAM.DELETE).toBe('team.delete');
    expect(TEAM.MANAGE_MEMBERS).toBe('team.manage_members');
    expect(TEAM.ASSIGN_LEADER).toBe('team.assign_leader');
  });

  it('defines task permissions', () => {
    expect(TASK.VIEW).toBe('task.view');
    expect(TASK.CREATE).toBe('task.create');
    expect(TASK.EDIT).toBe('task.edit');
    expect(TASK.DELETE).toBe('task.delete');
    expect(TASK.ASSIGN).toBe('task.assign');
    expect(TASK.SUBMIT).toBe('task.submit');
    expect(TASK.REVIEW).toBe('task.review');
    expect(TASK.APPROVE).toBe('task.approve');
  });

  it('defines discussion permissions', () => {
    expect(DISCUSSION.VIEW).toBe('discussion.view');
    expect(DISCUSSION.CREATE).toBe('discussion.create');
    expect(DISCUSSION.DELETE_OWN).toBe('discussion.delete_own');
    expect(DISCUSSION.DELETE_ANY).toBe('discussion.delete_any');
  });

  it('defines file permissions', () => {
    expect(FILE.VIEW).toBe('file.view');
    expect(FILE.UPLOAD).toBe('file.upload');
    expect(FILE.DELETE_OWN).toBe('file.delete_own');
    expect(FILE.DELETE_ANY).toBe('file.delete_any');
  });

  it('defines worklog permissions', () => {
    expect(WORKLOG.VIEW_OWN).toBe('worklog.view_own');
    expect(WORKLOG.CREATE).toBe('worklog.create');
    expect(WORKLOG.SUBMIT).toBe('worklog.submit');
    expect(WORKLOG.VIEW_TEAM).toBe('worklog.view_team');
    expect(WORKLOG.APPROVE).toBe('worklog.approve');
  });

  it('ALL_PERMISSIONS contains all defined permissions', () => {
    expect(ALL_PERMISSIONS.size).toBeGreaterThan(0);
    expect(ALL_PERMISSIONS.has('workspace.view')).toBe(true);
    expect(ALL_PERMISSIONS.has('task.edit')).toBe(true);
    expect(ALL_PERMISSIONS.has('worklog.approve')).toBe(true);
  });

  it('isValidPermission returns true for known permissions', () => {
    expect(isValidPermission('workspace.view')).toBe(true);
    expect(isValidPermission('task.edit')).toBe(true);
    expect(isValidPermission('worklog.approve')).toBe(true);
  });

  it('isValidPermission returns false for unknown permissions', () => {
    expect(isValidPermission('unknown.permission')).toBe(false);
    expect(isValidPermission('')).toBe(false);
    expect(isValidPermission(null)).toBe(false);
    expect(isValidPermission(undefined)).toBe(false);
    expect(isValidPermission(42)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Relationship Resolution Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('getWorkspaceRole', () => {
  it('returns Owner for workspace owner', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(getWorkspaceRole(user, ws)).toBe('Owner');
  });

  it('returns Admin for admin member', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(getWorkspaceRole(user, ws)).toBe('Admin');
  });

  it('returns Member for Developer (legacy mapping)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(getWorkspaceRole(user, ws)).toBe('Member');
  });

  it('returns Member for Manager (legacy mapping)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Manager' }]);
    expect(getWorkspaceRole(user, ws)).toBe('Member');
  });

  it('returns Member for Viewer (legacy mapping)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Viewer' }]);
    expect(getWorkspaceRole(user, ws)).toBe('Member');
  });

  it('returns null for non-member', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1');
    expect(getWorkspaceRole(user, ws)).toBe(null);
  });

  it('returns null for null user', () => {
    const ws = makeWorkspace('user1');
    expect(getWorkspaceRole(null, ws)).toBe(null);
  });

  it('returns null for null workspace', () => {
    const user = makeUser('user1');
    expect(getWorkspaceRole(user, null)).toBe(null);
  });

  it('returns null for workspace with no members', () => {
    const user = makeUser('user1');
    const ws = { _id: 'ws1', members: [] };
    expect(getWorkspaceRole(user, ws)).toBe(null);
  });
});

describe('getRawWorkspaceRole', () => {
  it('returns the raw stored role string', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(getRawWorkspaceRole(user, ws)).toBe('Developer');
  });

  it('returns Owner for owner', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(getRawWorkspaceRole(user, ws)).toBe('Owner');
  });

  it('returns null for non-member', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1');
    expect(getRawWorkspaceRole(user, ws)).toBe(null);
  });
});

describe('isWorkspaceMember', () => {
  it('returns true for owner', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(isWorkspaceMember(user, ws)).toBe(true);
  });

  it('returns true for admin', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(isWorkspaceMember(user, ws)).toBe(true);
  });

  it('returns true for legacy Developer', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(isWorkspaceMember(user, ws)).toBe(true);
  });

  it('returns false for non-member', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1');
    expect(isWorkspaceMember(user, ws)).toBe(false);
  });
});

describe('getProjectRole', () => {
  it('returns manager for project creator', () => {
    const user = makeUser('user1');
    const project = makeProject('user1');
    expect(getProjectRole(user, project)).toBe('manager');
  });

  it('returns member for project member', () => {
    const user = makeUser('user2');
    const project = makeProject('user1', ['user2']);
    expect(getProjectRole(user, project)).toBe('member');
  });

  it('returns null for non-member', () => {
    const user = makeUser('user3');
    const project = makeProject('user1', ['user2']);
    expect(getProjectRole(user, project)).toBe(null);
  });

  it('returns null for null user', () => {
    const project = makeProject('user1');
    expect(getProjectRole(null, project)).toBe(null);
  });

  it('returns null for null project', () => {
    const user = makeUser('user1');
    expect(getProjectRole(user, null)).toBe(null);
  });
});

describe('isProjectManager', () => {
  it('returns true for project creator', () => {
    const user = makeUser('user1');
    const project = makeProject('user1');
    expect(isProjectManager(user, project)).toBe(true);
  });

  it('returns false for project member', () => {
    const user = makeUser('user2');
    const project = makeProject('user1', ['user2']);
    expect(isProjectManager(user, project)).toBe(false);
  });

  it('returns false for non-member', () => {
    const user = makeUser('user3');
    const project = makeProject('user1', ['user2']);
    expect(isProjectManager(user, project)).toBe(false);
  });
});

describe('isProjectMember', () => {
  it('returns true for project manager', () => {
    const user = makeUser('user1');
    const project = makeProject('user1');
    expect(isProjectMember(user, project)).toBe(true);
  });

  it('returns true for project member', () => {
    const user = makeUser('user2');
    const project = makeProject('user1', ['user2']);
    expect(isProjectMember(user, project)).toBe(true);
  });

  it('returns false for non-member', () => {
    const user = makeUser('user3');
    const project = makeProject('user1', ['user2']);
    expect(isProjectMember(user, project)).toBe(false);
  });
});

describe('isTeamLeader', () => {
  it('returns true for team leader', () => {
    const user = makeUser('user1');
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(isTeamLeader(user, team)).toBe(true);
  });

  it('returns false for team member who is not leader', () => {
    const user = makeUser('user2');
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(isTeamLeader(user, team)).toBe(false);
  });

  it('returns false for non-member', () => {
    const user = makeUser('user3');
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(isTeamLeader(user, team)).toBe(false);
  });

  it('returns false when leaderId is null', () => {
    const user = makeUser('user1');
    const team = makeTeam(null, ['user1']);
    expect(isTeamLeader(user, team)).toBe(false);
  });
});

describe('isTeamMember', () => {
  it('returns true for team leader (who is also a member)', () => {
    const user = makeUser('user1');
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(isTeamMember(user, team)).toBe(true);
  });

  it('returns true for ordinary team member', () => {
    const user = makeUser('user2');
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(isTeamMember(user, team)).toBe(true);
  });

  it('returns false for non-member', () => {
    const user = makeUser('user3');
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(isTeamMember(user, team)).toBe(false);
  });
});

describe('isTaskAssignee', () => {
  it('returns true for assignee', () => {
    const user = makeUser('user2');
    const task = makeTask('user1', 'user2');
    expect(isTaskAssignee(user, task)).toBe(true);
  });

  it('returns false for non-assignee', () => {
    const user = makeUser('user3');
    const task = makeTask('user1', 'user2');
    expect(isTaskAssignee(user, task)).toBe(false);
  });

  it('returns false when no assignee', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null);
    expect(isTaskAssignee(user, task)).toBe(false);
  });
});

describe('isTaskReviewer', () => {
  it('returns true for reviewer', () => {
    const user = makeUser('user2');
    const task = { _id: 'task1', reviewerId: 'user2' };
    expect(isTaskReviewer(user, task)).toBe(true);
  });

  it('returns false for non-reviewer', () => {
    const user = makeUser('user3');
    const task = { _id: 'task1', reviewerId: 'user2' };
    expect(isTaskReviewer(user, task)).toBe(false);
  });
});

describe('isResourceOwner', () => {
  it('returns true for resource with matching userId', () => {
    const user = makeUser('user1');
    const resource = { userId: 'user1' };
    expect(isResourceOwner(user, resource)).toBe(true);
  });

  it('returns true for resource with matching createdBy', () => {
    const user = makeUser('user1');
    const resource = { createdBy: 'user1' };
    expect(isResourceOwner(user, resource)).toBe(true);
  });

  it('returns true for resource with matching authorId', () => {
    const user = makeUser('user1');
    const resource = { authorId: 'user1' };
    expect(isResourceOwner(user, resource)).toBe(true);
  });

  it('returns true for resource with matching uploadedBy', () => {
    const user = makeUser('user1');
    const resource = { uploadedBy: 'user1' };
    expect(isResourceOwner(user, resource)).toBe(true);
  });

  it('returns false for non-owner', () => {
    const user = makeUser('user2');
    const resource = { userId: 'user1' };
    expect(isResourceOwner(user, resource)).toBe(false);
  });

  it('returns false for null user', () => {
    const resource = { userId: 'user1' };
    expect(isResourceOwner(null, resource)).toBe(false);
  });

  it('returns false for null resource', () => {
    const user = makeUser('user1');
    expect(isResourceOwner(user, null)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Central can() Function Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('can() — Deny-by-default behavior', () => {
  it('denies null user', () => {
    expect(can(null, 'workspace.view', { workspace: makeWorkspace() })).toBe(false);
  });

  it('denies unknown permission', () => {
    const user = makeUser('user1');
    expect(can(user, 'unknown.permission', {})).toBe(false);
  });

  it('denies empty string permission', () => {
    const user = makeUser('user1');
    expect(can(user, '', {})).toBe(false);
  });

  it('denies when context is missing required resource', () => {
    const user = makeUser('user1');
    expect(can(user, 'workspace.view', {})).toBe(false);
  });

  it('denies when workspace is null', () => {
    const user = makeUser('user1');
    expect(can(user, 'workspace.view', { workspace: null })).toBe(false);
  });
});

describe('can() — Workspace permissions', () => {
  it('allows Owner to view workspace', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('allows Admin to view workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('allows Member to view workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('denies non-member to view workspace', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(false);
  });

  it('allows Owner to edit workspace', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.EDIT, { workspace: ws })).toBe(true);
  });

  it('allows Admin to edit workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.EDIT, { workspace: ws })).toBe(true);
  });

  it('denies Member to edit workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(can(user, WORKSPACE.EDIT, { workspace: ws })).toBe(false);
  });

  it('allows Owner to delete workspace', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(true);
  });

  it('denies Admin to delete workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(false);
  });

  it('allows Owner to manage members', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(true);
  });

  it('allows Admin to manage members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(true);
  });

  it('denies Member to manage members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
  });

  it('allows Owner to manage roles', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.MANAGE_ROLES, { workspace: ws })).toBe(true);
  });

  it('denies Member to manage roles', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(can(user, WORKSPACE.MANAGE_ROLES, { workspace: ws })).toBe(false);
  });

  it('allows Owner to manage billing', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.MANAGE_BILLING, { workspace: ws })).toBe(true);
  });

  it('denies Admin to manage billing', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.MANAGE_BILLING, { workspace: ws })).toBe(false);
  });

  it('allows Owner to transfer ownership', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(true);
  });

  it('denies Admin to transfer ownership', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(false);
  });
});

describe('can() — Project permissions', () => {
  it('denies unrelated workspace member from viewing project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.VIEW, { workspace: ws, project })).toBe(false);
  });

  it('allows project member to view project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    const project = makeProject('user1', ['user2']);
    expect(can(user, PROJECT.VIEW, { workspace: ws, project })).toBe(true);
  });

  it('allows project manager to view project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Owner' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.VIEW, { workspace: ws, project })).toBe(true);
  });

  it('allows workspace member to create project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    const project = makeProject('user1'); // project context needed for policy guard
    expect(can(user, PROJECT.CREATE, { workspace: ws, project })).toBe(true);
  });

  it('allows project manager to edit project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    expect(can(user, PROJECT.EDIT, { workspace: ws, project })).toBe(true);
  });

  it('allows workspace Admin to edit project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.EDIT, { workspace: ws, project })).toBe(true);
  });

  it('denies plain member to edit project', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Developer' }]);
    const project = makeProject('user1', ['user2']);
    expect(can(user, PROJECT.EDIT, { workspace: ws, project })).toBe(false);
  });

  it('allows workspace Admin to delete project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.DELETE, { workspace: ws, project })).toBe(true);
  });

  it('denies project manager to delete project (Admin required)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]); // maps to Member
    const project = makeProject('user2'); // user2 is PM
    // PM alone cannot delete; only workspace Admin+ can
    expect(can(user, PROJECT.DELETE, { workspace: ws, project })).toBe(false);
  });

  it('allows personal project creator all permissions', () => {
    const user = makeUser('user1');
    const project = makeProject('user1', [], null); // personal project
    expect(can(user, PROJECT.VIEW, { project })).toBe(true);
    expect(can(user, PROJECT.CREATE, { project })).toBe(true);
    expect(can(user, PROJECT.EDIT, { project })).toBe(true);
    expect(can(user, PROJECT.DELETE, { project })).toBe(true);
    expect(can(user, PROJECT.ARCHIVE, { project })).toBe(true);
    expect(can(user, PROJECT.MANAGE_MEMBERS, { project })).toBe(true);
    expect(can(user, PROJECT.ASSIGN_MANAGER, { project })).toBe(true);
  });

  it('denies non-creator access to personal project', () => {
    const user = makeUser('user2');
    const project = makeProject('user1', [], null); // user1's personal project
    expect(can(user, PROJECT.VIEW, { project })).toBe(false);
    expect(can(user, PROJECT.EDIT, { project })).toBe(false);
  });

  it('platform admin bypasses all project checks', () => {
    const user = { _id: 'admin1', role: 'admin' };
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    expect(can(user, PROJECT.VIEW, { workspace: ws, project })).toBe(true);
    expect(can(user, PROJECT.EDIT, { workspace: ws, project })).toBe(true);
    expect(can(user, PROJECT.DELETE, { workspace: ws, project })).toBe(true);
    expect(can(user, PROJECT.ARCHIVE, { workspace: ws, project })).toBe(true);
    expect(can(user, PROJECT.MANAGE_MEMBERS, { workspace: ws, project })).toBe(true);
    expect(can(user, PROJECT.ASSIGN_MANAGER, { workspace: ws, project })).toBe(true);
  });

  it('workspace Owner can archive project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user2');
    expect(can(user, PROJECT.ARCHIVE, { workspace: ws, project })).toBe(true);
  });

  it('workspace Admin can archive project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.ARCHIVE, { workspace: ws, project })).toBe(true);
  });

  it('Member cannot archive project', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.ARCHIVE, { workspace: ws, project })).toBe(false);
  });

  it('workspace Owner can manage project members', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user2');
    expect(can(user, PROJECT.MANAGE_MEMBERS, { workspace: ws, project })).toBe(true);
  });

  it('workspace Admin can manage project members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.MANAGE_MEMBERS, { workspace: ws, project })).toBe(true);
  });

  it('Member cannot manage project members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.MANAGE_MEMBERS, { workspace: ws, project })).toBe(false);
  });

  it('workspace Owner can assign project manager', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user2');
    expect(can(user, PROJECT.ASSIGN_MANAGER, { workspace: ws, project })).toBe(true);
  });

  it('Member cannot assign project manager', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.ASSIGN_MANAGER, { workspace: ws, project })).toBe(false);
  });

  it('non-member cannot view project', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1');
    expect(can(user, PROJECT.VIEW, { workspace: ws, project })).toBe(false);
  });

  it('missing project in context returns false', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, PROJECT.VIEW, { workspace: ws })).toBe(false);
  });

  it('legacy Manager workspace role maps to Member for project permissions', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Manager' }]);
    const project = makeProject('user1');
    // Manager maps to Member, so cannot edit (only PM or Admin+ can)
    expect(can(user, PROJECT.EDIT, { workspace: ws, project })).toBe(false);
    // Unrelated workspace Member cannot view without project membership
    expect(can(user, PROJECT.VIEW, { workspace: ws, project })).toBe(false);
    // But if added as project member, can view
    const memberProject = makeProject('user1', ['user2']);
    expect(can(user, PROJECT.VIEW, { workspace: ws, project: memberProject })).toBe(true);
  });
});

describe('can() — Team permissions', () => {
  // ── VIEW ────────────────────────────────────────────────────────────────────
  it('allows workspace Owner to view team', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Owner' }]);
    const team = makeTeam('user2', ['user2']);
    expect(can(user, TEAM.VIEW, { workspace: ws, team })).toBe(true);
  });

  it('allows workspace Admin to view team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const team = makeTeam('user3', ['user3']);
    expect(can(user, TEAM.VIEW, { workspace: ws, team })).toBe(true);
  });

  it('allows Team Leader to view own team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user2', ['user1', 'user2']);
    expect(can(user, TEAM.VIEW, { workspace: ws, team })).toBe(true);
  });

  it('allows Team Member to view own team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(can(user, TEAM.VIEW, { workspace: ws, team })).toBe(true);
  });

  it('denies unrelated workspace Member from viewing team', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2']); // user3 is NOT a member
    expect(can(user, TEAM.VIEW, { workspace: ws, team })).toBe(false);
  });

  it('allows Project Manager to view project-scoped team', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Member' }]);
    const project = makeProject('user1'); // user1 is PM
    const team = { _id: 'team1', leaderId: 'user2', members: ['user2'], workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, TEAM.VIEW, { workspace: ws, team, project })).toBe(true);
  });

  it('denies Project Member from viewing unrelated project team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user3', ['user2']); // user2 is member, user3 is PM
    const team = { _id: 'team1', leaderId: 'user3', members: ['user3'], workspaceRef: 'ws1', projectRef: 'proj1' };
    // user2 is project member but NOT PM, and NOT team member/leader
    expect(can(user, TEAM.VIEW, { workspace: ws, team, project })).toBe(false);
  });

  // ── CREATE ──────────────────────────────────────────────────────────────────
  it('allows workspace Owner to create team', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Owner' }]);
    expect(can(user, TEAM.CREATE, { workspace: ws })).toBe(true);
  });

  it('allows workspace Admin to create team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, TEAM.CREATE, { workspace: ws })).toBe(true);
  });

  it('denies plain Member to create team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, TEAM.CREATE, { workspace: ws })).toBe(false);
  });

  it('allows Project Manager to create team within their project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Member' }]);
    const project = makeProject('user1'); // user1 is PM
    expect(can(user, TEAM.CREATE, { workspace: ws, project })).toBe(true);
  });

  it('denies Project Member to create team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', ['user2']); // user2 is member, user1 is PM
    expect(can(user, TEAM.CREATE, { workspace: ws, project })).toBe(false);
  });

  // ── EDIT ────────────────────────────────────────────────────────────────────
  it('allows workspace Owner to edit team', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Owner' }]);
    const team = makeTeam('user2', ['user2']);
    expect(can(user, TEAM.EDIT, { workspace: ws, team })).toBe(true);
  });

  it('allows Team Leader to edit own team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user2', ['user1', 'user2']); // user2 is leader
    expect(can(user, TEAM.EDIT, { workspace: ws, team })).toBe(true);
  });

  it('denies Team Leader to edit another team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user3', ['user1', 'user2', 'user3']); // user3 is leader, user2 is member
    expect(can(user, TEAM.EDIT, { workspace: ws, team })).toBe(false);
  });

  it('denies plain Member to edit team', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user3']); // user3 is member, not leader
    expect(can(user, TEAM.EDIT, { workspace: ws, team })).toBe(false);
  });

  // ── DELETE ──────────────────────────────────────────────────────────────────
  it('allows workspace Owner to delete team', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Owner' }]);
    const team = makeTeam('user2', ['user2']);
    expect(can(user, TEAM.DELETE, { workspace: ws, team })).toBe(true);
  });

  it('allows workspace Admin to delete team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const team = makeTeam('user1', ['user1']);
    expect(can(user, TEAM.DELETE, { workspace: ws, team })).toBe(true);
  });

  it('denies Team Leader to delete team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user2', ['user1', 'user2']); // user2 is leader
    expect(can(user, TEAM.DELETE, { workspace: ws, team })).toBe(false);
  });

  it('denies plain Member to delete team', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user3']);
    expect(can(user, TEAM.DELETE, { workspace: ws, team })).toBe(false);
  });

  // ── MANAGE_MEMBERS ──────────────────────────────────────────────────────────
  it('allows workspace Admin to manage team members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(can(user, TEAM.MANAGE_MEMBERS, { workspace: ws, team })).toBe(true);
  });

  it('allows Team Leader to manage own team members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user2', ['user1', 'user2']); // user2 is leader
    expect(can(user, TEAM.MANAGE_MEMBERS, { workspace: ws, team })).toBe(true);
  });

  it('denies plain Member to manage team members', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user3']); // user3 is member, not leader
    expect(can(user, TEAM.MANAGE_MEMBERS, { workspace: ws, team })).toBe(false);
  });

  // ── ASSIGN_LEADER ───────────────────────────────────────────────────────────
  it('allows workspace Owner to assign team leader', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Owner' }]);
    const team = makeTeam('user2', ['user1', 'user2']);
    expect(can(user, TEAM.ASSIGN_LEADER, { workspace: ws, team })).toBe(true);
  });

  it('allows workspace Admin to assign team leader', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    expect(can(user, TEAM.ASSIGN_LEADER, { workspace: ws, team })).toBe(true);
  });

  it('denies Team Leader to assign themselves as leader of another team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const team = makeTeam('user3', ['user1', 'user2', 'user3']); // user3 is leader
    expect(can(user, TEAM.ASSIGN_LEADER, { workspace: ws, team })).toBe(false);
  });

  it('denies plain Member to assign team leader', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user3']);
    expect(can(user, TEAM.ASSIGN_LEADER, { workspace: ws, team })).toBe(false);
  });

  // ── Cross-workspace security ────────────────────────────────────────────────
  it('denies user from another workspace from accessing team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', []); // user2 is NOT a member of ws1
    const team = makeTeam('user1', ['user1']); // team is in ws1, user2 not a member
    expect(can(user, TEAM.VIEW, { workspace: ws, team })).toBe(false);
  });

  // ── Legacy teams ────────────────────────────────────────────────────────────
  it('denies non-admin from accessing legacy team', () => {
    const user = makeUser('user2');
    const team = { _id: 'team1', leaderId: null, members: ['user1', 'user2'], workspaceRef: null };
    expect(can(user, TEAM.VIEW, { workspace: null, team })).toBe(false);
  });

  it('allows admin to access legacy team', () => {
    const user = { _id: 'admin1', name: 'Admin', role: 'admin' };
    const team = { _id: 'team1', leaderId: null, members: ['user1'], workspaceRef: null };
    expect(can(user, TEAM.VIEW, { team })).toBe(true);
  });

  // ── Null / edge cases ───────────────────────────────────────────────────────
  it('denies null user', () => {
    const ws = makeWorkspace('user1');
    const team = makeTeam('user1', ['user1']);
    expect(can(null, TEAM.VIEW, { workspace: ws, team })).toBe(false);
  });

  it('denies missing team in context', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, TEAM.VIEW, { workspace: ws })).toBe(false);
  });
});

describe('can() — Task permissions', () => {
  it('allows project member to view task', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', ['user2']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('denies unrelated workspace member from viewing task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', ['user2']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(false);
  });

  it('allows Owner to view any workspace task', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const task = makeTask('user2', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('allows Admin to view any workspace task', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('allows assignee to view assigned task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('allows reviewer to view task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user2'], reviewerId: 'user3', workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('allows follower to view task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user2'], workspaceRef: 'ws1', projectRef: 'proj1', followerIds: ['user3'] };
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('allows PM to edit task in their project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const task = makeTask('user2', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: ws, project, task })).toBe(true);
  });

  it('allows assignee to edit their task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: ws, project, task })).toBe(true);
  });

  it('denies non-assignee non-PM from editing task', () => {
    const user = makeUser('user4');
    const ws = makeWorkspace('user1', [{ userId: 'user4', role: 'Member' }]);
    const project = makeProject('user1', ['user4']);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: ws, project, task })).toBe(false);
  });

  it('allows Admin to edit any workspace task', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: ws, project, task })).toBe(true);
  });

  it('denies Member to delete task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', ['user3']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.DELETE, { workspace: ws, project, task })).toBe(false);
  });

  it('allows PM to delete task in their project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const task = makeTask('user2', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.DELETE, { workspace: ws, project, task })).toBe(true);
  });

  it('allows Admin to delete any workspace task', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.DELETE, { workspace: ws, project, task })).toBe(true);
  });

  it('allows PM to assign task in their project', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const task = makeTask('user2', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.ASSIGN, { workspace: ws, project, task })).toBe(true);
  });

  it('allows Admin to assign any workspace task', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.ASSIGN, { workspace: ws, project, task })).toBe(true);
  });

  it('denies plain member to assign task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', ['user3']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.ASSIGN, { workspace: ws, project, task })).toBe(false);
  });

  it('allows assignee to submit task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.SUBMIT, { workspace: ws, project, task })).toBe(true);
  });

  it('denies non-assignee to submit task', () => {
    const user = makeUser('user4');
    const ws = makeWorkspace('user1', [{ userId: 'user4', role: 'Member' }]);
    const project = makeProject('user1', ['user4']);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.SUBMIT, { workspace: ws, project, task })).toBe(false);
  });

  it('allows reviewer to approve task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user2'], reviewerId: 'user3', workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, TASK.APPROVE, { workspace: ws, project, task })).toBe(true);
  });

  it('prevents assignee from self-approving', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user2'], reviewerId: 'user2', workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, TASK.APPROVE, { workspace: ws, project, task })).toBe(false);
  });

  it('allows reviewer to request changes', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user2'], reviewerId: 'user3', workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, TASK.REQUEST_CHANGES, { workspace: ws, project, task })).toBe(true);
  });

  it('allows assignee to reopen task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.REOPEN, { workspace: ws, project, task })).toBe(true);
  });

  it('denies PM of different project from viewing task', () => {
    const user = makeUser('user4');
    const ws = makeWorkspace('user1', [{ userId: 'user4', role: 'Member' }]);
    const project = { _id: 'proj2', userId: 'user5', workspaceRef: 'ws1', members: [{ userId: 'user5' }] }; // user4 is NOT PM of proj1
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, task })).toBe(false);
  });

  it('allows team leader to view task in their team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', []);
    const team = { _id: 'team1', leaderId: 'user2', members: [{ userId: 'user2' }], workspaceRef: 'ws1' };
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.VIEW, { workspace: ws, project, team, task })).toBe(true);
  });

  it('allows team leader to edit task in their team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', []);
    const team = { _id: 'team1', leaderId: 'user2', members: [{ userId: 'user2' }], workspaceRef: 'ws1' };
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: ws, project, team, task })).toBe(true);
  });

  it('allows team leader to assign task in their team', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', []);
    const team = { _id: 'team1', leaderId: 'user2', members: [{ userId: 'user2' }], workspaceRef: 'ws1' };
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.ASSIGN, { workspace: ws, project, team, task })).toBe(true);
  });

  it('allows reviewer to review task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', []);
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user2'], reviewerId: 'user3', workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, TASK.REVIEW, { workspace: ws, project, task })).toBe(true);
  });

  it('denies unrelated member from editing task', () => {
    const user = makeUser('user5');
    const ws = makeWorkspace('user1', [{ userId: 'user5', role: 'Member' }]);
    const project = makeProject('user1', ['user5']);
    const task = makeTask('user1', 'user3', 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: ws, project, task })).toBe(false);
  });

  it('denies non-admin non-pm from deleting task', () => {
    const user = makeUser('user5');
    const ws = makeWorkspace('user1', [{ userId: 'user5', role: 'Member' }]);
    const project = makeProject('user1', ['user5']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.DELETE, { workspace: ws, project, task })).toBe(false);
  });
});

describe('can() — Task: personal task protection', () => {
  it('allows owner to view personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.VIEW, { task })).toBe(true);
  });

  it('allows owner to edit personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.EDIT, { task })).toBe(true);
  });

  it('denies non-owner to view personal task', () => {
    const user = makeUser('user2');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.VIEW, { task })).toBe(false);
  });

  it('denies Admin to view personal task', () => {
    const user = makeUser('admin1');
    user.role = 'admin';
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.VIEW, { task })).toBe(false);
  });

  it('denies assignment on personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.ASSIGN, { task })).toBe(false);
  });

  it('denies review on personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.REVIEW, { task })).toBe(false);
  });

  it('denies approve on personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.APPROVE, { task })).toBe(false);
  });

  it('allows owner to delete personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.DELETE, { task })).toBe(true);
  });

  it('denies non-owner to delete personal task', () => {
    const user = makeUser('user2');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.DELETE, { task })).toBe(false);
  });

  it('allows owner to submit personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.SUBMIT, { task })).toBe(true);
  });

  it('allows owner to reopen personal task', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, null);
    expect(can(user, TASK.REOPEN, { task })).toBe(true);
  });
});

describe('can() — Task: workspace role escalation', () => {
  it('denies Member from deleting task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', ['user3']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.DELETE, { workspace: ws, project, task })).toBe(false);
  });

  it('denies Member from assigning task', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const project = makeProject('user1', ['user3']);
    const task = makeTask('user1', null, 'ws1');
    task.projectRef = 'proj1';
    expect(can(user, TASK.ASSIGN, { workspace: ws, project, task })).toBe(false);
  });

  it('allows Owner to delete any task', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user2');
    const task = makeTask('user2', null, 'ws1');
    task.projectRef = 'proj2';
    expect(can(user, TASK.DELETE, { workspace: ws, project, task })).toBe(true);
  });

  it('allows Owner to assign any task', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user2');
    const task = makeTask('user2', null, 'ws1');
    task.projectRef = 'proj2';
    expect(can(user, TASK.ASSIGN, { workspace: ws, project, task })).toBe(true);
  });
});

describe('can() — Task: cross-workspace isolation', () => {
  it('denies user from workspace A viewing task in workspace B', () => {
    const user = makeUser('user1');
    const wsA = makeWorkspace('user1');
    const wsB = { _id: 'ws2', createdBy: 'user2', members: [{ userId: 'user2', role: 'Owner' }] };
    const project = makeProject('user2', []);
    const task = makeTask('user2', null, 'ws2');
    task.projectRef = 'proj1';
    // user1 has no relationship to wsB's project
    expect(can(user, TASK.VIEW, { workspace: wsB, project, task })).toBe(false);
  });

  it('denies Admin of workspace A from editing task in workspace B', () => {
    const user = makeUser('user1');
    const wsB = { _id: 'ws2', createdBy: 'user2', members: [{ userId: 'user2', role: 'Owner' }] };
    const project = makeProject('user2', []);
    const task = makeTask('user2', null, 'ws2');
    task.projectRef = 'proj1';
    expect(can(user, TASK.EDIT, { workspace: wsB, project, task })).toBe(false);
  });
});

describe('can() — Task: platform admin bypass', () => {
  it('allows platform admin to view any task', () => {
    const user = { _id: 'admin1', name: 'Platform Admin', role: 'admin' };
    const task = makeTask('user1', null, 'ws1');
    expect(can(user, TASK.VIEW, { task })).toBe(true);
  });

  it('allows platform admin to delete any task', () => {
    const user = { _id: 'admin1', name: 'Platform Admin', role: 'admin' };
    const task = makeTask('user1', null, 'ws1');
    expect(can(user, TASK.DELETE, { task })).toBe(true);
  });

  it('allows platform admin to assign any task', () => {
    const user = { _id: 'admin1', name: 'Platform Admin', role: 'admin' };
    const task = makeTask('user1', null, 'ws1');
    expect(can(user, TASK.ASSIGN, { task })).toBe(true);
  });
});

describe('can() — Task: edge cases', () => {
  it('denies null user', () => {
    const task = makeTask('user1', null, 'ws1');
    expect(can(null, TASK.VIEW, { task })).toBe(false);
  });

  it('denies missing context', () => {
    const user = makeUser('user1');
    expect(can(user, TASK.VIEW, null)).toBe(false);
  });

  it('denies unknown permission', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, 'ws1');
    expect(can(user, 'UNKNOWN', { task })).toBe(false);
  });

  it('denies workspace task without workspace context', () => {
    const user = makeUser('user1');
    const task = makeTask('user1', null, 'ws1');
    expect(can(user, TASK.VIEW, { task })).toBe(false);
  });

  it('denies non-member from viewing workspace task', () => {
    const user = makeUser('user3');
    const ws = { _id: 'ws1', createdBy: 'user1', members: [{ userId: 'user1', role: 'Owner' }] };
    const task = makeTask('user1', null, 'ws1');
    expect(can(user, TASK.VIEW, { workspace: ws, task })).toBe(false);
  });
});

describe('can() — Worklog permissions', () => {
  // ── Personal WorkLog protection ───────────────────────────────────────────
  it('allows owner to view own worklog', () => {
    const user = makeUser('user1');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.VIEW_OWN, { resource: log })).toBe(true);
  });

  it('denies non-owner to view worklog as own', () => {
    const user = makeUser('user2');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.VIEW_OWN, { resource: log })).toBe(false);
  });

  it('allows any user to create worklog', () => {
    const user = makeUser('user1');
    expect(can(user, WORKLOG.CREATE, {})).toBe(true);
  });

  it('allows owner to edit own worklog', () => {
    const user = makeUser('user1');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.EDIT_OWN, { resource: log })).toBe(true);
  });

  it('denies non-owner to edit worklog', () => {
    const user = makeUser('user2');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.EDIT_OWN, { resource: log })).toBe(false);
  });

  it('allows owner to delete own worklog', () => {
    const user = makeUser('user1');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.DELETE_OWN, { resource: log })).toBe(true);
  });

  it('denies non-owner to delete worklog', () => {
    const user = makeUser('user2');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.DELETE_OWN, { resource: log })).toBe(false);
  });

  it('allows owner to submit own worklog', () => {
    const user = makeUser('user1');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.SUBMIT, { resource: log })).toBe(true);
  });

  it('denies non-owner to submit worklog', () => {
    const user = makeUser('user2');
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.SUBMIT, { resource: log })).toBe(false);
  });

  // ── Personal WorkLog: workspace admin cannot access ───────────────────────
  it('denies workspace Admin from viewing personal worklog', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const log = makeWorklog('user1'); // personal worklog (no task/project)
    // VIEW_TEAM requires hasWorkspaceScope — personal worklog has none
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, resource: log })).toBe(false);
  });

  it('denies workspace Owner from viewing personal worklog', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const log = makeWorklog('user2'); // personal worklog owned by user2
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, resource: log })).toBe(false);
  });

  // ── Team WorkLog visibility ──────────────────────────────────────────────
  it('allows Team Leader to view team worklogs', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user2');
    const task = makeTask('user1', 'user2', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(true);
  });

  it('allows workspace Admin to view team worklogs', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user1');
    const task = makeTask('user1', 'user1', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(true);
  });

  it('allows workspace Owner to view team worklogs', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user2');
    const task = makeTask('user1', 'user2', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(true);
  });

  it('denies plain member to view team worklogs', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2', 'user3']);
    const log = makeWorklog('user1');
    const task = makeTask('user1', 'user1', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('denies Team Leader from viewing unrelated team worklogs', () => {
    const user = makeUser('user1');
    // user1 is a Member (not Owner/Admin) and leader of team A
    const ws = makeWorkspace('owner', [{ userId: 'user1', role: 'Member' }]);
    const team = makeTeam('user1', ['user1']); // team A — user3 NOT a member
    const log = makeWorklog('user3');
    const task = makeTask('user3', 'user3', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('denies Team Leader from viewing personal worklogs via VIEW_TEAM', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user2'); // personal worklog (no task workspaceRef)
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log })).toBe(false);
  });

  // ── Project WorkLog visibility ───────────────────────────────────────────
  it('allows Project Manager to view project worklogs', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const log = makeWorklog('user2');
    const task = { _id: 'task1', userId: 'user2', assigneeIds: ['user2'], workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, WORKLOG.VIEW_PROJECT, { workspace: ws, project, resource: log, task })).toBe(true);
  });

  it('allows workspace Admin to view project worklogs', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const project = makeProject('user1');
    const log = makeWorklog('user1');
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user1'], workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, WORKLOG.VIEW_PROJECT, { workspace: ws, project, resource: log, task })).toBe(true);
  });

  it('denies Project Member from viewing all project worklogs', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    const project = makeProject('user1', ['user2']); // user2 is member, not PM
    const log = makeWorklog('user3');
    const task = { _id: 'task1', userId: 'user3', assigneeIds: ['user3'], workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, WORKLOG.VIEW_PROJECT, { workspace: ws, project, resource: log, task })).toBe(false);
  });

  it('denies PM from viewing unrelated project worklogs', () => {
    const user = makeUser('user1');
    // user1 is PM of project A, but NOT an admin of the workspace
    const ws = makeWorkspace('owner', [{ userId: 'user1', role: 'Member' }]);
    const project = makeProject('user1'); // user1 is PM of project A
    const log = makeWorklog('user2');
    const task = { _id: 'task1', userId: 'user2', assigneeIds: ['user2'], workspaceRef: 'ws1', projectRef: 'proj2' }; // project B
    expect(can(user, WORKLOG.VIEW_PROJECT, { workspace: ws, project, resource: log, task })).toBe(false);
  });

  // ── Review / Approve / Request Changes ───────────────────────────────────
  it('allows Team Leader to review team worklogs', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1', [{ userId: 'user1', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user2');
    const task = makeTask('user1', 'user2', 'ws1');
    expect(can(user, WORKLOG.REVIEW, { workspace: ws, team, resource: log, task })).toBe(true);
  });

  it('allows PM to approve project worklogs', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const log = makeWorklog('user2');
    const task = { _id: 'task1', userId: 'user2', assigneeIds: ['user2'], workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, WORKLOG.APPROVE, { workspace: ws, project, resource: log, task })).toBe(true);
  });

  it('prevents self-approval', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const project = makeProject('user1');
    const log = makeWorklog('user1'); // user1 owns the worklog
    const task = { _id: 'task1', userId: 'user1', assigneeIds: ['user1'], workspaceRef: 'ws1', projectRef: 'proj1' };
    expect(can(user, WORKLOG.APPROVE, { workspace: ws, project, resource: log, task })).toBe(false);
  });

  it('prevents self-review', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user1'); // user1 owns the worklog
    const task = makeTask('user1', 'user1', 'ws1');
    expect(can(user, WORKLOG.REVIEW, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('prevents self-request-changes', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    const team = makeTeam('user1', ['user1', 'user2']);
    const log = makeWorklog('user1');
    const task = makeTask('user1', 'user1', 'ws1');
    expect(can(user, WORKLOG.REQUEST_CHANGES, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('denies plain member to review worklogs', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Member' }]);
    const team = makeTeam('user1', ['user1', 'user2', 'user3']);
    const log = makeWorklog('user1');
    const task = makeTask('user1', 'user1', 'ws1');
    expect(can(user, WORKLOG.REVIEW, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('denies unauthorized Team Leader to approve worklogs', () => {
    const user = makeUser('user1');
    // user1 is leader of team A, but NOT an admin of the workspace
    const ws = makeWorkspace('owner', [{ userId: 'user1', role: 'Member' }]);
    const team = makeTeam('user1', ['user1']); // team A — user2 NOT a member
    const log = makeWorklog('user2');
    const task = makeTask('user2', 'user2', 'ws1');
    expect(can(user, WORKLOG.APPROVE, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('denies unauthorized PM to approve worklogs', () => {
    const user = makeUser('user1');
    // user1 is PM of project A, but NOT an admin of the workspace
    const ws = makeWorkspace('owner', [{ userId: 'user1', role: 'Member' }]);
    const project = makeProject('user1'); // PM of project A
    const log = makeWorklog('user2');
    const task = { _id: 'task1', userId: 'user2', assigneeIds: ['user2'], workspaceRef: 'ws1', projectRef: 'proj2' }; // project B
    expect(can(user, WORKLOG.APPROVE, { workspace: ws, project, resource: log, task })).toBe(false);
  });

  // ── Platform admin bypass ────────────────────────────────────────────────
  it('platform admin bypasses all worklog checks', () => {
    const user = { _id: 'admin1', name: 'Admin', role: 'admin' };
    const log = makeWorklog('user1');
    expect(can(user, WORKLOG.VIEW_OWN, { resource: log })).toBe(true);
    expect(can(user, WORKLOG.VIEW_TEAM, { resource: log })).toBe(true);
    expect(can(user, WORKLOG.VIEW_PROJECT, { resource: log })).toBe(true);
    expect(can(user, WORKLOG.APPROVE, { resource: log })).toBe(true);
  });

  // ── Null / edge cases ────────────────────────────────────────────────────
  it('denies null user', () => {
    const log = makeWorklog('user1');
    expect(can(null, WORKLOG.VIEW_OWN, { resource: log })).toBe(false);
  });

  it('denies missing context', () => {
    const user = makeUser('user1');
    expect(can(user, WORKLOG.VIEW_OWN, null)).toBe(false);
  });

  it('denies unknown permission', () => {
    const user = makeUser('user1');
    const log = makeWorklog('user1');
    expect(can(user, 'worklog.nonexistent', { resource: log })).toBe(false);
  });

  // ── Cross-workspace security ─────────────────────────────────────────────
  it('denies user from another workspace from viewing team worklogs', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', []); // user2 is NOT in ws1
    const team = makeTeam('user1', ['user1']);
    const log = makeWorklog('user1');
    const task = makeTask('user1', 'user1', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(false);
  });

  it('denies cross-project access for PM', () => {
    const user = makeUser('user1');
    // user1 is PM of project A, but NOT an admin of the workspace
    const ws = makeWorkspace('owner', [{ userId: 'user1', role: 'Member' }]);
    const project = makeProject('user1'); // PM of project A
    const log = makeWorklog('user2');
    const task = { _id: 'task1', userId: 'user2', assigneeIds: ['user2'], workspaceRef: 'ws1', projectRef: 'proj2' }; // project B
    expect(can(user, WORKLOG.VIEW_PROJECT, { workspace: ws, project, resource: log, task })).toBe(false);
  });

  it('denies cross-team access for Team Leader', () => {
    const user = makeUser('user1');
    // user1 is leader of team A, but NOT an admin of the workspace
    const ws = makeWorkspace('owner', [{ userId: 'user1', role: 'Member' }]);
    const team = makeTeam('user1', ['user1']); // team A
    const log = makeWorklog('user3'); // user3 is on team B
    const task = makeTask('user3', 'user3', 'ws1');
    expect(can(user, WORKLOG.VIEW_TEAM, { workspace: ws, team, resource: log, task })).toBe(false);
  });
});

describe('can() — Discussion permissions', () => {
  it('allows workspace member to view discussion', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(can(user, DISCUSSION.VIEW, { workspace: ws })).toBe(true);
  });

  it('allows author to delete own comment', () => {
    const user = makeUser('user1');
    const comment = makeComment('user1');
    expect(can(user, DISCUSSION.DELETE_OWN, { resource: comment })).toBe(true);
  });

  it('denies non-author to delete own comment', () => {
    const user = makeUser('user2');
    const comment = makeComment('user1');
    expect(can(user, DISCUSSION.DELETE_OWN, { resource: comment })).toBe(false);
  });

  it('allows workspace Admin to delete any comment', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const comment = makeComment('user1', 'ws1');
    expect(can(user, DISCUSSION.DELETE_ANY, { workspace: ws, resource: comment })).toBe(true);
  });

  it('denies plain member to delete any comment', () => {
    const user = makeUser('user3');
    const ws = makeWorkspace('user1', [{ userId: 'user3', role: 'Developer' }]);
    const comment = makeComment('user1', 'ws1');
    expect(can(user, DISCUSSION.DELETE_ANY, { workspace: ws, resource: comment })).toBe(false);
  });
});

describe('can() — File permissions', () => {
  it('allows uploader to delete own file', () => {
    const user = makeUser('user1');
    const att = makeAttachment('user1');
    expect(can(user, FILE.DELETE_OWN, { resource: att })).toBe(true);
  });

  it('denies non-uploader to delete own file', () => {
    const user = makeUser('user2');
    const att = makeAttachment('user1');
    expect(can(user, FILE.DELETE_OWN, { resource: att })).toBe(false);
  });

  it('allows workspace Admin to delete any file', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    const att = makeAttachment('user1', 'ws1');
    expect(can(user, FILE.DELETE_ANY, { workspace: ws, resource: att })).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Backward Compatibility Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Legacy permissions.js compatibility', () => {
  const legacy = require('../utils/permissions');

  it('exports ROLE_TIERS with new + legacy roles', () => {
    expect(legacy.ROLE_TIERS).toEqual(['Owner', 'Admin', 'Member', 'Manager', 'Developer', 'Viewer']);
  });

  it('exports EDITOR_ROLES with Member and legacy editor roles', () => {
    expect(legacy.EDITOR_ROLES).toEqual(['Owner', 'Admin', 'Member', 'Manager', 'Developer']);
  });

  it('exports MANAGER_ROLES as Owner and Admin', () => {
    expect(legacy.MANAGER_ROLES).toEqual(['Owner', 'Admin']);
  });

  it('exports OWNER_ROLES as Owner only', () => {
    expect(legacy.OWNER_ROLES).toEqual(['Owner']);
  });

  it('canRead returns true for all legacy roles', () => {
    for (const role of legacy.ROLE_TIERS) {
      expect(legacy.canRead(role)).toBe(true);
    }
  });

  it('canEdit returns false for Viewer', () => {
    expect(legacy.canEdit('Viewer')).toBe(false);
  });

  it('canEdit returns true for Developer', () => {
    expect(legacy.canEdit('Developer')).toBe(true);
  });

  it('canEdit returns true for Member', () => {
    expect(legacy.canEdit('Member')).toBe(true);
  });

  it('canManage returns true for Owner and Admin', () => {
    expect(legacy.canManage('Owner')).toBe(true);
    expect(legacy.canManage('Admin')).toBe(true);
  });

  it('canManage returns false for Manager', () => {
    expect(legacy.canManage('Manager')).toBe(false);
  });

  it('canDeleteWorkspace returns true only for Owner', () => {
    expect(legacy.canDeleteWorkspace('Owner')).toBe(true);
    expect(legacy.canDeleteWorkspace('Admin')).toBe(false);
  });

  it('GATE_ROLES matches expected structure', () => {
    expect(legacy.GATE_ROLES.member).toEqual(legacy.ROLE_TIERS);
    expect(legacy.GATE_ROLES.editor).toEqual(legacy.EDITOR_ROLES);
    expect(legacy.GATE_ROLES.ownerAdmin).toEqual(legacy.MANAGER_ROLES);
    expect(legacy.GATE_ROLES.owner).toEqual(legacy.OWNER_ROLES);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 2 · Workspace escalation / privilege-protection tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2 — Workspace privilege escalation prevention', () => {
  it('Member cannot self-promote to Admin via MANAGE_ROLES', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, WORKSPACE.MANAGE_ROLES, { workspace: ws })).toBe(false);
  });

  it('Member cannot manage members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
  });

  it('Member cannot delete workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(false);
  });

  it('Member cannot transfer ownership', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(false);
  });

  it('Member cannot manage billing', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, WORKSPACE.MANAGE_BILLING, { workspace: ws })).toBe(false);
  });

  it('Admin cannot delete workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(false);
  });

  it('Admin cannot transfer ownership', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(false);
  });

  it('Admin cannot manage billing', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.MANAGE_BILLING, { workspace: ws })).toBe(false);
  });

  it('Admin can manage members', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(true);
  });

  it('Admin can manage roles', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.MANAGE_ROLES, { workspace: ws })).toBe(true);
  });

  it('Admin can edit workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Admin' }]);
    expect(can(user, WORKSPACE.EDIT, { workspace: ws })).toBe(true);
  });

  it('Owner can delete workspace', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(true);
  });

  it('Owner can transfer ownership', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('user1');
    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(true);
  });

  it('Member can view workspace', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Member' }]);
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('legacy Manager maps to Member (no workspace admin privileges)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Manager' }]);
    // Manager maps to Member via LEGACY_ROLE_MAP, so no admin actions
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(false);
    // But can still view
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('legacy Developer maps to Member (no workspace admin privileges)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Developer' }]);
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(false);
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('legacy Viewer maps to Member (can view workspace)', () => {
    const user = makeUser('user2');
    const ws = makeWorkspace('user1', [{ userId: 'user2', role: 'Viewer' }]);
    // Viewer maps to Member, so can view (Member can view)
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
    // But cannot manage
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
  });
});
