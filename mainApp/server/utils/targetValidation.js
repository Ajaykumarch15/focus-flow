const Task = require('../models/Task');
const Project = require('../models/Project');
const WorkLog = require('../models/WorkLog');
const Workspace = require('../models/Workspace');
const { findMember } = require('../middleware/workspace');

// EEP2-P5.3.1 / EEP2-P5.3.2 (SAD §10.x): polymorphic `targetRef` validation for
// comments and attachments. A thread/attachment is only as good as the object it
// hangs off — every create/list/cascade first resolves the target and enforces
// the same visibility the target itself has:
//   • workspace Task / Project  → the caller must be a workspace member
//   • personal Task / WorkLog   → owner-only (404 to avoid existence leaks)
//   • doc                       → still client-mock (no server model) — accepted
//                                 without a workspace scope, matching today's
//                                 behaviour
// Returns { ok, workspaceRef } or { ok: false, status, message }.
async function validateTarget(user, { targetType, targetRef }) {
  switch (targetType) {
    case 'task': {
      const task = await Task.findById(targetRef);
      if (!task) return { ok: false, status: 404, message: 'Task not found' };
      if (task.workspaceRef) {
        const ws = await Workspace.findById(task.workspaceRef).select('members');
        if (!ws || !findMember(ws, user._id)) {
          return { ok: false, status: 403, message: 'You are not a member of this workspace' };
        }
        return { ok: true, workspaceRef: task.workspaceRef };
      }
      if (task.userId && String(task.userId) !== String(user._id)) {
        return { ok: false, status: 404, message: 'Task not found' };
      }
      return { ok: true, workspaceRef: null };
    }
    case 'project': {
      const project = await Project.findById(targetRef);
      if (!project) return { ok: false, status: 404, message: 'Project not found' };
      if (!project.workspaceRef) {
        return { ok: false, status: 400, message: 'Project is not workspace-scoped' };
      }
      const ws = await Workspace.findById(project.workspaceRef).select('members');
      if (!ws || !findMember(ws, user._id)) {
        return { ok: false, status: 403, message: 'You are not a member of this workspace' };
      }
      return { ok: true, workspaceRef: project.workspaceRef };
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
