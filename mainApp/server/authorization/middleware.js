// authorization/middleware.js — Reusable authorization middleware factories.
//
// Provides Express middleware factories that resolve context and invoke the
// central `can()` function. These are NOT yet used by existing routes — they
// are the foundation for Phase 2+ route migration.
//
// Phase 1: Middleware definitions only. No existing routes are modified.

const { can } = require('./authorization');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Team = require('../models/Team');
const WorkLog = require('../models/WorkLog');
const Task = require('../models/Task');

/**
 * Factory: require a workspace permission.
 *
 * Resolves the workspace from req.workspace (set by loadWorkspace) or
 * req.params.id, then checks the permission.
 *
 * @param {string} permission - A workspace.* permission.
 * @returns {Function} Express middleware.
 */
function requireWorkspacePermission(permission) {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated (must run after protect middleware)
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Resolve workspace
      let workspace = req.workspace;
      if (!workspace && req.params.id) {
        workspace = await Workspace.findById(req.params.id).select('members createdBy');
        if (!workspace) {
          return res.status(404).json({ message: 'Workspace not found' });
        }
      }

      if (!workspace) {
        return res.status(400).json({ message: 'Workspace context required' });
      }

      const allowed = can(req.user, permission, { workspace });
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Factory: require a project permission.
 *
 * Resolves the project from req.project or req.params.id, then loads its
 * workspace and checks the permission.
 *
 * @param {string} permission - A project.* permission.
 * @returns {Function} Express middleware.
 */
function requireProjectPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Resolve project
      let project = req.project;
      if (!project && req.params.id) {
        project = await Project.findById(req.params.id);
        if (!project) {
          return res.status(404).json({ message: 'Project not found' });
        }
        req.project = project;
      }

      if (!project) {
        return res.status(400).json({ message: 'Project context required' });
      }

      // Resolve workspace — only required for workspace-scoped projects.
      // Personal projects (workspaceRef null) pass workspace as null.
      let workspace = req.workspace;
      if (!workspace && project.workspaceRef) {
        workspace = await Workspace.findById(project.workspaceRef).select('members createdBy');
        if (!workspace) {
          return res.status(404).json({ message: 'Workspace not found' });
        }
        req.workspace = workspace;
      }

      const allowed = can(req.user, permission, { workspace, project });
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Factory: require a team permission.
 *
 * Resolves the team from req.team or req.params.id, then loads its
 * workspace (and project if project-scoped) and checks the permission.
 *
 * @param {string} permission - A team.* permission.
 * @returns {Function} Express middleware.
 */
function requireTeamPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Resolve team
      let team = req.team;
      if (!team && req.params.id) {
        team = await Team.findById(req.params.id);
        if (!team) {
          return res.status(404).json({ message: 'Team not found' });
        }
        req.team = team;
      }

      if (!team) {
        return res.status(400).json({ message: 'Team context required' });
      }

      // Resolve workspace — only required for workspace-scoped teams.
      // Legacy teams (workspaceRef null) pass workspace as null.
      let workspace = req.workspace;
      if (!workspace && team.workspaceRef) {
        workspace = await Workspace.findById(team.workspaceRef).select('members createdBy');
        if (!workspace) {
          return res.status(404).json({ message: 'Workspace not found' });
        }
        req.workspace = workspace;
      }

      // Resolve project — only for project-scoped teams.
      // If the team has a projectRef, load the project for PM access checks.
      let project = req.project;
      if (!project && team.projectRef) {
        project = await Project.findById(team.projectRef);
        if (project) {
          req.project = project;
        }
      }

      const allowed = can(req.user, permission, { workspace, team, project });
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Factory: require ownership of a resource.
 *
 * Loads the resource via getResource(req) and checks that the current user
 * is the owner/creator.
 *
 * @param {Function} getResource - async (req) => resource document.
 * @returns {Function} Express middleware.
 */
function requireOwnership(getResource) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const resource = await getResource(req);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      const { isResourceOwner } = require('./relationships');
      if (!isResourceOwner(req.user, resource)) {
        return res.status(403).json({ message: 'You do not own this resource' });
      }

      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Factory: require a worklog permission.
 *
 * Resolves the worklog from req.params.id, derives its scope from related
 * Task/Project/Workspace, and checks the permission via the worklog policy.
 *
 * Scope derivation:
 *   WorkLog → Task → Project → Workspace
 *   WorkLog → Project → Workspace
 *
 * @param {string} permission - A worklog.* permission.
 * @returns {Function} Express middleware.
 */
function requireWorklogPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Resolve worklog
      const worklogId = req.params.id || req.params.worklogId;
      if (!worklogId) {
        return res.status(400).json({ message: 'WorkLog ID required' });
      }

      const log = await WorkLog.findById(worklogId);
      if (!log) {
        return res.status(404).json({ message: 'WorkLog not found' });
      }
      req.worklog = log;

      // Resolve task (if taskRef is set)
      let task = null;
      if (log.taskRef) {
        task = await Task.findById(log.taskRef).select('workspaceRef projectRef userId assigneeIds');
        if (task) {
          req.task = task;
        }
      }

      // Resolve project (from worklog.projectRef or task.projectRef)
      let project = null;
      const projectId = log.projectRef || (task && task.projectRef);
      if (projectId) {
        project = await Project.findById(projectId).select('workspaceRef userId members');
        if (project) {
          req.project = project;
        }
      }

      // Resolve workspace (from task.workspaceRef or project.workspaceRef)
      let workspace = null;
      const workspaceId = (task && task.workspaceRef) || (project && project.workspaceRef);
      if (workspaceId) {
        workspace = await Workspace.findById(workspaceId).select('members createdBy');
        if (workspace) {
          req.workspace = workspace;
        }
      }

      const allowed = can(req.user, permission, { resource: log, workspace, project, task });
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Factory: require a task permission.
 *
 * Resolves the task from req.params.id, derives its scope from related
 * Project/Workspace, and checks the permission via the task policy.
 *
 * Scope derivation:
 *   Task → Project → Workspace
 *
 * @param {string} permission - A task.* permission.
 * @returns {Function} Express middleware.
 */
function requireTaskPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Resolve task
      const taskId = req.params.id;
      if (!taskId) {
        return res.status(400).json({ message: 'Task ID required' });
      }

      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      req.task = task;

      // Resolve project (from task.projectRef)
      let project = null;
      if (task.projectRef) {
        project = await Project.findById(task.projectRef).select('workspaceRef userId members');
        if (project) {
          req.project = project;
        }
      }

      // Resolve workspace (from task.workspaceRef or project.workspaceRef)
      let workspace = null;
      const workspaceId = task.workspaceRef || (project && project.workspaceRef);
      if (workspaceId) {
        workspace = await Workspace.findById(workspaceId).select('members createdBy');
        if (workspace) {
          req.workspace = workspace;
        }
      }

      const allowed = can(req.user, permission, { resource: task, workspace, project });
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireWorkspacePermission,
  requireProjectPermission,
  requireTeamPermission,
  requireWorklogPermission,
  requireTaskPermission,
  requireOwnership,
};
