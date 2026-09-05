import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle,
  Target, X, ArrowUpDown,
} from 'lucide-react';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { cn } from '@shared/utils/cn';
import { TaskCard } from '@worklog/components/tasks/TaskCard';
import { BulkActionBar } from '@worklog/components/tasks/BulkActionBar';
import { CreateTaskModal } from '@worklog/components/tasks/CreateTaskModal';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { Priority, TaskStatus } from '@shared/types';
import { CATEGORIES } from '@shared/utils/colors';
import { isOverdue } from '@shared/utils/time';
import { getScheduledState, type ScheduledState } from '@personal/services/personalTaskSchedule';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { EmptyState } from '@shared/components/ui/EmptyState';

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function PersonalTasks() {
  const {
    tasks,
    selectedTaskIds, toggleTaskSelection, selectAllTasks, clearTaskSelection,
    bulkCompleteTasks, bulkDeleteTasks, persistTaskOrder, reorderTasks,
    fetchTasks, addTask,
    startTimer, pauseTimer, resumeTimer, stopTimer, completeTask, deleteTask,
  } = usePersonalTaskStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [filterSchedule, setFilterSchedule] = useState<ScheduledState | 'all'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'deadline'>('default');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filtered = useMemo(() => tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (filterSchedule !== 'all' && getScheduledState(task) !== filterSchedule) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
    }
    if (showOverdueOnly && task.status !== 'completed' && !isOverdue(task.deadline)) return false;
    return true;
  }), [tasks, filterStatus, filterPriority, filterCategory, filterSchedule, search, showOverdueOnly]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'deadline') arr.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
    else arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return arr;
  }, [filtered, sortBy]);

  const filteredIds = useMemo(() => sorted.map(t => t.id), [sorted]);

  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus | 'all', number> = { all: 0, todo: 0, active: 0, paused: 0, completed: 0 };
    for (const t of tasks) {
      if (filterPriority !== 'all' && t.priority !== filterPriority) continue;
      if (filterCategory !== 'all' && t.category !== filterCategory) continue;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) continue;
      }
      if (showOverdueOnly && (t.status === 'completed' || !isOverdue(t.deadline))) continue;
      counts.all++;
      counts[t.status]++;
    }
    return counts;
  }, [tasks, search, filterPriority, filterCategory, showOverdueOnly]);

  const overdueCount = useMemo(
    () => tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length,
    [tasks],
  );

  const hasActiveFilters = Boolean(search) || filterStatus !== 'all' || filterPriority !== 'all'
    || filterCategory !== 'all' || filterSchedule !== 'all' || showOverdueOnly;

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterCategory('all');
    setFilterSchedule('all');
    setShowOverdueOnly(false);
  }, []);

  const isUnfiltered = !hasActiveFilters && filterCategory === 'all' && filterSchedule === 'all';

  const selectedArray = useMemo(() => [...selectedTaskIds], [selectedTaskIds]);
  const hasSelection = selectedArray.length > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const inDialog = (e.target as HTMLElement).closest('[role="dialog"]');
      if (inDialog) return;

      if (e.key === 'Escape' && hasSelection) {
        e.preventDefault();
        clearTaskSelection();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        setShowBulkDeleteConfirm(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (filteredIds.length > 0) selectAllTasks(filteredIds);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasSelection, filteredIds, clearTaskSelection, selectAllTasks]);

  const dragIdRef = useRef<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => { el.style.opacity = '0.4'; });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    dragIdRef.current = null;
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdRef.current && dragIdRef.current !== id) {
      setDragOverId(id);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragIdRef.current;
    if (!sourceId || sourceId === targetId) { setDragOverId(null); return; }

    const currentTasks = usePersonalTaskStore.getState().tasks;
    const sourceIdx = currentTasks.findIndex(t => t.id === sourceId);
    const targetIdx = currentTasks.findIndex(t => t.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) { setDragOverId(null); return; }

    const reordered = [...currentTasks];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const orderedIds = reordered.map(t => t.id);
    reorderTasks(reordered.map((t, i) => ({ ...t, order: i })));
    persistTaskOrder(orderedIds);
    setDragOverId(null);
  }, [reorderTasks, persistTaskOrder]);

  const handleDragLeave = useCallback(() => { setDragOverId(null); }, []);

  const handleBulkComplete = () => {
    if (selectedArray.length === 0) return;
    bulkCompleteTasks(selectedArray);
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedArray.length === 0) return;
    bulkDeleteTasks(selectedArray);
    setShowBulkDeleteConfirm(false);
  };

  const handleSelectAll = () => {
    if (selectedArray.length === filteredIds.length) clearTaskSelection();
    else selectAllTasks(filteredIds);
  };

  return (
    <div className="relative px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 max-w-[1400px] space-y-6" ref={containerRef}>
      {/* ── Decorative spots ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full
          bg-brand-400/[0.12] dark:bg-brand-400/[0.06] blur-3xl" />
        <div className="absolute top-[15%] -right-12 w-40 h-40 rounded-full
          bg-info-400/[0.10] dark:bg-info-300/[0.05] blur-3xl" />
        <div className="absolute top-[40%] left-[5%] w-36 h-36 rounded-[1.5rem] rotate-12
          bg-success-400/[0.08] dark:bg-success-300/[0.04] blur-2xl" />
        <div className="absolute top-[60%] right-[8%] w-44 h-44 rounded-full
          bg-brand-300/[0.08] dark:bg-brand-400/[0.04] blur-3xl" />
        <div className="absolute top-[80%] left-[20%] w-32 h-32 rounded-full
          bg-info-300/[0.08] dark:bg-info-400/[0.04] blur-2xl" />
        <div className="absolute top-[90%] right-[30%] w-40 h-28 rounded-full
          bg-brand-400/[0.07] dark:bg-brand-500/[0.04] blur-3xl" />
      </div>

      <PageHeader
        title="My Tasks"
        description="Your personal tasks and focus sessions."
        actions={
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={16} /> Add Task
          </Button>
        }
      />

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }}
              aria-label="Search tasks"
              className="h-10 pl-10 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as Priority | 'all')}
            aria-label="Filter by priority"
            className="h-10 px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-10 px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="relative">
            <ArrowUpDown size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort tasks"
              className="h-10 pl-9 pr-8 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 appearance-none"
            >
              <option value="default">Default Order</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>

          <Button
            variant={showOverdueOnly ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            aria-pressed={showOverdueOnly}
            className="gap-1.5 h-10"
          >
            <AlertTriangle size={14} />
            Overdue
            {overdueCount > 0 && (
              <span
                className={`ml-0.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-extrabold ${
                  showOverdueOnly ? 'bg-white/25 text-white' : 'bg-red-500/15 text-red-400'
                }`}
              >
                {overdueCount}
              </span>
            )}
          </Button>
        </div>

        <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5">
          {([
            ['all', 'All'],
            ['todo', 'To Do'],
            ['active', 'Active'],
            ['paused', 'Paused'],
            ['completed', 'Done'],
          ] as const).map(([value, label]) => {
            const active = filterStatus === value;
            const count = statusCounts[value];
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilterStatus(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-bold transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                    : 'bg-surface-900 border-surface-700/70 text-surface-400 hover:text-surface-200 hover:border-surface-600',
                )}
              >
                {label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-extrabold',
                    active ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-800 text-surface-500',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div role="group" aria-label="Filter by schedule" className="flex flex-wrap items-center gap-1.5">
          {([
            ['all', 'All Dates'],
            ['today', 'Today'],
            ['missed', 'Missed'],
            ['upcoming', 'Upcoming'],
            ['unscheduled', 'No Date'],
          ] as const).map(([value, label]) => {
            const active = filterSchedule === value;
            return (
              <button
                key={value}
                onClick={() => setFilterSchedule(value)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                  active
                    ? 'bg-info-500/15 border-info-500/40 text-info-300'
                    : 'bg-surface-900 border-surface-700/70 text-surface-400 hover:text-surface-200 hover:border-surface-600',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between text-xs text-surface-500">
          <p>
            Showing <span className="font-bold text-surface-300">{sorted.length}</span> of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
          <button onClick={clearFilters} className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            <X size={12} /> Clear filters
          </button>
        </div>
      )}

      {hasSelection && (
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <span>{selectedArray.length} task{selectedArray.length > 1 ? 's' : ''} selected</span>
          <button onClick={clearTaskSelection} className="text-brand-400 hover:text-brand-300 underline">Clear</button>
        </div>
      )}

      {sorted.length > 0 ? (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sorted.map(task => (
              <motion.div
                key={task.id}
                variants={fadeUp}
                layout
                onDragOver={(e) => handleDragOver(e as any, task.id)}
                onDrop={(e) => handleDrop(e as any, task.id)}
                onDragLeave={handleDragLeave}
                className={`relative ${dragOverId === task.id ? 'before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-brand-400' : ''}`}
              >
                <TaskCard
                  task={task}
                  selected={selectedTaskIds.has(task.id)}
                  onToggleSelect={toggleTaskSelection}
                  detailPath={`/personal/tasks/${task.id}`}
                  onStartTimer={startTimer}
                  onPauseTimer={pauseTimer}
                  onResumeTimer={resumeTimer}
                  onStopTimer={stopTimer}
                  onCompleteTask={completeTask}
                  onDeleteTask={deleteTask}
                  dragHandleProps={{
                    draggable: true,
                    onDragStart: (e: React.DragEvent) => handleDragStart(e, task.id),
                    onDragEnd: handleDragEnd,
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <EmptyState
          icon={isUnfiltered ? <Target size={24} /> : <Search size={24} />}
          title={isUnfiltered ? 'No tasks yet' : 'No matching tasks'}
          description={isUnfiltered ? 'Create your first task to get started with focused work.' : 'Try adjusting your filters or search query.'}
          action={isUnfiltered ? <Button onClick={() => setShowCreate(true)}>Add Task</Button> : (
            <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
          )}
        />
      )}

      <BulkActionBar
        visible={hasSelection}
        selectedIds={selectedArray}
        onSelectAll={handleSelectAll}
        totalCount={filteredIds.length}
        onComplete={handleBulkComplete}
        onDelete={() => setShowBulkDeleteConfirm(true)}
      />

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title={`Delete ${selectedArray.length} task${selectedArray.length > 1 ? 's' : ''}?`}
        message={`This will permanently remove ${selectedArray.length} task${selectedArray.length > 1 ? 's' : ''} and all their associated data. This action cannot be undone.`}
        confirmLabel="Delete Tasks"
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onAddTask={addTask} />}
    </div>
  );
}

export default PersonalTasks;
