import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Layers, Briefcase, User, BookOpen, Heart, DollarSign, Palette, Users, HelpCircle, ArrowRight, AlertTriangle, Filter, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parallelTimerEngine, type TimerStateSnapshot } from '@worklog/services/parallelTimerEngine';
import { timerEngine } from '@worklog/services/timerEngine';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { stopTaskTimer } from '@worklog/services/activeTimerRouter';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoActiveTimers } from '@shared/components/illustrations';
import { SkeletonCard } from '@shared/components/ui/Skeleton';
import { KpiCounter } from '@shared/components/ui/KpiCounter';
import { ActiveTimerCard } from '@timers/components/ActiveTimerCard';
import { formatMs } from '@shared/utils/time';
import { toast } from '@shared/services/useToastStore';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Work: <Briefcase size={14} />,
  Personal: <User size={14} />,
  Learning: <BookOpen size={14} />,
  Health: <Heart size={14} />,
  Finance: <DollarSign size={14} />,
  Creative: <Palette size={14} />,
  Social: <Users size={14} />,
  Other: <HelpCircle size={14} />,
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.05 } },
};

export function ActiveTimersPage() {
  const [allTimers, setAllTimers] = useState<Map<string, TimerStateSnapshot>>(
    () => parallelTimerEngine.getAllSnapshots()
  );
  const [legacySnapshot, setLegacySnapshot] = useState(() => timerEngine.getSnapshot());
  const [hydrated, setHydrated] = useState(false);
  const [elapsedFilter, setElapsedFilter] = useState<'all' | 'above10min'>('above10min');
  const [stateFilter, setStateFilter] = useState<'all' | 'running' | 'paused'>('all');

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const unsubParallel = parallelTimerEngine.subscribe((_, __, allSnapshots) => {
      setAllTimers(new Map(allSnapshots));
    });
    const unsubLegacy = timerEngine.subscribe((snapshot) => {
      setLegacySnapshot(snapshot);
    });
    return () => {
      unsubParallel();
      unsubLegacy();
    };
  }, []);

  const activeTimers = useMemo(() => {
    const now = Date.now();
    const TEN_MIN_MS = 10 * 60 * 1000;

    const computeElapsed = (s: TimerStateSnapshot): number => {
      const elapsed = s.timerState === 'running'
        ? now - s.sessionStartTime - s.totalPauseDuration
        : s.timerState === 'paused'
          ? (s.pauseStart ?? now) - s.sessionStartTime - s.totalPauseDuration
          : 0;
      return elapsed + s.baseElapsedMs;
    };

    const parallel = Array.from(allTimers.entries()).filter(([_, s]) => s.timerState !== 'idle');
    // Include legacy single timer if active and not already in parallel map
    if (legacySnapshot.taskId && legacySnapshot.timerState !== 'idle' && !allTimers.has(legacySnapshot.taskId)) {
      parallel.push([legacySnapshot.taskId, {
        taskId: legacySnapshot.taskId,
        sessionId: legacySnapshot.sessionId,
        timerState: legacySnapshot.timerState,
        sessionStartTime: legacySnapshot.sessionStartTime,
        totalPauseDuration: legacySnapshot.totalPauseDuration,
        pauseStart: legacySnapshot.pauseStart,
        baseElapsedMs: legacySnapshot.baseElapsedMs,
        sessionKind: legacySnapshot.sessionKind,
        lastUpdated: legacySnapshot.lastUpdated,
      }]);
    }

    // Apply filters
    return parallel.filter(([_, s]) => {
      if (elapsedFilter === 'above10min' && computeElapsed(s) < TEN_MIN_MS) return false;
      if (stateFilter === 'running' && s.timerState !== 'running') return false;
      if (stateFilter === 'paused' && s.timerState !== 'paused') return false;
      return true;
    });
  }, [allTimers, legacySnapshot, elapsedFilter, stateFilter]);

  const totalCount = activeTimers.length;

  // Total count before filtering (for KPI display)
  const unfilteredCount = useMemo(() => {
    const parallel = Array.from(allTimers.entries()).filter(([_, s]) => s.timerState !== 'idle');
    if (legacySnapshot.taskId && legacySnapshot.timerState !== 'idle' && !allTimers.has(legacySnapshot.taskId)) {
      parallel.push([legacySnapshot.taskId, legacySnapshot as unknown as TimerStateSnapshot]);
    }
    return parallel.length;
  }, [allTimers, legacySnapshot]);

  const totalElapsedMs = useMemo(() => {
    return activeTimers.reduce((sum, [_, s]) => {
      const now = Date.now();
      const elapsed =
        s.timerState === 'running'
          ? now - s.sessionStartTime - s.totalPauseDuration
          : s.timerState === 'paused'
            ? (s.pauseStart ?? now) - s.sessionStartTime - s.totalPauseDuration
            : 0;
      return sum + elapsed + s.baseElapsedMs;
    }, 0);
  }, [activeTimers]);

  const workTasks = useStore((s) => s.tasks);
  const personalTasks = usePersonalTaskStore((s) => s.tasks);
  const workGhostIds = useStore((s) => s.ghostSessionTaskIds);
  const personalGhostIds = usePersonalTaskStore((s) => s.ghostSessionTaskIds);
  const clearWorkGhost = useStore((s) => s.clearGhostSession);
  const clearPersonalGhost = usePersonalTaskStore((s) => s.clearGhostSession);

  const allGhostIds = useMemo(() => [...workGhostIds, ...personalGhostIds], [workGhostIds, personalGhostIds]);

  const fixAllGhostSessions = useCallback(async () => {
    const ids = [...allGhostIds];
    let fixed = 0;
    for (const id of ids) {
      try {
        await stopTaskTimer(id);
        clearWorkGhost(id);
        clearPersonalGhost(id);
        fixed++;
      } catch {
        // continue with next
      }
    }
    if (fixed > 0) {
      toast.success('Ghost sessions cleaned up', `${fixed} stale timer${fixed > 1 ? 's' : ''} stopped.`);
    } else {
      toast.error('Cleanup failed', 'Could not stop ghost sessions. They will be cleaned up by the server reaper.');
    }
  }, [allGhostIds, clearWorkGhost, clearPersonalGhost]);

  const groupedTimers = useMemo(() => {
    const groups: Record<string, { taskId: string; snapshot: TimerStateSnapshot }[]> = {};

    for (const [taskId, snapshot] of activeTimers) {
      const tasks = snapshot.sessionKind === 'personal' ? personalTasks : workTasks;
      const task = tasks.find((t) => t.id === taskId);
      const category = task?.category || 'Uncategorized';

      if (!groups[category]) groups[category] = [];
      groups[category].push({ taskId, snapshot });
    }

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [activeTimers, workTasks, personalTasks]);

  if (!hydrated) {
    return (
      <div className="relative p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        <PageHeader
          title="Active Timers"
          description="Monitor and control all your running focus sessions"
          icon={<Timer size={20} className="text-brand-500" />}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonCard headerWidth="60%" lines={0} />
          <SkeletonCard headerWidth="60%" lines={0} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SkeletonCard headerWidth="40%" lines={2} />
          <SkeletonCard headerWidth="40%" lines={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
      <PageHeader
        title="Active Timers"
        description="Monitor and control all your running focus sessions"
        icon={<Timer size={20} className="text-brand-500" />}
        actions={
          totalCount > 0 ? (
            <Badge tone="brand" icon={<Layers size={12} />}>
              {totalCount} active
            </Badge>
          ) : undefined
        }
      />

      {/* Ghost Session Cleanup Banner */}
      {allGhostIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-warning-500/30 bg-warning-500/10 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-warning-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-warning-300 text-sm">
                {allGhostIds.length} Ghost Session{allGhostIds.length > 1 ? 's' : ''} Detected
              </h3>
              <p className="text-xs text-surface-400 mt-0.5">
                Tasks with active timers that aren't showing in the list. This can happen after a browser crash.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={fixAllGhostSessions}
                className="text-warning-300 hover:text-warning-200"
              >
                Fix All
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-surface-800 bg-surface-900 p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Timer size={16} className="text-brand-400" />
            </div>
          </div>
          <p className="font-display text-2xl font-extrabold text-surface-50">
            <KpiCounter value={unfilteredCount} />
          </p>
          <p className="text-xs text-surface-400 mt-1">Active Timers</p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-surface-800 bg-surface-900 p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-success-500/10 border border-success-500/20 flex items-center justify-center">
              <Layers size={16} className="text-success-400" />
            </div>
          </div>
          <p className="font-display text-2xl font-extrabold text-surface-50 font-mono tabular-nums">
            {formatMs(totalElapsedMs)}
          </p>
          <p className="text-xs text-surface-400 mt-1">Total Tracked Time</p>
        </motion.div>
      </motion.div>

      {/* Filter Bar */}
      {unfilteredCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <div className="flex items-center gap-1.5 text-xs text-surface-400">
            <Filter size={13} />
            <span>Filter:</span>
          </div>
          <div className="flex items-center gap-1 bg-surface-900 border border-surface-800 rounded-xl p-1">
            <button
              onClick={() => setElapsedFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                elapsedFilter === 'all'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              All Timers
            </button>
            <button
              onClick={() => setElapsedFilter('above10min')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                elapsedFilter === 'above10min'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {'>'} 10 min
              </span>
            </button>
          </div>

          <div className="w-px h-5 bg-surface-700" />

          <div className="flex items-center gap-1 bg-surface-900 border border-surface-800 rounded-xl p-1">
            <button
              onClick={() => setStateFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                stateFilter === 'all'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              All States
            </button>
            <button
              onClick={() => setStateFilter('running')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                stateFilter === 'running'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              Running
            </button>
            <button
              onClick={() => setStateFilter('paused')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                stateFilter === 'paused'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              Paused
            </button>
          </div>

          {totalCount < unfilteredCount && (
            <span className="text-xs text-surface-500">
              Showing {totalCount} of {unfilteredCount} timers
            </span>
          )}
        </motion.div>
      )}

      {totalCount === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="rounded-2xl border border-surface-800 bg-surface-900">
            <EmptyState
              illustration={<NoActiveTimers />}
              title="No active timers"
              description="Start tracking a task to see it here. You can run multiple timers in parallel."
              action={
                <Link to="/worklog/tasks">
                  <Button leftIcon={<ArrowRight size={15} />} size="sm">
                    Go to Tasks
                  </Button>
                </Link>
              }
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {groupedTimers.map(([category, timers]) => (
            <motion.section key={category} variants={fadeUp}>
              <h2 className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg mb-4">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-brand-400">
                  {CATEGORY_ICONS[category] || <Layers size={14} />}
                </span>
                {category}
                <Badge tone="neutral">{timers.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {timers.map(({ taskId, snapshot }) => (
                    <ActiveTimerCard
                      key={taskId}
                      taskId={taskId}
                      snapshot={snapshot}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          ))}
        </motion.div>
      )}
    </div>
  );
}
