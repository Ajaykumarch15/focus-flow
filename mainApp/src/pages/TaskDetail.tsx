import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, Square, Plus, Trash2,
  CheckCircle, Circle, Clock, Edit2, Check, X,
  Timer, Zap, BookOpen, ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { formatDuration, formatHours, getDeadlineStatus } from '../utils/time';
import { PRIORITY_CONFIG, DEADLINE_CONFIG } from '../utils/colors';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import type { Mood } from '../types';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getTask, startTimer, pauseTimer, resumeTimer, stopTimer,
    addSubtask, toggleSubtask, deleteSubtask, addJournal,
    journals, updateTask,
  } = useStore();
  const { activeTaskId, activeTimerState, display: activeDisplay } = useActiveTimer();

  const task = getTask(id!);
  const [newSubtask, setNewSubtask] = useState('');
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState<Mood>(3);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task?.title || '');
  const [showSessions, setShowSessions] = useState(true);

  if (!task) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <EmptyState
          icon={<Circle size={28} className="text-surface-600" />}
          title="Task not found"
          description="This task may have been deleted."
          action={<Button onClick={() => navigate('/tasks')} size="lg">Back to Tasks</Button>}
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* ═══ Back + Header ═══ */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}
          className="text-sm mb-4 px-3 py-1.5 rounded-lg w-fit"
          leftIcon={<ArrowLeft size={15} />}>
          Back to Tasks
        </Button>

        <div className={`rounded-2xl border bg-surface-900 p-6 lg:p-8 relative overflow-hidden ${
          isTaskOverdue ? 'border-red-500/30' : 'border-surface-800/60'
        }`}>
          {/* Color accent strip */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
            style={{ backgroundColor: isTaskOverdue ? '#ef4444' : task.color }} />

          <div className="pl-3">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' || task.priority === 'medium' ? 'warning' : 'success'} className={`text-[11px] border ${priority.border}`}>
                {priority.label}
              </Badge>
              <Badge tone="neutral" className="text-[11px] border border-surface-700">
                {task.category}
              </Badge>
              {deadlineInfo && (
                <Badge tone={deadlineInfo.status === 'overdue' ? 'danger' : deadlineInfo.status === 'due-today' || deadlineInfo.status === 'due-soon' ? 'warning' : 'brand'} icon={<Clock size={10} className="mr-1" />} className={`text-[11px] border ${DEADLINE_CONFIG[deadlineInfo.status].border}`}>
                  {deadlineInfo.label}
                </Badge>
              )}
              {task.status === 'completed' && (
                <Badge tone="success" icon={<CheckCircle size={10} className="mr-1" />} className="text-[11px] border border-emerald-400/20">
                  Done
                </Badge>
              )}
            </div>

            {editTitle ? (
              <div className="flex items-center gap-2">
                <Input className="text-xl font-display font-bold h-12 rounded-xl flex-1"
                  value={titleValue} onChange={e => setTitleValue(e.target.value)} autoFocus />
                <button onClick={() => { updateTask(task.id, { title: titleValue }); setEditTitle(false); }}
                  className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/25 transition-all">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditTitle(false)}
                  className="p-2.5 bg-surface-800 text-surface-400 rounded-xl border border-surface-700 hover:bg-surface-700 transition-all">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50">{task.title}</h1>
                <button onClick={() => setEditTitle(true)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-all">
                  <Edit2 size={14} />
                </button>
              </div>
            )}

            {task.description && (
              <p className="text-surface-400 mt-2 text-sm max-w-2xl leading-relaxed">{task.description}</p>
            )}

            {/* Quick stats row */}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                <Timer size={12} className="text-brand-400" /> {formatHours(task.totalTime)} focused
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

      {/* ═══ Two-Column Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Timer + Sessions */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

          {/* Timer Card */}
          <motion.div variants={fadeUp}
            className={`rounded-2xl border p-6 text-center transition-all duration-300 ${
              isRunning
                ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/5 to-surface-900 shadow-lg shadow-amber-500/10'
                : isPaused
                ? 'border-yellow-400/40 bg-yellow-500/5'
                : 'border-surface-800 bg-surface-900'
            }`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Timer size={14} className={`${
                isRunning ? 'text-amber-400' : isPaused ? 'text-amber-400/70' : 'text-surface-500'
              }`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">Focus Timer</span>
            </div>

            <div className="my-6 relative">
              {/* Pulse rings when running */}
              {isRunning && (
                <>
                  <motion.div className="absolute inset-0 rounded-2xl border-2 border-amber-500/20"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                  <motion.div className="absolute inset-0 rounded-2xl border-2 border-amber-500/15"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0, 0.15] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
                </>
              )}
              <div className={`font-mono text-5xl lg:text-6xl font-extrabold tracking-wider transition-colors duration-300 ${
                isRunning ? 'text-amber-400' : isPaused ? 'text-amber-400/70' : 'text-surface-300'
              }`}>
                {isActive ? activeDisplay : formatDuration(task.totalTime)}
              </div>
            </div>

            {/* Status label */}
            <p className="text-xs font-medium mb-5">
              {isRunning ? (
                <span className="text-amber-400 flex items-center justify-center gap-1.5">
                  <motion.span className="inline-block w-2 h-2 rounded-full bg-amber-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }} />
                  Recording focus time
                </span>
              ) : isPaused ? (
                <span className="text-amber-400/70">Timer paused</span>
              ) : task.totalTime > 0 ? (
                <span className="text-surface-500">Total: {formatHours(task.totalTime)}</span>
              ) : (
                <span className="text-surface-500">Ready to focus</span>
              )}
            </p>

            {/* Controls */}
            <div className="flex gap-2.5 justify-center flex-wrap">
              {!isActive && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => startTimer(task.id)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2">
                  <Play size={15} fill="white" /> {task.totalTime > 0 ? 'Resume' : 'Start Timer'}
                </motion.button>
              )}
              {isRunning && (
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => pauseTimer(task.id)}
                  className="btn-secondary rounded-xl flex items-center gap-2">
                  <Pause size={15} /> Pause
                </motion.button>
              )}
              {isPaused && (
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => resumeTimer(task.id)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2">
                  <Play size={15} fill="white" /> Resume
                </motion.button>
              )}
              {isActive && (
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => stopTimer(task.id)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-400/15 hover:bg-red-400/25 text-red-400 rounded-xl font-semibold text-sm transition-all border border-red-400/20">
                  <Square size={14} fill="currentColor" /> Stop
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Session History */}
          <motion.div variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden">
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
        </motion.div>

        {/* Right Column: Subtasks + Journal */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-2 space-y-5">

          {/* ═══ Subtasks ═══ */}
          <motion.div variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle size={14} className="text-emerald-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Subtasks</span>
                {task.subtasks.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {task.subtasks.length > 0 && (
              <div className="h-2 bg-surface-800 rounded-full mb-4 overflow-hidden">
                <motion.div className="h-full bg-emerald-400 rounded-full"
                  animate={{ width: `${subtaskProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }} />
              </div>
            )}

            <div className="space-y-1 mb-3">
              {task.subtasks.length === 0 && (
                <p className="text-xs text-surface-600 italic py-2">No subtasks yet — add one below</p>
              )}
              <AnimatePresence>
                {task.subtasks.map(st => (
                  <motion.div key={st.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850 border border-transparent hover:border-surface-800 transition-all group">
                    <button onClick={() => toggleSubtask(task.id, st.id, !st.completed)}
                      className="flex-shrink-0 transition-transform hover:scale-110">
                      {st.completed
                        ? <CheckCircle size={18} className="text-emerald-400" />
                        : <Circle size={18} className="text-surface-500 hover:text-surface-300" />}
                    </button>
                    <span className={`flex-1 text-sm ${st.completed ? 'line-through text-surface-500' : 'text-surface-200'}`}>
                      {st.title}
                    </span>
                    <button onClick={() => deleteSubtask(task.id, st.id)}
                      className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all p-1">
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <Input className="flex-1 text-sm rounded-xl" placeholder="Add subtask…"
                value={newSubtask} onChange={e => setNewSubtask(e.target.value)} />
              <Button type="submit" disabled={!newSubtask.trim()} size="icon">
                <Plus size={15} />
              </Button>
            </form>
          </motion.div>

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
                    <p className="text-sm text-surface-200 leading-relaxed">{j.content}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
