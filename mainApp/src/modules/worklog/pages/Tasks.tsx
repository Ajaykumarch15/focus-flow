import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle,
  X, Eye, EyeOff, LayoutGrid, List,
  Filter, ChevronDown, Calendar,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { cn } from '@shared/utils/cn';
import { TaskCard } from '@worklog/components/tasks/TaskCard';
import { TaskListView } from '@worklog/components/tasks/TaskListView';
import { BulkActionBar } from '@worklog/components/tasks/BulkActionBar';
import { CreateTaskModal } from '@worklog/components/tasks/CreateTaskModal';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { TaskStatus, Task } from '@shared/types';
import { CATEGORIES } from '@shared/utils/colors';
import { isOverdue } from '@shared/utils/time';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NothingHereYet, NoSearchResults } from '@shared/components/illustrations';
import { Pagination } from '@shared/components/ui/Pagination';

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

/** Header illustration: a task clipboard with progress checks + priority flag. */
function TasksIllustration() {
  return (
    <svg viewBox="0 0 190 120" fill="none" aria-hidden="true"
      className="w-full h-full object-contain select-none">
      {/* Soft blobs behind the card */}
      <circle cx="38" cy="100" r="24" className="fill-success-500/10" />
      <circle cx="164" cy="24" r="20" className="fill-info-500/10" />
      <circle cx="28" cy="32" r="12" className="fill-brand-500/10" />

      {/* Floating badge: priority flag */}
      <circle cx="150" cy="88" r="17" className="fill-warning-500 stroke-warning-400" strokeWidth="2" />
      <path d="M150 79 V97" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white" />
      <path d="M150 79 H160 L156.5 83 L160 87 H150 Z" className="fill-white" />

      {/* Clipboard body */}
      <rect x="45" y="20" width="100" height="94" rx="12"
        className="fill-surface-900 stroke-surface-700" strokeWidth="2" />
      {/* Clip head */}
      <rect x="76" y="12" width="38" height="16" rx="8"
        className="fill-success-500/20 stroke-success-400" strokeWidth="2" />
      <rect x="88" y="16" width="14" height="8" rx="3" className="fill-success-500/30" />

      {/* Checklist rows */}
      <rect x="58" y="44" width="11" height="11" rx="3.5"
        className="fill-success-500 stroke-success-400" strokeWidth="1.5" />
      <path d="M60.5 49.5 L63 52 L67 47" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        strokeLinejoin="round" className="text-surface-950" />
      <rect x="76" y="47" width="48" height="6" rx="3" className="fill-surface-700/80" />

      <rect x="58" y="64" width="11" height="11" rx="3.5"
        className="fill-success-500 stroke-success-400" strokeWidth="1.5" />
      <path d="M60.5 69.5 L63 72 L67 67" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        strokeLinejoin="round" className="text-surface-950" />
      <rect x="76" y="67" width="34" height="6" rx="3" className="fill-surface-700/60" />

      {/* In-progress row */}
      <rect x="58" y="84" width="11" height="11" rx="3.5"
        className="fill-surface-800 stroke-brand-400" strokeWidth="1.5" strokeDasharray="3 2" />
      <rect x="76" y="87" width="42" height="6" rx="3" className="fill-surface-700/40" />

      {/* Progress bar footer */}
      <rect x="58" y="103" width="74" height="5" rx="2.5" className="fill-surface-800" />
      <rect x="58" y="103" width="46" height="5" rx="2.5" className="fill-success-400" />

      {/* Sparkles */}
      <path d="M32 52 L35 58 L41 61 L35 64 L32 70 L29 64 L23 61 L29 58 Z" className="fill-brand-400/40" />
      <path d="M174 52 L175.5 55 L178.5 56.5 L175.5 58 L174 61 L172.5 58 L169.5 56.5 L172.5 55 Z" className="fill-success-400/40" />
    </svg>
  );
}

/** localStorage key for the remembered grid/list view choice */
const VIEW_PREF_KEY = 'ff_worklog_tasks_view';

