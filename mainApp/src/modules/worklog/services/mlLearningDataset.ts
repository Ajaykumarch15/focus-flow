/**
 * Phase 8 — Personal Learning Dataset
 *
 * Derives structured ML training examples from raw Task/Schedule/Session data.
 * Does NOT duplicate raw records — only extracts the features needed for prediction.
 * User data stays local; no raw content (titles, descriptions) is included.
 */

import { Task, ScheduleItem, TimerSession } from '@shared/types';
import { timeToMinutes } from './scheduleAnalytics';

// ─── Storage Keys ────────────────────────────────────────────────────────────
export const LEARNING_DATASET_KEY = 'focusflow_learning_dataset_v1';
export const PREDICTION_OUTCOMES_KEY = 'focusflow_prediction_outcomes_v1';
export const EXPLICIT_PREFS_KEY = 'focusflow_explicit_prefs_v1';
export const MODEL_METRICS_KEY = 'focusflow_model_metrics_v1';
export const MODEL_VERSION_KEY = 'focusflow_model_version_v1';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface LearningExample {
  id: string;
  taskId: string;
  category: string;
  priority: string;
  plannedMinutes: number;
  predictedMinutes: number;
  actualMinutes: number;
  startHour: number;
  endHour: number;
  weekday: number; // 0=Sun, 6=Sat
  deadlineDistanceDays: number; // -1 = no deadline
  postponementCount: number;
  completionStatus: 0 | 1;
  sessionCount: number;
  totalPauseDurationMins: number;
  recommendationShown: boolean;
  recommendationAccepted: boolean;
  recommendationRejected: boolean;
  feedback?: string;
  predictionErrorMins: number; // actual - predicted
  baselineMinutes: number;
  baselineErrorMins: number; // actual - baseline
  createdAt: number;
}

export interface ModelVersion {
  id: string;
  modelType: 'duration' | 'completion' | 'slot';
  version: string; // e.g. 'personal-duration-v2'
  featureVersion: string;
  trainedAt: number;
  trainingExampleCount: number;
  durationMAE?: number;
  baselineDurationMAE?: number;
  completionAccuracy?: number;
}

// ─── Baseline Duration ────────────────────────────────────────────────────────
/**
 * Compute baseline duration estimate from subtask count — no personal learning.
 */
export function computeBaselineMinutes(task: Task): number {
  return task.subtasks?.length ? task.subtasks.length * 30 : 60;
}

// ─── Data Quality Guard ───────────────────────────────────────────────────────
/**
 * Returns true if a session record is considered valid for training.
 * Excludes zero-duration, negative, or obviously corrupted sessions.
 */
export function isValidSession(session: TimerSession): boolean {
  if (!session.endTime) return false;
  const durationMs = session.endTime - session.startTime - (session.totalPauseDuration || 0);
  if (durationMs <= 0) return false;
  if (durationMs > 16 * 60 * 60 * 1000) return false; // > 16h is invalid
  if (session.startTime > Date.now() + 5000) return false; // future start
  return true;
}

/**
 * Returns true if a ScheduleItem is valid for training.
 */
export function isValidScheduleForTraining(s: ScheduleItem): boolean {
  if (!s.startTime || !s.endTime) return false;
  const startM = timeToMinutes(s.startTime);
  const endM = timeToMinutes(s.endTime);
  if (endM <= startM) return false;
  if (s.status === 'cancelled') return false;
  return true;
}

// ─── Build One Training Example ───────────────────────────────────────────────
/**
 * Builds a single LearningExample from a completed task + its schedule record.
 * Returns null if the data is insufficient or invalid.
 */
