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
  createdAt: number;
  updatedAt: number;
  subtasks: Subtask[];
  sessions: TimerSession[];
  totalTime: number;
  tags: string[];
  color: string;
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
  pomodoroWork: number;
  pomodoroBreak: number;
  timezone: string;
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
