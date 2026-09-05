import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useStore } from '@worklog/services/useStore';
import { toast } from '@shared/services/useToastStore';
import { KnowledgePanel } from '@worklog/components/KnowledgePanel';

// ── KnowledgePage (S3-T2 · L1 personal) ───────────────────────────────────────
// Personal Knowledge surface (ECIS §B.5 · IA §8.9-5, §8.10-4): "What do we
// already know?" across every layer — team knowledge docs + personal work-log
// decisions/lessons/links + journal context. Work logs are loaded here (the
// source of decisions/lessons/links); docs and journals come straight from
// their existing stores. The panel stays presentational; this page owns data
// loading, the retry flow, and the "open in work log" navigation.

export function KnowledgePage() {
  const navigate = useNavigate();
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

  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);

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
        docs={docs}
        workLogs={workLogs}
        journals={journals}
        loading={loading || retrying}
        error={error}
        onRetry={handleRetry}
        onOpenWorkLog={(logId) => navigate(`/worklog/logs/${logId}`)}
      />
    </div>
  );
}
