import { useState, useRef, useEffect } from 'react';
import { Settings2, ChevronUp } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface Option {
  value: string;
  label: string;
}

interface FilterGroup {
  label: string;
  options: Option[];
}

interface FilterDropdownProps {
  groups: FilterGroup[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  label?: string;
  className?: string;
}

export function FilterDropdown({
  groups,
  selectedValues,
  onToggle,
  onClear,
  label = 'Filter',
  className,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeCount = selectedValues.length;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 h-10 rounded-xl border text-sm font-medium transition-colors cursor-pointer',
          activeCount > 0
            ? 'border-brand-500/40 text-brand-400 bg-brand-500/10 hover:bg-brand-500/15'
            : 'border-surface-700 text-surface-300 bg-surface-800 hover:border-surface-600 hover:text-surface-200',
        )}
      >
        <Settings2 size={14} />
        {label}
        {activeCount > 0 && (
          <span className="ml-0.5 bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {activeCount}
          </span>
        )}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[220px] bg-surface-900 border border-surface-800 rounded-xl p-3 z-50 shadow-xl shadow-black/40 max-h-[320px] overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="border-t border-surface-800 my-2.5" />}
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.options.map((option) => {
                  const checked = selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onToggle(option.value)}
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
                      <span className="text-sm text-surface-300 font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {activeCount > 0 && (
            <>
              <div className="border-t border-surface-800 my-2.5" />
              <button
                type="button"
                onClick={onClear}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors cursor-pointer text-left"
              >
                <span className="text-xs text-surface-400 font-medium">Clear all filters</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronDown({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
