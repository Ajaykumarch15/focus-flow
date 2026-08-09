import { useState } from 'react';
import { Link2, Plus, Unlink, AlertTriangle } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { CollaborativeTask } from '../../types/collaboration';
import { Button } from '../ui/Button';

// EEP2-P5.2.2 (s1 panel, DDS §4.9): dependency management surface. Lists the
// resolved dependency tasks (titles + board status), lets an editor add from the
// workspace's tasks (self and already-linked excluded) or unlink any, and shows
// a "Blocked by N" read-out while any dependency is unfinished. Writes the whole
// list atomically via setDependencies — the server re-checks same-project scope
// and rejects cycles, so a rejected add rolls the list back.
interface DependencyPanelProps {
  task: CollaborativeTask;
  dependencies: CollaborativeTask[];
}

export function DependencyPanel({ task, dependencies }: DependencyPanelProps) {
  const { tasks, setDependencies } = useCollaborationStore();
  const [candidateId, setCandidateId] = useState('');

  const blocked = dependencies.filter((d) => d.sprintStatus !== 'done').length;

  const candidates = tasks
    .filter((t) => t.workspaceId === task.workspaceId && t.id !== task.id && !task.dependencies.includes(t.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const addDependency = async () => {
    if (!candidateId) return;
    await setDependencies(task.id, [...task.dependencies, candidateId]);
    setCandidateId('');
  };

  const removeDependency = async (depId: string) => {
    await setDependencies(task.id, task.dependencies.filter((id) => id !== depId));
  };

  return (
    <div data-testid={`dependency-panel-${task.id}`} className="rounded-xl border border-surface-800 bg-surface-900/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display font-extrabold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
          <Link2 size={12} className="text-brand-400" /> Dependencies
        </span>
        <span data-testid={`dependency-count-${task.id}`} className="text-[10px] font-bold text-surface-300">
          {dependencies.length}
        </span>
      </div>

      {dependencies.length === 0 ? (
        <p className="text-[11px] text-surface-500 italic">
          No dependencies yet — link tasks that must finish first.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {dependencies.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-[11px]">
              <Link2 size={12} className="text-surface-500 flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-surface-200">{d.title}</span>
              <span
                data-testid={`dependency-status-${d.id}`}
                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${d.sprintStatus === 'done' ? 'text-emerald-400 bg-emerald-500/10' : 'text-warning-400 bg-warning-500/10'}`}>
                {d.sprintStatus.replace('_', ' ')}
              </span>
              <button
                type="button"
                aria-label={`Remove dependency ${d.title}`}
                onClick={() => removeDependency(d.id)}
                className="text-surface-500 hover:text-danger-400 transition-colors flex-shrink-0">
                <Unlink size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {blocked > 0 && (
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-warning-400">
          <AlertTriangle size={12} /> Blocked by {blocked} unfinished {blocked === 1 ? 'task' : 'tasks'}
        </p>
      )}

      {candidates.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            aria-label="Add dependency"
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className="flex-1 min-w-0 bg-surface-800 border border-surface-700 rounded px-2 py-1 text-[11px] text-surface-100 focus:outline-none focus:border-brand-500">
            <option value="">Choose a task…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <Button type="button" size="xs" onClick={addDependency} leftIcon={<Plus size={12} />}>Add</Button>
        </div>
      )}
    </div>
  );
}
