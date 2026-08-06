import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../ui/Button';

// EEP2-P5.4.1: persisted worklog panel for a task. The rows are NOT client mock
// data — they are served by GET /api/worklogs/by-task/:taskId and computed
// read-only from the task's real focus sessions (session-stop is the single
// writer). The header shows the rollup (totalActiveMs across the task's linked
// logs) so "Mock->persisted" stays honest on the board.

export interface WorklogPanelEntry {
  _id: string;
  date: string;
  what: string;
  activeMs: number;
}

export interface WorklogPanelLog {
  _id: string;
  title: string;
  totalActiveMs: number;
  workEntries: WorklogPanelEntry[];
}

function formatMs(ms: number): string {
  const totalMin = Math.round((ms || 0) / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function WorklogPanel({ taskId }: { taskId: string }) {
  const [logs, setLogs] = useState<WorklogPanelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const docs = await api.workLogs.byTask(taskId);
      setLogs((docs ?? []).map((d) => ({
        _id: d._id ?? '',
        title: d.title ?? '',
        totalActiveMs: Number(d.totalActiveMs ?? 0),
        workEntries: Array.isArray(d.workEntries) ? d.workEntries : [],
      })));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const entries = logs.flatMap((l) => l.workEntries);
  const total = logs.reduce((sum, l) => sum + (l.totalActiveMs || 0), 0);

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-850/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 bg-surface-850/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-surface-200">
          <Clock size={14} className="text-brand-400" />
          Worklog
          {total > 0 && <span className="text-xs font-bold text-emerald-400">{formatMs(total)}</span>}
        </div>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh worklog"
          title="Refresh"
          className="text-surface-500 hover:text-brand-400 transition-colors p-1">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto" data-testid="worklog-list">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-surface-500">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : error && entries.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-surface-400 mb-2">Couldn't load the worklog.</p>
            <Button variant="ghost" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-surface-500">
            No time logged yet. Start the timer on this task to persist worklog rows.
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry._id}
              className="flex items-start justify-between gap-3 rounded-lg border border-surface-800 bg-surface-900/40 px-3 py-2">
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-semibold text-surface-300">
                  {new Date(entry.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                {entry.what && <p className="text-[11px] text-surface-400 truncate">{entry.what}</p>}
              </div>
              <span className="text-[11px] font-bold text-emerald-400 shrink-0">{formatMs(entry.activeMs)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
