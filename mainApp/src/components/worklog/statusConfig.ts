import { WorkLogStatus } from '../../store/useWorkLogStore';

export const STATUS_OPTIONS: { value: WorkLogStatus; label: string; chipClass: string; color: string; bg: string }[] = [
  { value: 'planning',    label: '🗺️ Planning',    chipClass: 'chip-planning',    color: 'text-[#2563EB] dark:text-blue-400',    bg: 'bg-[#EEF5FF] dark:bg-blue-500/10' },
  { value: 'in-progress', label: '⚡ In Progress', chipClass: 'chip-in-progress', color: 'text-[#0284C7] dark:text-sky-400',     bg: 'bg-[#E8F5FF] dark:bg-sky-500/10'  },
  { value: 'reviewing',   label: '👀 Reviewing',   chipClass: 'chip-review',      color: 'text-[#7C3AED] dark:text-purple-400',  bg: 'bg-[#F5F3FF] dark:bg-purple-500/10' },
  { value: 'blocked',     label: '🚫 Blocked',     chipClass: 'chip-blocked',     color: 'text-[#DC2626] dark:text-red-400',     bg: 'bg-[#FFF1F2] dark:bg-red-500/10'    },
  { value: 'done',        label: '✅ Done',         chipClass: 'chip-done',        color: 'text-[#059669] dark:text-emerald-400', bg: 'bg-[#ECFDF5] dark:bg-emerald-500/10'},
];

