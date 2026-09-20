import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, CheckCircle, Circle,
  Edit2, Check, X, Clock,
} from 'lucide-react';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useStore } from '@worklog/services/useStore';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { formatHours, getDeadlineStatus } from '@shared/utils/time';
import { getScheduledState, formatScheduledDate } from '@personal/services/personalTaskSchedule';
import { PRIORITY_CONFIG, DEADLINE_CONFIG } from '@shared/utils/colors';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Badge } from '@shared/components/ui/Badge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { TaskNotFound } from '@shared/components/illustrations';
import { PauseCapturePanel } from '@worklog/components/focus/PauseCapturePanel';
import { CompletionPromptPanel } from '@worklog/components/focus/CompletionPromptPanel';
import { CircularTimer } from '@personal/components/focus/CircularTimer';
import { RightSidebar } from '@personal/components/RightSidebar';
import { LinkedRoadmapCard } from '@personal/components/roadmap/LinkedRoadmapCard';
// import { PomodoroPresets } from '@personal/components/focus/PomodoroPresets';
// import { TaskDetailSidebar } from '@personal/components/TaskDetailSidebar';
// import { EngineeringMemoryTabs } from '@personal/components/EngineeringMemoryTabs';
// import { TaskNotesSection } from '@personal/components/TaskNotesSection';
// import { TaskAttachmentsSection } from '@personal/components/TaskAttachmentsSection';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function PersonalTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getTask, addSubtask, toggleSubtask, deleteSubtask,
    updateTask, deleteTask, completeTask,
  } = usePersonalTaskStore();
  const theme = useStore(s => s.theme);
  const isReducedMotion = theme?.reducedMotion;

  const task = getTask(id!);

  const [parallelState, setParallelState] = useState(() =>
    task ? parallelTimerEngine.getState(task.id) : 'idle'
  );
  const [activeDisplay, setActiveDisplay] = useState(() =>
    task ? parallelTimerEngine.getFormattedDisplay(task.id) : ''
  );

  useEffect(() => {
    if (!task?.id) return;
    setParallelState(parallelTimerEngine.getState(task.id));
    setActiveDisplay(parallelTimerEngine.getFormattedDisplay(task.id));

    const unsubscribe = parallelTimerEngine.subscribe((changedTaskId) => {
      if (changedTaskId === task.id || changedTaskId === '') {
        setParallelState(parallelTimerEngine.getState(task.id));
        setActiveDisplay(parallelTimerEngine.getFormattedDisplay(task.id));
      }
    });
    return unsubscribe;
  }, [task?.id]);

  const [newSubtask, setNewSubtask] = useState('');
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task?.title || '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!task) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <EmptyState
          illustration={<TaskNotFound />}
          title="Task not found"
          description="This task may have been deleted."
          action={<Button onClick={() => navigate('/personal/tasks')} size="lg">Back to Tasks</Button>}
        />
      </div>
    );
  }

  const isRunning = parallelState === 'running';
  const isPaused = parallelState === 'paused';
  const priority = PRIORITY_CONFIG[task.priority];
  const deadlineInfo = task.status !== 'completed' ? getDeadlineStatus(task.deadline) : null;
  const isTaskOverdue = deadlineInfo?.status === 'overdue';

  const subtaskProgress = task.subtasks.length > 0
    ? (task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100
    : 0;

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    addSubtask(task.id, newSubtask);
    setNewSubtask('');
  };

  return (
    <div className="min-h-screen">
      {/* ═══ Top Bar ═══ */}
      <div className="sticky top-0 z-40 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/personal/tasks')}
            className="text-sm px-3 py-1.5 rounded-lg"
            leftIcon={<ArrowLeft size={15} />}
          >
            Back to Tasks
          </Button>
          <div className="flex items-center gap-3">
            {task.status !== 'completed' && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CheckCircle size={14} />}
                onClick={() => completeTask(task.id)}
              >
                Complete
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Edit2 size={14} />}
              onClick={() => setEditTitle(true)}
            >
              Edit Task
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 space-y-5">

        {/* ═══ Linked Roadmap (full width, at top) ═══ */}
        {(task.roadmapRef || task.phaseRef || task.milestoneRef) && (
          <LinkedRoadmapCard
            taskId={task.id}
            roadmapId={task.roadmapRef!}
            phaseId={task.phaseRef}
            milestoneId={task.milestoneRef}
          />
        )}

        {/* ═══ Task Card: Timer + Header side by side ═══ */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={`rounded-2xl border bg-surface-900 relative overflow-hidden ${
            isTaskOverdue ? 'border-red-500/30' : 'border-surface-800/60'
          }`}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
            style={{ backgroundColor: isTaskOverdue ? '#ef4444' : task.color }}
          />

          <div className="flex flex-col md:flex-row gap-5 p-5 lg:p-6">
            {/* Left: Focus Timer */}
            <div className={`flex-shrink-0 p-4 rounded-xl flex flex-col items-center justify-center min-w-[220px] transition-all duration-300 ${
              isRunning
                ? 'bg-gradient-to-br from-amber-500/5 to-slate-900 border border-amber-400/40'
                : isPaused
                ? 'bg-yellow-500/5 border border-yellow-400/30'
                : 'border border-surface-800'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock size={12} className={
                  isRunning ? 'text-amber-400' : isPaused ? 'text-amber-400/70' : 'text-surface-500'
                } />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-400">
                  Focus Timer
                </span>
              </div>

              <CircularTimer
                taskId={task.id}
                state={parallelState as 'idle' | 'running' | 'paused'}
                display={activeDisplay || formatHours(task.totalTime)}
                totalTime={task.totalTime}
                isReducedMotion={isReducedMotion}
              />

              {/*<div className="mt-4">
                <PomodoroPresets
                  isRunning={isRunning}
                  isPaused={isPaused}
                />
              </div>*/}
            </div>

            {/* Right: Task Header */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <Badge
                  tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' || task.priority === 'medium' ? 'warning' : 'success'}
                  className={`text-[11px] border ${priority.border}`}
                >
                  {priority.label}
                </Badge>
                <Badge tone="neutral" className="text-[11px] border border-surface-700">
                  {task.category}
                </Badge>
                {deadlineInfo && (
                  <Badge
                    tone={deadlineInfo.status === 'overdue' ? 'danger' : deadlineInfo.status === 'due-today' || deadlineInfo.status === 'due-soon' ? 'warning' : 'brand'}
                    icon={<Clock size={10} className="mr-1" />}
                    className={`text-[11px] border ${DEADLINE_CONFIG[deadlineInfo.status].border}`}
                  >
                    {deadlineInfo.label}
                  </Badge>
                )}
                {task.scheduledDate && task.status !== 'completed' && (() => {
                  const state = getScheduledState(task);
                  const stateColors: Record<string, string> = { today: 'brand', missed: 'danger', upcoming: 'info', unscheduled: 'neutral', completed: 'success' };
                  return (
                    <Badge tone={stateColors[state] as any || 'neutral'} icon={<Clock size={10} className="mr-1" />} className="text-[11px] border border-surface-700">
                      {formatScheduledDate(task.scheduledDate)}
                    </Badge>
                  );
                })()}
                {task.status === 'completed' && (
                  <Badge tone="success" icon={<CheckCircle size={10} className="mr-1" />} className="text-[11px] border border-emerald-400/20">
                    Done
                  </Badge>
                )}
              </div>

              {/* Title + Actions */}
              {editTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="text-xl font-display font-bold h-12 rounded-xl flex-1"
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={() => { updateTask(task.id, { title: titleValue }); setEditTitle(false); }}
                    className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditTitle(false)}
                    className="p-2.5 bg-surface-800 text-surface-400 rounded-xl border border-surface-700 hover:bg-surface-700 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-2 group">
                  <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 leading-tight">
                    {task.title}
                  </h1>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {task.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => completeTask(task.id)}
                        aria-label={`Complete task: ${task.title}`}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditTitle(true)}
                      aria-label={`Edit task title: ${task.title}`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(true)}
                      aria-label={`Delete task ${task.title}`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Description */}
              {task.description && (
                <p className="text-surface-400 mt-2 text-sm max-w-2xl leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta stats */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                  <Clock size={12} className="text-brand-400" /> {formatHours(task.totalTime)} focused
                </span>
                {task.subtasks.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                    <CheckCircle size={12} className="text-emerald-400" /> {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pause Capture (auto-shows on pause) */}
        <PauseCapturePanel
          paused={isPaused}
          workLogId={null}
          workLogTitle={null}
        />

        {/* Completion Prompt (shows when task is completed) */}
        <CompletionPromptPanel
          completed={task.status === 'completed'}
          taskId={task.id}
          workLogTitle={null}
        />

        {/* ═══ Bottom 2-Column: Subtasks + Sidebar ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          {/* Left: Subtasks */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle size={14} className="text-emerald-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Subtasks</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} completed
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>('#subtask-input');
                  input?.focus();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                <Plus size={13} />
                Add Subtask
              </button>
            </div>

            {task.subtasks.length > 0 && (
              <div className="h-2 bg-surface-800 rounded-full mb-4 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  animate={{ width: `${subtaskProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            )}

            {task.subtasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-14 h-14 rounded-full bg-surface-800 flex items-center justify-center mb-3">
                  <CheckCircle size={22} className="text-surface-600" />
                </div>
                <p className="text-sm font-semibold text-surface-300">No subtasks yet</p>
                <p className="text-xs text-surface-500 mt-1 text-center max-w-[260px]">
                  Break this task into smaller steps to make progress easier.
                </p>
              </div>
            ) : (
              <div className="space-y-1 mb-3">
                <AnimatePresence>
                  {task.subtasks.map(st => (
                    <motion.div
                      key={st.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850 border border-transparent hover:border-surface-800 transition-all group"
                    >
                      <button
                        onClick={() => toggleSubtask(task.id, st.id, !st.completed)}
                        className="flex-shrink-0 transition-transform hover:scale-110"
                      >
                        {st.completed
                          ? <CheckCircle size={18} className="text-emerald-400" />
                          : <Circle size={18} className="text-surface-500 hover:text-surface-300" />}
                      </button>
                      <span className={`flex-1 text-sm ${st.completed ? 'line-through text-surface-500' : 'text-surface-200'}`}>
                        {st.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSubtask(task.id, st.id)}
                        aria-label={`Delete subtask: ${st.title}`}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-surface-600 hover:text-red-400 transition-all p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <Input
                id="subtask-input"
                className="flex-1 text-sm rounded-xl"
                placeholder="Add subtask..."
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
              />
              <Button type="submit" disabled={!newSubtask.trim()} size="icon">
                <Plus size={15} />
              </Button>
            </form>
          </motion.div>

          {/* Right: Quote + Progress */}
          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        </div>

        {/* Sidebar Navigation + Stats */}
        {/*<TaskDetailSidebar
          totalTime={task.totalTime}
          sessions={task.sessions}
        />*/}

        {/* Engineering Memory Tabs */}
        {/*} <div id="section-activity">
          <EngineeringMemoryTabs taskId={task.id} />
        </div>*/}

        {/* Notes Section */}
        {/*<TaskNotesSection taskId={task.id} />

        {/* Attachments Section */}
        {/* <TaskAttachmentsSection />*/}
      </div>

      {/* Task Delete Confirmation */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          setShowConfirmDelete(false);
          deleteTask(task.id);
          navigate('/personal/tasks');
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}

export default PersonalTaskDetail;