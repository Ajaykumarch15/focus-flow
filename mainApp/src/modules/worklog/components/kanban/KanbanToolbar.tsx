import { Search, LayoutList, LayoutGrid, CalendarDays, MoreHorizontal } from 'lucide-react';
import { useKanbanStore } from './kanbanStore';
import { cn } from '@shared/utils/cn';
import type { KanbanView } from './types';

const VIEW_OPTIONS: { id: KanbanView; label: string; icon: typeof Search }[] = [
  { id: 'list', label: 'List', icon: LayoutList },
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export function KanbanToolbar() {
  const { searchQuery, setSearch, activeView, setActiveView } = useKanbanStore();

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
        <input
          type="text"
          placeholder="Search any task..."
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 outline-none transition-colors placeholder:text-surface-500"
        />
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 bg-surface-900 border border-surface-800 rounded-xl p-1">
        {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              activeView === id
                ? 'bg-surface-800 text-surface-50 shadow-sm'
                : 'text-surface-500 hover:text-surface-300',
            )}
            aria-label={`${label} view`}
            aria-pressed={activeView === id}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* More options */}
      <button
        type="button"
        className="p-2.5 rounded-xl text-surface-500 hover:text-surface-300 hover:bg-surface-800 border border-surface-800 transition-colors"
        aria-label="More options"
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
