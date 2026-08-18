/**
 * Phase 8 — Adaptive Intelligence Engine
 *
 * Builds on Phase 7 mlIntelligenceEngine.ts.
 * Adds:
 *  - Exponentially weighted recent behavior
 *  - Category-specific learning
 *  - Time-of-day learning
 *  - Baseline vs personal comparison
 *  - Personalization weight blending (0%→mature)
 *  - Prediction outcome storage & error calculation
 *  - Slot scoring with preference + feedback awareness
 *  - Model drift detection
 *  - Daily learning job (lightweight end-of-day update)
 *  - Model evaluation (MAE, RMSE, acceptance rate, schedule adherence)
 *  - Daily insight generation (data-backed, not motivational fluff)
 *  - Weekly summary generation
 *  - Explicit user preferences (hard constraints)
 *  - Cold-start failsafe — all functions return safe defaults if data is thin
 */

import { Task, ScheduleItem } from '../types';
import {
  MLPredictionDuration,
  MLPredictionCompletion,
  MLSlotRecommendation,
  MLPredictionOutcomeRecord,
  MLExplicitPreference,
  MLModelMetrics,
  ModelStatus,
  ModelConfidence,
} from '../types/mlIntelligence';
import {
  LearningExample,
  computeBaselineMinutes,
  getStoredLearningExamples,
  buildLearningExample,
  addLearningExample,
  getLatestModelVersion,
  recordModelVersion,
  PREDICTION_OUTCOMES_KEY,
  EXPLICIT_PREFS_KEY,
  MODEL_METRICS_KEY,
} from './mlLearningDataset';

// ─── Exponential Decay Weight ─────────────────────────────────────────────────
const EWA_ALPHA = 0.15; // recent examples matter more; lower = smoother

function exponentialWeightedAverage(values: number[], alpha = EWA_ALPHA): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  let ewa = values[0];
  for (let i = 1; i < values.length; i++) {
    ewa = alpha * values[i] + (1 - alpha) * ewa;
  }
  return ewa;
}

// ─── Personalization Weight ───────────────────────────────────────────────────
/** Returns a weight 0→1 that scales how much personal data influences the prediction */
function personalizationWeight(exampleCount: number): number {
  if (exampleCount < 3) return 0;
  if (exampleCount < 8) return 0.15;
  if (exampleCount < 15) return 0.35;
  if (exampleCount < 30) return 0.60;
  if (exampleCount < 60) return 0.80;
  return 0.92;
}

// ─── Model Status ─────────────────────────────────────────────────────────────
export function deriveModelStatus(exampleCount: number): ModelStatus {
  if (exampleCount === 0) return 'COLD_START';
  if (exampleCount < 5) return 'INSUFFICIENT_DATA';
  if (exampleCount < 15) return 'LEARNING';
  if (exampleCount < 30) return 'PERSONALIZED';
  return 'MATURE';
}

// ─── Category-Specific Statistics ────────────────────────────────────────────
export interface CategoryStats {
  category: string;
  exampleCount: number;
  avgActualMins: number;
  avgPredictedMins: number;
  biasRatio: number; // actual / predicted (> 1 = under-estimated)
  completionRate: number;
  avgStartHour: number;
  postponementRate: number;
}

export function deriveCategoryStats(examples: LearningExample[]): Record<string, CategoryStats> {
  const byCategory: Record<string, LearningExample[]> = {};
  for (const ex of examples) {
    if (!byCategory[ex.category]) byCategory[ex.category] = [];
    byCategory[ex.category].push(ex);
  }

  const result: Record<string, CategoryStats> = {};
  for (const [cat, exs] of Object.entries(byCategory)) {
    if (exs.length < 2) continue; // need at least 2 examples to be meaningful

    const avgActual = exs.reduce((s, e) => s + e.actualMinutes, 0) / exs.length;
    const avgPredicted = exs.reduce((s, e) => s + e.predictedMinutes, 0) / exs.length;
    const completionRate = exs.filter(e => e.completionStatus === 1).length / exs.length;
    const avgStartHour = exs.reduce((s, e) => s + e.startHour, 0) / exs.length;
    const postponementRate = exs.filter(e => e.postponementCount > 0).length / exs.length;

    result[cat] = {
      category: cat,
      exampleCount: exs.length,
      avgActualMins: Math.round(avgActual),
      avgPredictedMins: Math.round(avgPredicted),
      biasRatio: avgPredicted > 0 ? Number((avgActual / avgPredicted).toFixed(3)) : 1.15,
      completionRate: Number(completionRate.toFixed(2)),
      avgStartHour: Number(avgStartHour.toFixed(1)),
      postponementRate: Number(postponementRate.toFixed(2)),
    };
  }
  return result;
}

