import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, CheckCircle, Circle, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Priority, TaskStatus } from '../types';
import { CATEGORIES } from '../utils/colors';
import { isOverdue } from '../utils/time';

export function Tasks() {
  const { tasks } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'deadline' | 'priority'>('default');

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filtered = tasks.filter(task => {
    if (!showCompleted && task.status === 'completed') return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (showOverdueOnly && !isOverdue(task.deadline)) return false;
    return true;
  });

  const active = filtered.filter(t => t.status !== 'completed');
  const completed = filtered.filter(t => t.status === 'completed');

  const sortedActive = [...active].sort((a, b) => {
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
  });

  const overdueCount = tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length;

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl">✅</span>
            Tasks
          </h1>
          <p className="text-surface-400 font-medium text-sm mt-1.5">{active.length} Active · {tasks.filter(t => t.status === 'completed').length} Completed</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} />
          New Task
        </button>
      </motion.div>

      {/* Overdue Warning Banner */}
      {overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-[18px]"
        >
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-300 font-medium">
            <span className="font-semibold">{overdueCount} task{overdueCount !== 1 ? 's' : ''}</span> {overdueCount === 1 ? 'is' : 'are'} overdue
          </p>
        </motion.div>
      )}

      {/* Search + Filters Container */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6 rounded-[22px] shadow-sm mb-8 space-y-4"
      >
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-11 h-12 rounded-[14px]"
            placeholder="Search tasks by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'todo', 'active', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-2 rounded-[12px] text-xs font-semibold transition-all ${filterStatus === s ? 'bg-brand-500 text-white shadow-sm' : 'bg-surface-850 text-surface-300 hover:text-surface-50 border border-surface-800'}`}
            >
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="w-px h-6 bg-surface-800 mx-1" />
          {(['all', 'low', 'medium', 'high', 'urgent'] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-3.5 py-2 rounded-[12px] text-xs font-semibold transition-all ${filterPriority === p ? 'bg-brand-500 text-white shadow-sm' : 'bg-surface-850 text-surface-300 hover:text-surface-50 border border-surface-800'}`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <div className="w-px h-6 bg-surface-800 mx-1" />
          <button
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className={`px-3.5 py-2 rounded-[12px] text-xs font-semibold transition-all flex items-center gap-1.5 ${showOverdueOnly ? 'bg-red-500 text-white shadow-sm' : 'bg-surface-850 text-surface-300 hover:text-surface-50 border border-surface-800'}`}
          >
            <AlertTriangle size={13} />
            Overdue {overdueCount > 0 && `(${overdueCount})`}
          </button>
          <div className="w-px h-6 bg-surface-800 mx-1" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-3.5 py-2 rounded-[12px] text-xs font-semibold bg-surface-850 text-surface-300 hover:text-surface-50 transition-all border border-surface-800 outline-none cursor-pointer"
          >
            <option value="default">Default Order</option>
            <option value="deadline">Deadline (Soonest)</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </motion.div>

      {/* Task List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedActive.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </AnimatePresence>

        {active.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-10 text-center"
          >
            <Circle size={36} className="text-surface-600 mx-auto mb-3" />
            <p className="text-surface-300 font-medium">No tasks found</p>
            <p className="text-surface-500 text-sm mt-1">Try adjusting your filters or create a new task</p>
          </motion.div>
        )}

        {/* Completed Section */}
        <div className="pt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-surface-400 hover:text-surface-50 text-sm font-medium transition-colors mb-3"
          >
            <CheckCircle size={16} className="text-emerald-400" />
            Completed ({tasks.filter(t => t.status === 'completed').length})
          </button>

          <AnimatePresence>
            {showCompleted && completed.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
