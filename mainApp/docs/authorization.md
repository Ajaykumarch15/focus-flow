# FocusFlow Authorization System

## Overview

FocusFlow implements a centralized, deny-by-default authorization system for workspace-scoped resources. The system uses three canonical workspace roles, scoped relationships, and a permission-based evaluation engine.

**Four modules:** Personal (user-scoped, owner-only), Workspace, Worklog, Collab.

---

## Role Hierarchy

```
Platform:    admin > user
Workspace:   Owner > Admin > Member  (legacy: Manager/Developer/Viewer → Member)
Project:     manager (= userId creator) > member (in members[])
Team:        leader (= leaderId) > member (in members[])
Task:        assignee + reviewer (specific to each task)
```

---

## Roles

### Platform Roles (User model)

| Role | Scope | Notes |
|------|-------|-------|
| `user` | Platform | Normal user |
| `admin` | Platform | Platform-wide bypass (except workspace operations) |

### Workspace Roles (Workspace.members[])

| Role | Capabilities |
|------|-------------|
| `Owner` | Full workspace control, role management, project creation, billing, ownership transfer |
| `Admin` | Project management, team management, member management |
| `Member` | Task editing, commenting, time tracking (default role) |

**Legacy roles** (`Manager`, `Developer`, `Viewer`) are mapped at read-time via `LEGACY_ROLE_MAP` in `server/authorization/permissions.js`. Migration `0016_migrate_legacy_workspace_roles` converts them in the database.

### Project Roles

| Role | How Determined | Capabilities |
|------|---------------|-------------|
| `manager` | `project.userId` (the creator) | Full project control, member management, archiving |
| `member` | In `project.members[]` array | View, create tasks, comment |

### Team Roles

| Role | How Determined | Capabilities |
|------|---------------|-------------|
| `leader` | `team.leaderId` field | Edit team, manage members, view/managing tasks, moderate discussions |
| `member` | In `team.members[]` array | View team, create tasks in team |

---

## Permission Vocabulary (53 permissions across 8 domains)

### Workspace Permissions
| Permission | Description |
|-----------|-------------|
| `workspace.view` | View workspace details and members |
| `workspace.edit` | Edit workspace name, type, description, settings |
| `workspace.delete` | Delete the workspace and all its data |
| `workspace.manage_members` | Add/remove members, change roles |
| `workspace.manage_roles` | Change member roles (Owner/Admin/Member) |
| `workspace.manage_billing` | Manage billing and subscription |
| `workspace.transfer_ownership` | Transfer ownership to another member |

### Project Permissions
| Permission | Description |
|-----------|-------------|
| `project.view` | View project details |
| `project.create` | Create new projects |
| `project.edit` | Edit project details, description, status |
| `project.delete` | Delete a project |
| `project.archive` | Archive a project |
| `project.manage_members` | Add/remove project members and teams |
| `project.assign_manager` | Assign a project manager |

### Team Permissions
| Permission | Description |
|-----------|-------------|
| `team.view` | View team details and members |
| `team.create` | Create new teams |
| `team.edit` | Edit team name, description, leader |
| `team.delete` | Delete a team |
| `team.manage_members` | Add/remove team members |
| `team.assign_leader` | Assign a team leader |

### Task Permissions
| Permission | Description |
|-----------|-------------|
| `task.view` | View task details |
| `task.create` | Create new tasks |
| `task.edit` | Edit task title, description, status |
| `task.delete` | Delete a task |
| `task.assign` | Assign a task to a user |
| `task.reassign` | Reassign a task to another user |
| `task.submit` | Submit task for review |
| `task.review` | Review a submitted task |
| `task.approve` | Approve a reviewed task |
| `task.request_changes` | Request changes on a task |
| `task.reopen` | Reopen a closed task |

