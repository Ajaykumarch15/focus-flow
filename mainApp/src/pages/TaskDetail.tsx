import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, Square, Plus, Trash2,
  CheckCircle, Circle, Clock, Edit2, Check, X
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDuration, formatHours, getDeadlineStatus } from '../utils/time';
import { PRIORITY_CONFIG, MOOD_LABELS, DEADLINE_CONFIG } from '../utils/colors';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getTask, startTimer, pauseTimer, resumeTimer, stopTimer,
    addSubtask, toggleSubtask, deleteSubtask, addJournal,
    journals, activeTaskId, activeTimerState, updateTask
  } = useStore();

  const task = getTask(id!);
  const [newSubtask, setNewSubtask] = useState('');
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState(3);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task?.title || '');

  if (!task) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-surface-300">Task not found</p>
          <button onClick={() => navigate('/tasks')} className="btn-primary mt-4">Back to Tasks</button>
        </div>
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

  const lastSession = task.sessions[task.sessions.length - 1];
  const liveTime = isActive && lastSession ? lastSession.activeTime : 0;

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    addSubtask(task.id, newSubtask);
    setNewSubtask('');
  };

  const handleAddJournal = () => {
    if (!journalText.trim()) return;
    addJournal({ taskId: task.id, content: journalText, mood: mood as any, focusRating: mood });
    setJournalText('');
    setMood(3);
  };

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Back */}
      <button
        onClick={() => navigate('/tasks')}
        className="btn-secondary"
      >
        <ArrowLeft size={16} />
        Back to Tasks
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`card p-6 rounded-[22px] shadow-sm mb-6 relative overflow-hidden ${isTaskOverdue ? 'border-red-500/30 bg-red-500/5' : ''}`}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ backgroundColor: isTaskOverdue ? '#ef4444' : task.color }} />
        <div className="pl-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`badge ${priority.bg} ${priority.color} border ${priority.border}`}>{priority.label}</span>
            <span className="badge bg-surface-850 text-surface-300 border border-surface-800">{task.category}</span>
            {deadlineInfo && (
              <span className={`badge ${DEADLINE_CONFIG[deadlineInfo.status].bg} ${DEADLINE_CONFIG[deadlineInfo.status].color} border ${DEADLINE_CONFIG[deadlineInfo.status].border}`}>
                <Clock size={10} className="mr-1" />
                {deadlineInfo.label}
              </span>
            )}
          </div>

          {editTitle ? (
            <div className="flex items-center gap-2">
              <input
                className="input text-xl font-display font-bold h-12 rounded-[14px]"
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                autoFocus
              />
              <button onClick={() => { updateTask(task.id, { title: titleValue }); setEditTitle(false); }}
                className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-[14px]"><Check size={16} /></button>
              <button onClick={() => setEditTitle(false)}
                className="p-2.5 bg-surface-850 text-surface-400 rounded-[14px]"><X size={16} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-3xl font-display font-extrabold text-surface-50">{task.title}</h1>
              <button onClick={() => setEditTitle(true)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-surface-50 transition-all">
                <Edit2 size={14} />
              </button>
            </div>
          )}

          {task.description && (
            <p className="text-surface-300 mt-2 font-medium">{task.description}</p>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Timer + Time */}
        <div className="space-y-6">
          {/* Timer Card */}
          <div className="card p-6 rounded-[22px] shadow-sm text-center bg-[#FFFDF5] dark:bg-surface-900 border border-amber-200/80 dark:border-surface-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">Timer Focus</div>
            <div className={`timer-display text-5xl lg:text-6xl font-extrabold mb-6 ${isRunning ? 'text-amber-500' : isPaused ? 'text-amber-500/80' : 'text-surface-300'}`}>
              {isActive ? formatDuration(liveTime) : formatDuration(task.totalTime)}
            </div>
            {isRunning && (
              <motion.div
                className="w-3 h-3 bg-amber-500 rounded-full mx-auto mb-4"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              {!isActive && (
                <button onClick={() => startTimer(task.id)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[14px] font-semibold text-sm transition-all shadow-md shadow-blue-500/20 flex items-center gap-2">
                  <Play size={16} fill="white" /> Start Timer
                </button>
              )}
              {isRunning && (
                <button onClick={() => pauseTimer(task.id)} className="btn-secondary">
                  <Pause size={16} /> Pause
                </button>
              )}
              {isPaused && (
                <button onClick={() => resumeTimer(task.id)} className="btn-primary flex items-center gap-2">
                  <Play size={15} /> Resume
                </button>
              )}
              {isActive && (
                <button onClick={() => stopTimer(task.id)} className="flex items-center gap-2 px-4 py-2 bg-red-400/15 hover:bg-red-400/25 text-red-400 rounded-xl font-medium transition-all">
                  <Square size={15} /> Stop
                </button>
              )}
            </div>
          </div>

          {/* Session History */}
          <div className="card p-4">
            <h3 className="font-medium text-surface-50 mb-3 flex items-center gap-2">
              <Clock size={15} className="text-brand-400" /> Sessions
            </h3>
            {task.sessions.length === 0 ? (
              <p className="text-sm text-surface-400">No sessions yet</p>
            ) : (
              <div className="space-y-2">
                {task.sessions.slice().reverse().map((session, i) => (
                  <div key={session.id} className="flex justify-between text-sm">
                    <span className="text-surface-400">Session {task.sessions.length - i}</span>
                    <span className="text-surface-50 timer-display">{formatDuration(session.activeTime)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-surface-800 mt-3 pt-3 flex justify-between">
              <span className="text-sm text-surface-300">Total</span>
              <span className="text-sm font-medium text-brand-400 timer-display">{formatHours(task.totalTime)}</span>
            </div>
          </div>
        </div>

        {/* Right: Subtasks + Journal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subtasks */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-surface-50">Subtasks</h3>
              {task.subtasks.length > 0 && (
                <span className="text-sm text-surface-400">
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                </span>
              )}
            </div>

            {task.subtasks.length > 0 && (
              <div className="h-1.5 bg-surface-800 rounded-full mb-4 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  animate={{ width: `${subtaskProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            <div className="space-y-2 mb-3">
              {task.subtasks.map(st => (
                <motion.div
                  key={st.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-800/50 group"
                >
                  <button onClick={() => toggleSubtask(task.id, st.id, !st.completed)}>
                    {st.completed
                      ? <CheckCircle size={18} className="text-emerald-400" />
                      : <Circle size={18} className="text-surface-500 hover:text-surface-50" />}
                  </button>
                  <span className={`flex-1 text-sm ${st.completed ? 'line-through text-surface-500' : 'text-surface-50'}`}>
                    {st.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(task.id, st.id)}
                    className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Add subtask..."
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
              />
              <button type="submit" className="btn-primary px-3 py-2">
                <Plus size={16} />
              </button>
            </form>
          </div>

          {/* Journal */}
          <div className="card p-5">
            <h3 className="font-medium text-surface-50 mb-4">Journal Entry</h3>
            <textarea
              className="input resize-none h-28 text-sm mb-3"
              placeholder="Write your thoughts, progress, blockers..."
              value={journalText}
              onChange={e => setJournalText(e.target.value)}
            />
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm text-surface-300">Mood:</span>
              {[1, 2, 3, 4, 5].map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`text-xl transition-transform ${mood >= m ? 'scale-125' : 'opacity-40'}`}
                >
                  {['😔', '😐', '🙂', '😊', '🔥'][m - 1]}
                </button>
              ))}
            </div>
            <button onClick={handleAddJournal} disabled={!journalText.trim()} className="btn-primary w-full">
              Save Journal Entry
            </button>
          </div>

          {/* Past Journals */}
          {taskJournals.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-surface-300 text-sm">Previous Entries</h3>
              {taskJournals.map(j => (
                <motion.div
                  key={j.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-surface-400">
                      {new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xl">{['😔', '😐', '🙂', '😊', '🔥'][j.mood - 1]}</span>
                  </div>
                  <p className="text-sm text-surface-200">{j.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