// ─── Hourly Learning ──────────────────────────────────────────────────────────
export interface HourlyStats {
  hour: number;
  sampleCount: number;
  completionRate: number;
  avgActualMins: number;
  avgPlannedMins: number;
  avgAccuracy: number; // 1 - abs(error)/actual
  postponementRate: number;
}

export function deriveHourlyStats(examples: LearningExample[]): HourlyStats[] {
  const byHour: Record<number, LearningExample[]> = {};
  for (const ex of examples) {
    const h = ex.startHour;
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(ex);
  }

  return Object.entries(byHour).map(([hourStr, exs]) => {
    const hour = Number(hourStr);
    const completionRate = exs.filter(e => e.completionStatus === 1).length / exs.length;
    const avgActualMins = exs.reduce((s, e) => s + e.actualMinutes, 0) / exs.length;
    const avgPlannedMins = exs.reduce((s, e) => s + e.plannedMinutes, 0) / exs.length;
    const avgAccuracy = exs.reduce((s, e) => {
      if (e.actualMinutes <= 0) return s;
      return s + Math.max(0, 1 - Math.abs(e.predictionErrorMins) / e.actualMinutes);
    }, 0) / exs.length;
    const postponementRate = exs.filter(e => e.postponementCount > 0).length / exs.length;

    return {
      hour,
      sampleCount: exs.length,
      completionRate: Number(completionRate.toFixed(2)),
      avgActualMins: Math.round(avgActualMins),
      avgPlannedMins: Math.round(avgPlannedMins),
      avgAccuracy: Number(avgAccuracy.toFixed(2)),
      postponementRate: Number(postponementRate.toFixed(2)),
    };
  }).sort((a, b) => a.hour - b.hour);
}

// ─── Duration Prediction (Adaptive, Weighted) ─────────────────────────────────
/**
 * Blends baseline estimate with personal learning data.
 * Uses exponential weighting on recent examples so recent behavior matters more.
 */
export function adaptivePredictDuration(
  task: Task,
  examples: LearningExample[],
  categoryStats: Record<string, CategoryStats>
): MLPredictionDuration {
  const featureVersion = 'features-v2';
  const baseline = computeBaselineMinutes(task);
  const allCount = examples.length;
  const pWeight = personalizationWeight(allCount);
  const status = deriveModelStatus(allCount);

  // Category-specific examples ordered oldest→newest for EWA
  const catKey = task.category || 'General';
  const catExamples = examples
    .filter(e => e.category === catKey)
    .sort((a, b) => a.createdAt - b.createdAt);

  const globalExamples = examples.sort((a, b) => a.createdAt - b.createdAt);

  // Compute EWA of actual minutes for this category (or global fallback)
  const ewaSource = catExamples.length >= 3 ? catExamples : globalExamples;
  const recentActuals = ewaSource.map(e => e.actualMinutes);
  const ewaActual = recentActuals.length > 0 ? exponentialWeightedAverage(recentActuals) : baseline;

  // Category-specific bias ratio
  const catBias = categoryStats[catKey]?.biasRatio ?? 1.15;
  const catPersonalMins = Math.round(baseline * catBias);

  // Blended prediction
  const blendedPersonal = Math.round(
    (ewaActual * 0.6) + (catPersonalMins * 0.4)
  );
  const predictedMinutes = Math.round(
    baseline * (1 - pWeight) + blendedPersonal * pWeight
  );

  const spread = Math.round(predictedMinutes * 0.15);

  let confidence: ModelConfidence = 'learning';
  let confidenceScore = 0.35;
  if (status === 'MATURE') { confidence = 'high'; confidenceScore = 0.90; }
  else if (status === 'PERSONALIZED') { confidence = 'medium'; confidenceScore = 0.73; }
  else if (status === 'LEARNING') { confidence = 'low'; confidenceScore = 0.52; }

  const latestVersion = getLatestModelVersion('duration');
  const modelVersion = latestVersion?.version ?? 'personal-duration-v1';

  return {
    predictedMinutes,
    confidence,
    confidenceScore,
    predictionRange: {
      minMins: Math.max(10, predictedMinutes - spread),
      maxMins: predictedMinutes + spread,
    },
    historicalAverageMins: Math.round(ewaActual),
    dataPointsUsed: allCount,
    modelVersion,
    // @ts-ignore -- we add extra fields for explainability
    baselineMinutes: baseline,
    featureVersion,
    explanation: buildDurationExplanation(task, confidence, ewaActual, baseline, catExamples.length, pWeight),
  };
}