### Worklog Permissions
| Permission | Description |
|-----------|-------------|
| `worklog.view_own` | View your own worklogs |
| `worklog.create` | Create worklog entries |
| `worklog.edit_own` | Edit your own worklogs |
| `worklog.delete_own` | Delete your own worklogs |
| `worklog.submit` | Submit worklog for approval |
| `worklog.view_team` | View team members' worklogs |
| `worklog.review` | Review submitted worklogs |
| `worklog.approve` | Approve submitted worklogs |
| `worklog.request_changes` | Request changes on worklogs |
| `worklog.view_project` | View project-scoped worklogs |

### Discussion Permissions
| Permission | Description |
|-----------|-------------|
| `discussion.view` | View discussions |
| `discussion.create` | Create new discussions |
| `discussion.comment` | Comment on discussions |
| `discussion.edit_own` | Edit your own comments |
| `discussion.delete_own` | Delete your own comments |
| `discussion.delete_any` | Delete any comment |
| `discussion.pin` | Pin/unpin discussions |
| `discussion.moderate` | Moderate discussions |

### Channel Permissions
| Permission | Description |
|-----------|-------------|
| `channel.view` | View channels |
| `channel.create` | Create new channels |
| `channel.edit` | Edit channel details |
| `channel.delete` | Delete channels |
| `channel.manage_members` | Manage channel membership |
| `channel.archive` | Archive channels |

### File Permissions
| Permission | Description |
|-----------|-------------|
| `file.view` | View files |
| `file.upload` | Upload files |
| `file.share` | Share files |
| `file.delete_own` | Delete your own files |
| `file.delete_any` | Delete any file |

---

## Permission Matrices

### Workspace Policy
| Permission | Owner | Admin | Member |
|-----------|-------|-------|--------|
| `workspace.view` | ✓ | ✓ | ✓ |
| `workspace.edit` | ✓ | ✓ | ✗ |
| `workspace.delete` | ✓ | ✗ | ✗ |
| `workspace.manage_members` | ✓ | ✓ | ✗ |
| `workspace.manage_roles` | ✓ | ✗ | ✗ |
| `workspace.manage_billing` | ✓ | ✗ | ✗ |
| `workspace.transfer_ownership` | ✓ | ✗ | ✗ |

### Project Policy
| Permission | Owner | Admin | PM | Member | Non-member |
|-----------|-------|-------|----|--------|-----------|
| `project.view` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `project.create` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `project.edit` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `project.delete` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `project.archive` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `project.manage_members` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `project.assign_manager` | ✓ | ✓ | ✗ | ✗ | ✗ |

### Team Policy
| Permission | Owner | Admin | PM | Team Leader | Member | Non-member |
|-----------|-------|-------|----|------------|--------|-----------|
| `team.view` | ✓ | ✓ | ✓* | ✓** | ✓** | ✗ |
| `team.create` | ✓ | ✓ | ✓* | ✗ | ✗ | ✗ |
| `team.edit` | ✓ | ✓ | ✗ | ✓** | ✗ | ✗ |
| `team.delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `team.manage_members` | ✓ | ✓ | ✗ | ✓** | ✗ | ✗ |
| `team.assign_leader` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

\* PM access only for project-scoped teams (`team.projectRef` set)
\** TL/Member access only for their own team

### Task Policy
| Permission | Owner/Admin | PM | Assignee | Reviewer | Team Leader | Non-member |
|-----------|-------------|----|---------|---------|-------------|-----------|
| `task.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `task.create` | ✓ | ✓ | ✓* | ✗ | ✓ | ✗ |
| `task.edit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `task.delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `task.assign` | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| `task.reassign` | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| `task.submit` | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `task.review` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| `task.approve` | ✓ | ✓ | ✗** | ✓ | ✗ | ✗ |
| `task.request_changes` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| `task.reopen` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

\* PM/Team Leader can create tasks in projects they manage
\** Self-approval blocked: assignee cannot approve their own task

