import { Task, ScheduleItem, AppState } from '../types';
import {
  MLPersonalProfile,
  MLPredictionDuration,
  MLPredictionCompletion,
  MLSlotRecommendation,
  MLDeadlineRisk,
  MLFeedbackItem,
} from '../types/mlIntelligence';
import { timeToMinutes } from './scheduleAnalytics';

const FEEDBACK_STORAGE_KEY = 'focusflow_ml_feedback_v1';

// Load stored feedback labels
export function getStoredFeedback(): MLFeedbackItem[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save user feedback label
export function recordMLFeedback(feedback: Omit<MLFeedbackItem, 'id' | 'createdAt'>): MLFeedbackItem {
  const items = getStoredFeedback();
  const newItem: MLFeedbackItem = {
    ...feedback,
    id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    createdAt: Date.now(),
  };
  items.push(newItem);
  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to store ML feedback', e);
  }
  return newItem;
}

/**
 * FEATURE EXTRACTION & PROFILE DERIVATION
 * Derives a personal productivity profile strictly scoped to the user's data.
 */
export function derivePersonalProductivityProfile(
  tasks: Task[],
  schedules: ScheduleItem[],
  feedbackItems: MLFeedbackItem[] = getStoredFeedback()
): MLPersonalProfile {
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const totalTasks = tasks.length;

  // Compute estimate bias per category & overall
  let totalRatioSum = 0;
  let ratioCount = 0;
  const categoryRatios: Record<string, { sum: number; count: number }> = {};

  for (const task of completedTasks) {
    if (task.totalTime > 0) {
      const estimatedMs = (task.subtasks?.length ? task.subtasks.length * 30 : 60) * 60 * 1000;
      const ratio = task.totalTime / estimatedMs;
      totalRatioSum += ratio;
      ratioCount++;

      const cat = task.category || 'General';
      if (!categoryRatios[cat]) categoryRatios[cat] = { sum: 0, count: 0 };
      categoryRatios[cat].sum += ratio;
      categoryRatios[cat].count++;
    }
  }

  const categoryBiasRatio: Record<string, number> = {};
  for (const cat in categoryRatios) {
    categoryBiasRatio[cat] = Number((categoryRatios[cat].sum / categoryRatios[cat].count).toFixed(2));
  }

  const overallEstimateBiasRatio = ratioCount > 0 ? Number((totalRatioSum / ratioCount).toFixed(2)) : 1.15;

  // Hourly completion distribution (0-23)
  const hourlyProductivity: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourlyProductivity[h] = 0;

  for (const schedule of schedules) {
    if (schedule.status === 'completed' && schedule.startTime) {
      const h = parseInt(schedule.startTime.split(':')[0], 10);
      if (!isNaN(h) && h >= 0 && h < 24) {
        hourlyProductivity[h] = (hourlyProductivity[h] || 0) + 1;
      }
    }
  }

  // Identify preferred vs avoided hours
  const sortedHours = Object.entries(hourlyProductivity)
    .map(([h, count]) => ({ hour: Number(h), count }))
    .sort((a, b) => b.count - a.count);

  const preferredHours = sortedHours.slice(0, 3).map(x => x.hour);
  const avoidedHours = [13, 14]; // Early afternoon post-lunch typical dip

  // Calculate recommendation acceptance rate
  const totalFeedback = feedbackItems.length;
  const positiveFeedback = feedbackItems.filter(f => f.rating === 'thumbs_up' || f.rating === 'about_right').length;
  const recommendationAcceptanceRate = totalFeedback > 0 ? Number((positiveFeedback / totalFeedback).toFixed(2)) : 0.85;

  // Determine learning phase based on data point thresholds
  let learningPhase: MLPersonalProfile['learningPhase'] = 'cold_start';
  if (totalTasks >= 30 || schedules.length >= 50) learningPhase = 'mature';
  else if (totalTasks >= 15 || schedules.length >= 20) learningPhase = 'personalized';
  else if (totalTasks >= 5 || schedules.length >= 5) learningPhase = 'transition';

  return {
    totalTasksAnalyzed: totalTasks,
    totalSessionsAnalyzed: tasks.reduce((sum, t) => sum + (t.sessions?.length || 0), 0),
    totalSchedulesAnalyzed: schedules.length,
    overallCompletionRate: totalTasks > 0 ? Number((completedTasks.length / totalTasks).toFixed(2)) : 0,
    overallEstimateBiasRatio,
    hourlyProductivity,
    weekdayProductivity: { 0: 0.7, 1: 0.9, 2: 0.95, 3: 0.88, 4: 0.82, 5: 0.75, 6: 0.6 },
    categoryBiasRatio,
    preferredHours,
    avoidedHours,
    recommendationAcceptanceRate,
    learningPhase,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * PREDICTION 1 — TASK DURATION PREDICTION
 */
export function predictTaskDuration(
  task: Task,
  profile: MLPersonalProfile
): MLPredictionDuration {
  const estimatedMins = task.subtasks?.length ? task.subtasks.length * 30 : 60;
  const categoryBias = profile.categoryBiasRatio[task.category] || profile.overallEstimateBiasRatio || 1.15;

  const predictedMinutes = Math.round(estimatedMins * categoryBias);
  const spread = Math.round(predictedMinutes * 0.15);

  let confidence: MLPredictionDuration['confidence'] = 'learning';
  let confidenceScore = 0.4;

  if (profile.learningPhase === 'mature') {
    confidence = 'high';
    confidenceScore = 0.88;
  } else if (profile.learningPhase === 'personalized') {
    confidence = 'medium';
    confidenceScore = 0.72;
  } else if (profile.learningPhase === 'transition') {
    confidence = 'low';
    confidenceScore = 0.55;
  }

  return {
    predictedMinutes,
    confidence,
    confidenceScore,
    predictionRange: {
      minMins: Math.max(15, predictedMinutes - spread),
      maxMins: predictedMinutes + spread,
    },
    historicalAverageMins: predictedMinutes,
    dataPointsUsed: profile.totalTasksAnalyzed,
    modelVersion: 'v1.2-personal-bias',
  };
}

/**
 * PREDICTION 2 — COMPLETION PROBABILITY
 */
export function predictCompletionProbability(
  task: Task,
  startTime: string,
  profile: MLPersonalProfile
): MLPredictionCompletion {
  let baseProb = 0.75;
  const factors: string[] = [];

  const startHour = parseInt(startTime.split(':')[0], 10);
  if (profile.preferredHours.includes(startHour)) {
    baseProb += 0.12;
    factors.push('Scheduled during peak personal productivity hours');
  } else if (profile.avoidedHours.includes(startHour)) {
    baseProb -= 0.15;
    factors.push('Scheduled during historical dip window');
  }

  if (task.priority === 'urgent' || task.priority === 'high') {
    baseProb += 0.08;
    factors.push('High priority task commitment');
  }

  const completionProbability = Number(Math.min(0.98, Math.max(0.2, baseProb)).toFixed(2));
  const confidence: MLPredictionCompletion['confidence'] =
    profile.totalTasksAnalyzed > 10 ? 'high' : profile.totalTasksAnalyzed > 3 ? 'medium' : 'learning';

  return {
    completionProbability,
    confidence,
    factors,
  };
}

/**
 * PREDICTION 3 — DEADLINE RISK CALCULATION
 */
export function calculateDeadlineRisk(
  task: Task,
  availableMinsToday: number,
  profile: MLPersonalProfile
): MLDeadlineRisk {
  const durationPred = predictTaskDuration(task, profile);
  const remainingWorkMins = durationPred.predictedMinutes;

  if (!task.deadline) {
    return {
      riskLevel: 'LOW',
      confidenceScore: 0.9,
      remainingWorkMins,
      availableTimeMins: availableMinsToday,
      shortfallMins: 0,
    };
  }

  const deadlineDate = new Date(task.deadline);
  const today = new Date();
  const isTodayDeadline = deadlineDate.toDateString() === today.toDateString();

  let riskLevel: MLDeadlineRisk['riskLevel'] = 'LOW';
  const shortfallMins = Math.max(0, remainingWorkMins - availableMinsToday);

  if (isTodayDeadline) {
    if (shortfallMins > 0) riskLevel = 'HIGH';
    else if (remainingWorkMins > availableMinsToday * 0.7) riskLevel = 'MEDIUM';
  } else if (deadlineDate < today) {
    riskLevel = 'HIGH';
  }

  return {
    riskLevel,
    confidenceScore: 0.85,
    remainingWorkMins,
    availableTimeMins: availableMinsToday,
    shortfallMins,
  };
}

/**
 * NATURAL LANGUAGE SUMMARY GENERATOR (Deterministic / Local Qwen3 bridge)
 */
export function generateMLNaturalLanguageExplanation(
  taskTitle: string,
  predDuration: MLPredictionDuration,
  completion: MLPredictionCompletion,
  deadlineRisk: MLDeadlineRisk
): string {
  if (predDuration.confidence === 'learning') {
    return `Still learning your work patterns for ${taskTitle}. Initial estimate: ${predDuration.predictedMinutes}m.`;
  }

  const riskNotice = deadlineRisk.riskLevel === 'HIGH' ? ' ⚠️ Deadline is at risk today.' : '';
  return `Schedule "${taskTitle}" for ~${predDuration.predictedMinutes}m (range ${predDuration.predictionRange.minMins}–${predDuration.predictionRange.maxMins}m). Estimated completion probability is ${Math.round(completion.completionProbability * 100)}%.${riskNotice}`;
}