function buildDurationExplanation(
  task: Task,
  confidence: ModelConfidence,
  ewaActual: number,
  baseline: number,
  catCount: number,
  pWeight: number
): string {
  if (confidence === 'learning' || pWeight < 0.1) {
    return `Still learning your patterns for "${task.category || 'tasks'}". Baseline estimate: ${baseline}m.`;
  }
  if (catCount >= 3) {
    return `Estimated ${Math.round(ewaActual)}m based on your recent history with ${task.category} tasks (${catCount} examples).`;
  }
  return `Estimated ${Math.round(ewaActual)}m based on your general work patterns (${Math.round(pWeight * 100)}% personal weighting).`;
}

// ─── Completion Probability (Adaptive) ───────────────────────────────────────
export function adaptivePredictCompletion(
  task: Task,
  startTime: string,
  examples: LearningExample[],
  hourlyStats: HourlyStats[]
): MLPredictionCompletion {
  let baseProb = 0.72;
  const factors: string[] = [];

  const startHour = parseInt(startTime.split(':')[0], 10);
  const hourStat = hourlyStats.find(h => h.hour === startHour);

  if (hourStat && hourStat.sampleCount >= 3) {
    // Use learned completion rate for this hour instead of raw heuristic
    baseProb = hourStat.completionRate;
    if (hourStat.completionRate > 0.8) {
      factors.push(`Strong historical completion (${Math.round(hourStat.completionRate * 100)}%) at ${startHour}:00`);
    } else if (hourStat.completionRate < 0.55) {
      factors.push(`Low historical completion (${Math.round(hourStat.completionRate * 100)}%) at ${startHour}:00`);
    }
  }

  if (task.priority === 'urgent' || task.priority === 'high') {
    baseProb = Math.min(0.98, baseProb + 0.08);
    factors.push('High priority drives stronger follow-through');
  }

  // Category-specific completion pattern
  const catExamples = examples.filter(e => e.category === (task.category || 'General'));
  if (catExamples.length >= 3) {
    const catRate = catExamples.filter(e => e.completionStatus === 1).length / catExamples.length;
    baseProb = (baseProb + catRate) / 2;
    if (catRate > 0.8) factors.push(`You complete ${task.category} tasks reliably (${Math.round(catRate * 100)}%)`);
  }

  const completionProbability = Number(Math.min(0.98, Math.max(0.15, baseProb)).toFixed(2));
  const count = examples.length;
  const confidence: ModelConfidence =
    count >= 15 ? 'high' : count >= 5 ? 'medium' : count > 0 ? 'low' : 'learning';

  return { completionProbability, confidence, factors };
}