export function buildLearningExample(
  task: Task,
  schedule: ScheduleItem,
  predictedMinutes: number,
  postponementCount: number = 0,
  recommendationShown: boolean = false,
  recommendationAccepted: boolean = false,
  recommendationRejected: boolean = false,
  feedback?: string
): LearningExample | null {
  if (!isValidScheduleForTraining(schedule)) return null;

  // Compute actual worked time from task sessions
  const validSessions = (task.sessions || []).filter(isValidSession);
  if (validSessions.length === 0 && task.totalTime <= 0) return null;

  const actualMinutes = task.totalTime > 0
    ? Math.round(task.totalTime / 60_000)
    : validSessions.reduce((sum, s) => {
        const durationMs = (s.endTime! - s.startTime) - (s.totalPauseDuration || 0);
        return sum + Math.round(durationMs / 60_000);
      }, 0);

  if (actualMinutes <= 0) return null;

  const baselineMinutes = computeBaselineMinutes(task);
  const plannedMinutes = timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);
  const startHour = parseInt(schedule.startTime.split(':')[0], 10);
  const endHour = parseInt(schedule.endTime.split(':')[0], 10);

  const scheduleDate = new Date(schedule.date + 'T00:00:00');
  const weekday = scheduleDate.getDay();

  let deadlineDistanceDays = -1;
  if (task.deadline) {
    const deadlineDate = new Date(task.deadline);
    deadlineDistanceDays = Math.round(
      (deadlineDate.getTime() - scheduleDate.getTime()) / 86_400_000
    );
  }

  const totalPauseDurationMins = validSessions.reduce(
    (sum, s) => sum + Math.round((s.totalPauseDuration || 0) / 60_000),
    0
  );

  return {
    id: `le_${task.id}_${schedule._id}`,
    taskId: task.id,
    category: task.category || 'General',
    priority: task.priority,
    plannedMinutes,
    predictedMinutes,
    actualMinutes,
    startHour,
    endHour,
    weekday,
    deadlineDistanceDays,
    postponementCount,
    completionStatus: task.status === 'completed' ? 1 : 0,
    sessionCount: validSessions.length,
    totalPauseDurationMins,
    recommendationShown,
    recommendationAccepted,
    recommendationRejected,
    feedback,
    predictionErrorMins: actualMinutes - predictedMinutes,
    baselineMinutes,
    baselineErrorMins: actualMinutes - baselineMinutes,
    createdAt: Date.now(),
  };
}

// ─── Dataset Persistence ──────────────────────────────────────────────────────
export function getStoredLearningExamples(): LearningExample[] {
  try {
    const raw = localStorage.getItem(LEARNING_DATASET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredLearningExamples(examples: LearningExample[]): void {
  try {
    localStorage.setItem(LEARNING_DATASET_KEY, JSON.stringify(examples));
  } catch (e) {
    console.warn('[ML] Failed to persist learning examples', e);
  }
}

/** Add a new example; deduplicates by id */
export function addLearningExample(example: LearningExample): void {
  const existing = getStoredLearningExamples();
  if (existing.some(e => e.id === example.id)) return;
  existing.push(example);
  saveStoredLearningExamples(existing);
}

/** Reset — clears the learning dataset only, NOT raw tasks/sessions/schedules */
export function resetLearningDataset(): void {
  try {
    localStorage.removeItem(LEARNING_DATASET_KEY);
    localStorage.removeItem(PREDICTION_OUTCOMES_KEY);
    localStorage.removeItem(MODEL_METRICS_KEY);
    localStorage.removeItem(MODEL_VERSION_KEY);
  } catch {
    // silent
  }
}

// ─── Model Version Registry ───────────────────────────────────────────────────
export function getModelVersions(): ModelVersion[] {
  try {
    const raw = localStorage.getItem(MODEL_VERSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordModelVersion(mv: ModelVersion): void {
  const versions = getModelVersions();
  const idx = versions.findIndex(v => v.id === mv.id);
  if (idx >= 0) {
    versions[idx] = mv;
  } else {
    versions.push(mv);
  }
  try {
    localStorage.setItem(MODEL_VERSION_KEY, JSON.stringify(versions));
  } catch {
    // silent
  }
}

export function getLatestModelVersion(modelType: ModelVersion['modelType']): ModelVersion | null {
  const versions = getModelVersions().filter(v => v.modelType === modelType);
  if (versions.length === 0) return null;
  return versions.sort((a, b) => b.trainedAt - a.trainedAt)[0];
}
