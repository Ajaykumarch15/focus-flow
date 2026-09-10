import { useState, useRef, useEffect } from 'react';
import { X, Users, ChevronDown } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import { cn } from '@shared/utils/cn';

interface Member {
  id: string;
  name: string;
  avatar?: string;
}

interface TaskFiltersProps {
  members: Member[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function TaskFilters({ members, selectedIds, onToggle, onClear }: TaskFiltersProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
          selectedIds.length > 0
            ? 'border-brand-500/40 text-brand-400 bg-brand-500/10 hover:bg-brand-500/15'
            : 'border-surface-800 text-surface-400 bg-surface-900 hover:border-surface-700 hover:text-surface-300',
        )}
      >
        <Users size={12} />
        Members
        {selectedIds.length > 0 && (
          <span className="ml-0.5 bg-brand-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            {selectedIds.length}
          </span>
        )}
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[220px] bg-surface-900 border border-surface-800 rounded-xl p-1.5 z-50 shadow-xl shadow-black/40">
          <div className="px-2 py-1.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
            Select members
          </div>
          {members.map((m) => {
            const checked = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onToggle(m.id)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors cursor-pointer text-left"
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    checked
                      ? 'bg-brand-500 border-brand-500'
                      : 'border-surface-600',
                  )}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <Avatar name={m.name} src={m.avatar} size="xs" />
                <span className="text-xs text-surface-300 font-medium">{m.name}</span>
              </button>
            );
          })}
          {selectedIds.length > 0 && (
            <>
              <div className="border-t border-surface-800 my-1" />
              <button
                type="button"
                onClick={onClear}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors cursor-pointer text-left"
              >
                <X size={12} className="text-surface-500" />
                <span className="text-xs text-surface-400 font-medium">Clear all</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
