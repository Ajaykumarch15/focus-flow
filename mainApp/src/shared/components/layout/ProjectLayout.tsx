import { useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderKanban, History, Map, Rocket } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { ContextBreadcrumbs } from './ContextBreadcrumbs';
import { Button } from '@shared/components/ui/Button';

// EEP2-P3.3.1 / DDS §8.1 L2: the Project-context shell. Hosts every page that
// renders under `/w/:workspaceId/projects/:projectId` — breadcrumbs (context
// spine), a project-level tab bar, and the routed Outlet. Additive: deep links
// to existing project pages keep working because this shell wraps, never moves.
export function ProjectLayout() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const { projects, activeWorkspaceId } = useCollaborationStore();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId && p.workspaceId === (workspaceId ?? activeWorkspaceId)),
    [projects, projectId, workspaceId, activeWorkspaceId],
  );

  const wsKey = workspaceId ?? activeWorkspaceId;

  const TABS = [
    { to: `/w/${wsKey}/projects/${projectId}`, label: 'Overview', icon: Rocket, end: true },
    { to: `/w/${wsKey}/projects/${projectId}/roadmap`, label: 'Roadmap', icon: Map, end: false },
    { to: `/w/${wsKey}/projects/${projectId}/timeline`, label: 'Timeline', icon: History, end: false },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 border-b border-surface-800/70 bg-surface-950/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 pt-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <ContextBreadcrumbs />
              <div className="mt-2 flex items-center gap-2.5 min-w-0">
                <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-surface-50 shadow-md">
                  <FolderKanban size={16} />
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-extrabold text-surface-50 truncate leading-tight">
                    {project?.name ?? 'Project'}
                  </h1>
                  {project && (
                    <p className="text-[11px] text-surface-400 font-semibold capitalize">
                      {project.key} · {project.status}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate(`/w/${wsKey}/projects`)}
              leftIcon={<ArrowLeft size={14} />}
              className="flex-shrink-0"
            >
              Projects
            </Button>
          </div>

          <nav className="flex gap-1 mt-4 -mb-px overflow-x-auto no-scrollbar" aria-label="Project sections">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-surface-50 border-brand-500'
                      : 'text-surface-400 hover:text-surface-100 border-transparent'
                  }`
                }
              >
                <tab.icon size={14} className={tab.end ? 'text-brand-400' : 'text-cyan-400'} />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
