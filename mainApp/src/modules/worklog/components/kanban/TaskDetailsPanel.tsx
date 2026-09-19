import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MessageSquare, Link2, Trash2, ChevronDown, ChevronUp, Pencil, Plus, CheckCircle2, Flag, Tag, Users, ListChecks, Paperclip } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';

import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
import { useKanbanStore } from './kanbanStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';

import { canEditTask } from './taskPermissions';
import { KANBAN_COLUMNS } from './types';
import type { KanbanStatus, KanbanPriority } from './types';


const PRIORITY_CONFIG: Record<KanbanPriority, { icon: string; color: string; bg: string }> = {
  low: { icon: '↓', color: 'text-surface-400', bg: 'bg-surface-800' },
  medium: { icon: '→', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  high: { icon: '↑', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  urgent: { icon: '⚡', color: 'text-red-400', bg: 'bg-red-500/10' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  todo: { color: 'text-surface-400', bg: 'bg-surface-800' },
  doing: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  review: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  done: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

export function TaskDetailsPanel() {
  const { tasks, selectedTaskId, showDetailsPanel, closeDetailsPanel, updateTask, deleteTask, toggleSubtask, membersMap } =
    useKanbanStore();
  const assignTask = useCollaborationStore((s) => s.assignTask);

  const task = tasks.find((t) => t.id === selectedTaskId);
  const [depsOpen, setDepsOpen] = useState(false);

  const handleClose = () => {
    closeDetailsPanel();
  };

  const handleDelete = () => {
    if (task) {
      deleteTask(task.id);
      closeDetailsPanel();
    }
  };

  const subtasksDone = task ? task.subtasks.filter((s) => s.completed).length : 0;
  const subtasksTotal = task ? task.subtasks.length : 0;
  const progress = subtasksTotal > 0 ? (subtasksDone / subtasksTotal) * 100 : 0;
  const canEdit = task ? canEditTask(task) : false;

  const priorityConf = task ? PRIORITY_CONFIG[task.priority] : PRIORITY_CONFIG.medium;
  const statusConf = task ? STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo : STATUS_CONFIG.todo;

  return (
    <AnimatePresence>
      {showDetailsPanel && task && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-surface-900 border-l border-surface-800 shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-surface-800/60">
              <div className="flex items-start gap-4">
                {/* Task icon */}
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <ListChecks size={22} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-lg font-bold text-surface-50 leading-tight">
                    {task.title}
                  </h2>
                  <p className="text-xs text-surface-400 mt-1 flex items-center gap-1.5">
                    <Calendar size={11} />
                    Created on {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors flex-shrink-0"
                  aria-label="Close panel"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Description */}
              <div>
                <textarea
                  placeholder="Add a description (optional)..."
                  defaultValue={task.description}
                  onBlur={(e) => updateTask(task.id, { description: e.target.value })}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full bg-surface-850 border border-surface-800 rounded-xl px-4 py-3 text-sm text-surface-300 placeholder:text-surface-500 resize-none outline-none focus:border-brand-500/50 transition-colors disabled:opacity-60"
                />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-400 mb-2">
                    <CheckCircle2 size={13} />
                    Status
                  </label>
                  <div className="relative">
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center ${statusConf.bg}`}>
                      <div className={`w-2 h-2 rounded-full ${statusConf.color.replace('text-', 'bg-')}`} />
                    </div>
                    <Select
                      value={task.status}
                      onChange={(e) => updateTask(task.id, { status: e.target.value as KanbanStatus })}
                      disabled={!canEdit}
                      className="text-xs pl-9"
                    >
                      {KANBAN_COLUMNS.map((col) => (
                        <option key={col.id} value={col.id}>{col.title}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-400 mb-2">
                    <Flag size={13} />
                    Priority
                  </label>
                  <div className="relative">
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${priorityConf.bg} ${priorityConf.color}`}>
                      {priorityConf.icon}
                    </div>
                    <Select
                      value={task.priority}
                      onChange={(e) => updateTask(task.id, { priority: e.target.value as KanbanPriority })}
                      disabled={!canEdit}
                      className="text-xs pl-9"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-400">
                    <Tag size={13} />
                    Labels
                  </label>
                  <button className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
                    <Plus size={12} />
                    Add label
                  </button>
                </div>
                {task.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.labels.map((label) => (
                      <span
                        key={label.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-surface-800 bg-surface-850 text-surface-300"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                        {label.name}
                        {canEdit && (
                          <button className="ml-0.5 text-surface-500 hover:text-surface-300 transition-colors">×</button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-surface-500 italic">No labels added</p>
                )}
              </div>

              {/* Assignees */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-400">
                    <Users size={13} />
                    Assignees {task.assignees.length > 0 && <span className="text-surface-500">({task.assignees.length})</span>}
                  </label>
                  {canEdit && (
                    <button
                      onClick={() => {
                        const currentIds = task.assignees.map((a) => a.id);
                        const memberNames = Object.entries(membersMap)
                          .filter(([id]) => id !== task.ownerId)
                          .map(([id, m]) => `${m.name} (${id.slice(-4)})`)
                          .join('\n');
                        const input = window.prompt(
                          `Current assignees: ${currentIds.length > 0 ? task.assignees.map(a => a.name).join(', ') : 'None'}\n\nEnter member IDs (comma-separated) from:\n${memberNames}`,
                          currentIds.join(', '),
                        );
                        if (input !== null) {
                          const ids = input.split(',').map((s) => s.trim()).filter(Boolean);
                          assignTask(task.id, ids);
                        }
                      }}
                      className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  )}
                </div>
                {task.assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {task.assignees.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 bg-surface-850 border border-surface-800 rounded-xl px-3 py-2">
                        <Avatar name={a.name} src={a.avatar} size="xs" />
                        <span className="text-xs text-surface-300 font-medium uppercase tracking-wide">{a.name}</span>
                        {canEdit && (
                          <button className="text-surface-500 hover:text-surface-300 transition-colors ml-1">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <button className="w-9 h-9 rounded-xl border-2 border-dashed border-surface-700 flex items-center justify-center text-surface-500 hover:border-brand-500/50 hover:text-brand-400 transition-all">
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-surface-500 italic">No assignees</p>
                )}
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-400">
                    <ListChecks size={13} />
                    Subtasks
                  </label>
                  <span className="text-[11px] font-bold text-surface-300">{subtasksDone}/{subtasksTotal}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-800 overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="space-y-1.5">
                  {task.subtasks.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleSubtask(task.id, st.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                        st.completed
                          ? 'bg-surface-850 text-surface-500 line-through'
                          : 'bg-surface-850 border border-surface-800 text-surface-300 hover:border-surface-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                        st.completed ? 'bg-brand-500 border-brand-500' : 'border-surface-600'
                      }`}>
                        {st.completed && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {st.title}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-surface-600 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Add a subtask..."
                    className="flex-1 bg-transparent text-xs text-surface-300 placeholder:text-surface-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        // Subtask add logic handled by store
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                </div>
              </div>

              {/* Dependencies */}
              <div className="border border-surface-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDepsOpen(!depsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-850 hover:bg-surface-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-brand-400" />
                    <span className="text-xs font-semibold text-surface-300">Dependencies</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-surface-800 text-surface-400">
                      {task.dependencies?.length ?? 0}
                    </span>
                  </div>
                  {depsOpen ? <ChevronUp size={14} className="text-surface-500" /> : <ChevronDown size={14} className="text-surface-500" />}
                </button>
                {depsOpen && (
                  <div className="px-4 py-3 border-t border-surface-800">
                    <p className="text-[11px] text-surface-500 mb-3">No dependencies yet — link tasks that must finish first.</p>
                    <div className="flex gap-2">
                      <select className="flex-1 bg-surface-850 border border-surface-800 rounded-lg px-3 py-2 text-xs text-surface-300 outline-none">
                        <option>Choose a task...</option>
                      </select>
                      <Button variant="secondary" size="sm" className="rounded-lg flex-shrink-0">
                        <Plus size={14} />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-surface-500 pt-2">
                <span className="flex items-center gap-1.5 text-xs">
                  <MessageSquare size={13} /> {task.comments} comments
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Paperclip size={13} /> {task.attachments} attachments
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-surface-800/60 bg-surface-900">
              <Button variant="danger" size="sm" onClick={handleDelete} leftIcon={<Trash2 size={14} />} className="rounded-xl">
                Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleClose} className="rounded-xl">
                  Close
                </Button>
                <Button size="sm" className="rounded-xl">
                  Save changes
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
