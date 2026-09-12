import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Layers, Briefcase, User, BookOpen, Heart, DollarSign, Palette, Users, HelpCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parallelTimerEngine, type TimerStateSnapshot } from '@worklog/services/parallelTimerEngine';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { SkeletonCard } from '@shared/components/ui/Skeleton';
import { KpiCounter } from '@shared/components/ui/KpiCounter';
import { ActiveTimerCard } from '@timers/components/ActiveTimerCard';
import { formatMs } from '@shared/utils/time';

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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const unsubscribe = parallelTimerEngine.subscribe((_, __, allSnapshots) => {
      setAllTimers(new Map(allSnapshots));
    });
    return unsubscribe;
  }, []);

  const activeTimers = useMemo(
    () => Array.from(allTimers.entries()).filter(([_, s]) => s.timerState !== 'idle'),
    [allTimers]
  );

  const totalCount = activeTimers.length;

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
            <KpiCounter value={totalCount} />
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

      {totalCount === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="rounded-2xl border border-surface-800 bg-surface-900">
            <EmptyState
              icon={<Timer size={28} className="text-surface-400" />}
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
