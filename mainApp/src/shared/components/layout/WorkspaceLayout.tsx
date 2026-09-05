import { useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useStore } from '@worklog/services/useStore';
import { ToastContainer } from '@shared/components/ui/ToastContainer';
import { WorkspaceTopNav } from './WorkspaceTopNav';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceNav } from './WorkspaceNav';

// Engineering Workspace shell: the workspace owns the whole screen. Top
// navigation → workspace header → workspace sections → routed content. No
// personal sidebar, no nested personal shell — full browser width.
export function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    workspaces, workspacesLoading, activeWorkspaceId, setActiveWorkspace, loadCollabData,
  } = useCollaborationStore();
  const { setMobileSidebarOpen } = useStore();
  const location = useLocation();

  const activeWs = workspaces.find((w) => w.id === (workspaceId || activeWorkspaceId)) || workspaces[0];

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) setActiveWorkspace(workspaceId);
    loadCollabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  if (!activeWs) {
    return (
      <div className="flex h-screen bg-surface-950 text-surface-50 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-surface-400">
          <div className="w-8 h-8 border-2 border-surface-700 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold">
            {workspacesLoading ? 'Loading workspace…' : 'No workspaces yet'}
          </p>
        </div>
      </div>
    );
  }

  const wsKey = workspaceId || activeWorkspaceId;
  // The workspace root (launcher) stays clean — identity header and section
  // tabs are shown on sub-pages only.
  const isWorkspaceRoot = location.pathname === `/w/${wsKey}`;

  return (
    <div className="flex flex-col h-screen bg-surface-950 text-surface-50 overflow-hidden">
      <WorkspaceTopNav />
      {!isWorkspaceRoot && <WorkspaceHeader />}
      {!isWorkspaceRoot && <WorkspaceNav />}

      <main className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
