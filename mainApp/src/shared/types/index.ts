export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'active' | 'paused' | 'completed';
export type TimerState = 'idle' | 'running' | 'paused';
export type Mood = 1 | 2 | 3 | 4 | 5;

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

export interface TimerSession {
  id: string;
  startTime: number;
  endTime?: number;
  pauseStart?: number;
  totalPauseDuration: number;
  activeTime: number;
  focusScore?: number;
}

export interface JournalEntry {
  id: string;
  taskId: string;
  content: string;
  mood: Mood;
  focusRating: number;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  category: string;
  deadline?: number;
  scheduledDate?: number;
  reminderMinutesBefore?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number | null;
  subtasks: Subtask[];
  sessions: TimerSession[];
  totalTime: number;
  tags: string[];
  labels?: string[];
  color: string;
  order: number;
  roadmapRef?: string;
  phaseRef?: string;
  milestoneRef?: string;
  workspaceContext?: 'personal' | 'work' | 'collab';
}

export interface ThemeSettings {
  mode: 'dark' | 'light';
  accentColor: string;
  fontSize: 'sm' | 'md' | 'lg';
  glassmorphism: boolean;
  animatedBackground: boolean;
  reducedMotion: boolean;
}

export interface SocialLinks {
  website?: string;
  github?: string;
  twitter?: string;
  linkedin?: string;
}

export interface UserProfile {
  name: string;
  avatar?: string;
  bio?: string;
  socialLinks?: SocialLinks;
  dailyGoal: number;
  personalDailyGoal: number;
  timezone: string;
  streak: {
    current: number;
    best: number;
    lastDate: string;
  };
  totalPoints: number;
  leaderboardOptIn: boolean;
}

export interface PublicProfile {
  _id: string;
  name: string;
  avatar?: string;
  bio?: string;
  socialLinks?: SocialLinks;
  joinedAt: string;
  streak: { current: number; best: number };
  totalPoints: number;
  leaderboardOptIn: boolean;
}

export interface ProfileActivityItem {
  type: 'task_completed' | 'session_logged';
  title: string;
  date: string;
  durationMs?: number;
}

export interface ProfileStats {
  totalFocusMs: number;
  tasksCompleted: number;
  sessionsCount: number;
  dailyHours: Record<string, number>;
  recentActivity: ProfileActivityItem[];
  rank?: number | null;
}

export interface AppState {
  tasks: Task[];
  journals: JournalEntry[];
  theme: ThemeSettings;
  profile: UserProfile;
  activeTaskId: string | null;  // Legacy: single active task
  activeTimerState: TimerState; // Legacy: single timer state
  currentSessionStart?: number;
  currentPauseStart?: number;

  // Parallel timer support
  activeTimers: Record<string, TimerState>;  // taskId -> timer state
  activeTaskIds: string[];                    // list of all running task IDs
}

export type ScheduleStatus = 'scheduled' | 'in-progress' | 'completed' | 'missed' | 'cancelled' | 'skipped';
export type ScheduleRecurrence = 'none' | 'daily' | 'weekly' | 'custom';

// Derived schedule state (computed from current time + schedule data)
export type DerivedScheduleState = 'upcoming' | 'starting-soon' | 'ongoing' | 'completed' | 'missed';

export interface ScheduleNotification {
  id: string;
  scheduleId: string;
  taskId: string;
  taskTitle: string;
  type: 'five-minute' | 'start-now' | 'overtime';
  deliveredAt: number;
  dismissed: boolean;
  scheduledStartTime: number;
  /** Absolute end of the scheduled slot (overtime bookkeeping) */
  scheduledEndTime?: number;
}

export interface ScheduleItem {
  _id: string;
  userId: string | { _id: string; name: string; email: string; avatar?: string };
  taskId: Task | string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  status: ScheduleStatus;
  notes?: string;
  recurrence?: ScheduleRecurrence;
  actualTimeMs?: number;
  /** True when the slot is fixed (meeting/appointment) and must not be moved by rescheduling */
  locked?: boolean;
  /** Epoch-ms timestamp of the actual execution start (null until started) */
  actualStartAt?: number | null;
  /** Epoch-ms timestamp of actual completion (null until completed) */
  actualEndAt?: number | null;
  /** Total minutes the slot has been extended via rescheduling */
  extendedMins?: number;
  workspaceId?: string | null;
  projectId?: string | null;
  assignedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleCreatePayload {
  taskId: string;
  userId?: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status?: ScheduleStatus;
  recurrence?: ScheduleRecurrence;
  locked?: boolean;
  actualStartAt?: number | null;
  actualEndAt?: number | null;
  extendedMins?: number;
  workspaceId?: string | null;
  projectId?: string | null;
}

export interface ScheduleUpdatePayload {
  taskId?: string;
  userId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  status?: ScheduleStatus;
  recurrence?: ScheduleRecurrence;
  locked?: boolean;
  actualStartAt?: number | null;
  actualEndAt?: number | null;
  extendedMins?: number;
  /** Server-side audit metadata, attached to schedule.revisions (never applied to fields) */
  revisionMeta?: {
    strategy?: 'shift-all' | 'relocate' | 'shrink' | 'keep-as-is' | 'manual' | 'skip';
    reason?: string;
    items?: Record<string, unknown> | null;
  };
}

// ---------------------------------------------------------------------------
// Intelligent rescheduling (execution-aware)
// ---------------------------------------------------------------------------

export type RescheduleStrategy = 'shift-all' | 'relocate' | 'shrink' | 'keep-as-is';

export interface RescheduleSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export type RescheduleChangeKind = 'extended' | 'shifted' | 'moved' | 'shrunk' | 'unchanged';

export interface RescheduleItemChange {
  scheduleId: string;
  taskTitle: string;
  kind: RescheduleChangeKind;
  from: RescheduleSlot;
  to: RescheduleSlot;
  /** For shrunk items: original and reduced duration in minutes */
  originalMins?: number;
  reducedMins?: number;
}

export interface RescheduleProposal {
  strategy: RescheduleStrategy;
  scheduleId: string;
  extraMinutes: number;
  changes: RescheduleItemChange[];
  /** Human-readable conflicts (e.g. with locked/fixed events). Must be resolved or acknowledged */
  conflicts: string[];
  /** Non-blocking warnings (working-hours overflow, absorbed/unabsorbed minutes, etc.) */
  warnings: string[];
  /** Minutes of extra schedule time added by the extension itself */
  totalExtraMins: number;
  /** True when any resulting slot crosses beyond working hours */
  beyondWorkHours: boolean;
  /** Shrink strategy: minutes absorbed by shrinking other tasks */
  absorbedMins?: number;
  /** Shrink strategy: minutes that could not be absorbed */
  unabsorbedMins?: number;
}
