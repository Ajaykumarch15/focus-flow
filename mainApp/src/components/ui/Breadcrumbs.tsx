import { Link, useLocation, matchRoutes } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';

const ROUTE_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  worklog: 'Work Logs',
  reports: 'Reports',
  tasks: 'Tasks',
  analytics: 'Analytics',
  journal: 'Journal',
  habits: 'Habits',
  leaderboard: 'Leaderboard',
  focus: 'Focus Mode',
  settings: 'Settings',
  workspace: 'Workspace',
  admin: 'Administration',
  overview: 'Overview',
  people: 'People',
  teams: 'Teams',
  activity: 'Activity',
  w: 'Workspace',
};

// Labels for dynamic route params — derived from the route shape, never guessed
// from the segment's string length.
const PARAM_LABELS: Record<string, string> = {
  workspaceId: 'Workspace',
  memberId: 'Member',
  projectId: 'Project',
  sprintId: 'Sprint',
  featureId: 'Feature',
  docId: 'Document',
  id: 'Details',
  token: 'Shared Report',
};

const DYNAMIC_ROUTES = [
  '/w/:workspaceId',
  '/w/:workspaceId/members/:memberId',
  '/w/:workspaceId/projects/:projectId',
  '/w/:workspaceId/sprints/:sprintId',
  '/w/:workspaceId/features/:featureId',
  '/w/:workspaceId/knowledge/:docId',
  '/tasks/:id',
  '/worklog/:id',
  '/reports/share/token/:token',
];

export function Breadcrumbs() {
  const location = useLocation();
  const crumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);

    // Deepest dynamic route whose shape matches the current location.
    const deepest = DYNAMIC_ROUTES
      .map((path) => matchRoutes([{ path }], location)?.[0])
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .sort((a, b) => (b.route.path ?? '').split('/').length - (a.route.path ?? '').split('/').length)[0];

    const params = (deepest?.params ?? {}) as Record<string, string>;

    const result: { label: string; path: string; isLast: boolean }[] = [];
    let path = '';
    for (let i = 0; i < segments.length; i++) {
      path += '/' + segments[i];
      const paramKey = Object.keys(params).find((k) => params[k] === segments[i]);
      // The leading /w segment already renders as "Workspace".
      if (paramKey === 'workspaceId') continue;
      const label = paramKey
        ? (PARAM_LABELS[paramKey] || 'Details')
        : (ROUTE_MAP[segments[i]] || segments[i].charAt(0).toUpperCase() + segments[i].slice(1));
      result.push({ label, path, isLast: i === segments.length - 1 });
    }
    return result;
  }, [location.pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs min-w-0">
      <Link to="/dashboard" aria-label="Home" className="text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0">
        <Home size={13} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1 min-w-0">
          <ChevronRight size={12} className="text-surface-600 flex-shrink-0" />
          {crumb.isLast ? (
            <span className="text-surface-200 font-medium truncate">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="text-surface-400 hover:text-surface-200 transition-colors truncate">{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
