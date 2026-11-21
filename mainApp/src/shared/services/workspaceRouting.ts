/**
 * workspaceRouting.ts — Derive the active workspace context from the current URL.
 *
 * The sidebar (Sidebar.tsx) renders different nav sections based on
 * `useAuthStore.workspace` ('personal' | 'work' | 'admin'). Deriving the
 * workspace from the URL keeps the nav consistent with the page the user is on
 * and survives a refresh for free.
 */

export type AppWorkspace = 'personal' | 'work' | 'admin' | null;

export function deriveWorkspaceFromPath(pathname: string): AppWorkspace {
  // Homepage / workspace selector — clear workspace context.
  if (pathname === '/home' || pathname === '/workspace') return null;

  if (pathname.startsWith('/personal')) return 'personal';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/worklog') || pathname.startsWith('/meetings')) return 'work';

  return 'work';
}
