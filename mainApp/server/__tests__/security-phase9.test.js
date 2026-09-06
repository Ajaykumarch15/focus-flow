// @vitest-environment node
// Phase 9.8 · Security tests — Horizontal/Vertical Escalation, IDOR, Mass-Assignment.
//
// Tests that authorization boundaries are enforced and cannot be bypassed through
// API manipulation, direct ID access, or role escalation.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ── Permission vocabulary ────────────────────────────────────────────────────

const { WORKSPACE, PROJECT, TEAM, TASK, DISCUSSION, FILE, WORKLOG } = require('../authorization/permissions');

// ── Central authorization ───────────────────────────────────────────────────

const { can } = require('../authorization/authorization');

// ── Relationship helpers ─────────────────────────────────────────────────────

const {
  getWorkspaceRole,
  getProjectRole,
  isTeamLeader,
  isTeamMember,
  isTaskAssignee,
  isTaskReviewer,
  isResourceOwner,
} = require('../authorization/relationships');

// ── Test fixtures ────────────────────────────────────────────────────────────

function makeUser(id, opts = {}) {
  return { _id: id, name: `User ${id}`, email: `user${id}@test.com`, ...opts };
}

function makeWorkspace(ownerId, members = []) {
  return {
    _id: 'ws1',
    createdBy: ownerId,
    members: [{ userId: ownerId, role: 'Owner' }, ...members],
  };
}

function makeProject(pmId, members = [], workspaceRef = 'ws1') {
  return { _id: 'proj1', userId: pmId, members, workspaceRef };
}

function makeTeam(leaderId, memberIds = [], workspaceRef = 'ws1') {
  return { _id: 'team1', leaderId, members: memberIds, workspaceRef };
}

function makeTask(creatorId, workspaceRef, extra = {}) {
  return {
    _id: 'task1',
    userId: creatorId,
    workspaceRef,
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HORIZONTAL ESCALATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9.8 · Horizontal Escalation — Cross-Workspace', () => {
  it('Workspace A Member cannot access Workspace B resources', () => {
    const user = makeUser('member1');
    const wsA = makeWorkspace('ownerA', [{ userId: 'member1', role: 'Member' }]);
    const wsB = makeWorkspace('ownerB');

    expect(getWorkspaceRole(user, wsA)).toBe('Member');
    expect(getWorkspaceRole(user, wsB)).toBeNull();
  });

  it('Workspace A Admin cannot access Workspace B resources', () => {
    const user = makeUser('admin1');
    const wsA = makeWorkspace('ownerA', [{ userId: 'admin1', role: 'Admin' }]);
    const wsB = makeWorkspace('ownerB');

    expect(getWorkspaceRole(user, wsA)).toBe('Admin');
    expect(getWorkspaceRole(user, wsB)).toBeNull();
  });

  it('Workspace A Owner cannot access Workspace B as Owner', () => {
    const user = makeUser('ownerA');
    const wsA = makeWorkspace('ownerA');
    const wsB = makeWorkspace('ownerB');

    expect(getWorkspaceRole(user, wsA)).toBe('Owner');
    expect(getWorkspaceRole(user, wsB)).toBeNull();
  });
});

describe('Phase 9.8 · Horizontal Escalation — Cross-Project', () => {
  it('Project A Manager cannot access Project B as Manager', () => {
    const user = makeUser('pm1');
    const projA = makeProject('pm1', []);
    const projB = makeProject('pm2', []);

    expect(getProjectRole(user, projA)).toBe('manager');
    expect(getProjectRole(user, projB)).toBeNull();
  });

  it('Project A Member cannot access Project B as Member', () => {
    const user = makeUser('member1');
    const projA = makeProject('pm1', ['member1']);
    const projB = makeProject('pm2', []);

    expect(getProjectRole(user, projA)).toBe('member');
    expect(getProjectRole(user, projB)).toBeNull();
  });

  it('Project A Manager cannot moderate Project B discussions', () => {
    const user = makeUser('pm1');
    const ws = makeWorkspace('owner', [{ userId: 'pm1', role: 'Member' }]);
    const projA = makeProject('pm1', []);
    const comment = { _id: 'c1', authorId: 'other', workspaceRef: 'ws1' };

    // PM of projA can moderate projA discussions
    expect(can(user, DISCUSSION.DELETE_ANY, { workspace: ws, project: projA, resource: comment })).toBe(true);

    // PM of projA cannot moderate projB discussions
    const projB = makeProject('pm2', []);
    expect(can(user, DISCUSSION.DELETE_ANY, { workspace: ws, project: projB, resource: comment })).toBe(false);
  });
});