### Worklog Policy
| Permission | Owner/Admin | PM | Team Leader | Worklog Owner |
|-----------|-------------|----|-------------|---------------|
| `worklog.view_own` | — | — | — | ✓ |
| `worklog.create` | ✓ | ✓ | ✓ | ✓ |
| `worklog.edit_own` | — | — | — | ✓ |
| `worklog.delete_own` | — | — | — | ✓ |
| `worklog.submit` | — | — | — | ✓ |
| `worklog.view_team` | ✓ | ✓ | ✓ (their team) | ✗ |
| `worklog.view_project` | ✓ | ✓ (their projects) | ✗ | ✗ |
| `worklog.review` | ✓ | ✓ (their projects) | ✓ (their team) | ✗* |
| `worklog.approve` | ✓ | ✓ (their projects) | ✓ (their team) | ✗* |
| `worklog.request_changes` | ✓ | ✓ (their projects) | ✓ (their team) | ✗* |

\* Self-approval blocked: worklog owner cannot approve their own worklog

### Collab Policy (Discussions & Files)
| Permission | Owner/Admin | PM | Team Leader | Member |
|-----------|-------------|----|------------|--------|
| `discussion.view` | ✓ | ✓ | ✓ | ✓ |
| `discussion.create` | ✓ | ✓ | ✓ | ✓ |
| `discussion.comment` | ✓ | ✓ | ✓ | ✓ |
| `discussion.edit_own` | — | — | — | owner only |
| `discussion.delete_own` | — | — | — | owner only |
| `discussion.delete_any` | ✓ | ✓ | ✓ | ✗ |
| `discussion.pin` | ✓ | ✓ | ✓ | ✗ |
| `discussion.moderate` | ✓ | ✓ | ✓ | ✗ |
| `file.view` | ✓ | ✓ | ✓ | ✓ |
| `file.upload` | ✓ | ✓ | ✓ | ✓ |
| `file.share` | ✓ | ✓ | ✓ | ✓ |
| `file.delete_own` | — | — | — | owner only |
| `file.delete_any` | ✓ | ✓ | ✓ | ✗ |

---

## Architecture

```
server/authorization/
├── permissions.js      # Permission constants, LEGACY_ROLE_MAP, role definitions
├── authorization.js    # Central can(user, permission, context) entry point
├── relationships.js    # getWorkspaceRole, getProjectRole, isTeamLeader, etc.
├── middleware.js        # requireWorkspacePermission, requireProjectPermission, etc.
├── index.js            # Re-exports everything
└── policies/
    ├── workspace.policy.js  # workspace.* permissions
    ├── project.policy.js    # project.* permissions
    ├── team.policy.js       # team.* permissions
    ├── task.policy.js       # task.* permissions
    ├── worklog.policy.js    # worklog.* permissions
    └── collab.policy.js     # discussion.* and file.* permissions
```

---

## How It Works

### 1. Permission Check

```js
const { can } = require('../authorization');
const { TASK } = require('../authorization/permissions');

// Build context from the request
const context = {
  resource: task,     // The target resource (required)
  workspace: ws,      // Workspace document
  project: project,   // Project document (optional)
  team: team,         // Team document (optional)
};

// Check permission
const allowed = can(user, TASK.EDIT, context);
```

### 2. Context Loading

The `can()` function routes to the appropriate policy based on the permission prefix:

| Prefix | Policy | Context Required |
|--------|--------|-----------------|
| `workspace.*` | workspace.policy.js | workspace |
| `project.*` | project.policy.js | workspace, project |
| `team.*` | team.policy.js | workspace, project, team |
| `task.*` | task.policy.js | resource (task), workspace |
| `worklog.*` | worklog.policy.js | resource (worklog), workspace |
| `discussion.*` | collab.policy.js | resource (comment), workspace |
| `file.*` | collab.policy.js | resource (attachment), workspace |

### 3. Deny-by-Default

All unknown permissions, missing contexts, and null users return `false`.

### 4. Platform Admin Bypass

`user.role === 'admin'` gets blanket bypass on company tasks (after personal-task owner check). Workspace-level operations (`workspace.*`) have NO platform-admin bypass — platform admins must be workspace members.

### 5. Middleware Usage

```js
const { requireTaskPermission } = require('../authorization/middleware');

// In route handler
router.patch('/:id', requireTaskPermission('task.edit'), handler);
```