// ─── Slot Scoring ─────────────────────────────────────────────────────────────
export function scoreSlot(
  startTime: string,
  endTime: string,
  task: Task,
  examples: LearningExample[],
  hourlyStats: HourlyStats[],
  explicitPrefs: MLExplicitPreference[]
): MLSlotRecommendation {
  const startHour = parseInt(startTime.split(':')[0], 10);
  let score = 0.5;
  let reason = 'Available slot with no strong signal yet.';

  // 1. Explicit user preferences (hard constraints override score)
  const noAfterHour = explicitPrefs.find(p => p.key === 'no_schedules_after_hour');
  if (noAfterHour && startHour >= Number(noAfterHour.value)) {
    return {
      startTime, endTime,
      score: 0,
      confidence: 'high',
      reason: `Blocked — you prefer no tasks after ${noAfterHour.value}:00.`,
    };
  }

  // 2. Hourly stats from personal history
  const hourStat = hourlyStats.find(h => h.hour === startHour);
  if (hourStat && hourStat.sampleCount >= 3) {
    score = hourStat.completionRate * 0.7 + hourStat.avgAccuracy * 0.3;
    if (hourStat.completionRate > 0.8) {
      reason = `Strong historical completion (${Math.round(hourStat.completionRate * 100)}%) for tasks starting at ${startHour}:00.`;
    } else if (hourStat.completionRate < 0.5) {
      reason = `Lower completion rate (${Math.round(hourStat.completionRate * 100)}%) at ${startHour}:00 — consider another window.`;
    }
  }

  // 3. Category preference
  const catExamples = examples.filter(e => e.category === (task.category || 'General') && e.startHour === startHour);
  if (catExamples.length >= 2) {
    const catCompRate = catExamples.filter(e => e.completionStatus === 1).length / catExamples.length;
    score = (score + catCompRate) / 2;
    if (catCompRate > 0.8) {
      reason = `Your completion rate for ${task.category} at ${startHour}:00 is ${Math.round(catCompRate * 100)}%.`;
    }
  }

  // 4. Deadline urgency bonus
  if (task.deadline) {
    const daysLeft = (task.deadline - Date.now()) / 86_400_000;
    if (daysLeft <= 1) score = Math.min(1.0, score + 0.12);
    else if (daysLeft <= 3) score = Math.min(1.0, score + 0.06);
  }

  // 5. Feedback penalty — reduce score for repeatedly rejected slot types
  const rejectedAtHour = examples.filter(
    e => e.startHour === startHour && e.recommendationRejected && e.category === (task.category || 'General')
  );
  if (rejectedAtHour.length >= 2) {
    score = Math.max(0.05, score - rejectedAtHour.length * 0.06);
    reason = `Score reduced: previous recommendations at ${startHour}:00 for ${task.category} were rejected.`;
  }

  score = Number(Math.min(1, Math.max(0, score)).toFixed(2));

  const sampleBasis = Math.max(hourStat?.sampleCount ?? 0, catExamples.length);
  const confidence: ModelConfidence =
    sampleBasis >= 10 ? 'high' : sampleBasis >= 4 ? 'medium' : sampleBasis >= 1 ? 'low' : 'learning';

  return { startTime, endTime, score, confidence, reason };
}

