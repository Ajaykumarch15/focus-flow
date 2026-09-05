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

export interface UserProfile {
  name: string;
  avatar?: string;
  dailyGoal: number;
  timezone: string;
  streak: {
    current: number;
    best: number;
    lastDate: string;
  };
  totalPoints: number;
  leaderboardOptIn: boolean;
}

export interface AppState {
  tasks: Task[];
  journals: JournalEntry[];
  theme: ThemeSettings;
  profile: UserProfile;
  activeTaskId: string | null;
  activeTimerState: TimerState;
  currentSessionStart?: number;
  currentPauseStart?: number;
}

export type ScheduleStatus = 'scheduled' | 'in-progress' | 'completed' | 'missed' | 'cancelled';
export type ScheduleRecurrence = 'none' | 'daily' | 'weekly' | 'custom';

// Derived schedule state (computed from current time + schedule data)
export type DerivedScheduleState = 'upcoming' | 'starting-soon' | 'ongoing' | 'completed' | 'missed';

export interface ScheduleNotification {
  id: string;
  scheduleId: string;
  taskId: string;
  taskTitle: string;
  type: 'five-minute' | 'start-now';
  deliveredAt: number;
  dismissed: boolean;
  scheduledStartTime: number;
}

export interface ScheduleItem {
  _id: string;
  userId: string;
  taskId: Task | string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  status: ScheduleStatus;
  notes?: string;
  recurrence?: ScheduleRecurrence;
  actualTimeMs?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleCreatePayload {
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status?: ScheduleStatus;
  recurrence?: ScheduleRecurrence;
}

export interface ScheduleUpdatePayload {
  taskId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  status?: ScheduleStatus;
  recurrence?: ScheduleRecurrence;
}

