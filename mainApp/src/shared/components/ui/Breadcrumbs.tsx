import { Link, useLocation, matchRoutes } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';

const ROUTE_MAP: Record<string, string> = {
  dashboard: 'Today',
  worklog: 'WorkLog',
  logs: 'Work Logs',
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
  timeline: 'Timeline',
  w: 'Workspace',
  roadmaps: 'Roadmaps',
  schedule: 'Schedule',
  knowledge: 'Knowledge',
  insights: 'Insights',
  personal: 'Personal',
  collab: 'Collab',
  home: 'Home',
  search: 'Search',
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
  '/w/:workspaceId/projects/:projectId/timeline',
  '/w/:workspaceId/sprints/:sprintId',
  '/w/:workspaceId/features/:featureId',
  '/w/:workspaceId/knowledge/:docId',
  '/worklog/tasks/:id',
  '/worklog/logs/:id',
  '/personal/roadmaps/:id',
  '/personal/roadmaps/:id/phases/:phaseId',
  '/personal/roadmaps/:id/phases/:phaseId/milestones/:milestoneId',
  '/reports/share/token/:token',
];

type Crumb = { label: string; path: string; isLast: boolean; title: string };

export function Breadcrumbs() {
  const location = useLocation();
  const { activeRoadmap, detailLoading } = useRoadmapStore();

  const crumbs = useMemo<Crumb[]>(() => {
    const segments = location.pathname.split('/').filter(Boolean);

    // ── Roadmap family: resolve ids → human-readable entity titles ──────────
    // /personal/roadmaps/:id | /personal/roadmaps/:id/phases/:phaseId |
    // /personal/roadmaps/:id/phases/:phaseId/milestones/:milestoneId
    // Raw IDs are never shown — we wait for the store to resolve, or fall back
    // to a generic label ("Roadmap"/"Phase"/"Milestone").
    if (segments[0] === 'personal' && segments[1] === 'roadmaps' && segments[2]) {
      const id = segments[2];
      const phaseId = segments[3] === 'phases' ? segments[4] : undefined;
      const milestoneId = segments[5] === 'milestones' ? segments[6] : undefined;

      const roadmapReady = !!activeRoadmap && String(activeRoadmap._id) === String(id);
      const phase = roadmapReady
        ? activeRoadmap.phases.find((p) => String(p._id) === String(phaseId))
        : undefined;
      const milestone = roadmapReady
        ? activeRoadmap.milestones.find((m) => String(m._id) === String(milestoneId))
        : undefined;

      // While the store is still resolving this roadmap, avoid flashing IDs.
      const loading = detailLoading && !roadmapReady;

      const roadmapLabel = loading ? 'Loading…' : (activeRoadmap?.title || 'Roadmap');
      const phaseLabel = loading ? 'Loading…' : (phase?.title || 'Phase');
      const milestoneLabel = loading ? 'Loading…' : (milestone?.title || 'Milestone');

      const result: Crumb[] = [
        { label: 'Roadmaps', path: '/personal/roadmaps', isLast: false, title: 'Roadmaps' },
        { label: roadmapLabel, path: `/personal/roadmaps/${id}`, isLast: !phaseId, title: roadmapLabel },
      ];
      if (phaseId) {
        result.push({
          label: phaseLabel,
          path: `/personal/roadmaps/${id}/phases/${phaseId}`,
          isLast: !milestoneId,
          title: phaseLabel,
        });
      }
      if (milestoneId) {
        result.push({
          label: milestoneLabel,
          path: `/personal/roadmaps/${id}/phases/${phaseId}/milestones/${milestoneId}`,
          isLast: true,
          title: milestoneLabel,
        });
      }
      return result;
    }

    // ── Generic handling for all other routes ───────────────────────────────
    // Deepest dynamic route whose shape matches the current location.
    const deepest = DYNAMIC_ROUTES
      .map((path) => matchRoutes([{ path }], location)?.[0])
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .sort((a, b) => (b.route.path ?? '').split('/').length - (a.route.path ?? '').split('/').length)[0];

    const params = (deepest?.params ?? {}) as Record<string, string>;

    const result: Crumb[] = [];
    let path = '';
    for (let i = 0; i < segments.length; i++) {
      path += '/' + segments[i];
      const paramKey = Object.keys(params).find((k) => params[k] === segments[i]);
      // The leading /w segment already renders as "Workspace".
      if (paramKey === 'workspaceId') continue;
      const label = paramKey
        ? (PARAM_LABELS[paramKey] || 'Details')
        : (ROUTE_MAP[segments[i]] || segments[i].charAt(0).toUpperCase() + segments[i].slice(1));
      result.push({ label, path, isLast: i === segments.length - 1, title: label });
    }
    return result;
  }, [location.pathname, activeRoadmap, detailLoading]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs min-w-0">
      <Link to="/home" aria-label="Home" title="Home" className="text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0">
        <Home size={13} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1 min-w-0">
          <ChevronRight size={12} className="text-surface-600 flex-shrink-0" />
          {crumb.isLast ? (
            <span title={crumb.title} className="text-surface-200 font-medium truncate">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} title={crumb.title} className="text-surface-400 hover:text-surface-200 transition-colors truncate">{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
