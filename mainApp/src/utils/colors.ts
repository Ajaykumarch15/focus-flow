export const TASK_COLORS = [
  '#0ea5e9', '#06b6d4', '#8b5cf6', '#ec4899',
  '#f97316', '#22c55e', '#eab308', '#ef4444',
  '#6366f1', '#14b8a6',
];

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
