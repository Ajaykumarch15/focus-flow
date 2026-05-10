import { WorkLogStatus } from '../../store/useWorkLogStore';

export const STATUS_OPTIONS: { value: WorkLogStatus; label: string; color: string; bg: string }[] = [
  { value: 'planning',    label: '🗺️ Planning',    color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { value: 'in-progress', label: '⚡ In Progress', color: 'text-brand-400',  bg: 'bg-brand-400/10'  },
  { value: 'reviewing',   label: '👀 Reviewing',   color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { value: 'blocked',     label: '🚫 Blocked',     color: 'text-red-400',    bg: 'bg-red-400/10'    },
  { value: 'done',        label: '✅ Done',         color: 'text-emerald-400',bg: 'bg-emerald-400/10'},
];
