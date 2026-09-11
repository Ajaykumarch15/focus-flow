import { useParams } from 'react-router-dom';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';

/**
 * Resolves the workspace ID from the URL slug.
 * Falls back to treating the param as a raw ID for backward compatibility
 * (old bookmarks, shared links with raw IDs).
 */
export function useWorkspaceId(): string {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaces = useCollaborationStore((s) => s.workspaces);

  if (!workspaceSlug) return '';

  // Try slug match first
  const match = workspaces.find((w) => w.slug === workspaceSlug);
  if (match) return match.id;

  // Fallback: treat as raw ID (backward compat for old URLs / bookmarks)
  const byId = workspaces.find((w) => w.id === workspaceSlug);
  if (byId) return byId.id;

  // Return as-is — let the consuming component handle the "not found" case
  return workspaceSlug;
}
