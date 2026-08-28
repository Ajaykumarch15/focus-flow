import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { useStore } from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { KnowledgePanel } from '../../components/knowledge/KnowledgePanel';

// ── TeamKnowledgePage (S3-T2 · L2 workspace) ──────────────────────────────────
// Workspace-scoped Knowledge surface (ECIS §B.5 · IA §8.10-4). The workspace
// Knowledge Base (sidebar entry → /w/:id/knowledge) now renders this real
// surface instead of the TeamWorkspace mega-tab: docs are scoped to the active
// workspace, while decisions/lessons/links/journals stay cross-layer personal
// knowledge. Reuses the same KnowledgePanel as the personal L1 page.

export function TeamKnowledgePage() {
  const navigate = useNavigate();
  const workspaces = useCollaborationStore((s) => s.workspaces);
  const activeWorkspaceId = useCollaborationStore((s) => s.activeWorkspaceId);
  const docs = useCollaborationStore((s) => s.docs);
  const activeLogs = useWorkLogStore((s) => s.activeLogs);
  const closedLogs = useWorkLogStore((s) => s.closedLogs);
  const loading = useWorkLogStore((s) => s.loading);
  const error = useWorkLogStore((s) => s.error);
  const loadAll = useWorkLogStore((s) => s.loadAll);
  const journals = useStore((s) => s.journals);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);
  const wsDocs = useMemo(
    () => (activeWs ? docs.filter((d) => d.workspaceId === activeWs.id) : []),
    [docs, activeWs?.id],
  );

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await loadAll();
      if (!useWorkLogStore.getState().error) {
        toast.success('Knowledge loaded', 'Docs, decisions, lessons, and links are up to date.');
      }
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">
      <KnowledgePanel
        docs={wsDocs}
        workLogs={workLogs}
        journals={journals}
        loading={loading || retrying}
        error={error}
        onRetry={handleRetry}
        onOpenWorkLog={(logId) => navigate(`/worklog/logs/${logId}`)}
        title={activeWs ? `${activeWs.name} Knowledge` : 'Knowledge'}
        description="What does this workspace already know?"
      />
    </div>
  );
}
