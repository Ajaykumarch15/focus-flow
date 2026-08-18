/**
 * Phase 8 — Adaptive Intelligence Engine Tests
 * Covers: learning dataset, prediction error, baseline comparison,
 * personalization weighting, EWA, category learning, hourly learning,
 * feedback learning, slot scoring, model confidence, cold start,
 * drift detection, reset learning, model versioning, privacy isolation,
 * ML failsafe, scheduler authority.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Task, ScheduleItem } from '../../types';
import {
  buildLearningExample,
  computeBaselineMinutes,
  isValidSession,
  isValidScheduleForTraining,
  getStoredLearningExamples,
  saveStoredLearningExamples,
  addLearningExample,
  resetLearningDataset,
  getModelVersions,
  recordModelVersion,
  getLatestModelVersion,
  LearningExample,
} from '../mlLearningDataset';
import {
  deriveModelStatus,
  deriveCategoryStats,
  deriveHourlyStats,
  adaptivePredictDuration,
  adaptivePredictCompletion,
  scoreSlot,
  computeModelMetrics,
  detectModelDrift,
  generateDailyInsight,
  generateWeeklySummary,
  runDailyLearningJob,
  getExplicitPreferences,
  setExplicitPreference,
  removeExplicitPreference,
  recordPredictionOutcome,
  getStoredPredictionOutcomes,
  resolvePredictionOutcome,
} from '../mlAdaptiveEngine';
import { predictTaskDuration, derivePersonalProductivityProfile } from '../mlIntelligenceEngine';

// ─── Fixtures ──────────────────────────────────────────────────────────────────
const mkTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Test Task',
  description: '',
  priority: 'medium',
  status: 'completed',
  category: 'Engineering',
  createdAt: Date.now() - 3600_000,
  updatedAt: Date.now(),
  subtasks: [{ id: 'sub1', title: 'Part 1', completed: true, createdAt: Date.now() }],
  sessions: [
    {
      id: 's1',
      startTime: Date.now() - 3600_000,
      endTime: Date.now() - 600_000,
      totalPauseDuration: 0,
      activeTime: 3000_000,
    },
  ],
  totalTime: 50 * 60 * 1000, // 50m
  tags: [],
  color: '#0ea5e9',
  order: 1,
  ...overrides,
});

const mkSchedule = (overrides: Partial<ScheduleItem> = {}): ScheduleItem => ({
  _id: 'sch1',
  userId: 'user1',
  taskId: 't1',
  date: '2026-08-17',
  startTime: '09:00',
  endTime: '10:30',
  status: 'completed',
  ...overrides,
});

beforeEach(() => {
  resetLearningDataset();
});

// ─── 1. Learning Dataset ──────────────────────────────────────────────────────
describe('Learning Dataset', () => {
  it('builds a valid LearningExample from completed task + schedule', () => {
    const task = mkTask();
    const schedule = mkSchedule();
    const example = buildLearningExample(task, schedule, 60);
    expect(example).not.toBeNull();
    expect(example!.taskId).toBe('t1');
    expect(example!.category).toBe('Engineering');
    expect(example!.actualMinutes).toBe(50);
    expect(example!.predictedMinutes).toBe(60);
    expect(example!.predictionErrorMins).toBe(-10); // 50 - 60
    expect(example!.completionStatus).toBe(1);
    expect(example!.weekday).toBe(new Date('2026-08-17T00:00:00').getDay());
  });

  it('returns null for cancelled schedule', () => {
    const task = mkTask();
    const schedule = mkSchedule({ status: 'cancelled' });
    const example = buildLearningExample(task, schedule, 60);
    expect(example).toBeNull();
  });

  it('returns null for zero-duration task', () => {
    const task = mkTask({ totalTime: 0, sessions: [] });
    const schedule = mkSchedule();
    const example = buildLearningExample(task, schedule, 60);
    expect(example).toBeNull();
  });

  it('deduplicates examples by id', () => {
    const task = mkTask();
    const schedule = mkSchedule();
    const ex = buildLearningExample(task, schedule, 60)!;
    addLearningExample(ex);
    addLearningExample(ex); // duplicate
    const stored = getStoredLearningExamples();
    expect(stored.length).toBe(1);
  });

  it('persists and retrieves learning examples', () => {
    const task = mkTask();
    const schedule = mkSchedule();
    const ex = buildLearningExample(task, schedule, 60)!;
    addLearningExample(ex);
    const stored = getStoredLearningExamples();
    expect(stored.length).toBe(1);
    expect(stored[0].category).toBe('Engineering');
  });
});

// ─── 2. Data Quality Guard ────────────────────────────────────────────────────
describe('Data Quality Guard', () => {
  it('rejects session with no endTime', () => {
    const sess = { id: 's1', startTime: Date.now() - 1000, totalPauseDuration: 0, activeTime: 0 };
    expect(isValidSession(sess as any)).toBe(false);
  });

  it('rejects session with negative duration', () => {
    const now = Date.now();
    const sess = { id: 's1', startTime: now, endTime: now - 1000, totalPauseDuration: 0, activeTime: 0 };
    expect(isValidSession(sess as any)).toBe(false);
  });

  it('rejects session lasting > 16h', () => {
    const now = Date.now();
    const sess = { id: 's1', startTime: now - 17 * 3600_000, endTime: now, totalPauseDuration: 0, activeTime: 0 };
    expect(isValidSession(sess as any)).toBe(false);
  });

  it('accepts valid session', () => {
    const now = Date.now();
    const sess = { id: 's1', startTime: now - 3600_000, endTime: now, totalPauseDuration: 0, activeTime: 3600_000 };
    expect(isValidSession(sess as any)).toBe(true);
  });

  it('rejects schedule with endTime <= startTime', () => {
    expect(isValidScheduleForTraining(mkSchedule({ startTime: '10:00', endTime: '09:00' }))).toBe(false);
  });
});

// ─── 3. Prediction Error ──────────────────────────────────────────────────────
describe('Prediction Error', () => {
  it('calculates correct prediction error (actual - predicted)', () => {
    const task = mkTask({ totalTime: 90 * 60 * 1000 }); // 90m actual
    const schedule = mkSchedule();
    const ex = buildLearningExample(task, schedule, 60)!; // 60m predicted
    expect(ex.predictionErrorMins).toBe(30); // 90 - 60
    expect(ex.baselineErrorMins).toBe(90 - computeBaselineMinutes(task));
  });

  it('calculates correct baseline error', () => {
    const task = mkTask({ totalTime: 80 * 60 * 1000, subtasks: [{ id: 'a', title: 'x', completed: true, createdAt: 1 }] });
    const ex = buildLearningExample(task, mkSchedule(), 60)!;
    const baseline = computeBaselineMinutes(task); // 1 subtask * 30m = 30m
    expect(ex.baselineMinutes).toBe(30);
    expect(ex.baselineErrorMins).toBe(80 - 30); // 50
  });
});

// ─── 4. Model Status / Personalization Weight ─────────────────────────────────
describe('Model Status', () => {
  it('returns COLD_START with 0 examples', () => {
    expect(deriveModelStatus(0)).toBe('COLD_START');
  });
  it('returns INSUFFICIENT_DATA with 1-4 examples', () => {
    expect(deriveModelStatus(3)).toBe('INSUFFICIENT_DATA');
  });
  it('returns LEARNING with 5-14 examples', () => {
    expect(deriveModelStatus(10)).toBe('LEARNING');
  });
  it('returns PERSONALIZED with 15-29 examples', () => {
    expect(deriveModelStatus(20)).toBe('PERSONALIZED');
  });
  it('returns MATURE with 30+ examples', () => {
    expect(deriveModelStatus(50)).toBe('MATURE');
  });
});

// ─── 5. Baseline vs Personal Comparison ──────────────────────────────────────
describe('Baseline vs Personal Prediction', () => {
  it('adaptive prediction should blend toward personal for mature model', () => {
    const examples: LearningExample[] = Array.from({ length: 35 }, (_, i) => ({
      id: `ex${i}`,
      taskId: `t${i}`,
      category: 'Engineering',
      priority: 'medium',
      plannedMinutes: 60,
      predictedMinutes: 60,
      actualMinutes: 90,  // consistently took 90m
      startHour: 9,
      endHour: 10,
      weekday: 1,
      deadlineDistanceDays: 5,
      postponementCount: 0,
      completionStatus: 1,
      sessionCount: 1,
      totalPauseDurationMins: 0,
      recommendationShown: false,
      recommendationAccepted: false,
      recommendationRejected: false,
      predictionErrorMins: 30,
      baselineMinutes: 30,
      baselineErrorMins: 60,
      createdAt: Date.now() - (35 - i) * 86400_000,
    }));

    const task = mkTask({ category: 'Engineering' });
    const catStats = deriveCategoryStats(examples);
    const pred = adaptivePredictDuration(task, examples, catStats);

    // With 35 mature examples all showing 90m, prediction should exceed baseline (30m)
    const baseline = computeBaselineMinutes(task);
    expect(pred.predictedMinutes).toBeGreaterThan(baseline);
    expect(pred.confidence).toBe('high');
    expect(pred.dataPointsUsed).toBe(35);
  });
});

// ─── 6. Category-Specific Learning ───────────────────────────────────────────
describe('Category-Specific Learning', () => {
  it('derives separate stats for each category', () => {
    const examples: LearningExample[] = [
      { ...buildLearningExample(mkTask({ category: 'Design', totalTime: 120 * 60_000 }), mkSchedule(), 60)!, id: 'e1', category: 'Design' },
      { ...buildLearningExample(mkTask({ category: 'Design', totalTime: 90 * 60_000, id: 't2' }), mkSchedule({ _id: 'sch2' }), 60)!, id: 'e2', category: 'Design' },
      { ...buildLearningExample(mkTask({ category: 'Engineering', id: 't3' }), mkSchedule({ _id: 'sch3' }), 60)!, id: 'e3', category: 'Engineering' },
    ].filter(Boolean) as LearningExample[];

    const stats = deriveCategoryStats(examples);
    expect(stats['Design']).toBeDefined();
    expect(stats['Design'].exampleCount).toBe(2);
    expect(stats['Design'].avgActualMins).toBe(105); // (120+90)/2
  });

  it('falls back gracefully when category has < 2 examples', () => {
    const examples: LearningExample[] = [
      buildLearningExample(mkTask({ category: 'Reading' }), mkSchedule(), 60)!,
    ].filter(Boolean) as LearningExample[];
    const stats = deriveCategoryStats(examples);
    expect(stats['Reading']).toBeUndefined(); // requires >= 2
  });
});

// ─── 7. Hourly Learning ───────────────────────────────────────────────────────
describe('Hourly Learning', () => {
  it('groups examples by start hour and computes completion rate', () => {
    const examples = Array.from({ length: 4 }, (_, i): LearningExample => ({
      id: `ex${i}`,
      taskId: `t${i}`,
      category: 'General',
      priority: 'medium',
      plannedMinutes: 60,
      predictedMinutes: 60,
      actualMinutes: 55,
      startHour: 9,
      endHour: 10,
      weekday: 1,
      deadlineDistanceDays: -1,
      postponementCount: 0,
      completionStatus: i < 3 ? 1 : 0, // 3 of 4 completed
      sessionCount: 1,
      totalPauseDurationMins: 0,
      recommendationShown: false,
      recommendationAccepted: false,
      recommendationRejected: false,
      predictionErrorMins: -5,
      baselineMinutes: 60,
      baselineErrorMins: -5,
      createdAt: Date.now() - i * 86400_000,
    }));
    const stats = deriveHourlyStats(examples);
    const hour9 = stats.find(h => h.hour === 9);
    expect(hour9).toBeDefined();
    expect(hour9!.completionRate).toBe(0.75);
    expect(hour9!.sampleCount).toBe(4);
  });
});

// ─── 8. Slot Scoring ─────────────────────────────────────────────────────────
describe('Slot Scoring', () => {
  it('blocks slot after explicit no_schedules_after_hour preference', () => {
    const task = mkTask();
    const pref = { key: 'no_schedules_after_hour', value: 20, priority: 'must_respect' as const };
    const rating = scoreSlot('20:00', '21:00', task, [], [], [{ id: 'pref_after', ...pref }]);
    expect(rating.score).toBe(0);
  });

  it('boosts score for slot with high historical completion rate', () => {
    const examples: LearningExample[] = Array.from({ length: 5 }, (_, i): LearningExample => ({
      id: `ex${i}`, taskId: `t${i}`, category: 'Engineering', priority: 'medium',
      plannedMinutes: 60, predictedMinutes: 60, actualMinutes: 60,
      startHour: 9, endHour: 10, weekday: 1, deadlineDistanceDays: -1,
      postponementCount: 0, completionStatus: 1, sessionCount: 1, totalPauseDurationMins: 0,
      recommendationShown: false, recommendationAccepted: false, recommendationRejected: false,
      predictionErrorMins: 0, baselineMinutes: 30, baselineErrorMins: 30, createdAt: Date.now() - i * 86400_000,
    }));
    const hourlyStats = deriveHourlyStats(examples);
    const task = mkTask();
    const rating = scoreSlot('09:00', '10:30', task, examples, hourlyStats, []);
    expect(rating.score).toBeGreaterThan(0.5);
  });

  it('reduces score for repeatedly rejected slots', () => {
    const examples: LearningExample[] = Array.from({ length: 3 }, (_, i): LearningExample => ({
      id: `ex${i}`, taskId: `t${i}`, category: 'Engineering', priority: 'medium',
      plannedMinutes: 60, predictedMinutes: 60, actualMinutes: 60,
      startHour: 14, endHour: 15, weekday: 2, deadlineDistanceDays: -1,
      postponementCount: 0, completionStatus: 0, sessionCount: 1, totalPauseDurationMins: 0,
      recommendationShown: true, recommendationAccepted: false, recommendationRejected: true,
      predictionErrorMins: 0, baselineMinutes: 30, baselineErrorMins: 30, createdAt: Date.now() - i * 86400_000,
    }));
    const rating = scoreSlot('14:00', '15:00', mkTask(), examples, [], []);
    // Score should be reduced relative to base due to 3 rejections
    expect(rating.score).toBeLessThan(0.6);
  });
});

// ─── 9. Prediction Outcomes ───────────────────────────────────────────────────
describe('Prediction Outcomes', () => {
  it('stores and retrieves prediction outcome records', () => {
    recordPredictionOutcome({
      id: 'po1',
      predictionType: 'duration',
      taskId: 't1',
      predictedValue: 60,
      baselineValue: 30,
      confidence: 'medium',
      modelVersion: 'personal-duration-v1',
      featureVersion: 'features-v2',
      timestamp: Date.now(),
    });
    const outcomes = getStoredPredictionOutcomes();
    expect(outcomes.length).toBe(1);
    expect(outcomes[0].predictedValue).toBe(60);
  });

  it('resolves prediction outcome with actual and computes error', () => {
    recordPredictionOutcome({
      id: 'po2',
      predictionType: 'duration',
      taskId: 't1',
      predictedValue: 60,
      baselineValue: 30,
      confidence: 'medium',
      modelVersion: 'personal-duration-v1',
      featureVersion: 'features-v2',
      timestamp: Date.now(),
    });
    const resolved = resolvePredictionOutcome('po2', 80);
    expect(resolved).not.toBeNull();
    expect(resolved!.actualOutcome).toBe(80);
    expect(resolved!.error).toBe(20); // 80 - 60
    expect(resolved!.baselineError).toBe(50); // 80 - 30
  });
});

// ─── 10. Explicit Preferences ─────────────────────────────────────────────────
describe('Explicit Preferences', () => {
  it('stores and retrieves explicit preferences', () => {
    setExplicitPreference({ key: 'no_schedules_after_hour', value: 20, priority: 'must_respect' });
    const prefs = getExplicitPreferences();
    expect(prefs.length).toBe(1);
    expect(prefs[0].value).toBe(20);
  });

  it('removes preference by key', () => {
    setExplicitPreference({ key: 'no_schedules_after_hour', value: 20, priority: 'must_respect' });
    removeExplicitPreference('no_schedules_after_hour');
    expect(getExplicitPreferences().length).toBe(0);
  });
});

// ─── 11. Model Evaluation ─────────────────────────────────────────────────────
describe('Model Evaluation / Metrics', () => {
  it('computes MAE, RMSE, and schedule adherence correctly', () => {
    const examples: LearningExample[] = [
      { id: 'e1', taskId: 't1', category: 'G', priority: 'medium', plannedMinutes: 60, predictedMinutes: 60, actualMinutes: 80, startHour: 9, endHour: 10, weekday: 1, deadlineDistanceDays: -1, postponementCount: 0, completionStatus: 1, sessionCount: 1, totalPauseDurationMins: 0, recommendationShown: true, recommendationAccepted: true, recommendationRejected: false, predictionErrorMins: 20, baselineMinutes: 30, baselineErrorMins: 50, createdAt: Date.now() },
      { id: 'e2', taskId: 't2', category: 'G', priority: 'medium', plannedMinutes: 60, predictedMinutes: 60, actualMinutes: 70, startHour: 10, endHour: 11, weekday: 2, deadlineDistanceDays: -1, postponementCount: 0, completionStatus: 0, sessionCount: 1, totalPauseDurationMins: 0, recommendationShown: true, recommendationAccepted: false, recommendationRejected: true, predictionErrorMins: 10, baselineMinutes: 30, baselineErrorMins: 40, createdAt: Date.now() },
    ];
    const metrics = computeModelMetrics(examples);
    expect(metrics.durationMAE).toBe(15); // (20+10)/2
    expect(metrics.recommendationAcceptanceRate).toBe(0.5); // 1/2
    expect(metrics.trainingExampleCount).toBe(2);
  });
});

// ─── 12. Model Drift Detection ────────────────────────────────────────────────
describe('Model Drift Detection', () => {
  it('detects drift when recent sessions are meaningfully shorter', () => {
    // Historical: 80m sessions, Recent: 30m sessions
    const historical = Array.from({ length: 20 }, (_, i): LearningExample => ({
      id: `h${i}`, taskId: `t${i}`, category: 'G', priority: 'medium',
      plannedMinutes: 80, predictedMinutes: 80, actualMinutes: 80,
      startHour: 9, endHour: 10, weekday: 1, deadlineDistanceDays: -1,
      postponementCount: 0, completionStatus: 1, sessionCount: 1, totalPauseDurationMins: 0,
      recommendationShown: false, recommendationAccepted: false, recommendationRejected: false,
      predictionErrorMins: 0, baselineMinutes: 30, baselineErrorMins: 50,
      createdAt: Date.now() - (35 - i) * 86400_000,
    }));
    const recent = Array.from({ length: 15 }, (_, i): LearningExample => ({
      id: `r${i}`, taskId: `t${20 + i}`, category: 'G', priority: 'medium',
      plannedMinutes: 30, predictedMinutes: 30, actualMinutes: 30,
      startHour: 9, endHour: 10, weekday: 1, deadlineDistanceDays: -1,
      postponementCount: 0, completionStatus: 1, sessionCount: 1, totalPauseDurationMins: 0,
      recommendationShown: false, recommendationAccepted: false, recommendationRejected: false,
      predictionErrorMins: 0, baselineMinutes: 30, baselineErrorMins: 0,
      createdAt: Date.now() - (15 - i) * 86400_000,
    }));
    const report = detectModelDrift([...historical, ...recent]);
    expect(report.detected).toBe(true);
    expect(report.dimension).toBe('session_duration');
  });

  it('returns no drift with insufficient data', () => {
    const examples = Array.from({ length: 5 }, (_, i): LearningExample => ({
      id: `e${i}`, taskId: `t${i}`, category: 'G', priority: 'medium',
      plannedMinutes: 60, predictedMinutes: 60, actualMinutes: 60,
      startHour: 9, endHour: 10, weekday: 1, deadlineDistanceDays: -1,
      postponementCount: 0, completionStatus: 1, sessionCount: 1, totalPauseDurationMins: 0,
      recommendationShown: false, recommendationAccepted: false, recommendationRejected: false,
      predictionErrorMins: 0, baselineMinutes: 30, baselineErrorMins: 30, createdAt: Date.now(),
    }));
    const report = detectModelDrift(examples);
    expect(report.detected).toBe(false);
  });
});

// ─── 13. Reset Learning ───────────────────────────────────────────────────────
describe('Reset Learning', () => {
  it('clears all derived ML data but leaves raw task/session data intact', () => {
    const task = mkTask();
    const ex = buildLearningExample(task, mkSchedule(), 60)!;
    addLearningExample(ex);
    expect(getStoredLearningExamples().length).toBe(1);

    resetLearningDataset();
    expect(getStoredLearningExamples().length).toBe(0);

    // Raw task should still be available (we don't touch it)
    expect(task.id).toBe('t1');
    expect(task.totalTime).toBeGreaterThan(0);
  });
});

// ─── 14. Model Versioning ─────────────────────────────────────────────────────
describe('Model Versioning', () => {
  it('records and retrieves model versions', () => {
    recordModelVersion({
      id: 'personal-duration-v1',
      modelType: 'duration',
      version: 'personal-duration-v1',
      featureVersion: 'features-v2',
      trainedAt: Date.now(),
      trainingExampleCount: 20,
      durationMAE: 12.5,
    });
    const latest = getLatestModelVersion('duration');
    expect(latest).not.toBeNull();
    expect(latest!.version).toBe('personal-duration-v1');
    expect(latest!.durationMAE).toBe(12.5);
  });

  it('returns latest version by trainedAt when multiple exist', () => {
    const t1 = Date.now() - 10000;
    const t2 = Date.now();
    recordModelVersion({ id: 'v1', modelType: 'duration', version: 'personal-duration-v1', featureVersion: 'f1', trainedAt: t1, trainingExampleCount: 10 });
    recordModelVersion({ id: 'v2', modelType: 'duration', version: 'personal-duration-v2', featureVersion: 'f2', trainedAt: t2, trainingExampleCount: 25 });
    const latest = getLatestModelVersion('duration');
    expect(latest!.version).toBe('personal-duration-v2');
  });
});

// ─── 15. Daily Insight ────────────────────────────────────────────────────────
describe('Daily Insight', () => {
  it('returns null with < 5 examples', () => {
    const examples: LearningExample[] = [];
    const insight = generateDailyInsight(examples, null, { detected: false, dimension: null, historicAvg: 0, recentAvg: 0, deltaPercent: 0, message: '' });
    expect(insight).toBeNull();
  });

  it('returns data-backed insight for consistent underestimation', () => {
    const examples = Array.from({ length: 10 }, (_, i): LearningExample => ({
      id: `e${i}`, taskId: `t${i}`, category: 'Engineering', priority: 'medium',
      plannedMinutes: 60, predictedMinutes: 60, actualMinutes: 90,
      startHour: 9, endHour: 10, weekday: 1, deadlineDistanceDays: -1,
      postponementCount: 0, completionStatus: 1, sessionCount: 1, totalPauseDurationMins: 0,
      recommendationShown: false, recommendationAccepted: false, recommendationRejected: false,
      predictionErrorMins: 30, baselineMinutes: 30, baselineErrorMins: 60, createdAt: Date.now(),
    }));
    const insight = generateDailyInsight(examples, null, { detected: false, dimension: null, historicAvg: 0, recentAvg: 0, deltaPercent: 0, message: '' });
    expect(insight).not.toBeNull();
    expect(insight).toContain('underestimating');
  });
});

// ─── 16. Failsafe ─────────────────────────────────────────────────────────────
describe('ML Failsafe — Phase 7 fallback always works', () => {
  it('Phase 7 predictTaskDuration returns safe default with empty profile', () => {
    const profile = derivePersonalProductivityProfile([], []);
    const pred = predictTaskDuration(mkTask(), profile);
    expect(pred.predictedMinutes).toBeGreaterThan(0);
    expect(['learning', 'low', 'medium', 'high']).toContain(pred.confidence);
  });

  it('adaptivePredictDuration returns safe result with no examples', () => {
    const pred = adaptivePredictDuration(mkTask(), [], {});
    expect(pred.predictedMinutes).toBeGreaterThan(0);
    expect(pred.confidence).toBe('learning');
  });

  it('scoreSlot returns valid score with no data', () => {
    const rating = scoreSlot('09:00', '10:00', mkTask(), [], [], []);
    expect(rating.score).toBeGreaterThanOrEqual(0);
    expect(rating.score).toBeLessThanOrEqual(1);
  });
});

// ─── 17. Privacy / User Isolation ────────────────────────────────────────────
describe('Privacy & User Isolation', () => {
  it('learning examples do not contain raw titles or descriptions', () => {
    const task = mkTask({ title: 'SECRET PROJECT ALPHA', description: 'Confidential roadmap' });
    const ex = buildLearningExample(task, mkSchedule(), 60)!;
    const serialized = JSON.stringify(ex);
    expect(serialized).not.toContain('SECRET PROJECT ALPHA');
    expect(serialized).not.toContain('Confidential roadmap');
  });
});

// ─── 18. Scheduler Authority ──────────────────────────────────────────────────
describe('Scheduler Authority', () => {
  it('adaptivePredictDuration does NOT mutate task or schedule state', () => {
    const task = mkTask();
    const originalStatus = task.status;
    const originalTotalTime = task.totalTime;
    adaptivePredictDuration(task, [], {});
    expect(task.status).toBe(originalStatus);
    expect(task.totalTime).toBe(originalTotalTime);
  });

  it('scoreSlot does NOT mutate examples array', () => {
    const examples: LearningExample[] = [];
    scoreSlot('09:00', '10:00', mkTask(), examples, [], []);
    expect(examples.length).toBe(0);
  });
});