export function Tasks() {
  const navigate = useNavigate();
  const {
    tasks,
    selectedTaskIds, toggleTaskSelection, selectAllTasks, clearTaskSelection,
    bulkCompleteTasks, bulkDeleteTasks, persistTaskOrder, reorderTasks,
  } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterCombined, setFilterCombined] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<string>('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'deadline' | 'priority'>('default');
  const [showCompleted, setShowCompleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // Task view choice persists across reloads ("remember my choice") — grid is
  // the fallback for first visits / missing or corrupted storage.
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem(VIEW_PREF_KEY);
      return saved === 'list' || saved === 'grid' ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  const updateView = useCallback((next: 'grid' | 'list') => {
    setView(next);
    try {
      localStorage.setItem(VIEW_PREF_KEY, next);
    } catch {
      // Storage unavailable (private mode, quota) — view just won't persist
    }
  }, []);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

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
          // Local date key (toISOString would be UTC and shift the day for
          // non-UTC users, making the picked date mismatch nearby deadlines)
          const d = task.deadline ? new Date(task.deadline) : null;
          const taskDate = d
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            : null;
          if (taskDate !== filterSchedule) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      if (showOverdueOnly && (task.status === 'completed' || !isOverdue(task.deadline))) return false;
      return true;
    });
  }, [tasks, filterStatus, filterCombined, filterSchedule, search, showOverdueOnly, showCompleted]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'deadline') arr.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
    else if (sortBy === 'priority') arr.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
    else arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return arr;
  }, [filtered, sortBy]);

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterCombined, filterSchedule, showOverdueOnly, sortBy, showCompleted]);

  const filteredIds = useMemo(() => sorted.map(t => t.id), [sorted]);

  const overdueCount = useMemo(
    () => tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length,
    [tasks],
  );

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
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 sm:gap-4 z-10 relative">
        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden md:block w-[180px] h-[120px] flex-shrink-0">
            <TasksIllustration />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-extrabold text-surface-50">My Tasks</h1>
            <p className="text-sm text-surface-400 mt-0.5 truncate">Break it down. Do it. Grow everyday.</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={16} />} className="hidden lg:inline-flex flex-shrink-0">
          Add Task
        </Button>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="lg:hidden flex-shrink-0 h-10 px-4 rounded-2xl bg-gradient-to-r from-success-500 to-teal-500 text-white text-sm font-bold inline-flex items-center gap-1.5 shadow-md shadow-success-500/25 transition-all hover:from-success-400 hover:to-teal-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500/40"
        >
          <Plus size={16} /> Add Task
        </button>
      </motion.div>

      {/* ═══════════════ TASKS CONTENT ═══════════════ */}
      <div className="z-10 relative">

        {/* ── Filters + Task List ── */}
        <div className="space-y-4 min-w-0">
          {/* Filters Row 1: Search + Merged Filter + Sort (desktop) */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="hidden lg:flex flex-wrap gap-3 items-center">
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
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort tasks"
              className="h-8 px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              <option value="default">Default Order</option>
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
            </select>
            <div className="flex-1" />
            <div className="inline-flex bg-surface-800 border border-surface-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => updateView('grid')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                  view === 'grid' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-surface-300',
                )}
              >
                <LayoutGrid size={13} />
                Grid
              </button>
              <button
                type="button"
                onClick={() => updateView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-surface-300',
                )}
              >
                <List size={13} />
                List
              </button>
            </div>
          </motion.div>

          {/* Filters Row 2: Status + Date (desktop) */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="hidden lg:flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | 'all')}
                aria-label="Filter by status"
                className="appearance-none h-8 pl-3 pr-8 rounded-full bg-success-500/10 border border-success-500/25 text-success-600 dark:text-success-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-success-500/40">
                {([
                  ['all', 'All', statusCounts.all],
                  ['todo', 'To Do', statusCounts.todo],
                  ['active', 'In Progress', statusCounts.active],
                  ['paused', 'Paused', statusCounts.paused],
                  ['completed', 'Completed', statusCounts.completed],
                ] as const).map(([value, label, count]) => (
                  <option key={value} value={value} className="text-surface-50 bg-surface-900">{label} ({count})</option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-success-600 dark:text-success-400" />
            </div>
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

          {/* ══════════ MOBILE FILTERS (below lg) ══════════ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="lg:hidden space-y-3">
            {/* Search + Funnel */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  placeholder="Search tasks..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }}
                  aria-label="Search tasks"
                  className="h-11 pl-10 pr-9 rounded-xl"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(v => !v)}
                aria-expanded={showMobileFilters}
                aria-controls="mobile-task-filters"
                aria-label="Toggle filters"
                className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                  showMobileFilters
                    ? 'bg-brand-500/15 border-brand-500/30 text-brand-500'
                    : 'bg-surface-850 border-surface-800 text-surface-300'
                }`}
              >
                <Filter size={16} />
              </button>
            </div>

            {/* Status pill + Date + Sort */}
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | 'all')}
                  aria-label="Filter by status"
                  className="appearance-none h-10 pl-3 pr-8 rounded-full bg-success-500/10 border border-success-500/25 text-success-600 dark:text-success-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-success-500/40">
                  {([
                    ['all', 'All', statusCounts.all],
                    ['todo', 'To Do', statusCounts.todo],
                    ['active', 'In Progress', statusCounts.active],
                    ['paused', 'Paused', statusCounts.paused],
                    ['completed', 'Completed', statusCounts.completed],
                  ] as const).map(([value, label, count]) => (
                    <option key={value} value={value} className="text-surface-50 bg-surface-900">{label} ({count})</option>
                  ))}
                </select>
                <ChevronDown size={13} aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-success-600 dark:text-success-400" />
              </div>
              <div className="relative flex-1 min-w-0">
                <Calendar size={14} aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  type="date"
                  value={filterSchedule === 'no-date' ? '' : filterSchedule}
                  onChange={e => setFilterSchedule(e.target.value)}
                  aria-label="Filter by date"
                  className="h-10 w-full pl-9 pr-8 rounded-xl bg-surface-850 border border-surface-800 text-surface-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:[color-scheme:dark]"
                />
                {filterSchedule && filterSchedule !== 'no-date' && (
                  <button type="button" onClick={() => setFilterSchedule('')} aria-label="Clear date filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Overdue + Completed chips */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                aria-pressed={showOverdueOnly}
                className={`h-10 px-3 rounded-full border flex items-center justify-center gap-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
                  showOverdueOnly
                    ? 'bg-red-500/15 border-red-500/30 text-red-500 dark:text-red-400'
                    : 'bg-red-500/5 border-red-500/15 text-red-500/90 dark:text-red-400/90'
                }`}
              >
                <AlertTriangle size={14} />
                Overdue
                {overdueCount > 0 && (
                  <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-500 dark:text-red-300">
                    {overdueCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCompleted(!showCompleted)}
                aria-pressed={showCompleted}
                className={`h-10 px-3 rounded-full border flex items-center justify-center gap-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  showCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-emerald-500/5 border-emerald-500/15 text-emerald-600/90 dark:text-emerald-400/90'
                }`}
              >
                {showCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
                Completed
                {statusCounts.completed > 0 && (
                  <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                    {statusCounts.completed}
                  </span>
                )}
              </button>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                aria-label="Sort tasks"
                className="col-span-2 h-10 px-3 rounded-xl bg-surface-850 border border-surface-800 text-surface-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
                <option value="default">Default Order</option>
                <option value="deadline">Sort by Deadline</option>
                <option value="priority">Sort by Priority</option>
              </select>
            </div>

            {/* Collapsible extra filters */}
            {showMobileFilters && (
              <div id="mobile-task-filters" className="rounded-2xl border border-surface-800 bg-surface-900 p-3 space-y-2.5">
                <select value={filterCombined} onChange={e => setFilterCombined(e.target.value)}
                  aria-label="Filter by priority or category"
                  className="w-full h-10 px-3 rounded-xl bg-surface-850 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
                  <option value="all">All priorities &amp; categories</option>
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
                  type="button"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="w-full h-9 rounded-xl border border-surface-700 text-xs font-bold text-surface-300 hover:bg-surface-850 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  Clear filters
                </button>
              </div>
            )}
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
            view === 'list' ? (
              <>
                <div className="hidden lg:block">
                  <TaskListView
                    tasks={sorted}
                    onTaskClick={(id) => navigate(`/worklog/tasks/${id}`)}
                  />
                </div>
                <div className="lg:hidden">
                  <CardsContent
                    paginatedTasks={paginatedTasks}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={sorted.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCurrentPage}
                    selectedTaskIds={selectedTaskIds}
                    toggleTaskSelection={toggleTaskSelection}
                    dragOverId={dragOverId}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragLeave={handleDragLeave}
                  />
                </div>
              </>
            ) : (
              <CardsContent
                paginatedTasks={paginatedTasks}
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={sorted.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                selectedTaskIds={selectedTaskIds}
                toggleTaskSelection={toggleTaskSelection}
                dragOverId={dragOverId}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
              />
            )
          ) : (
            <EmptyState
              illustration={isUnfiltered ? <NothingHereYet /> : <NoSearchResults />}
              title={isUnfiltered ? 'No tasks yet' : 'No matching tasks'}
              description={isUnfiltered ? 'Create your first task to get started with focused work.' : 'Try adjusting your filters or search query.'}
              action={isUnfiltered ? <Button onClick={() => setShowCreate(true)}>Add Task</Button> : (
                <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
              )}
            />
          )}
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

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

interface CardsContentProps {
  paginatedTasks: Task[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  selectedTaskIds: Set<string>;
  toggleTaskSelection: (id: string) => void;
  dragOverId: string | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
}

function CardsContent({
  paginatedTasks, currentPage, totalPages, totalCount, pageSize, onPageChange,
  selectedTaskIds, toggleTaskSelection,
  dragOverId, onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave,
}: CardsContentProps) {
  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
        <AnimatePresence mode="popLayout">
          {paginatedTasks.map(task => (
            <motion.div
              key={task.id}
              variants={fadeUp}
              layout
              onDragOver={(e) => onDragOver(e as any, task.id)}
              onDrop={(e) => onDrop(e as any, task.id)}
              onDragLeave={onDragLeave}
              className={`relative ${dragOverId === task.id ? 'before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-brand-400' : ''}`}
            >
              <TaskCard
                task={task}
                selected={selectedTaskIds.has(task.id)}
                onToggleSelect={toggleTaskSelection}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => onDragStart(e, task.id),
                  onDragEnd,
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </>
  );
}

export default Tasks;
