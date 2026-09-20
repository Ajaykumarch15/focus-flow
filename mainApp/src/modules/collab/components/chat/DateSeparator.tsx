import { useMemo } from 'react';

interface DateSeparatorProps {
  date: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const label = useMemo(() => formatDate(date), [date]);

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-surface-700" />
      <span className="text-[11px] font-medium text-surface-500 select-none">{label}</span>
      <div className="flex-1 h-px bg-surface-700" />
    </div>
  );
}
