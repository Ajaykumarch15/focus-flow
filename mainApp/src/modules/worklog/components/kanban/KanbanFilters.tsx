import { X, Filter } from 'lucide-react';
import { useKanbanStore } from './kanbanStore';
import { KANBAN_COLUMNS, LABEL_PRESETS } from './types';
import { TaskFilters } from './TaskFilters';

export function KanbanFilters() {
  const { filters, setFilter, clearFilters, membersMap, toggleAssigneeFilter, clearAssigneeFilter } = useKanbanStore();

  const hasActiveFilters =
    filters.status !== 'all' || filters.priority || filters.label || filters.assignees.length > 0;

  const members = Object.entries(membersMap).map(([id, { name, avatar }]) => ({ id, name, avatar }));

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-surface-500 mr-1">
        <Filter size={13} />
        Filters
      </span>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value)}
        className="appearance-none bg-surface-900 border border-surface-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer hover:border-surface-700"
      >
        <option value="all">Status: All</option>
        {KANBAN_COLUMNS.map((col) => (
          <option key={col.id} value={col.id}>{col.title}</option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={(e) => setFilter('priority', e.target.value)}
        className="appearance-none bg-surface-900 border border-surface-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer hover:border-surface-700"
      >
        <option value="">Priority: All</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>

      {/* Label */}
      <select
        value={filters.label}
        onChange={(e) => setFilter('label', e.target.value)}
        className="appearance-none bg-surface-900 border border-surface-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer hover:border-surface-700"
      >
        <option value="">Label: All</option>
        {LABEL_PRESETS.map((l) => (
          <option key={l.name} value={l.name}>{l.name}</option>
        ))}
      </select>

      {/* Members (multi-select) */}
      <TaskFilters
        members={members}
        selectedIds={filters.assignees}
        onToggle={toggleAssigneeFilter}
        onClear={clearAssigneeFilter}
      />

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
}
