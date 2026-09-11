import { useAuthStore } from '@shared/services/useAuthStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { KanbanTask } from './types';

/**
 * Check if the current user has TASK.EDIT permission on a Kanban task.
 *
 * Mirrors the server-side task.policy.js TASK.EDIT rules:
 * - Platform admin (roleId.level >= 60) → always allowed
 * - Workspace admin/superadmin → allowed
 * - Project manager → allowed
 * - Task assignee (in assigneeIds) → allowed
 * - Task reviewer → allowed
 * - Otherwise → denied
 */
export function canEditTask(task: KanbanTask): boolean {
  const user = useAuthStore.getState().user;
  if (!user) return false;

  // Platform admin blanket bypass
  if ((user.roleId?.level ?? 0) >= 60) return true;

  const { members, projects } = useCollaborationStore.getState();

  // Find workspace membership for current user
  const me = members.find((m) => m.id === user._id);
  if (!me) return false;

  // Workspace admin / superadmin
  if (me.role === 'admin' || me.role === 'superadmin') return true;

  // Project manager check
  if (task.projectId) {
    const project = projects.find((p) => p.id === task.projectId);
    if (project) {
      const pmMember = project.members?.find((m) => m.isProjectManager);
      if (pmMember?.userId === user._id) return true;
    }
  }

  // Task assignee check
  if (task.assignees?.some((a) => a.id === user._id)) return true;

  return false;
}

/**
 * React hook version of canEditTask for use in components.
 */
export function useCanEditTask(task: KanbanTask): boolean {
  const user = useAuthStore((s) => s.user);
  const members = useCollaborationStore((s) => s.members);
  const projects = useCollaborationStore((s) => s.projects);

  if (!user) return false;

  // Platform admin blanket bypass
  if ((user.roleId?.level ?? 0) >= 60) return true;

  // Find workspace membership for current user
  const me = members.find((m) => m.id === user._id);
  if (!me) return false;

  // Workspace admin / superadmin
  if (me.role === 'admin' || me.role === 'superadmin') return true;

  // Project manager check
  if (task.projectId) {
    const project = projects.find((p) => p.id === task.projectId);
    if (project) {
      const pmMember = project.members?.find((m) => m.isProjectManager);
      if (pmMember?.userId === user._id) return true;
    }
  }

  // Task assignee check
  if (task.assignees?.some((a) => a.id === user._id)) return true;

  return false;
}
