import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Bell } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Priority } from '../../types';
import { TASK_COLORS, CATEGORIES } from '../../utils/colors';

interface CreateTaskModalProps {
  onClose: () => void;
}

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { addTask } = useStore();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    category: 'Work',
    deadline: '',
    reminderMinutesBefore: 0,
    color: TASK_COLORS[0],
    tags: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    addTask({
      title: form.title,
      description: form.description,
      priority: form.priority,
      category: form.category,
      status: 'todo',
      deadline: form.deadline || undefined,
      reminderMinutesBefore: form.deadline ? form.reminderMinutesBefore : undefined,
      color: form.color,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      subtasks: [],
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-surface-900 border border-surface-800 rounded-[22px] p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-extrabold text-surface-50">Create Task</h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
            <input
              className="input h-12 rounded-[14px]"
              placeholder="What are you working on?"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
            <textarea
              className="input resize-none h-24 rounded-[14px] py-3"
              placeholder="Add more details..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-1.5">Priority</label>
              <select
                className="input h-12 rounded-[14px]"
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-1.5">Category</label>
              <select
                className="input h-12 rounded-[14px]"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Deadline</label>
            <input
              type="date"
              className="input h-12 rounded-[14px]"
              value={form.deadline}
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
            />
          </div>

          {form.deadline && (
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-1.5 flex items-center gap-1.5">
                <Bell size={14} /> Remind me
              </label>
              <select
                className="input h-12 rounded-[14px]"
                value={form.reminderMinutesBefore}
                onChange={e => setForm(p => ({ ...p, reminderMinutesBefore: Number(e.target.value) }))}
              >
                <option value={0}>No reminder</option>
                <option value={15}>15 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={1440}>1 day before</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Color Accent</label>
            <div className="flex gap-2.5 flex-wrap">
              {TASK_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, color }))}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110 shadow-md' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Tags (comma separated)</label>
            <input
              className="input h-12 rounded-[14px]"
              placeholder="frontend, bug, v2"
              value={form.tags}
              onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim()}
              className="btn-primary flex-1"
            >
              <Plus size={16} /> Create Task
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
