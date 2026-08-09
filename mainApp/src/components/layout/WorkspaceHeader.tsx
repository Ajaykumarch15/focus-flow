import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, Layers, Pencil, Plus, UserCheck, Users } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { CreateProjectModal } from '../collaboration/CreateProjectModal';
import { WorkspaceEditModal } from '../collaboration/WorkspaceEditModal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// Persistent workspace identity banner under the top navigation. Rendered on
// every workspace page so the Engineering Workspace reads as its own
// application shell (icon, name, description, badges, quick actions).
export function WorkspaceHeader() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { workspaces, projects, activeWorkspaceId } = useCollaborationStore();

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const wsId = workspaceId || activeWorkspaceId;
  const activeWs = workspaces.find((w) => w.id === wsId) || workspaces[0];
  const wsProjects = projects.filter((p) => p.workspaceId === wsId);
  const activeCount = wsProjects.filter((p) => p.status === 'active').length;

  if (!activeWs) return null;

  return (
    <div className="flex-shrink-0 border-b border-surface-800 bg-surface-900/40">
      <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span
            className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-2xl lg:text-3xl shadow-lg shadow-brand-500/20 shrink-0"
            aria-hidden="true"
          >
            {activeWs.icon}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-display font-extrabold text-surface-50 truncate">
              {activeWs.name}
            </h1>
            <p className="text-sm text-surface-400 truncate max-w-2xl">{activeWs.description}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge tone="neutral" icon={<Users size={12} />}>
                {activeWs.membersCount} members
              </Badge>
              <Badge tone="brand" icon={<FolderOpen size={12} />}>
                {wsProjects.length} projects
              </Badge>
              <Badge tone="success" icon={<Layers size={12} />}>
                {activeCount} active
              </Badge>
              <Badge tone="info" className="capitalize border border-cyan-500/20">
                {activeWs.type}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)} leftIcon={<Pencil size={13} />}>
            <span className="hidden sm:inline">Edit Workspace</span>
            <span className="sm:hidden">Edit</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/w/${wsId}/members`)} leftIcon={<UserCheck size={13} />}>
            <span className="hidden sm:inline">Invite Member</span>
            <span className="sm:hidden">Invite</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreateProject(true)} leftIcon={<Plus size={13} />}>
            <span className="hidden sm:inline">Create Project</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      <CreateProjectModal isOpen={showCreateProject} onClose={() => setShowCreateProject(false)} />
      <WorkspaceEditModal isOpen={showEdit} onClose={() => setShowEdit(false)} workspace={activeWs} />
    </div>
  );
}
