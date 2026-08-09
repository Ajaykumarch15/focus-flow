import { useState } from 'react';
import { Check, ListTodo, Plus, X } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { CollaborativeTask } from '../../types/collaboration';
import { Button } from '../ui/Button';

// EEP2-P5.1.3 (s2 UI): subtask management surface (DDS §4.10). Adds/toggles/
// deletes subtasks on a collaborative task through the collaboration store
// (optimistic with rollback) and renders the x/y progress read-out.
interface SubtaskPanelProps {
  task: CollaborativeTask;
}

export function SubtaskPanel({ task }: SubtaskPanelProps) {
  const { addSubtask, toggleSubtask, deleteSubtask } = useCollaborationStore();
  const [title, setTitle] = useState('');

  const done = task.subtasks.filter((s) => s.completed).length;
  const total = task.subtasks.length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await addSubtask(task.id, trimmed);
    setTitle('');
  };

  return (
    <div data-testid={`subtask-panel-${task.id}`} className="rounded-xl border border-surface-800 bg-surface-900/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display font-extrabold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
          <ListTodo size={12} className="text-brand-400" /> Subtasks
        </span>
        <span data-testid={`subtask-count-${task.id}`} className="text-[10px] font-bold text-surface-300">
          {done}/{total}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-[11px] text-surface-500 italic">
          No subtasks yet — break this task into checkable steps.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {task.subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={s.completed}
                aria-label={`Mark ${s.title} as ${s.completed ? 'not done' : 'done'}`}
                onChange={(e) => toggleSubtask(task.id, s.id, e.target.checked)}
                className="accent-brand-500 h-3.5 w-3.5 flex-shrink-0"
              />
              <span className={`flex-1 min-w-0 truncate ${s.completed ? 'line-through text-surface-500' : 'text-surface-200'}`}>
                {s.completed && <Check size={10} className="inline text-emerald-400 mr-1" />}
                {s.title}
              </span>
              <button
                type="button"
                aria-label={`Delete subtask ${s.title}`}
                onClick={() => deleteSubtask(task.id, s.id)}
                className="text-surface-500 hover:text-danger-400 transition-colors flex-shrink-0">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="New subtask title"
          placeholder="Add a subtask…"
          className="flex-1 min-w-0 bg-surface-800 border border-surface-700 rounded px-2 py-1 text-[11px] text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-brand-500"
        />
        <Button type="submit" size="xs" leftIcon={<Plus size={12} />}>Add</Button>
      </form>
    </div>
  );
}
