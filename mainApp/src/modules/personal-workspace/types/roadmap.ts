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
  scheduledDate?: string;
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

// ── ROADMAP GENERATOR TYPES ─────────────────────────────────────────────────

export interface InputJson {
  project: {
    name: string;
    description?: string;
    startDate: string;
    deadline: string;
  };
  schedule: {
    workingDays: string[];
    hoursPerDay: number;
    bufferDays?: number;
  };
  rules?: {
    includeRevision?: boolean;
    includePractice?: boolean;
    includeProjects?: boolean;
    includeQuiz?: boolean;
    includeSubtasks?: boolean;
    defaultSubtaskCount?: number;
    defaultTaskHours?: number;
    milestoneGroupSize?: number;
  };
  phases: Array<{
    name: string;
    description?: string;
    topics: Array<{
      title: string;
      estimatedHours?: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      subtopics?: string[];
    }>;
  }>;
}

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: number;
  priority: string;
  scheduledDate: string | null;
  deadline: string | null;
  durationDays: number | null;
  order: number;
  tags: string[];
  subtasks: Array<{ title: string; completed: boolean }>;
  dependencies: string[];
}

export interface GeneratedMilestone {
  id: string;
  title: string;
  description: string;
  order: number;
  targetDate: string | null;
  completionCriteria: string[];
  tasks: GeneratedTask[];
}

export interface GeneratedPhase {
  id: string;
  title: string;
  description: string;
  order: number;
  startDate: string | null;
  targetDate: string | null;
  milestones: GeneratedMilestone[];
}

export interface GenerationMetadata {
  generatedAt: string;
  generatorVersion: string;
  inputVersion: string;
}

export interface GeneratorWarning {
  type: 'overload' | 'tight' | 'deadline_conflict' | 'empty_phase';
  severity: 'warning' | 'info' | 'error';
  message: string;
  requiredHours?: number;
  availableHours?: number;
  shortageHours?: number;
  utilization?: number;
  overflowDays?: number;
  lastTaskDeadline?: string;
  phaseId?: string;
  phaseTitle?: string;
}

export interface GeneratedPlan {
  roadmap: {
    title: string;
    description: string;
    startDate: string;
    targetDate: string;
    status: string;
    icon: string;
    color: string;
    type: string;
  };
  phases: GeneratedPhase[];
  warnings: GeneratorWarning[];
  stats: {
    totalPhases: number;
    totalMilestones: number;
    totalTasks: number;
    totalEstimatedHours: number;
    totalWorkingDays: number;
    availableHours: number;
    bufferDays: number;
    utilization: number;
    hoursByType: Record<string, number>;
  };
  generationMetadata: GenerationMetadata;
}

export const TASK_TYPE_LABELS: Record<string, string> = {
  learning: 'Learning',
  practice: 'Practice',
  quiz: 'Quiz',
  revision: 'Revision',
  project: 'Project',
  review: 'Review',
};

export const TASK_TYPE_COLORS: Record<string, string> = {
  learning: 'info',
  practice: 'success',
  quiz: 'warning',
  revision: 'brand',
  project: 'danger',
  review: 'neutral',
};
