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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-50">Tasks</h1>
          <p className="text-surface-300 text-sm mt-1">{active.length} active · {tasks.filter(t => t.status === 'completed').length} completed</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Task
        </button>
      </motion.div>

      {/* Overdue Warning Banner */}
      {overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl"
        >
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">{overdueCount} task{overdueCount !== 1 ? 's' : ''}</span> {overdueCount === 1 ? 'is' : 'are'} overdue
          </p>
        </motion.div>
      )}

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3 mb-6"
      >
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-10"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'todo', 'active', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === s ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-surface-50'}`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="w-px bg-surface-700 mx-1" />
          {(['all', 'low', 'medium', 'high', 'urgent'] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterPriority === p ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-surface-50'}`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <div className="w-px bg-surface-700 mx-1" />
          <button
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${showOverdueOnly ? 'bg-red-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-surface-50'}`}
          >
            <AlertTriangle size={13} />
            Overdue {overdueCount > 0 && `(${overdueCount})`}
          </button>
          <div className="w-px bg-surface-700 mx-1" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-800 text-surface-300 hover:text-surface-50 transition-all border-0 outline-none cursor-pointer"
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
