import { Link, useLocation } from 'react-router-dom';
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
};

export function Breadcrumbs() {
  const location = useLocation();
  const crumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const result: { label: string; path: string; isLast: boolean }[] = [];
    let path = '';
    for (let i = 0; i < segments.length; i++) {
      path += '/' + segments[i];
      const isId = segments[i].length > 20;
      result.push({
        label: isId ? 'Details' : (ROUTE_MAP[segments[i]] || segments[i].charAt(0).toUpperCase() + segments[i].slice(1)),
        path,
        isLast: i === segments.length - 1,
      });
    }
    return result;
  }, [location.pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs min-w-0">
      <Link to="/dashboard" className="text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0">
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
