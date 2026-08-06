import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, X, LayoutList, BookMarked } from 'lucide-react';
import type { WorkLog } from '../../store/useWorkLogStore';
import { WorkLogDetailPanel } from './WorkLogDetailPanel';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

// ── WorkLogMasterDetail (S3-T1) ───────────────────────────────────────────────
// The merged single-surface Work Log view (IA §8.7-4, §8.8; ECIS §B.4): a
// compact master rail of every work log on top, with the selected log's full
// detail panel below. The standalone WorkLogDetail page is retired — list and
// item now live on one surface. Switching logs never leaves the page.

export function WorkLogMasterDetail({ logs, selectedId, onSelect, onBack }: {
  logs: WorkLog[];
  selectedId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const [railQuery, setRailQuery] = useState('');

  const selected = logs.find(l => l._id === selectedId) ?? null;

  const railLogs = useMemo(() => {
    if (!railQuery.trim()) return logs;
    const q = railQuery.toLowerCase();
    return logs.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.gitBranch?.toLowerCase().includes(q) ||
      l.taskRef?.title?.toLowerCase().includes(q)
    );
  }, [logs, railQuery]);

  if (!selected) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">
          <ArrowLeft size={16} /> Back to Work Logs
        </motion.button>
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 overflow-hidden">
          <EmptyState
            icon={<BookMarked size={40} className="text-surface-600" />}
            title="Work log not found"
            description="This work log may have been deleted."
            action={<Button variant="secondary" onClick={onBack} leftIcon={<ArrowLeft size={14} />}>Back to Work Logs</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Master rail — all work logs in one surface */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
            <LayoutList size={13} className="text-brand-400" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">All Work Logs</span>
          <span className="text-[10px] text-surface-500 font-medium">{logs.length} total</span>
          <div className="relative ml-auto w-48">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input className="h-7 pl-7 pr-7 text-xs rounded-lg"
              placeholder="Filter logs…" value={railQuery} onChange={e => setRailQuery(e.target.value)} aria-label="Filter work logs" />
            {railQuery && (
              <button onClick={() => setRailQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200 transition-colors" aria-label="Clear filter">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {railLogs.length === 0 ? (
          <p className="text-xs text-surface-500 py-2 text-center">No logs match "{railQuery}".</p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {railLogs.map(log => {
              const isSelected = log._id === selectedId;
              return (
                <button key={log._id} onClick={() => onSelect(log._id)}
                  aria-current={isSelected ? 'page' : undefined}
                  title={log.title}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 border ${
                    isSelected
                      ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                      : 'bg-surface-850 text-surface-400 border-surface-800 hover:text-surface-200 hover:border-surface-700'
                  }`}>
                  <span>{log.isActive ? '⚡' : '✅'}</span>
                  <span className="max-w-[160px] truncate">{log.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Detail panel */}
      <WorkLogDetailPanel workLog={selected} onBack={onBack} />
    </div>
  );
}
