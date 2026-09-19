import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle,
  X, ArrowUp, ArrowDown, Eye, EyeOff,
} from 'lucide-react';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { PersonalTaskCard } from '@personal/components/tasks/PersonalTaskCard';
import { BulkActionBar } from '@worklog/components/tasks/BulkActionBar';
import { CreateTaskModal } from '@worklog/components/tasks/CreateTaskModal';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { TaskStatus } from '@shared/types';
import { CATEGORIES } from '@shared/utils/colors';
import { isOverdue } from '@shared/utils/time';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Card } from '@shared/components/ui/Card';
import { Pagination } from '@shared/components/ui/Pagination';
import { TodayPlanWidget } from '@personal/components/schedule/TodayPlanWidget';

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function PersonalTasks() {
  const {
    tasks,
    selectedTaskIds, selectAllTasks, clearTaskSelection,
    bulkCompleteTasks, bulkDeleteTasks,
    fetchTasks, addTask,
  } = usePersonalTaskStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterCombined, setFilterCombined] = useState<string>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [filterSchedule, setFilterSchedule] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filtered = useMemo(() => {
    const priorities: string[] = ['urgent', 'high', 'medium', 'low'];
    const categories: string[] = CATEGORIES.map(c => c.toLowerCase());
    return tasks.filter(task => {
      if (!showCompleted && task.status === 'completed') return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      if (filterCombined !== 'all') {
        if (priorities.includes(filterCombined) && task.priority !== filterCombined) return false;
        if (categories.includes(filterCombined) && task.category?.toLowerCase() !== filterCombined) return false;
      }
      if (filterSchedule) {
        if (filterSchedule === 'no-date') {
          if (task.deadline) return false;
        } else {
          const taskDate = task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : null;
          if (taskDate !== filterSchedule) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      if (showOverdueOnly && task.status !== 'completed' && !isOverdue(task.deadline)) return false;
      return true;
    });
  }, [tasks, filterStatus, filterCombined, filterSchedule, search, showOverdueOnly, showCompleted]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp = (a.deadline || Infinity) - (b.deadline || Infinity);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortDir]);

  const filteredIds = useMemo(() => sorted.map(t => t.id), [sorted]);

  // Pagination
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);
  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterCombined, filterSchedule, showOverdueOnly, sortDir, showCompleted]);

  const statusCounts = useMemo(() => {
    const priorities: string[] = ['urgent', 'high', 'medium', 'low'];
    const categories: string[] = CATEGORIES.map(c => c.toLowerCase());
    const counts: Record<TaskStatus | 'all', number> = { all: 0, todo: 0, active: 0, paused: 0, completed: 0 };
    for (const t of tasks) {
      if (filterCombined !== 'all') {
        if (priorities.includes(filterCombined) && t.priority !== filterCombined) continue;
        if (categories.includes(filterCombined) && t.category?.toLowerCase() !== filterCombined) continue;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) continue;
      }
      if (showOverdueOnly && (t.status === 'completed' || !isOverdue(t.deadline))) continue;
      counts.all++;
      counts[t.status]++;
    }
    return counts;
  }, [tasks, search, filterCombined, showOverdueOnly]);

  const overdueCount = useMemo(
    () => tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length,
    [tasks],
  );

  const hasActiveFilters = Boolean(search) || filterStatus !== 'all' || filterCombined !== 'all'
    || Boolean(filterSchedule) || showOverdueOnly || showCompleted;

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilterStatus('all');
    setFilterCombined('all');
    setFilterSchedule('');
    setShowOverdueOnly(false);
    setShowCompleted(false);
  }, []);

  const isUnfiltered = !hasActiveFilters && filterCombined === 'all' && !filterSchedule && !showCompleted;

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
    <div className="relative px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 max-w-[1600px] space-y-6" ref={containerRef}>
      {/* ── Decorative spots ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-brand-400/[0.12] dark:bg-brand-400/[0.06] blur-3xl" />
        <div className="absolute top-[15%] -right-12 w-40 h-40 rounded-full bg-info-400/[0.10] dark:bg-info-300/[0.05] blur-3xl" />
        <div className="absolute top-[40%] left-[5%] w-36 h-36 rounded-[1.5rem] rotate-12 bg-success-400/[0.08] dark:bg-success-300/[0.04] blur-2xl" />
        <div className="absolute top-[60%] right-[8%] w-44 h-44 rounded-full bg-brand-300/[0.08] dark:bg-brand-400/[0.04] blur-3xl" />
      </div>

      {/* ═══════════════ HEADER ═══════════════ */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 relative">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">My Tasks</h1>
          <p className="text-sm text-surface-400 mt-0.5">Break it down. Do it. Grow everyday.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={16} />}>
          Add Task
        </Button>
      </motion.div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 z-10 relative"
      >
        {/*{[
          { label: 'To Do', count: statusCounts.todo, color: 'text-surface-400', bg: 'bg-surface-800/50' },
          { label: 'In Progress', count: statusCounts.active, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Completed', count: statusCounts.completed, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Overdue', count: overdueCount, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-surface-800 bg-surface-900 p-3 flex flex-col`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">{kpi.label}</span>
            <span className={`text-2xl font-display font-extrabold mt-1 ${kpi.color}`}>{kpi.count}</span>
          </div>
        ))}*/}
      </motion.div>

      {/* ═══════════════ MAIN 2-COL LAYOUT ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 z-10 relative">

        {/* ── LEFT: Filters + Task List ── */}
        <div className="space-y-4 min-w-0">
          {/* Filters Row 1: Search + Merged Filter + Sort Toggle */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }}
                aria-label="Search tasks"
                className="h-18 pl-10 pr-9"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            <select value={filterCombined} onChange={e => setFilterCombined(e.target.value)}
              aria-label="Filter by priority or category"
              className="h-8 px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              <option value="all">All</option>
              <optgroup label="Priority">
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </optgroup>
              <optgroup label="Category">
                {CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
              </optgroup>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="h-8 w-10 flex items-center justify-center rounded-xl bg-surface-800 border border-surface-700 text-surface-200 hover:bg-surface-700 transition-all"
              title={sortDir === 'asc' ? 'Ascending (earliest first)' : 'Descending (latest first)'}
              aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortDir === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </button>
          </motion.div>

          {/* Filters Row 2: Status + Schedule tabs */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex flex-wrap items-center gap-1.5">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | 'all')}
              aria-label="Filter by status"
              className="h-8 px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              {([
                ['all', 'All', statusCounts.all],
                ['todo', 'To Do', statusCounts.todo],
                ['active', 'In Progress', statusCounts.active],
                ['paused', 'Paused', statusCounts.paused],
                ['completed', 'Completed', statusCounts.completed],
              ] as const).map(([value, label, count]) => (
                <option key={value} value={value}>{label} ({count})</option>
              ))}
            </select>
            <span className="w-px h-5 bg-surface-700 mx-1" aria-hidden="true" />
            <div className="relative">
              <input
                type="date"
                value={filterSchedule === 'no-date' ? '' : filterSchedule}
                onChange={e => setFilterSchedule(e.target.value)}
                aria-label="Filter by date"
                className="h-8 px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 [color-scheme:dark]"
              />
              {filterSchedule && filterSchedule !== 'no-date' && (
                <button type="button" onClick={() => setFilterSchedule('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
            {/*<Button
              variant={!filterSchedule ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterSchedule(filterSchedule === 'no-date' ? '' : 'no-date')}
              className="gap-1.5 h-9">
              No Date
            </Button>*/}
            <Button
              variant={showOverdueOnly ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowOverdueOnly(!showOverdueOnly)}
              aria-pressed={showOverdueOnly}
              className="gap-1.5 h-9 ml-auto">
              <AlertTriangle size={14} />
              Overdue
              {overdueCount > 0 && (
                <span className={`ml-0.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-extrabold ${showOverdueOnly ? 'bg-white/25 text-white' : 'bg-red-500/15 text-red-400'}`}>
                  {overdueCount}
                </span>
              )}
            </Button>
            <Button
              variant={showCompleted ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              aria-pressed={showCompleted}
              className="gap-1.5 h-9">
              {showCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
              {statusCounts.completed > 0 && (
                <span className={`ml-0.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-extrabold ${showCompleted ? 'bg-white/25 text-white' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  {statusCounts.completed}
                </span>
              )}
            </Button>
          </motion.div>

          {/* Active filters summary */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between text-xs text-surface-500">
              <p>Showing <span className="font-bold text-surface-300">{sorted.length}</span> of {tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
              <button onClick={clearFilters} className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:text-brand-300 transition-colors">
                <X size={12} /> Clear filters
              </button>
            </div>
          )}

          {/* Selection info */}
          {hasSelection && (
            <div className="flex items-center gap-2 text-xs text-surface-400">
              <span>{selectedArray.length} task{selectedArray.length > 1 ? 's' : ''} selected</span>
              <button onClick={clearTaskSelection} className="text-brand-400 hover:text-brand-300 underline">Clear</button>
            </div>
          )}

          {/* Task List */}
          {sorted.length > 0 ? (
            <>
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {paginatedTasks.map(task => (
                    <motion.div
                      key={task.id}
                      variants={fadeUp}
                      layout
                    >
                      <PersonalTaskCard task={task} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={sorted.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </>
          ) : (
            <EmptyState
              illustration={isUnfiltered ? '/SVG/empty-tasks.png' : '/SVG/task-list.png'}
              title={isUnfiltered ? 'No tasks yet' : 'No matching tasks'}
              description={isUnfiltered ? 'Create your first task to get started with focused work.' : 'Try adjusting your filters or search query.'}
              action={isUnfiltered ? <Button onClick={() => setShowCreate(true)}>Add Task</Button> : (
                <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
              )}
            />
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="space-y-5 hidden lg:block">
          {/* Illustration */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-5 overflow-hidden relative">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-brand-400/10 blur-2xl pointer-events-none" />
              <img src="/SVG/focus.svg.png" alt="" aria-hidden="true" loading="lazy" draggable={false}
                className="w-full h-auto max-h-[380px] object-contain select-none pointer-events-none" />
              <p className="text-center text-xs text-surface-400 mt-3 font-medium">Good Things Take Time</p>
            </Card>
          </motion.div>

          {/* Today's Focus */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <TodayPlanWidget />
          </motion.div>

          {/* Motivational Quote */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-5 relative overflow-hidden min-h-[160px]">
              <div className="absolute inset-0 opacity-20">
                <img src="/SVG/roadmap-mountain.svg" alt="" aria-hidden="true" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-surface-900/90 via-surface-900/60 to-transparent" />
              <div className="relative z-10">
                <div className="text-4xl text-brand-500/30 font-display select-none pointer-events-none leading-none">&ldquo;</div>
                <p className="text-sm font-semibold text-surface-100 leading-relaxed italic -mt-2">
                  Discipline today builds the freedom tomorrow.
                </p>
              </div>
            </Card>
          </motion.div>

        </div>
      </div>

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
