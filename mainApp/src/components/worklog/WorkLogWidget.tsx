import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookMarked, GitBranch, CheckCircle2, ArrowRight, Plus, Zap } from 'lucide-react';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { STATUS_OPTIONS } from './statusConfig';

export function WorkLogWidget() {
  const { todayLog, loading, loadToday } = useWorkLogStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!todayLog) loadToday();
  }, []);

  const log      = todayLog;
  const status   = STATUS_OPTIONS.find(s => s.value === log?.status) || STATUS_OPTIONS[1];
  const doneCount = log?.completedItems?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="card p-4 cursor-pointer hover:border-surface-600 transition-all group"
      onClick={() => navigate('/worklog')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center">
            <BookMarked size={14} className="text-brand-400" />
          </div>
          <span className="text-sm font-medium text-surface-50">Today's Work Log</span>
        </div>
        <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>

      {loading && !log ? (
        <div className="h-16 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : log ? (
        <div className="space-y-2.5">
          {/* Status + mood */}
          <div className="flex items-center gap-2">
            <span className={`badge text-xs ${status.bg} ${status.color}`}>{status.label}</span>
            {log.gitBranch && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono truncate max-w-[140px]">
                <GitBranch size={10} />{log.gitBranch}
              </span>
            )}
          </div>

          {/* Current work summary */}
          {log.currentWork ? (
            <p className="text-xs text-surface-300 line-clamp-2">{log.currentWork}</p>
          ) : log.problem ? (
            <p className="text-xs text-surface-300 line-clamp-2">{log.problem}</p>
          ) : (
            <p className="text-xs text-surface-500 italic">Click to fill in today's log…</p>
          )}

          {/* Completed count */}
          {doneCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={12} />
              {doneCount} thing{doneCount !== 1 ? 's' : ''} completed today
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-surface-400">
          <Plus size={14} className="text-brand-400" />
          Start today's work log
        </div>
      )}
    </motion.div>
  );
}
