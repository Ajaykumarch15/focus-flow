import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';
import { useCollaborationStore } from '../../store/useCollaborationStore';

// EEP2-P3.3.1 / DDS §8.2: the clickable context spine
// `Workspace › Project › Milestone › Phase › Module › Feature`. Labels come from
// the store (never guessed from the URL segment); each segment links back up the
// spine. Deep links survive — a missing entity renders its generic label only.
export function ContextBreadcrumbs() {
  const { workspaceId, projectId, milestoneId, phaseId, moduleId } = useParams<{
    workspaceId: string;
    projectId: string;
    milestoneId: string;
    phaseId: string;
    moduleId: string;
  }>();
  const { workspaces, projects, milestones, phases, modules, activeWorkspaceId } = useCollaborationStore();

  const crumbs = useMemo(() => {
    const wsKey = workspaceId ?? activeWorkspaceId;
    const projectUrl = projectId
      ? `/w/${wsKey}/projects/${projectId}`
      : `/w/${wsKey}/projects`;

    const ws = workspaces.find((w) => w.id === wsKey);
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    const milestone = milestoneId ? milestones.find((m) => m.id === milestoneId) : undefined;
    const phase = phaseId ? phases.find((p) => p.id === phaseId) : undefined;
    const module = moduleId ? modules.find((m) => m.id === moduleId) : undefined;

    const out: { label: string; to: string }[] = [];
    if (ws) out.push({ label: ws.name, to: `/w/${ws.id}` });
    if (project) out.push({ label: project.name, to: projectUrl });

    // Parent chain for phase/module pages: resolved from store refs so the spine
    // always reads Workspace › Project › Milestone › Phase › Module even when the
    // URL only carries the deepest id.
    if (module) {
      const parentPhase = module.phaseId ? phases.find((p) => p.id === module.phaseId) : undefined;
      const parentMilestone = parentPhase?.milestoneId
        ? milestones.find((m) => m.id === parentPhase.milestoneId)
        : undefined;
      if (parentMilestone) out.push({ label: parentMilestone.name, to: `${projectUrl}/roadmap/${parentMilestone.id}` });
      if (parentPhase) out.push({ label: parentPhase.name, to: `${projectUrl}/phases/${parentPhase.id}` });
      out.push({ label: module.name, to: `${projectUrl}/modules/${module.id}` });
    } else if (phase) {
      const parentMilestone = phase.milestoneId ? milestones.find((m) => m.id === phase.milestoneId) : undefined;
      if (parentMilestone) out.push({ label: parentMilestone.name, to: `${projectUrl}/roadmap/${parentMilestone.id}` });
      out.push({ label: phase.name, to: `${projectUrl}/phases/${phase.id}` });
    } else if (milestone) {
      out.push({ label: milestone.name, to: `${projectUrl}/roadmap/${milestone.id}` });
    }
    return out;
  }, [workspaceId, activeWorkspaceId, projectId, milestoneId, phaseId, moduleId, workspaces, projects, milestones, phases, modules]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Context breadcrumb" className="flex items-center gap-1 text-xs min-w-0">
      <Link to="/home" aria-label="Home" className="text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0">
        <Home size={13} />
      </Link>
      {crumbs.map((crumb, idx) => (
        <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1 min-w-0">
          <ChevronRight size={12} className="text-surface-600 flex-shrink-0" />
          <Link to={crumb.to} className="text-surface-400 hover:text-surface-200 transition-colors truncate max-w-[220px]">
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
