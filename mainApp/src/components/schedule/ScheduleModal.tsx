import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, AlertTriangle, Sparkles, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useScheduleStore, getTodayDateString } from '../../store/useScheduleStore';
import { toast } from '../../store/useToastStore';
import { Priority, ScheduleItem } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { timeToMinutes, formatMinutes } from '../../utils/scheduleAnalytics';
import { mlApi, type DurationPrediction } from '../../utils/mlApi';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to convert minutes from midnight to "HH:mm"
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Format "HH:mm" to 12-hr label
function formatTime12(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export function ScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
  const { tasks, addTask } = useStore();
  const {
    selectedDate,
    preselectedTaskId,
    editingSchedule,
    schedules,
    createSchedule,
    updateSchedule,
  } = useScheduleStore();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [date, setDate] = useState<string>(selectedDate || getTodayDateString());
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:30');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictData, setConflictData] = useState<{ conflicting: ScheduleItem; warning: string } | null>(null);
  const [deadlineWarning, setDeadlineWarning] = useState<string | null>(null);
  const [mlPrediction, setMlPrediction] = useState<DurationPrediction | null>(null);

  // Form state for New Task mode
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newCategory, setNewCategory] = useState('Work');
  const [newDeadline, setNewDeadline] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#0ea5e9');

  const incompleteTasks = tasks.filter((t) => t.status !== 'completed');

  // Compute target task object
  const currentTaskObj = useMemo(() => {
    if (mode === 'new') return null;
    return tasks.find(t => t.id === selectedTaskId);
  }, [tasks, selectedTaskId, mode]);

  // Fetch ML prediction when task changes
  useEffect(() => {
    if (!currentTaskObj) { setMlPrediction(null); return; }
    let cancelled = false;
    mlApi.predictDuration(currentTaskObj, []).then(pred => {
      if (!cancelled) setMlPrediction(pred);
    }).catch(() => { if (!cancelled) setMlPrediction(null); });
    return () => { cancelled = true; };
  }, [currentTaskObj?.id]);

  useEffect(() => {
    if (isOpen) {
      if (editingSchedule) {
        setMode('existing');
        const taskObj = editingSchedule.taskId as any;
        const tId = typeof taskObj === 'object' ? (taskObj.id || taskObj._id) : taskObj;
        setSelectedTaskId(tId || '');
        setDate(editingSchedule.date);
        setStartTime(editingSchedule.startTime);
        setEndTime(editingSchedule.endTime);
        setNotes(editingSchedule.notes || '');
      } else {
        setMode('existing');
        setDate(selectedDate || getTodayDateString());
        if (preselectedTaskId) {
          setSelectedTaskId(preselectedTaskId);
        } else if (incompleteTasks.length > 0) {
          setSelectedTaskId(incompleteTasks[0].id);
        }
        setStartTime('09:00');
        setEndTime('10:30');
        setNotes('');
      }
      setConflictData(null);
      setDeadlineWarning(null);
    }
  }, [isOpen, preselectedTaskId, editingSchedule, selectedDate]);

  // Compute available smart slot suggestions for the target date
  const smartSlots = useMemo(() => {
    if (!isOpen || !date) return [];

    const daySchedules = schedules.filter(s => s.date === date && s.status !== 'cancelled' && s._id !== editingSchedule?._id);
    const busyIntervals = daySchedules.map(s => ({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime),
    })).sort((a, b) => a.start - b.start);

    // Default working day range: 8:00 (480) to 20:00 (1200)
    const workStart = 8 * 60;
    const workEnd = 20 * 60;
    const slots: { start: string; end: string; durationMins: number }[] = [];

    let current = workStart;
    for (const b of busyIntervals) {
      if (b.start > current && (b.start - current) >= 30) {
        slots.push({
          start: minutesToTime(current),
          end: minutesToTime(b.start),
          durationMins: b.start - current,
        });
      }
      current = Math.max(current, b.end);
    }

    if (workEnd > current && (workEnd - current) >= 30) {
      slots.push({
        start: minutesToTime(current),
        end: minutesToTime(workEnd),
        durationMins: workEnd - current,
      });
    }

    return slots.slice(0, 3);
  }, [isOpen, date, schedules, editingSchedule]);

  // Real-time conflict detection & Deadline checking
  useEffect(() => {
    if (!isOpen || !date || !startTime || !endTime) {
      setConflictData(null);
      setDeadlineWarning(null);
      return;
    }

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (endMin <= startMin) {
      setConflictData(null);
      setDeadlineWarning(null);
      return;
    }

    // Check overlap
    const currentId = editingSchedule?._id;
    const conflicting = schedules.find((s) => {
      if (s._id === currentId) return false;
      if (s.date !== date || s.status === 'cancelled') return false;

      const sStart = timeToMinutes(s.startTime);
      const sEnd = timeToMinutes(s.endTime);
      return startMin < sEnd && endMin > sStart;
    });

    if (conflicting) {
      const taskObj = typeof conflicting.taskId === 'object' ? conflicting.taskId : tasks.find(t => t.id === conflicting.taskId);
      const taskTitle = taskObj?.title || 'Another task';
      setConflictData({
        conflicting,
        warning: `Reacts with "${taskTitle}" (${conflicting.startTime} - ${conflicting.endTime}).`,
      });
    } else {
      setConflictData(null);
    }

    // Check deadline warning
    const deadline = mode === 'new' ? newDeadline : currentTaskObj?.deadline;
    if (deadline && date > deadline) {
      setDeadlineWarning(`Warning: This schedule date (${date}) is after the task deadline (${deadline}).`);
    } else {
      setDeadlineWarning(null);
    }
  }, [date, startTime, endTime, schedules, editingSchedule, isOpen, tasks, mode, newDeadline, currentTaskObj]);

  // Conflict Resolution Action: Move to first available slot
  const handleResolveMove = (slot: { start: string; end: string }) => {
    const plannedDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
    const dur = plannedDuration > 0 ? plannedDuration : 60;
    setStartTime(slot.start);
    setEndTime(minutesToTime(timeToMinutes(slot.start) + dur));
  };

  // Conflict Resolution Action: Shorten to fit before conflict
  const handleResolveShorten = () => {
    if (!conflictData) return;
    const cStart = timeToMinutes(conflictData.conflicting.startTime);
    const startMin = timeToMinutes(startTime);
    if (cStart > startMin && (cStart - startMin) >= 15) {
      setEndTime(minutesToTime(cStart));
    }
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      return;
    }

    setIsSubmitting(true);

    try {
      let targetTaskId = selectedTaskId;

      if (mode === 'new' && !editingSchedule) {
        if (!newTitle.trim()) {
          setIsSubmitting(false);
          return;
        }

        try {
          targetTaskId = await addTask({
            title: newTitle.trim(),
            priority: newPriority,
            category: newCategory,
            deadline: newDeadline || undefined,
            description: newDescription.trim(),
            color: newColor,
            status: 'todo',
            tags: [],
            subtasks: [],
          });
        } catch (taskErr: any) {
          console.error('Failed to create task:', taskErr);
          toast.error('Task creation failed', taskErr?.message || 'Could not create the task. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      if (!targetTaskId) {
        setIsSubmitting(false);
        return;
      }

      let result: ScheduleItem | null = null;
      if (editingSchedule) {
        result = await updateSchedule(editingSchedule._id, {
          taskId: targetTaskId,
          date,
          startTime,
          endTime,
          notes,
        });
      } else {
        result = await createSchedule({
          taskId: targetTaskId,
          date,
          startTime,
          endTime,
          notes,
        });
      }

      if (result) {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Schedule Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl p-6 overflow-hidden my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-surface-800">
            <h2 id="schedule-modal-title" className="text-lg font-semibold text-surface-50 flex items-center gap-2">
              <Calendar size={20} className="text-brand-400" aria-hidden="true" />
              {editingSchedule ? 'Edit Schedule' : 'Schedule Task'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close scheduling modal"
              className="p-1 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Mode Selector (Existing Task vs Create New Task) */}
            {!editingSchedule && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface-950 rounded-xl border border-surface-800" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'existing'}
                  onClick={() => setMode('existing')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    mode === 'existing'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  Existing Task
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'new'}
                  onClick={() => setMode('new')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    mode === 'new'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  + Create New Task
                </button>
              </div>
            )}

            {/* Existing Task Selection */}
            {mode === 'existing' ? (
              <div>
                <label htmlFor="schedule-task-select" className="block text-xs font-medium text-surface-300 mb-1.5">
                  Select Task
                </label>
                {incompleteTasks.length === 0 ? (
                  <div className="p-3 bg-surface-950 rounded-xl text-xs text-surface-400 border border-surface-800">
                    No active tasks available. Switch to &quot;Create New Task&quot; above.
                  </div>
                ) : (
                  <select
                    id="schedule-task-select"
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  >
                    {incompleteTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title} [{task.priority.toUpperCase()}] ({task.category || 'General'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              /* Create New Task Form */
              <div className="space-y-3 p-3 bg-surface-950/70 rounded-xl border border-surface-800/80">
                <div>
                  <label htmlFor="schedule-new-title" className="block text-xs font-medium text-surface-300 mb-1">
                    Task Title *
                  </label>
                  <Input
                    id="schedule-new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="schedule-new-priority" className="block text-xs font-medium text-surface-300 mb-1">
                      Priority
                    </label>
                    <select
                      id="schedule-new-priority"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as Priority)}
                      className="w-full bg-surface-900 border border-surface-800 rounded-xl px-3 py-2 text-xs text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="schedule-new-category" className="block text-xs font-medium text-surface-300 mb-1">
                      Category
                    </label>
                    <Input
                      id="schedule-new-category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="e.g. Work, Study"
                    />
                  </div>
                  <div>
                    <label htmlFor="schedule-new-deadline" className="block text-xs font-medium text-surface-300 mb-1">
                      Deadline
                    </label>
                    <Input
                      id="schedule-new-deadline"
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="schedule-new-desc" className="block text-xs font-medium text-surface-300 mb-1">
                    Description
                  </label>
                  <Textarea
                    id="schedule-new-desc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Task details..."
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="schedule-new-color" className="text-xs font-medium text-surface-300">
                    Color Accent:
                  </label>
                  <input
                    id="schedule-new-color"
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            {/* ML Duration Prediction Callout */}
            {currentTaskObj && mlPrediction && (
              <div className="p-2.5 bg-surface-950 border border-surface-800 rounded-xl text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-400 flex-shrink-0" />
                  <span className="text-surface-300">
                    Historical average duration: <strong className="text-surface-100">{formatMinutes(mlPrediction.predicted_minutes)}</strong>
                    <span className="text-[10px] text-surface-500 ml-1">({mlPrediction.prediction_range.min_mins}–{mlPrediction.prediction_range.max_mins}m range)</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const startMin = timeToMinutes(startTime);
                    setEndTime(minutesToTime(startMin + mlPrediction.predicted_minutes));
                  }}
                  className="text-[10px] font-semibold bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-md transition-colors"
                >
                  Use {formatMinutes(mlPrediction.predicted_minutes)}
                </button>
              </div>
            )}

            {/* Smart Slot Suggestions */}
            {smartSlots.length > 0 && (
              <div className="space-y-1.5 p-2.5 bg-brand-500/5 border border-brand-500/20 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-300">
                  <Sparkles size={14} className="text-brand-400" />
                  <span>Suggested Available Slots</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {smartSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setStartTime(slot.start);
                        const dur = timeToMinutes(endTime) - timeToMinutes(startTime);
                        const targetDur = dur > 0 ? dur : 60;
                        setEndTime(minutesToTime(timeToMinutes(slot.start) + targetDur));
                      }}
                      className="text-[11px] bg-surface-950 hover:bg-surface-800 border border-surface-700/80 px-2.5 py-1 rounded-lg text-surface-200 flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle size={12} className="text-emerald-400" />
                      {formatTime12(slot.start)} – {formatTime12(slot.end)} ({formatMinutes(slot.durationMins)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date & Time Pickers */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="schedule-date" className="block text-xs font-medium text-surface-300 mb-1">
                  Date
                </label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="schedule-start-time" className="block text-xs font-medium text-surface-300 mb-1">
                  Start Time
                </label>
                <Input
                  id="schedule-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="schedule-end-time" className="block text-xs font-medium text-surface-300 mb-1">
                  End Time
                </label>
                <Input
                  id="schedule-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="schedule-notes" className="block text-xs font-medium text-surface-300 mb-1">
                Notes / Goal (Optional)
              </label>
              <Textarea
                id="schedule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specific target for this focus session..."
                rows={2}
              />
            </div>

            {/* Deadline Warning Callout */}
            {deadlineWarning && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                <span>{deadlineWarning}</span>
              </div>
            )}

            {/* Conflict Detection & Resolution Box */}
            {conflictData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 space-y-2"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-red-200">Schedule Conflict</p>
                    <p>{conflictData.warning}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-red-500/20 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold text-red-400">Resolve Conflict:</span>
                  {smartSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleResolveMove(smartSlots[0])}
                      className="px-2 py-1 bg-surface-900 hover:bg-surface-800 border border-surface-700 rounded text-[11px] text-surface-100 transition-colors"
                    >
                      Move to {formatTime12(smartSlots[0].start)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResolveShorten}
                    className="px-2 py-1 bg-surface-900 hover:bg-surface-800 border border-surface-700 rounded text-[11px] text-surface-100 transition-colors"
                  >
                    Shorten to fit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConflictData(null)}
                    className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded text-[11px] transition-colors"
                  >
                    Schedule Anyway
                  </button>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-800">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (mode === 'existing' && !selectedTaskId)}
              >
                {editingSchedule ? 'Update Schedule' : 'Schedule'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