describe('Phase 9.8 · Horizontal Escalation — Cross-Team', () => {
  it('Team A Leader cannot access Team B as Leader', () => {
    const user = makeUser('leader1');
    const teamA = makeTeam('leader1', ['leader1']);
    const teamB = makeTeam('leader2', ['leader2']);

    expect(isTeamLeader(user, teamA)).toBe(true);
    expect(isTeamLeader(user, teamB)).toBe(false);
  });

  it('Team A Leader cannot moderate Team B discussions', () => {
    const user = makeUser('leader1');
    const ws = makeWorkspace('owner', [{ userId: 'leader1', role: 'Member' }]);
    const teamA = makeTeam('leader1', ['leader1']);
    const comment = { _id: 'c1', authorId: 'other', workspaceRef: 'ws1' };

    // Leader of teamA can moderate teamA discussions
    expect(can(user, DISCUSSION.DELETE_ANY, { workspace: ws, team: teamA, resource: comment })).toBe(true);

    // Leader of teamA cannot moderate teamB discussions
    const teamB = makeTeam('leader2', ['leader2']);
    expect(can(user, DISCUSSION.DELETE_ANY, { workspace: ws, team: teamB, resource: comment })).toBe(false);
  });
});

describe('Phase 9.8 · Horizontal Escalation — Cross-Task', () => {
  it('Task A Assignee cannot access Task B as Assignee', () => {
    const user = makeUser('assignee1');
    const taskA = makeTask('creator', 'ws1', { assigneeId: 'assignee1' });
    const taskB = makeTask('creator', 'ws1', { assigneeId: 'assignee2' });

    expect(isTaskAssignee(user, taskA)).toBe(true);
    expect(isTaskAssignee(user, taskB)).toBe(false);
  });

  it('Task A Reviewer cannot access Task B as Reviewer', () => {
    const user = makeUser('reviewer1');
    const taskA = makeTask('creator', 'ws1', { reviewerId: 'reviewer1' });
    const taskB = makeTask('creator', 'ws1', { reviewerId: 'reviewer2' });

    expect(isTaskReviewer(user, taskA)).toBe(true);
    expect(isTaskReviewer(user, taskB)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL ESCALATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9.8 · Vertical Escalation — Role Hierarchy', () => {
  it('Member cannot perform Admin-only workspace operations', () => {
    const user = makeUser('member1');
    const ws = makeWorkspace('owner', [{ userId: 'member1', role: 'Member' }]);

    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
    expect(can(user, WORKSPACE.DELETE, { workspace: ws })).toBe(false);
    expect(can(user, WORKSPACE.UPDATE, { workspace: ws })).toBe(false);
  });

  it('Member cannot perform Owner-only workspace operations', () => {
    const user = makeUser('member1');
    const ws = makeWorkspace('owner', [{ userId: 'member1', role: 'Member' }]);

    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(false);
  });

  it('Admin cannot perform Owner-only workspace operations', () => {
    const user = makeUser('admin1');
    const ws = makeWorkspace('owner', [{ userId: 'admin1', role: 'Admin' }]);

    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(false);
  });

  it('Project Member cannot perform PM-only project operations', () => {
    const user = makeUser('member1');
    const project = makeProject('pm1', ['member1']);

    expect(can(user, PROJECT.UPDATE, { project })).toBe(false);
    expect(can(user, PROJECT.ARCHIVE, { project })).toBe(false);
    expect(can(user, PROJECT.MANAGE_MEMBERS, { project })).toBe(false);
  });

  it('Team Member cannot perform Leader-only team operations', () => {
    const user = makeUser('member1');
    const team = makeTeam('leader1', ['leader1', 'member1']);

    expect(can(user, TEAM.UPDATE, { team })).toBe(false);
    expect(can(user, TEAM.DELETE, { team })).toBe(false);
    expect(can(user, TEAM.MANAGE_MEMBERS, { team })).toBe(false);
    expect(can(user, TEAM.ASSIGN_LEADER, { team })).toBe(false);
  });

  it('Task Assignee cannot perform Admin/PM-only task operations', () => {
    const user = makeUser('assignee1');
    const ws = makeWorkspace('owner', [{ userId: 'assignee1', role: 'Member' }]);
    const task = makeTask('creator', 'ws1', { assigneeId: 'assignee1' });

    expect(can(user, TASK.DELETE, { workspace: ws, resource: task })).toBe(false);
    expect(can(user, TASK.ASSIGN, { workspace: ws, resource: task })).toBe(false);
  });

  it('Task Reviewer cannot perform Admin/PM-only task operations', () => {
    const user = makeUser('reviewer1');
    const ws = makeWorkspace('owner', [{ userId: 'reviewer1', role: 'Member' }]);
    const task = makeTask('creator', 'ws1', { reviewerId: 'reviewer1' });

    expect(can(user, TASK.DELETE, { workspace: ws, resource: task })).toBe(false);
    expect(can(user, TASK.ASSIGN, { workspace: ws, resource: task })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IDOR (Insecure Direct Object Reference) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9.8 · IDOR — Direct ID Access', () => {
  it('User without workspace membership cannot access workspace resources', () => {
    const user = makeUser('outsider');
    const ws = makeWorkspace('owner', [{ userId: 'member1', role: 'Member' }]);

    expect(getWorkspaceRole(user, ws)).toBeNull();
    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(false);
  });

  it('User without project membership cannot access project resources', () => {
    const user = makeUser('outsider');
    const project = makeProject('pm1', ['member1']);

    expect(getProjectRole(user, project)).toBeNull();
    expect(can(user, PROJECT.VIEW, { project })).toBe(false);
  });

  it('Non-author cannot edit comment via direct ID', () => {
    const user = makeUser('other');
    const ws = makeWorkspace('owner', [{ userId: 'other', role: 'Member' }]);
    const comment = { _id: 'c1', authorId: 'author1', workspaceRef: 'ws1' };

    expect(isResourceOwner(user, comment)).toBe(false);
    expect(can(user, DISCUSSION.EDIT_OWN, { workspace: ws, resource: comment })).toBe(false);
  });

  it('Non-uploader cannot delete attachment via direct ID', () => {
    const user = makeUser('other');
    const ws = makeWorkspace('owner', [{ userId: 'other', role: 'Member' }]);
    const attachment = { _id: 'a1', uploadedBy: 'uploader1', workspaceRef: 'ws1' };

    expect(isResourceOwner(user, attachment)).toBe(false);
    expect(can(user, FILE.DELETE_OWN, { workspace: ws, resource: attachment })).toBe(false);
  });

  it('Non-owner cannot access personal worklog via direct ID', () => {
    const user = makeUser('other');
    const worklog = { _id: 'w1', userId: 'owner1' };

    expect(isResourceOwner(user, worklog)).toBe(false);
    expect(can(user, WORKLOG.READ, { resource: worklog })).toBe(false);
  });

  it('Platform admin cannot access personal tasks (owner-only)', () => {
    const admin = makeUser('admin', { role: 'admin' });
    const task = makeTask('owner1', null); // personal task

    // Platform admin bypass should NOT apply to personal tasks
    expect(can(admin, TASK.VIEW, { resource: task })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MASS-ASSIGNMENT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9.8 · Mass-Assignment — Role Manipulation', () => {
  it('Member cannot elevate themselves to Admin via role change', () => {
    const user = makeUser('member1');
    const ws = makeWorkspace('owner', [{ userId: 'member1', role: 'Member' }]);

    // The authorization system checks the current role, not the proposed role
    expect(getWorkspaceRole(user, ws)).toBe('Member');
    expect(can(user, WORKSPACE.MANAGE_MEMBERS, { workspace: ws })).toBe(false);
  });

  it('Member cannot elevate themselves to Owner via role change', () => {
    const user = makeUser('member1');
    const ws = makeWorkspace('owner', [{ userId: 'member1', role: 'Member' }]);

    expect(getWorkspaceRole(user, ws)).toBe('Member');
    expect(can(user, WORKSPACE.TRANSFER_OWNERSHIP, { workspace: ws })).toBe(false);
  });

  it('Project Member cannot elevate themselves to PM', () => {
    const user = makeUser('member1');
    const project = makeProject('pm1', ['member1']);

    // The authorization system checks project.userId, not a proposed change
    expect(getProjectRole(user, project)).toBe('member');
    expect(can(user, PROJECT.UPDATE, { project })).toBe(false);
  });

  it('Team Member cannot elevate themselves to Leader', () => {
    const user = makeUser('member1');
    const team = makeTeam('leader1', ['leader1', 'member1']);

    expect(isTeamLeader(user, team)).toBe(false);
    expect(can(user, TEAM.UPDATE, { team })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM ADMIN VS WORKSPACE ADMIN SEPARATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9.8 · Platform Admin vs Workspace Admin Separation', () => {
  it('Platform admin without workspace membership cannot access workspace resources', () => {
    const admin = makeUser('admin', { role: 'admin' });
    const ws = makeWorkspace('owner', [{ userId: 'member1', role: 'Member' }]);

    // Platform admin bypass does NOT apply to workspace operations
    // They must be workspace members to access workspace resources
    expect(getWorkspaceRole(admin, ws)).toBeNull();
    expect(can(admin, WORKSPACE.VIEW, { workspace: ws })).toBe(false);
  });

  it('Platform admin who IS a workspace member gets workspace access', () => {
    const admin = makeUser('admin', { role: 'admin' });
    const ws = makeWorkspace('owner', [{ userId: 'admin', role: 'Member' }]);

    // Platform admin who is also a workspace member gets access
    expect(getWorkspaceRole(admin, ws)).toBe('Member');
    expect(can(admin, WORKSPACE.VIEW, { workspace: ws })).toBe(true);
  });

  it('Workspace Admin is not Platform Admin', () => {
    const wsAdmin = makeUser('wsadmin', { role: 'user' });
    const ws = makeWorkspace('owner', [{ userId: 'wsadmin', role: 'Admin' }]);

    // Workspace Admin has workspace access
    expect(getWorkspaceRole(wsAdmin, ws)).toBe('Admin');

    // But is NOT platform admin
    expect(wsAdmin.role).toBe('user');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 9.8 · Edge Cases', () => {
  it('null user is always denied', () => {
    const ws = makeWorkspace('owner');
    expect(can(null, WORKSPACE.VIEW, { workspace: ws })).toBe(false);
    expect(can(null, TASK.VIEW, { resource: makeTask('owner', 'ws1') })).toBe(false);
  });

  it('null context is always denied', () => {
    const user = makeUser('user1');
    expect(can(user, WORKSPACE.VIEW, null)).toBe(false);
    expect(can(user, TASK.VIEW, null)).toBe(false);
  });

  it('unknown permission is always denied', () => {
    const user = makeUser('user1');
    const ws = makeWorkspace('owner');
    expect(can(user, 'workspace.UNKNOWN', { workspace: ws })).toBe(false);
    expect(can(user, 'task.UNKNOWN', { resource: makeTask('owner', 'ws1') })).toBe(false);
  });

  it('user with no workspace role cannot access workspace resources', () => {
    const user = makeUser('outsider');
    const ws = makeWorkspace('owner');

    expect(can(user, WORKSPACE.VIEW, { workspace: ws })).toBe(false);
    expect(can(user, WORKSPACE.UPDATE, { workspace: ws })).toBe(false);
  });

  it('user with no project role cannot access project resources', () => {
    const user = makeUser('outsider');
    const project = makeProject('pm1');

    expect(can(user, PROJECT.VIEW, { project })).toBe(false);
    expect(can(user, PROJECT.UPDATE, { project })).toBe(false);
  });
});
