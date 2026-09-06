# FocusFlow Authorization System

## Overview

FocusFlow implements a centralized, deny-by-default authorization system for workspace-scoped resources. The system uses three canonical workspace roles, scoped relationships, and a permission-based evaluation engine.

**Four modules:** Personal (user-scoped, owner-only), Workspace, Worklog, Collab.

## Roles

### Platform Roles (User model)
| Role | Scope | Notes |
|------|-------|-------|
| `user` | Platform | Normal user |
| `admin` | Platform | Platform-wide bypass (except workspace operations) |

### Workspace Roles (Workspace.members[])
| Role | Capabilities |
|------|-------------|
| `Owner` | Full workspace control, role management, project creation |
| `Admin` | Project management, team management, member management |
| `Member` | Task editing, commenting, time tracking (default role) |

**Legacy roles** (`Manager`, `Developer`, `Viewer`) are mapped at read-time via `LEGACY_ROLE_MAP` in `server/authorization/permissions.js`. Migration `0016_migrate_legacy_workspace_roles` converts them in the database.

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

## Permission Matrix

### Workspace
| Permission | Owner | Admin | Member |
|-----------|-------|-------|--------|
| workspace.view | ✓ | ✓ | ✓ |
| workspace.edit | ✓ | ✓ | ✗ |
| workspace.delete | ✓ | ✗ | ✗ |
| workspace.manage_members | ✓ | ✓ | ✗ |
| workspace.manage_roles | ✓ | ✗ | ✗ |

### Project
| Permission | Owner | Admin | PM | Member | Non-member |
|-----------|-------|-------|----| ------|-----------|
| project.view | ✓ | ✓ | ✓ | ✓ | ✗ |
| project.create | ✓ | ✓ | ✓ | ✓ | ✗ |
| project.edit | ✓ | ✓ | ✓ | ✗ | ✗ |
| project.delete | ✓ | ✓ | ✗ | ✗ | ✗ |
| project.manage_members | ✓ | ✓ | ✓ | ✗ | ✗ |
| project.assign_manager | ✓ | ✓ | ✗ | ✗ | ✗ |

### Task
| Permission | Owner/Admin | PM | Assignee | Reviewer | Team Leader | Non-member |
|-----------|-------------|----|---------|---------|-------------|-----------|
| task.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| task.create | ✓ | ✓ | ✓* | ✗ | ✓ | ✗ |
| task.edit | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| task.delete | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| task.assign | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| task.submit | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| task.review | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |

*PM/Team Leader can create tasks in projects they manage.

### Team
| Permission | Owner | Admin | PM | Team Leader | Member |
|-----------|-------|-------|----|------------|--------|
| team.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| team.create | ✓ | ✓ | ✓ | ✗ | ✗ |
| team.edit | ✓ | ✓ | ✗ | ✓ | ✗ |
| team.delete | ✓ | ✓ | ✗ | ✗ | ✗ |
| team.manage_members | ✓ | ✓ | ✗ | ✓ | ✗ |

### Collab (Comments & Attachments)
| Permission | Owner/Admin | PM | Team Leader | Member |
|-----------|-------------|----|------------|--------|
| discussion.create | ✓ | ✓ | ✓ | ✓ |
| discussion.delete_any | ✓ | ✓ | ✓ | ✗ |
| discussion.reply_in_thread | ✓ | ✓ | ✓ | ✓ |
| file.upload | ✓ | ✓ | ✓ | ✓ |
| file.delete_any | ✓ | ✓ | ✓ | ✗ |

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

## Migration from Legacy Roles

1. **Read-time mapping:** `LEGACY_ROLE_MAP` translates legacy values on every access
2. **Database migration:** `0016_migrate_legacy_workspace_roles` converts Manager/Developer/Viewer → Member
3. **Mongoose enum:** Workspace model still allows legacy values in the schema enum during transition
4. **Future cleanup:** Once migration is confirmed on all environments, narrow enum to `['Owner', 'Admin', 'Member']`

## Testing

Authorization tests are in:
- `server/__tests__/authorization.test.js` — 264 foundation tests
- `server/__tests__/security-phase9.test.js` — 35 escalation/IDOR/mass-assignment tests
- `server/__tests__/collab-auth.test.js` — 51 collab authorization tests
- `server/__tests__/permissionMatrix.test.js` — 18 permission matrix tests
- `server/__tests__/migration0016.test.js` — 8 migration tests
