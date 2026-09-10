import { useCallback } from 'react';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';

/**
 * Returns a function that builds slug-based collab paths.
 * Usage: const wsPath = useWorkspacePath(); navigate(wsPath('projects', projectId));
 * Output: /collab/my-startup/projects/proj-123
 */
export function useWorkspacePath(): (...segments: string[]) => string {
  const workspaceId = useWorkspaceId();
  const slug = useCollaborationStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId)?.slug,
  );
  const resolved = slug ?? workspaceId;
  return useCallback((...segs: string[]) => `/collab/${resolved}/${segs.join('/')}`, [resolved]);
}