The middleware builds the context automatically from the request.

### 6. Role Resolution Functions

| Function | File | Returns |
|----------|------|---------|
| `getWorkspaceRole(user, workspace)` | relationships.js | `'Owner'`/`'Admin'`/`'Member'`/`null` |
| `getRawWorkspaceRole(user, workspace)` | relationships.js | Raw stored role string |
| `isWorkspaceMember(user, workspace)` | relationships.js | `boolean` |
| `getProjectRole(user, project)` | relationships.js | `'manager'`/`'member'`/`null` |
| `isProjectManager(user, project)` | relationships.js | `boolean` |
| `isProjectMember(user, project)` | relationships.js | `boolean` |
| `isTeamLeader(user, team)` | relationships.js | `boolean` |
| `isTeamMember(user, team)` | relationships.js | `boolean` |
| `isTaskAssignee(user, task)` | relationships.js | `boolean` |
| `isTaskReviewer(user, task)` | relationships.js | `boolean` |
| `isResourceOwner(user, resource)` | relationships.js | `boolean` |

---

## Member Management Flow

### Adding Members

| Level | Method | Who Can Do It |
|-------|--------|---------------|
| **Workspace** | `POST /api/workspaces/:id/members` (invite by email) | Owner, Admin |
| **Workspace** | `POST /api/workspaces/:id/join` (self-join) | Any user (if enabled) |
| **Project** | `PATCH /api/projects/:id` (set `members[]` array) | Owner, Admin, PM |
| **Team** | `POST /api/teams` (create with members) | Owner, Admin, PM |
| **Team** | `POST /api/teams/:id/members` (add single member) | Owner, Admin, Team Leader |

### Removing Members

| Level | Method | Who Can Do It |
|-------|--------|---------------|
| **Workspace** | `DELETE /api/workspaces/:id/members/:userId` | Owner, Admin |
| **Project** | `PATCH /api/projects/:id` (set `members[]` array) | Owner, Admin, PM |
| **Team** | `DELETE /api/teams/:id/members/:userId` | Owner, Admin, Team Leader |

### Updating Roles

| Level | Method | Who Can Do It |
|-------|--------|---------------|
| **Workspace** | `PATCH /api/workspaces/:id/members/:userId` | Owner, Admin |
| **Team** | `PATCH /api/teams/:id` (set `leaderId`) | Owner, Admin |

---

## Key Files

| File | Purpose |
|------|---------|
| `server/authorization/permissions.js` | Permission constants, LEGACY_ROLE_MAP |
| `server/authorization/authorization.js` | Central `can()` function |
| `server/authorization/relationships.js` | Role resolution helpers |
| `server/authorization/middleware.js` | Express middleware factories |
| `server/authorization/policies/*.js` | Per-module permission policies |
| `server/middleware/workspace.js` | Legacy workspace middleware (compatibility) |
| `server/utils/permissions.js` | Legacy compatibility layer |
| `server/utils/targetValidation.js` | Polymorphic target authorization |
| `server/migrations/migrations/0016_migrate_legacy_workspace_roles.js` | Database migration for legacy roles |

---

## Migration from Legacy Roles

1. **Read-time mapping:** `LEGACY_ROLE_MAP` translates legacy values on every access
2. **Database migration:** `0016_migrate_legacy_workspace_roles` converts Manager/Developer/Viewer → Member
3. **Mongoose enum:** Workspace model still allows legacy values in the schema enum during transition
4. **Future cleanup:** Once migration is confirmed on all environments, narrow enum to `['Owner', 'Admin', 'Member']`

---

## Testing

Authorization tests are in:
- `server/__tests__/authorization.test.js` — 264 foundation tests
- `server/__tests__/security-phase9.test.js` — 35 escalation/IDOR/mass-assignment tests
- `server/__tests__/collab-auth.test.js` — 51 collab authorization tests
- `server/__tests__/permissionMatrix.test.js` — 18 permission matrix tests
- `server/__tests__/migration0016.test.js` — 8 migration tests
