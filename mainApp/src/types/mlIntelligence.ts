// Phase 7: Personal ML Intelligence Types & Profiles

export type ModelConfidence = 'learning' | 'low' | 'medium' | 'high';

export interface MLPredictionDuration {
  predictedMinutes: number;
  confidence: ModelConfidence;
  confidenceScore: number; // 0 to 1
  predictionRange: { minMins: number; maxMins: number };
  historicalAverageMins?: number;
  dataPointsUsed: number;
  modelVersion: string;
}

export interface MLPredictionCompletion {
  completionProbability: number; // 0 to 1
  confidence: ModelConfidence;
  factors: string[]; // e.g. ["Morning peak productivity", "Urgent priority"]
}

export interface MLSlotRecommendation {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  score: number;     // 0 to 1
  confidence: ModelConfidence;
  reason: string;
}

export interface MLDeadlineRisk {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceScore: number; // 0 to 1
  remainingWorkMins: number;
  availableTimeMins: number;
  shortfallMins: number;
}

export interface MLPersonalProfile {
  totalTasksAnalyzed: number;
  totalSessionsAnalyzed: number;
  totalSchedulesAnalyzed: number;
  overallCompletionRate: number; // 0 to 1
  overallEstimateBiasRatio: number; // actual / planned e.g. 1.24
  hourlyProductivity: Record<number, number>; // hour (0-23) -> completion rate or score
  weekdayProductivity: Record<number, number>; // day (0-6) -> completion rate or score
  categoryBiasRatio: Record<string, number>; // category -> bias ratio e.g. { "Work": 1.15 }
  preferredHours: number[]; // e.g. [9, 10, 11]
  avoidedHours: number[];   // e.g. [14, 15]
  recommendationAcceptanceRate: number;
  learningPhase: 'cold_start' | 'transition' | 'personalized' | 'mature';
  lastUpdated: string;
}

export type ModelStatus = 'COLD_START' | 'LEARNING' | 'PERSONALIZED' | 'MATURE' | 'INSUFFICIENT_DATA';

export interface MLPredictionOutcomeRecord {
  id: string;
  predictionType: 'duration' | 'completion' | 'deadline_risk' | 'slot';
  taskId?: string;
  predictedValue: number; // e.g. predictedMinutes or completionProbability
  baselineValue: number;  // e.g. unweighted estimate or global average
  confidence: ModelConfidence;
  modelVersion: string;
  featureVersion: string;
  timestamp: number;
  actualOutcome?: number; // e.g. actual worked minutes or 1/0 completed
  error?: number;         // actual - predicted
  baselineError?: number; // actual - baseline
}

export interface MLExplicitPreference {
  id: string;
  key: string; // e.g. "no_schedules_after_hour"
  value: any;  // e.g. 20 (8 PM)
  priority: 'must_respect' | 'preferred';
}

export interface MLModelMetrics {
  durationMAE: number;         // Mean Absolute Error for duration predictions
  baselineDurationMAE: number; // Baseline Mean Absolute Error
  durationRMSE: number;
  completionAccuracy: number;  // 0 to 1
  recommendationAcceptanceRate: number; // 0 to 1
  successfulRecommendationRate: number;
  scheduleAdherenceRate: number;
  modelVersion: string;
  trainedAt: string;
  trainingExampleCount: number;
}

export interface MLFeedbackItem {
  id: string;
  predictionType: 'duration' | 'time_slot' | 'plan_my_day';
  taskId?: string;
  rating: 'thumbs_up' | 'thumbs_down' | 'too_short' | 'about_right' | 'too_long';
  notes?: string;
  createdAt: number;
}
