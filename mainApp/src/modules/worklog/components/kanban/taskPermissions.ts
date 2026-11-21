import { useAuthStore } from '@shared/services/useAuthStore';
import type { KanbanTask } from './types';

/**
 * Check if the current user can edit a local Kanban task.
 * With the collab workspace removed, permissions are personal: a signed-in user
 * can edit tasks they own or are assigned to; platform admins can edit any task.
 */
export function canEditTask(task: KanbanTask): boolean {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  if ((user.roleId?.level ?? 0) >= 60) return true;
  if (task.ownerId === user._id) return true;
  return Boolean(task.assignees?.some((a) => a.id === user._id));
}

/** React hook version of canEditTask for use in components. */
export function useCanEditTask(task: KanbanTask): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if ((user.roleId?.level ?? 0) >= 60) return true;
  if (task.ownerId === user._id) return true;
  return Boolean(task.assignees?.some((a) => a.id === user._id));
}
