import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, CheckCircle, AlertTriangle, Circle,
  Target, Flame, Zap, X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Priority, TaskStatus } from '../types';
import { CATEGORIES } from '../utils/colors';
import { isOverdue } from '../utils/time';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function Tasks() {
  const { tasks, profile } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'deadline' | 'priority'>('default');

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filtered = useMemo(() => tasks.filter(task => {
    if (!showCompleted && task.status === 'completed') return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (showOverdueOnly && !isOverdue(task.deadline)) return false;
    return true;
  }), [tasks, showCompleted, search, filterStatus, filterPriority, filterCategory, showOverdueOnly]);

  const active = filtered.filter(t => t.status !== 'completed');
  const completed = filtered.filter(t => t.status === 'completed');

  const sortedActive = useMemo(() => [...active].sort((a, b) => {
    if (sortBy === 'deadline') {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline - b.deadline;
    }
    if (sortBy === 'priority') {
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    }
    return 0;
  }), [active, sortBy]);

  const overdueCount = tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length;
  const totalCompleted = tasks.filter(t => t.status === 'completed').length;
  const totalActive = tasks.filter(t => t.status !== 'completed').length;
  const hasFilters = search || filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all' || showOverdueOnly;

  const clearFilters = () => {
    setSearch(''); setFilterStatus('all'); setFilterPriority('all');
    setFilterCategory('all'); setShowOverdueOnly(false); setSortBy('default');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* ═══ Hero Header ═══ */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="relative rounded-2xl border border-surface-800/60 bg-surface-900 p-6 lg:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[200px] opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, var(--color-brand-500), transparent 70%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader title="Tasks" description={`${totalActive} active · ${totalCompleted} completed${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
            actions={
              <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                New Task
              </Button>
            } />
        </div>

        {/* Quick stats */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          {[
            { icon: Target, label: 'Active Tasks', value: String(totalActive), color: 'text-brand-400', bg: 'bg-brand-500/10' },
            { icon: Flame, label: 'Streak', value: `${profile.streak?.current || 0}d`, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { icon: Zap, label: 'Points', value: (profile.totalPoints || 0).toLocaleString(), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <motion.div key={label} variants={fadeUp}>
              <Card className="flex items-center gap-3 p-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={14} className={color} />
                </div>
                <div>
                  <p className="text-sm font-bold text-surface-100">{value}</p>
                  <p className="text-[10px] text-surface-400 font-medium">{label}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* ═══ Overdue Warning ═══ */}
      <AnimatePresence>
        {overdueCount > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-danger-500/20 bg-danger-500/5">
            <div className="w-9 h-9 rounded-xl bg-danger-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-danger-500" />
            </div>
            <p className="text-sm text-danger-400 font-semibold">
              {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Command Toolbar ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-4 lg:p-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input className="h-11 pl-10 pr-4"
              placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter chips row */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {/* Status */}
            {(['all', 'todo', 'active', 'paused'] as const).map(s => (
              <FilterChip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </FilterChip>
            ))}

            <div className="w-px h-5 bg-surface-800 mx-1" />

            {/* Priority */}
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map(p => (
              <FilterChip key={p} active={filterPriority === p} onClick={() => setFilterPriority(p)}>
                {p === 'all' ? 'Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
              </FilterChip>
            ))}

            <div className="w-px h-5 bg-surface-800 mx-1" />

            {/* Category */}
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-850 text-surface-400 border border-surface-800 hover:text-surface-200 hover:border-surface-700 transition-all cursor-pointer outline-none">
              <option value="all">Category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div className="w-px h-5 bg-surface-800 mx-1" />

            {/* Overdue */}
            <FilterChip active={showOverdueOnly} activeClass="bg-danger-500/15 text-danger-400 border-danger-500/30"
              onClick={() => setShowOverdueOnly(!showOverdueOnly)}>
              <AlertTriangle size={12} />
              Overdue {overdueCount > 0 && `(${overdueCount})`}
            </FilterChip>

            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-850 text-surface-400 border border-surface-800 hover:text-surface-200 hover:border-surface-700 transition-all cursor-pointer outline-none">
              <option value="default">Default Order</option>
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
            </select>

            {/* Clear */}
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger-400 hover:bg-danger-500/10 border border-danger-500/20 transition-all flex items-center gap-1">
                <X size={11} /> Clear
              </button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* ═══ Task List ═══ */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedActive.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </AnimatePresence>

        {active.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 overflow-hidden">
            <EmptyState
              icon={<Circle size={28} className="text-brand-400" />}
              title={hasFilters ? 'No matching tasks' : 'No tasks yet'}
              description={hasFilters
                ? "Try adjusting your filters or search query to find what you're looking for."
                : 'Create your first task to start tracking focus time and building momentum.'}
              action={
                hasFilters
                  ? <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
                  : <Button leftIcon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Create Task</Button>
              }
            />
          </motion.div>
        )}

        {/* Completed Section */}
        {completed.length > 0 && (
          <div className="pt-4">
            <Button variant="ghost" size="sm"
              leftIcon={<CheckCircle size={15} className="text-success-400" />}
              onClick={() => setShowCompleted(!showCompleted)}>
              Completed ({completed.length})
              <motion.span animate={{ rotate: showCompleted ? 180 : 0 }} transition={{ duration: 0.2 }}
                className="inline-block text-surface-500">
                ↓
              </motion.span>
            </Button>
            <AnimatePresence>
              {showCompleted && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden mt-3">
                  {completed.map(task => <TaskCard key={task.id} task={task} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ active, activeClass, onClick, children }: {
  active: boolean; activeClass?: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        active
          ? activeClass || 'bg-brand-500/15 text-brand-400 border-brand-500/30'
          : 'bg-surface-850 text-surface-400 border-surface-800 hover:text-surface-200 hover:border-surface-700'
      }`}>
      {children}
    </button>
  );
}
