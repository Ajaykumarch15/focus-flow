import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MessageSquare, Link2, Trash2, ChevronRight } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
import { useKanbanStore } from './kanbanStore';
import { KANBAN_COLUMNS } from './types';
import type { KanbanStatus, KanbanPriority } from './types';

export function TaskDetailsPanel() {
  const { tasks, selectedTaskId, showDetailsPanel, closeDetailsPanel, updateTask, deleteTask, toggleSubtask } =
    useKanbanStore();

  const task = tasks.find((t) => t.id === selectedTaskId);

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

  return (
    <AnimatePresence>
      {showDetailsPanel && task && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-surface-900 border-l border-surface-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-surface-800">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-lg font-bold text-surface-50 leading-tight">
                  {task.title}
                </h2>
                <p className="text-xs text-surface-400 mt-1">Created {new Date(task.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors flex-shrink-0"
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-surface-300 leading-relaxed">{task.description || 'No description provided.'}</p>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5">Status</label>
                  <Select
                    value={task.status}
                    onChange={(e) => updateTask(task.id, { status: e.target.value as KanbanStatus })}
                    className="text-xs"
                  >
                    {KANBAN_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5">Priority</label>
                  <Select
                    value={task.priority}
                    onChange={(e) => updateTask(task.id, { priority: e.target.value as KanbanPriority })}
                    className="text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
              </div>

              {/* Due date */}
              {task.dueDate && (
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5">Due Date</label>
                  <div className="flex items-center gap-2 text-sm text-surface-300">
                    <Calendar size={14} className="text-surface-500" />
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              )}

              {/* Labels */}
              {task.labels.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-2">Labels</label>
                  <div className="flex flex-wrap gap-1.5">
                    {task.labels.map((label) => (
                      <Badge key={label.name} tone="neutral" className="text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: label.color }} />
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignees */}
              {task.assignees.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-2">Assignees</label>
                  <div className="flex items-center gap-2">
                    {task.assignees.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 bg-surface-850 border border-surface-800 rounded-lg px-2.5 py-1.5">
                        <Avatar name={a.name} src={a.avatar} size="xs" />
                        <span className="text-xs text-surface-300 font-medium">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-surface-400">Subtasks</label>
                  <span className="text-[11px] font-bold text-surface-300">{subtasksDone}/{subtasksTotal}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-800 overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="space-y-1.5">
                  {task.subtasks.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleSubtask(task.id, st.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
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
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-surface-500">
                <span className="flex items-center gap-1 text-xs">
                  <MessageSquare size={12} /> {task.comments} comments
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <Link2 size={12} /> {task.attachments} attachments
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-surface-800">
              <Button variant="danger" size="sm" onClick={handleDelete} leftIcon={<Trash2 size={14} />}>
                Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClose} rightIcon={<ChevronRight size={14} />}>
                Close
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