// ─── Prediction Outcome Storage ───────────────────────────────────────────────
export function getStoredPredictionOutcomes(): MLPredictionOutcomeRecord[] {
  try {
    const raw = localStorage.getItem(PREDICTION_OUTCOMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPredictionOutcome(record: MLPredictionOutcomeRecord): void {
  const outcomes = getStoredPredictionOutcomes();
  const existing = outcomes.findIndex(o => o.id === record.id);
  if (existing >= 0) {
    outcomes[existing] = record;
  } else {
    outcomes.push(record);
  }
  try {
    localStorage.setItem(PREDICTION_OUTCOMES_KEY, JSON.stringify(outcomes));
  } catch {
    // silent
  }
}

/** Resolve an existing prediction with the actual outcome (called end-of-day or on task completion) */
export function resolvePredictionOutcome(
  id: string,
  actualOutcome: number
): MLPredictionOutcomeRecord | null {
  const outcomes = getStoredPredictionOutcomes();
  const record = outcomes.find(o => o.id === id);
  if (!record) return null;
  record.actualOutcome = actualOutcome;
  record.error = actualOutcome - record.predictedValue;
  record.baselineError = actualOutcome - record.baselineValue;
  recordPredictionOutcome(record);
  return record;
}

// ─── Explicit Preferences ─────────────────────────────────────────────────────
export function getExplicitPreferences(): MLExplicitPreference[] {
  try {
    const raw = localStorage.getItem(EXPLICIT_PREFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setExplicitPreference(pref: Omit<MLExplicitPreference, 'id'>): MLExplicitPreference {
  const prefs = getExplicitPreferences();
  const existing = prefs.findIndex(p => p.key === pref.key);
  const newPref: MLExplicitPreference = { ...pref, id: `pref_${pref.key}` };
  if (existing >= 0) {
    prefs[existing] = newPref;
  } else {
    prefs.push(newPref);
  }
  try {
    localStorage.setItem(EXPLICIT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // silent
  }
  return newPref;
}

export function removeExplicitPreference(key: string): void {
  const prefs = getExplicitPreferences().filter(p => p.key !== key);
  try {
    localStorage.setItem(EXPLICIT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // silent
  }
}

// ─── Model Evaluation ─────────────────────────────────────────────────────────
export function computeModelMetrics(examples: LearningExample[]): MLModelMetrics {
  const resolved = examples.filter(e => e.actualMinutes > 0);

  let durationMAE = 0;
  let baselineMAE = 0;
  let durationSumSq = 0;

  if (resolved.length > 0) {
    durationMAE = resolved.reduce((s, e) => s + Math.abs(e.predictionErrorMins), 0) / resolved.length;
    baselineMAE = resolved.reduce((s, e) => s + Math.abs(e.baselineErrorMins), 0) / resolved.length;
    durationSumSq = resolved.reduce((s, e) => s + e.predictionErrorMins ** 2, 0);
  }

  const durationRMSE = resolved.length > 0 ? Math.sqrt(durationSumSq / resolved.length) : 0;
  const completionAccuracy =
    resolved.length > 0
      ? resolved.filter(e => e.completionStatus === 1).length / resolved.length
      : 0;

  const withRec = resolved.filter(e => e.recommendationShown);
  const recommendationAcceptanceRate =
    withRec.length > 0
      ? withRec.filter(e => e.recommendationAccepted).length / withRec.length
      : 0;
  const successfulRec = withRec.filter(e => e.recommendationAccepted && e.completionStatus === 1);
  const successfulRecommendationRate =
    withRec.filter(e => e.recommendationAccepted).length > 0
      ? successfulRec.length / withRec.filter(e => e.recommendationAccepted).length
      : 0;

  const scheduleAdherenceRate =
    resolved.length > 0
      ? resolved.filter(e => Math.abs(e.predictionErrorMins) <= 20).length / resolved.length
      : 0;

  const latestVersion = getLatestModelVersion('duration');
  return {
    durationMAE: Number(durationMAE.toFixed(1)),
    baselineDurationMAE: Number(baselineMAE.toFixed(1)),
    durationRMSE: Number(durationRMSE.toFixed(1)),
    completionAccuracy: Number(completionAccuracy.toFixed(2)),
    recommendationAcceptanceRate: Number(recommendationAcceptanceRate.toFixed(2)),
    successfulRecommendationRate: Number(successfulRecommendationRate.toFixed(2)),
    scheduleAdherenceRate: Number(scheduleAdherenceRate.toFixed(2)),
    modelVersion: latestVersion?.version ?? 'personal-duration-v1',
    trainedAt: new Date().toISOString(),
    trainingExampleCount: resolved.length,
  };
}

export function getStoredModelMetrics(): MLModelMetrics | null {
  try {
    const raw = localStorage.getItem(MODEL_METRICS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveModelMetrics(metrics: MLModelMetrics): void {
  try {
    localStorage.setItem(MODEL_METRICS_KEY, JSON.stringify(metrics));
  } catch {
    // silent
  }
}

// ─── Model Drift Detection ────────────────────────────────────────────────────
export interface DriftReport {
  detected: boolean;
  dimension: 'session_duration' | 'start_hour' | 'completion_rate' | null;
  historicAvg: number;
  recentAvg: number;
  deltaPercent: number;
  message: string;
}

export function detectModelDrift(examples: LearningExample[]): DriftReport {
  const RECENT_WINDOW = 15;
  const DRIFT_THRESHOLD = 0.25; // 25% change is flagged

  if (examples.length < RECENT_WINDOW + 5) {
    return { detected: false, dimension: null, historicAvg: 0, recentAvg: 0, deltaPercent: 0, message: '' };
  }

  const sorted = [...examples].sort((a, b) => a.createdAt - b.createdAt);
  const recent = sorted.slice(-RECENT_WINDOW);
  const historical = sorted.slice(0, -RECENT_WINDOW);

  // Check average session duration drift
  const historicAvg = historical.reduce((s, e) => s + e.actualMinutes, 0) / historical.length;
  const recentAvg = recent.reduce((s, e) => s + e.actualMinutes, 0) / recent.length;
  const delta = Math.abs(recentAvg - historicAvg) / Math.max(historicAvg, 1);

  if (delta > DRIFT_THRESHOLD) {
    const dir = recentAvg < historicAvg ? 'shorter' : 'longer';
    return {
      detected: true,
      dimension: 'session_duration',
      historicAvg: Math.round(historicAvg),
      recentAvg: Math.round(recentAvg),
      deltaPercent: Math.round(delta * 100),
      message: `Your recent focus sessions have become ${dir} (avg ${Math.round(recentAvg)}m vs ${Math.round(historicAvg)}m historically).`,
    };
  }

  return { detected: false, dimension: null, historicAvg: Math.round(historicAvg), recentAvg: Math.round(recentAvg), deltaPercent: Math.round(delta * 100), message: '' };
}

// ─── Daily Learning Job ───────────────────────────────────────────────────────
/**
 * Lightweight end-of-day update. Reconciles completed tasks with schedule records,
 * builds new training examples, records prediction errors, updates model metrics.
 * Safe to call repeatedly — deduplicates by LearningExample id.
 */
export function runDailyLearningJob(
  tasks: Task[],
  schedules: ScheduleItem[]
): { newExamples: number; metrics: MLModelMetrics } {
  let newExamples = 0;
  const completedToday = tasks.filter(t => t.status === 'completed');

  for (const task of completedToday) {
    const taskSchedules = schedules.filter(s => {
      const sid = typeof s.taskId === 'string' ? s.taskId : (s.taskId as any)?._id ?? (s.taskId as any)?.id;
      return sid === task.id && s.status === 'completed';
    });

    for (const schedule of taskSchedules) {
      // Build example with baseline as predicted (before personal model existed)
      const baseline = computeBaselineMinutes(task);
      const example = buildLearningExample(task, schedule, baseline, 0, false, false, false);
      if (example) {
        addLearningExample(example);
        newExamples++;
      }
    }
  }

  // Recompute and persist metrics
  const allExamples = getStoredLearningExamples();
  const metrics = computeModelMetrics(allExamples);
  saveModelMetrics(metrics);

  // Register a new model version if we have enough new data
  const total = allExamples.length;
  if (total >= 5) {
    const versionNum = Math.floor(total / 10) + 1;
    recordModelVersion({
      id: `personal-duration-v${versionNum}`,
      modelType: 'duration',
      version: `personal-duration-v${versionNum}`,
      featureVersion: 'features-v2',
      trainedAt: Date.now(),
      trainingExampleCount: total,
      durationMAE: metrics.durationMAE,
      baselineDurationMAE: metrics.baselineDurationMAE,
      completionAccuracy: metrics.completionAccuracy,
    });
  }

  return { newExamples, metrics };
}

// ─── Daily Insight Generator ──────────────────────────────────────────────────
/**
 * Returns ONE data-backed daily insight. Only returns a non-null insight
 * if there is enough evidence to make a meaningful statement.
 */
export function generateDailyInsight(
  examples: LearningExample[],
  metrics: MLModelMetrics | null,
  drift: DriftReport
): string | null {
  if (examples.length < 5) return null;

  // Drift insight takes priority
  if (drift.detected) return drift.message;

  // Under-estimation pattern
  const underEsts = examples.filter(e => e.predictionErrorMins > 15 && e.actualMinutes > 0);
  if (underEsts.length / examples.length > 0.55) {
    const avgOver = Math.round(underEsts.reduce((s, e) => s + e.predictionErrorMins, 0) / underEsts.length);
    return `You've been underestimating task durations by ~${avgOver}m on average. Schedule extra buffer time.`;
  }

  // Category-specific insight
  const catCounts: Record<string, { total: number; under: number }> = {};
  for (const ex of examples) {
    if (!catCounts[ex.category]) catCounts[ex.category] = { total: 0, under: 0 };
    catCounts[ex.category].total++;
    if (ex.predictionErrorMins > 15) catCounts[ex.category].under++;
  }
  for (const [cat, data] of Object.entries(catCounts)) {
    if (data.total >= 4 && data.under / data.total > 0.6) {
      const bias = Math.round(
        examples.filter(e => e.category === cat && e.predictionErrorMins > 0)
          .reduce((s, e) => s + e.predictionErrorMins, 0) / data.total
      );
      return `You consistently underestimate ${cat} tasks by ~${bias}m. Consider adding buffer when scheduling.`;
    }
  }

  // Peak hours insight
  const byHour: Record<number, { completed: number; total: number }> = {};
  for (const ex of examples) {
    if (!byHour[ex.startHour]) byHour[ex.startHour] = { completed: 0, total: 0 };
    byHour[ex.startHour].total++;
    if (ex.completionStatus === 1) byHour[ex.startHour].completed++;
  }
  const bestHour = Object.entries(byHour)
    .filter(([, d]) => d.total >= 3)
    .sort((a, b) => b[1].completed / b[1].total - a[1].completed / a[1].total)[0];
  if (bestHour) {
    const h = Number(bestHour[0]);
    const rate = Math.round((bestHour[1].completed / bestHour[1].total) * 100);
    return `Your strongest focus window is ${h}:00–${h + 1}:00 with ${rate}% task completion. Schedule deep work here.`;
  }

  // Recommendation acceptance insight
  if (metrics && metrics.trainingExampleCount >= 10) {
    const rate = Math.round(metrics.recommendationAcceptanceRate * 100);
    if (rate < 50) {
      return `Only ${rate}% of scheduling recommendations were accepted. Adjust your preferences for better suggestions.`;
    }
  }

  return null;
}

// ─── Weekly Summary ───────────────────────────────────────────────────────────
export interface WeeklySummary {
  totalWorkedMins: number;
  avgSessionMins: number;
  bestFocusWindow: string;
  estimateAccuracyPercent: number;
  scheduleAdherencePercent: number;
  patternInsight: string | null;
}

export function generateWeeklySummary(examples: LearningExample[]): WeeklySummary | null {
  if (examples.length < 5) return null;

  const oneWeekAgo = Date.now() - 7 * 86_400_000;
  const weekExamples = examples.filter(e => e.createdAt > oneWeekAgo);
  if (weekExamples.length < 3) return null;

  const totalWorkedMins = weekExamples.reduce((s, e) => s + e.actualMinutes, 0);
  const avgSessionMins = Math.round(totalWorkedMins / weekExamples.length);

  // Best focus window
  const byHour: Record<number, { completed: number; total: number }> = {};
  for (const ex of weekExamples) {
    if (!byHour[ex.startHour]) byHour[ex.startHour] = { completed: 0, total: 0 };
    byHour[ex.startHour].total++;
    if (ex.completionStatus === 1) byHour[ex.startHour].completed++;
  }
  const bestHour = Object.entries(byHour)
    .filter(([, d]) => d.total >= 2)
    .sort((a, b) => b[1].completed / b[1].total - a[1].completed / a[1].total)[0];
  const bestFocusWindow = bestHour
    ? `${bestHour[0]}:00 – ${Number(bestHour[0]) + 1}:00`
    : 'Not enough data';

  const accurateOnes = weekExamples.filter(e => Math.abs(e.predictionErrorMins) <= 15);
  const estimateAccuracyPercent = Math.round((accurateOnes.length / weekExamples.length) * 100);
  const adherentOnes = weekExamples.filter(e => Math.abs(e.predictionErrorMins) <= 20);
  const scheduleAdherencePercent = Math.round((adherentOnes.length / weekExamples.length) * 100);

  // Pattern: deep work blocks
  let patternInsight: string | null = null;
  const longSessions = weekExamples.filter(e => e.actualMinutes > 90);
  const shortSessions = weekExamples.filter(e => e.actualMinutes <= 60);
  if (shortSessions.length / weekExamples.length >= 0.7 && weekExamples.length >= 4) {
    patternInsight = 'You perform best when deep-work blocks stay under 60 minutes this week.';
  } else if (longSessions.length >= 2 && longSessions.every(e => e.completionStatus === 1)) {
    patternInsight = 'Long focused sessions (90m+) had a strong completion record this week.';
  }

  return {
    totalWorkedMins,
    avgSessionMins,
    bestFocusWindow,
    estimateAccuracyPercent,
    scheduleAdherencePercent,
    patternInsight,
  };
}
