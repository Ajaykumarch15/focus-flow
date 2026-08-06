import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderOpen, GitBranch, Plus } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { CreateProjectModal } from '../../components/collaboration/CreateProjectModal';
import { Button } from '../../components/ui/Button';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';

// Persisted project status → badge tone/label (EEP P2 frontend work: cards
// surface the saved status, not just key/name).
const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'info',
  active: 'success',
  completed: 'success',
  on_hold: 'warning',
};

// ECIS B.8 (IA 8.1, L3): the managed Projects list answers "What is the
// workspace structure?" and is reached from the Administration sidebar — never
// on the daily Planning nav. It was split out of the TeamWorkspace mega-tab so
// each surface is a deep-linkable, focused page (S4-T3).
export function WorkspaceProjectsPage() {
  const { projects, activeWorkspaceId } = useCollaborationStore();
  const [showCreateProject, setShowCreateProject] = useState(false);

  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId],
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title="Projects & Milestones"
        description="Managed initiatives across this workspace — deep-link only from Administration."
        icon={<FolderOpen size={18} className="text-cyan-400" />}
        actions={
          <Button onClick={() => setShowCreateProject(true)} size="sm" leftIcon={<Plus size={14} />}>
            New Project
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {wsProjects.map((proj) => (
          <div key={proj.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4 flex flex-col">
            <div className="flex items-start justify-between">
                <Link
                  to={`/w/${activeWorkspaceId}/projects/${proj.id}`}
                  className="group block"
                  aria-label={`Open overview for ${proj.name}`}
                >
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                      {proj.key}
                    </Badge>
                    <Badge tone={STATUS_TONE[proj.status] ?? 'neutral'} className="text-[10px] font-bold uppercase tracking-wider">
                      {proj.status}
                    </Badge>
                  </span>
                  <h3 className="text-lg font-display font-extrabold text-surface-50 mt-1 group-hover:text-brand-300 transition-colors">{proj.name}</h3>
                </Link>
              {proj.repositoryUrl && (
                <a href={proj.repositoryUrl} target="_blank" rel="noreferrer"
                  className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 flex items-center gap-1.5 text-xs font-semibold">
                  <GitBranch size={14} /> Repository
                </a>
              )}
            </div>

            <p className="text-xs text-surface-400 leading-relaxed">{proj.description}</p>

            {/* Milestones */}
            <div className="space-y-2 pt-2 border-t border-surface-800">
              <p className="text-xs font-bold text-surface-300">Active Milestones</p>
              {proj.milestones.map((ms) => (
                <div key={ms.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-surface-100">{ms.title}</p>
                    <p className="text-[10px] text-surface-500">Due: {ms.dueDate}</p>
                  </div>
                  <Badge tone="success" className="text-[10px] font-bold uppercase border border-emerald-500/20">
                    {ms.targetPoints} pts
                  </Badge>
                </div>
              ))}
              {proj.milestones.length === 0 && (
                <p className="text-xs text-surface-500 italic">No milestones set.</p>
              )}
            </div>

            <Link
              to={`/w/${activeWorkspaceId}/projects/${proj.id}`}
              className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors"
            >
              Open Project Overview <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>

      {wsProjects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center">
          <FolderOpen size={28} className="mx-auto text-cyan-400/60 mb-3" />
          <p className="text-xs font-bold text-surface-300 mb-1">No projects yet</p>
          <p className="text-xs text-surface-500 italic mb-4">Kick off the first initiative for this workspace.</p>
          <Button onClick={() => setShowCreateProject(true)} size="sm" leftIcon={<Plus size={14} />}>
            New Project
          </Button>
        </div>
      )}

      <CreateProjectModal isOpen={showCreateProject} onClose={() => setShowCreateProject(false)} />
    </div>
  );
}
