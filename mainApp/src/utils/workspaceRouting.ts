/**
 * workspaceRouting.ts — Derive the active workspace context from the current URL.
 *
 * The sidebar (Sidebar.tsx) renders different nav sections based on
 * `useAuthStore.workspace` ('personal' | 'collab' | 'work' | 'admin'). That value
 * was only ever set from `useWorkspaceStore.activeWorkspace`, which defaulted to
 * 'personal' and was never updated as the user moved between areas — so on refresh
 * (and often during a session) the sidebar stayed on Personal. Deriving the
 * workspace from the URL makes it follow the page the user is actually on, and
 * because BrowserRouter preserves the URL across reloads, the choice survives a
 * refresh for free.
 */

export type AppWorkspace = 'personal' | 'collab' | 'work' | 'admin';

export function deriveWorkspaceFromPath(pathname: string): AppWorkspace {
  if (pathname.startsWith('/personal')) return 'personal';
  if (pathname.startsWith('/admin')) return 'admin';
  if (
    pathname.startsWith('/w/') ||
    pathname.startsWith('/team') ||
    pathname.startsWith('/collab') ||
    pathname.startsWith('/workspace') ||
    pathname === '/hub' ||
    pathname === '/leaderboard' ||
    pathname === '/activity'
  ) {
    return 'collab';
  }
  // Dashboard, tasks, worklog, focus, reports, insights, schedule, habits,
  // knowledge, settings, analytics, roadmaps, etc. → card-based WorkLog nav.
  return 'work';
}
