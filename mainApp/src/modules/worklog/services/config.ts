import type { WorkLogStatus } from '@worklog/services/useWorkLogStore';

export interface WorkLogStatusOption {
  value: WorkLogStatus;
  label: string;
  emoji: string;
  chipClass: string;
  color: string;
  bg: string;
  border: string;
}

export const STATUS_OPTIONS: WorkLogStatusOption[] = [
  { value: 'planning',    label: 'Planning',    emoji: '🗺️', chipClass: 'chip-planning',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { value: 'in-progress', label: 'In Progress', emoji: '⚡',  chipClass: 'chip-in-progress', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  { value: 'reviewing',   label: 'Reviewing',   emoji: '👀',  chipClass: 'chip-review',      color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
  { value: 'blocked',     label: 'Blocked',     emoji: '🚫',  chipClass: 'chip-blocked',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  { value: 'done',        label: 'Done',        emoji: '✅',  chipClass: 'chip-done',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
];

export const STATUS_MAP = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s])
) as Record<WorkLogStatus, WorkLogStatusOption>;

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, `${s.emoji} ${s.label}`])
);

export const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'text-surface-300', bg: 'bg-surface-700/50' },
  active: { label: 'Active', color: 'text-brand-400', bg: 'bg-brand-400/10' },
  paused: { label: 'Paused', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  completed: { label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
};

export const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];

export const MOOD_LABELS = ['Exhausted', 'Meh', 'Okay', 'Good', 'Fired up'];

export const MOOD_LABELS_WITH_EMOJI: Record<number, string> = Object.fromEntries(
  MOOD_EMOJIS.map((emoji, i) => [i + 1, `${emoji} ${MOOD_LABELS[i]}`])
);
