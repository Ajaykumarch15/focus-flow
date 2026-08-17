export type RoadmapType = 'learning' | 'project' | 'career' | 'certification' | 'interview-prep' | 'personal' | 'custom';
export type RoadmapStatus = 'planning' | 'active' | 'completed' | 'paused' | 'archived';
export type RoadmapPhaseStatus = 'upcoming' | 'active' | 'completed' | 'paused';
export type RoadmapMilestoneStatus = 'todo' | 'in-progress' | 'completed';

export interface RoadmapListItem {
  _id: string;
  userId: string;
  title: string;
  description: string;
  type: RoadmapType;
  startDate?: string;
  targetDate?: string;
  status: RoadmapStatus;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  phaseCount: number;
  milestoneTotal: number;
  milestoneCompleted: number;
  totalTasks: number;
  completedTasks: number;
  totalTime: number;
  progress: number;
}

export interface RoadmapPhaseDoc {
  _id: string;
  userId: string;
  roadmapId: string;
  title: string;
  description: string;
  order: number;
  startDate?: string;
  targetDate?: string;
  status: RoadmapPhaseStatus;
  createdAt: string;
  updatedAt: string;
  milestoneTotal: number;
  milestoneCompleted: number;
  progress: number;
}

export interface RoadmapMilestoneDoc {
  _id: string;
  userId: string;
  roadmapId: string;
  phaseId: string;
  title: string;
  description: string;
  order: number;
  targetDate?: string;
  status: RoadmapMilestoneStatus;
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
}

export interface RoadmapDetail extends RoadmapListItem {
  phases: RoadmapPhaseDoc[];
  milestones: RoadmapMilestoneDoc[];
  tasks: RoadmapTaskSummary[];
}

export interface RoadmapTaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  totalTime: number;
  milestoneRef?: string;
  phaseRef?: string;
  deadline?: string;
}

export const ROADMAP_TYPE_LABELS: Record<RoadmapType, string> = {
  learning: 'Learning',
  project: 'Project',
  career: 'Career',
  certification: 'Certification',
  'interview-prep': 'Interview Prep',
  personal: 'Personal',
  custom: 'Custom',
};

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
  archived: 'Archived',
};

export const ROADMAP_STATUS_COLORS: Record<RoadmapStatus, string> = {
  planning: 'info',
  active: 'brand',
  completed: 'success',
  paused: 'warning',
  archived: 'neutral',
};

export const ROADMAP_ICONS = [
  'Map', 'GraduationCap', 'Rocket', 'Target', 'Trophy',
  'BookOpen', 'Code', 'Briefcase', 'Lightbulb', 'Brain',
  'Palette', 'Globe', 'Heart', 'Star', 'Zap', 'Award',
];

export const ROADMAP_COLORS = [
  '#0ea5e9', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#10b981', '#14b8a6',
  '#84cc16', '#d946ef', '#ef4444', '#3b82f6', '#ff6b6b', '#059669',
];
