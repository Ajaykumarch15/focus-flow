import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, CheckCircle, AlertTriangle,
  Target,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { TaskCard } from '../components/tasks/TaskCard';
import { BulkActionBar } from '../components/tasks/BulkActionBar';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Priority, TaskStatus } from '../types';
import { CATEGORIES } from '../utils/colors';
import { isOverdue } from '../utils/time';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function Tasks() {
  const {
    tasks,
    selectedTaskIds, toggleTaskSelection, selectAllTasks, clearTaskSelection,
    bulkCompleteTasks, bulkDeleteTasks, persistTaskOrder, reorderTasks,
  } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'deadline' | 'priority'>('default');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStatusFilter = (status: TaskStatus | 'all') => {
    setFilterStatus(status);
    if (status === 'completed') setShowCompleted(true);
    else if (status !== 'all') setShowCompleted(false);
  };

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filtered = useMemo(() => tasks.filter(task => {
    if (!showCompleted && task.status === 'completed') return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
    }
    if (showOverdueOnly && task.status !== 'completed' && !isOverdue(task.deadline)) return false;
    return true;
  }), [tasks, filterStatus, filterPriority, filterCategory, search, showCompleted, showOverdueOnly]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'deadline') arr.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
    else if (sortBy === 'priority') arr.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
    else arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return arr;
  }, [filtered, sortBy]);

  const filteredIds = useMemo(() => sorted.map(t => t.id), [sorted]);

  const selectedArray = useMemo(() => [...selectedTaskIds], [selectedTaskIds]);
  const hasSelection = selectedArray.length > 0;

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const inDialog = (e.target as HTMLElement).closest('[role="dialog"]');
      if (inDialog) return;

      // Escape → clear selection
      if (e.key === 'Escape' && hasSelection) {
        e.preventDefault();
        clearTaskSelection();
        return;
      }

      // Delete/Backspace → open bulk delete confirm
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        setShowBulkDeleteConfirm(true);
        return;
      }

      // Ctrl/Cmd + A → select all visible
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (filteredIds.length > 0) selectAllTasks(filteredIds);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasSelection, filteredIds, clearTaskSelection, selectAllTasks]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
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

    const currentTasks = useStore.getState().tasks;
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

  // ── Bulk Actions ────────────────────────────────────────────────────────────
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto space-y-6" ref={containerRef}>
      {/* Header */}
      <PageHeader
        title="Tasks"
        description="Manage your personal tasks and focus sessions."
        actions={
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={16} /> Add Task
          </Button>
        }
      />

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => handleStatusFilter(e.target.value as TaskStatus | 'all')}
          className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value as Priority | 'all')}
          className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
          className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="default">Default Order</option>
          <option value="deadline">Deadline</option>
          <option value="priority">Priority</option>
        </select>

        <Button
          variant={showCompleted ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => {
            const next = !showCompleted;
            setShowCompleted(next);
            setFilterStatus(next ? 'completed' : 'all');
          }}
          className="gap-1.5"
        >
          <CheckCircle size={14} />
          Completed
        </Button>

        <Button
          variant={showOverdueOnly ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setShowOverdueOnly(!showOverdueOnly)}
          className="gap-1.5"
        >
          <AlertTriangle size={14} />
          Overdue
        </Button>
      </motion.div>

      {/* Selection info */}
      {hasSelection && (
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <span>{selectedArray.length} task{selectedArray.length > 1 ? 's' : ''} selected</span>
          <button onClick={clearTaskSelection} className="text-brand-400 hover:text-brand-300 underline">Clear</button>
        </div>
      )}

      {/* Task List */}
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
          icon={search || filterStatus !== 'all' || filterPriority !== 'all' || showOverdueOnly || !showCompleted ? <Search size={24} /> : <Target size={24} />}
          title={search || filterStatus !== 'all' || filterPriority !== 'all' || showOverdueOnly || !showCompleted ? 'No matching tasks' : 'No tasks yet'}
          description={search || filterStatus !== 'all' || filterPriority !== 'all' || showOverdueOnly || !showCompleted ? 'Try adjusting your filters or search query.' : 'Create your first task to get started with focused work.'}
          action={!search && filterStatus === 'all' && filterPriority === 'all' && showCompleted && !showOverdueOnly ? <Button onClick={() => setShowCreate(true)}>Add Task</Button> : undefined}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        visible={hasSelection}
        selectedIds={selectedArray}
        onSelectAll={handleSelectAll}
        totalCount={filteredIds.length}
        onComplete={handleBulkComplete}
        onDelete={() => setShowBulkDeleteConfirm(true)}
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title={`Delete ${selectedArray.length} task${selectedArray.length > 1 ? 's' : ''}?`}
        message={`This will permanently remove ${selectedArray.length} task${selectedArray.length > 1 ? 's' : ''} and all their associated data. This action cannot be undone.`}
        confirmLabel="Delete Tasks"
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {/* Create Task Modal */}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
