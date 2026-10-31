import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, CheckCircle, Circle,
  Edit2, Check, X, Clock, Zap, BookOpen, ChevronDown, Calendar,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { ScheduleModal } from '@personal/components/schedule/ScheduleModal';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { formatDuration, formatHours, getDeadlineStatus } from '@shared/utils/time';
import { PRIORITY_CONFIG, DEADLINE_CONFIG } from '@shared/utils/colors';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';

import { Badge } from '@shared/components/ui/Badge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { TaskNotFound } from '@shared/components/illustrations';
import { RichContent } from '@shared/components/ui/RichContent';
import { TaskContinuationPanel } from '@personal/components/TaskContinuationPanel';
import { LinkedRoadmapCard } from '@personal/components/roadmap/LinkedRoadmapCard';
import { PauseCapturePanel } from '@worklog/components/focus/PauseCapturePanel';
import { CompletionPromptPanel } from '@worklog/components/focus/CompletionPromptPanel';
import { EngineeringMemoryPanel } from '@personal/components/EngineeringMemoryPanel';
import { CircularTimer } from '@personal/components/focus/CircularTimer';
import { RightSidebar } from '@personal/components/RightSidebar';
import type { Mood } from '@shared/types';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getTask, startParallelTimer, pauseParallelTimer, resumeParallelTimer, stopParallelTimer,
    addSubtask, toggleSubtask, deleteSubtask, addJournal,
    journals, updateTask, deleteTask, completeTask, theme,
  } = useStore();
  const { activeTaskId, activeTimerState, display: activeDisplay } = useActiveTimer();
  const { openModal: openScheduleModal, isModalOpen, closeModal } = useScheduleStore();
  const { activeLogs, closedLogs } = useWorkLogStore();
  const isReducedMotion = theme?.reducedMotion;

  const task = getTask(id!);

  // Find linked work log for pause/completion capture
  const allLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);
  const linkedLog = useMemo(() => task ? allLogs.find(l => l.taskRef?._id === task.id) ?? null : null, [allLogs, task]);
  const [newSubtask, setNewSubtask] = useState('');
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState<Mood>(3);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task?.title || '');
  const [showSessions, setShowSessions] = useState(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!task) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <EmptyState
          illustration={<TaskNotFound />}
          title="Task not found"
          description="This task may have been deleted."
          action={<Button onClick={() => navigate('/worklog/tasks')} size="lg">Back to Tasks</Button>}
        />
      </div>
    );
  }

  const isActive = activeTaskId === task.id;
  const isRunning = isActive && activeTimerState === 'running';
  const isPaused = isActive && activeTimerState === 'paused';
  const priority = PRIORITY_CONFIG[task.priority];
  const taskJournals = journals.filter(j => j.taskId === task.id);
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

  const handleAddJournal = () => {
    if (!journalText.trim()) return;
    addJournal({ taskId: task.id, content: journalText, mood, focusRating: mood });
    setJournalText('');
    setMood(3);
  };

  return (
    <div className="min-h-screen">
      {/* ═══ Top Bar (sticky) ═══ */}
      <div className="sticky top-0 z-40 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/worklog/tasks')}
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
              variant="secondary"
              size="sm"
              leftIcon={<Calendar size={14} />}
              onClick={() => openScheduleModal(task.id)}
            >
              Schedule
            </Button>
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
                state={isRunning ? 'running' : isPaused ? 'paused' : 'idle'}
                display={isActive ? activeDisplay : formatHours(task.totalTime)}
                totalTime={task.totalTime}
                isReducedMotion={isReducedMotion}
                onStart={startParallelTimer}
                onPause={pauseParallelTimer}
                onResume={resumeParallelTimer}
                onStop={stopParallelTimer}
              />
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
                <RichContent
                  content={task.description}
                  className="mt-2 max-w-2xl text-sm text-surface-400"
                />
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
                {task.sessions.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                    <Zap size={12} className="text-purple-400" /> {task.sessions.length} session{task.sessions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ Continuation (S2-T1) ═══ */}
        <TaskContinuationPanel taskId={task.id} />

        {/* Pause Capture (auto-shows on pause) */}
        <PauseCapturePanel
          paused={isPaused}
          workLogId={linkedLog?._id ?? null}
          workLogTitle={linkedLog?.title ?? null}
        />

        {/* Completion Prompt (shows when task is completed) */}
        <CompletionPromptPanel
          completed={task.status === 'completed'}
          taskId={task.id}
          workLogTitle={linkedLog?.title ?? null}
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

        {/* ═══ Sessions + Journal two-column ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Session History */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden h-fit">
            <button onClick={() => setShowSessions(!showSessions)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-850/50 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Clock size={14} className="text-purple-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Sessions</span>
                {task.sessions.length > 0 && (
                  <span className="text-[10px] font-bold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">
                    {task.sessions.length}
                  </span>
                )}
              </div>
              <motion.div animate={{ rotate: showSessions ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} className="text-surface-500" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {showSessions && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t border-surface-800">
                  <div className="p-4">
                    {task.sessions.length === 0 ? (
                      <div className="text-center py-4">
                        <Clock size={20} className="text-surface-600 mx-auto mb-1.5" />
                        <p className="text-xs text-surface-400">No sessions yet</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {task.sessions.slice().reverse().map((session, i) => (
                          <div key={session.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-surface-850/50 border border-surface-800">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-md bg-surface-800 flex items-center justify-center text-[10px] font-bold text-surface-400">
                                {task.sessions.length - i}
                              </div>
                              <span className="text-xs text-surface-400">
                                {session.endTime
                                  ? new Date(session.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                  : 'Active'}
                              </span>
                            </div>
                            <span className="text-sm font-mono font-semibold text-surface-200">
                              {formatDuration(session.activeTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total */}
                    <div className="mt-3 pt-3 border-t border-surface-800 flex justify-between items-center">
                      <span className="text-xs text-surface-400 font-medium">Total Focus</span>
                      <span className="text-sm font-mono font-bold text-brand-400">{formatHours(task.totalTime)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Journal column */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
            {/* ═══ Journal Entry ═══ */}
            <motion.div variants={fadeUp}
              className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BookOpen size={14} className="text-blue-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Journal Entry</span>
              </div>

              <Textarea
                className="resize-none h-28 text-sm mb-3 rounded-xl"
                placeholder="Write your thoughts, progress, blockers…"
                value={journalText}
                onChange={e => setJournalText(e.target.value)}
              />

              <div className="flex items-center gap-4 mb-4">
                <span className="text-xs text-surface-400 font-medium">Mood</span>
                <div className="flex gap-1">
                  {([1, 2, 3, 4, 5] as const).map(m => (
                    <button key={m} onClick={() => setMood(m)}
                      className={`text-xl transition-all p-1 rounded-lg ${
                        mood >= m ? 'scale-110' : 'opacity-30 hover:opacity-60'
                      }`}>
                      {['😔', '😐', '🙂', '😊', '🔥'][m - 1]}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleAddJournal} disabled={!journalText.trim()}
                className="w-full" leftIcon={<BookOpen size={14} />}>
                Save Journal Entry
              </Button>
            </motion.div>

            {/* ═══ Previous Entries ═══ */}
            {taskJournals.length > 0 && (
              <motion.div variants={fadeUp}>
                <h3 className="font-display font-bold text-surface-50 text-[15px] mb-3 flex items-center gap-2">
                  <BookOpen size={15} className="text-blue-400" /> Previous Entries
                  <span className="text-[10px] font-bold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">
                    {taskJournals.length}
                  </span>
                </h3>
                <div className="space-y-2.5">
                  {taskJournals.map(j => (
                    <motion.div key={j.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] text-surface-500 font-medium">
                          {new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-lg">{['😔', '😐', '🙂', '😊', '🔥'][j.mood - 1]}</span>
                      </div>
                      <RichContent content={j.content} className="text-sm text-surface-200 leading-relaxed" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ═══ Engineering Memory ═══ */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <EngineeringMemoryPanel taskId={task.id} />
        </motion.div>
      </div>

      <ScheduleModal isOpen={isModalOpen} onClose={closeModal} />

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
          navigate('/worklog/tasks');
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}

export default TaskDetail;
