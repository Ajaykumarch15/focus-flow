export type FutureGoalCategory = 'career' | 'projects' | 'learning' | 'travel' | 'personal' | 'health' | 'finance' | 'creative' | 'other';
export type FutureGoalStatus = 'someday' | 'considering' | 'active' | 'completed' | 'dropped';
export type FutureGoalPriority = 'low' | 'medium' | 'high';

export interface FutureGoal {
  _id: string;
  userId: string;
  title: string;
  description: string;
  category: FutureGoalCategory;
  status: FutureGoalStatus;
  priority: FutureGoalPriority;
  color: string;
  linkedRoadmapId: string | null;
  lastReviewedAt: string | null;
  remindAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const FUTURE_GOAL_CATEGORY_LABELS: Record<FutureGoalCategory, string> = {
  career: 'Career',
  projects: 'Projects',
  learning: 'Learning',
  travel: 'Travel',
  personal: 'Personal',
  health: 'Health',
  finance: 'Finance',
  creative: 'Creative',
  other: 'Other',
};

export const FUTURE_GOAL_CATEGORY_COLORS: Record<FutureGoalCategory, string> = {
  career: '#3b82f6',
  projects: '#8b5cf6',
  learning: '#06b6d4',
  travel: '#f59e0b',
  personal: '#ec4899',
  health: '#10b981',
  finance: '#6366f1',
  creative: '#f43f5e',
  other: '#64748b',
};

export const FUTURE_GOAL_STATUS_LABELS: Record<FutureGoalStatus, string> = {
  someday: 'Someday',
  considering: 'Considering',
  active: 'Active',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const FUTURE_GOAL_STATUS_TONES: Record<FutureGoalStatus, 'info' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  someday: 'info',
  considering: 'warning',
  active: 'success',
  completed: 'success',
  dropped: 'danger',
};

export const FUTURE_GOAL_PRIORITY_LABELS: Record<FutureGoalPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
