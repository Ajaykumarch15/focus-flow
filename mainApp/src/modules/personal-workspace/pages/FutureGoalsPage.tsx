import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Search, X, Star, Zap, Globe, BookOpen, Heart, Briefcase, Palette, DollarSign, Activity, Sparkles } from 'lucide-react';
import { useFutureGoalStore } from '@personal/services/useFutureGoalStore';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { FutureGoalQuickAdd } from '@personal/components/futureGoals/FutureGoalQuickAdd';
import { FutureGoalCard } from '@personal/components/futureGoals/FutureGoalCard';
import { FutureGoalReview } from '@personal/components/futureGoals/FutureGoalReview';
import { FUTURE_GOAL_CATEGORY_LABELS, FUTURE_GOAL_STATUS_LABELS, type FutureGoalCategory, type FutureGoalStatus } from '@personal/types/futureGoal';

const CATEGORY_ICONS: Record<string, any> = {
  career: Briefcase,
  projects: Target,
  learning: BookOpen,
  travel: Globe,
  personal: Heart,
  health: Activity,
  finance: DollarSign,
  creative: Palette,
  other: Sparkles,
};

function SkeletonCard() {
  return (
    <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-surface-800 animate-pulse" />
        <div className="h-4 w-32 bg-surface-800 rounded animate-pulse" />
      </div>
      <div className="h-3 w-20 bg-surface-800 rounded animate-pulse" />
      <div className="h-1.5 w-full bg-surface-800 rounded-full animate-pulse" />
    </div>
  );
}

export function FutureGoalsPage() {
  const { goals, loading, error, loadGoals } = useFutureGoalStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => { loadGoals(); }, [loadGoals]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadGoals();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadGoals]);

  const filteredGoals = useMemo(() => {
    let result = [...goals];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.title.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter(g => g.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter(g => g.category === categoryFilter);
    return result;
  }, [goals, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = goals.length;
    const someday = goals.filter(g => g.status === 'someday').length;
    const considering = goals.filter(g => g.status === 'considering').length;
    const active = goals.filter(g => g.status === 'active').length;
    const completed = goals.filter(g => g.status === 'completed').length;
    return { total, someday, considering, active, completed };
  }, [goals]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 sm:space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl min-h-[200px] sm:min-h-[240px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-transparent" />
        <div className="absolute inset-0 bg-surface-900/80" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 min-h-[200px] sm:min-h-[240px]">
          <div className="flex-1 max-w-md">
            <p className="text-xs font-semibold tracking-widest text-violet-400 uppercase mb-2">Future Goals</p>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-surface-50 leading-tight">
              Capture What<br />You Want to Become
            </h1>
            <p className="text-sm text-surface-400 mt-2 leading-relaxed">
              A place for your someday dreams. No pressure, no deadlines — just things you don't want to forget.
            </p>
            <div className="mt-4 p-3 rounded-xl bg-surface-900/60 backdrop-blur-sm border border-surface-800 max-w-sm">
              <p className="text-xs text-surface-300 italic leading-relaxed">
                "The future belongs to those who believe in the beauty of their dreams."
              </p>
              <p className="text-[10px] text-surface-500 mt-1">— Eleanor Roosevelt</p>
            </div>
          </div>

          <div className="hidden sm:block flex-shrink-0 w-40 h-40">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
              <Target size={56} className="text-violet-400/60" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Add */}
      <FutureGoalQuickAdd />

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="p-8 text-center">
          <Target className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-surface-300 font-medium mb-1">Failed to load goals</p>
          <p className="text-surface-500 text-sm mb-4">{error}</p>
          <Button variant="secondary" onClick={loadGoals}>Retry</Button>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && goals.length === 0 && (
        <EmptyState
          icon={<Target size={40} className="text-violet-400" />}
          title="No future goals yet"
          description="Start capturing things you want to do, learn, or become someday. No pressure — just jot them down."
        />
      )}

      {/* Search + Filters */}
      {!loading && !error && goals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search goals..."
              className="pl-9 h-9 text-xs"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                <X size={12} />
              </button>
            )}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-300 outline-none focus:border-violet-500/50">
            <option value="all">All Status</option>
            {Object.entries(FUTURE_GOAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-300 outline-none focus:border-violet-500/50">
            <option value="all">All Categories</option>
            {Object.entries(FUTURE_GOAL_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </motion.div>
      )}

      {/* KPI Cards */}
      {!loading && !error && goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Goals', value: stats.total, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
            { label: 'Someday', value: stats.someday, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'Considering', value: stats.considering, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { label: 'Active', value: stats.active, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.border} border flex items-center justify-center ${kpi.color}`}>
                <Target size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-50">{kpi.value}</p>
                <p className="text-[11px] text-surface-400">{kpi.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Forgotten Ideas Review */}
      {!loading && !error && <FutureGoalReview />}

      {/* Goal Grid */}
      {!loading && !error && filteredGoals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredGoals.map((goal) => (
              <FutureGoalCard key={goal._id} goal={goal} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Filtered empty state */}
      {!loading && !error && goals.length > 0 && filteredGoals.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-3 text-surface-600" size={28} />
          <p className="text-sm text-surface-300 font-medium mb-1">No goals match your filters</p>
          <p className="text-xs text-surface-500 mb-3">Try adjusting your search or filter criteria.</p>
          <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); }}>
            Clear Filters
          </Button>
        </Card>
      )}
    </div>
  );
}
