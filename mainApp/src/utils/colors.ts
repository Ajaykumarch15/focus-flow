export const ACCENT_PRESETS = [
  { name: 'Sky Blue', hex: '#0ea5e9' },
  { name: 'Electric Cyan', hex: '#06b6d4' },
  { name: 'Royal Indigo', hex: '#6366f1' },
  { name: 'Deep Purple', hex: '#8b5cf6' },
  { name: 'Vibrant Pink', hex: '#ec4899' },
  { name: 'Rose Red', hex: '#f43f5e' },
  { name: 'Sunset Amber', hex: '#f97316' },
  { name: 'Golden Sun', hex: '#eab308' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Mint Teal', hex: '#14b8a6' },
  { name: 'Neon Lime', hex: '#84cc16' },
  { name: 'Fuchsia Spark', hex: '#d946ef' },
  { name: 'Crimson Red', hex: '#ef4444' },
  { name: 'Ocean Blue', hex: '#3b82f6' },
  { name: 'Coral Flame', hex: '#ff6b6b' },
  { name: 'Forest Jade', hex: '#059669' },
];

export const TASK_COLORS = ACCENT_PRESETS.map(p => p.hex);

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' },
};

export const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'text-surface-300', bg: 'bg-surface-700/50' },
  active: { label: 'Active', color: 'text-brand-400', bg: 'bg-brand-400/10' },
  paused: { label: 'Paused', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  completed: { label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
};

export const CATEGORIES = [
  'Work', 'Personal', 'Learning', 'Health', 'Finance', 'Creative', 'Social', 'Other'
];

export const MOOD_LABELS: Record<number, string> = {
  1: '😔 Low', 2: '😐 Okay', 3: '🙂 Good', 4: '😊 Great', 5: '🔥 Excellent'
};

export const DEADLINE_CONFIG = {
  overdue: { label: 'Overdue', color: 'text-red-400', bg: 'bg-red-400/15', border: 'border-red-400/30', bar: '#ef4444' },
  'due-today': { label: 'Due Today', color: 'text-orange-400', bg: 'bg-orange-400/15', border: 'border-orange-400/30', bar: '#f97316' },
  'due-soon': { label: 'Due Soon', color: 'text-yellow-400', bg: 'bg-yellow-400/15', border: 'border-yellow-400/30', bar: '#eab308' },
  upcoming: { label: 'Upcoming', color: 'text-brand-400', bg: 'bg-brand-400/15', border: 'border-brand-400/30', bar: 'var(--color-brand-500)' },
};
