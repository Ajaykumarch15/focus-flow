const Task = require('../models/Task');
const Project = require('../models/Project');
const WorkLog = require('../models/WorkLog');
const Workspace = require('../models/Workspace');
const { getWorkspaceRole, getProjectRole, isWorkspaceMember } = require('../authorization/relationships');

// EEP2-P5.3.1 / EEP2-P5.3.2 (SAD §10.x): polymorphic `targetRef` validation for
// comments and attachments. A thread/attachment is only as good as the object it
// hangs off — every create/list/cascade first resolves the target and enforces
// the same visibility the target itself has:
//
// Authorization principle (Phase 8):
//   A user must be authorized to access the parent resource before accessing
//   its comments or attachments. Authorization is derived from:
//
//   Task targets:
//     - Personal task (no workspaceRef): owner-only
//     - Workspace task with projectRef: project membership or Owner/Admin or assignee/reviewer
//     - Workspace task without projectRef: workspace Owner/Admin only
//
//   Project targets:
//     - Project membership or workspace Owner/Admin
//
//   Worklog targets:
//     - Owner-only (personal resource)
//
//   Doc targets:
//     - Accepted without scope (client-mock)
//
// Returns { ok, workspaceRef } or { ok: false, status, message }.
async function validateTarget(user, { targetType, targetRef }) {
  switch (targetType) {
    case 'task': {
      const task = await Task.findById(targetRef);
      if (!task) return { ok: false, status: 404, message: 'Task not found' };

      // Personal task: owner-only (404 to avoid existence leaks)
      if (!task.workspaceRef) {
        if (task.userId && String(task.userId) !== String(user._id)) {
          return { ok: false, status: 404, message: 'Task not found' };
        }
        return { ok: true, workspaceRef: null };
      }

      // Workspace task: check proper authorization
      const ws = await Workspace.findById(task.workspaceRef).select('members createdBy');
      if (!ws) return { ok: false, status: 404, message: 'Workspace not found' };

      // Check workspace membership
      const isMember = isWorkspaceMember(user, ws);
      if (!isMember) {
        return { ok: false, status: 403, message: 'You are not a member of this workspace' };
      }

      // Owner/Admin of workspace: full access to all workspace resources
      const wsRole = getWorkspaceRole(user, ws);
      if (wsRole === 'Owner' || wsRole === 'Admin') {
        return { ok: true, workspaceRef: task.workspaceRef };
      }

      // Task assignee: can access the task
      if (task.assigneeId && String(task.assigneeId) === String(user._id)) {
        return { ok: true, workspaceRef: task.workspaceRef };
      }

      // Task reviewer: can access the task
      if (task.reviewerId && String(task.reviewerId) === String(user._id)) {
        return { ok: true, workspaceRef: task.workspaceRef };
      }

      // Task creator: can access the task
      if (task.userId && String(task.userId) === String(user._id)) {
        return { ok: true, workspaceRef: task.workspaceRef };
      }

      // If task has a project, check project membership
      if (task.projectRef) {
        const project = await Project.findById(task.projectRef).select('userId members workspaceRef');
        if (project) {
          const projectRole = getProjectRole(user, project);
          if (projectRole) {
            return { ok: true, workspaceRef: task.workspaceRef };
          }
        }
      }

      // No matching authorization — deny access
      return { ok: false, status: 403, message: 'You do not have access to this task' };
    }

    case 'project': {
      const project = await Project.findById(targetRef);
      if (!project) return { ok: false, status: 404, message: 'Project not found' };
      if (!project.workspaceRef) {
        return { ok: false, status: 400, message: 'Project is not workspace-scoped' };
      }
      const ws = await Workspace.findById(project.workspaceRef).select('members createdBy');
      if (!ws) return { ok: false, status: 404, message: 'Workspace not found' };

      const isMember = isWorkspaceMember(user, ws);
      if (!isMember) {
        return { ok: false, status: 403, message: 'You are not a member of this workspace' };
      }

      // Owner/Admin: full access
      const wsRole = getWorkspaceRole(user, ws);
      if (wsRole === 'Owner' || wsRole === 'Admin') {
        return { ok: true, workspaceRef: project.workspaceRef };
      }

      // Check project membership
      const projectRole = getProjectRole(user, project);
      if (projectRole) {
        return { ok: true, workspaceRef: project.workspaceRef };
      }

      return { ok: false, status: 403, message: 'You are not a member of this project' };
    }

    case 'worklog': {
      const log = await WorkLog.findById(targetRef);
      if (!log) return { ok: false, status: 404, message: 'Worklog not found' };
      if (String(log.userId) !== String(user._id)) {
        return { ok: false, status: 404, message: 'Worklog not found' };
      }
      return { ok: true, workspaceRef: null };
    }

    case 'doc':
      return { ok: true, workspaceRef: null };

    default:
      return { ok: false, status: 400, message: 'Invalid targetType' };
  }
}

module.exports = { validateTarget };
