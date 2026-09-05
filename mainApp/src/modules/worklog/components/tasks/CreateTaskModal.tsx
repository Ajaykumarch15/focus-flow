import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Bell } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { Priority } from '@shared/types';
import { TASK_COLORS, CATEGORIES } from '@shared/utils/colors';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Textarea } from '@shared/components/ui/Textarea';

interface CreateTaskModalProps {
  onClose: () => void;
  onAddTask?: (data: any) => Promise<string>;
}

export function CreateTaskModal({ onClose, onAddTask }: CreateTaskModalProps) {
  const storeAddTask = useStore((s) => s.addTask);
  const addTask = onAddTask ?? storeAddTask;
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    category: 'Work',
    deadline: '',
    scheduledDate: '',
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
      scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).getTime() : undefined,
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
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-2">
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
            <Input
              className="h-12 rounded-[14px]"
              placeholder="What are you working on?"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
            <Textarea
              className="resize-none h-24 rounded-[14px] py-3"
              placeholder="Add more details..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-1.5">Priority</label>
              <Select
                className="h-12 rounded-[14px]"
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-1.5">Category</label>
              <Select
                className="h-12 rounded-[14px]"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Deadline</label>
            <Input
              type="date"
              className="h-12 rounded-[14px]"
              value={form.deadline}
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-200 mb-1.5">Scheduled Date</label>
            <Input
              type="date"
              className="h-12 rounded-[14px]"
              value={form.scheduledDate}
              onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))}
            />
            <p className="text-[10px] text-surface-500 mt-1">When do you plan to work on this? Shows on Today's page.</p>
          </div>

          {form.deadline && (
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-1.5 flex items-center gap-1.5">
                <Bell size={14} /> Remind me
              </label>
              <Select
                className="h-12 rounded-[14px]"
                value={form.reminderMinutesBefore}
                onChange={e => setForm(p => ({ ...p, reminderMinutesBefore: Number(e.target.value) }))}
              >
                <option value={0}>No reminder</option>
                <option value={15}>15 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={1440}>1 day before</option>
              </Select>
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
            <Input
              className="h-12 rounded-[14px]"
              placeholder="frontend, bug, v2"
              value={form.tags}
              onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.title.trim()}
              className="flex-1"
              leftIcon={<Plus size={16} />}
            >
              Create Task
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
