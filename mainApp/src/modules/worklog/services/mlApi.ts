/**
 * ML API Client — calls the Python FastAPI ML service.
 * Replaces all local TypeScript ML computations.
 */

const ML_BASE = import.meta.env.VITE_ML_API_URL || 'http://localhost:8000';

async function mlFetch<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(`${ML_BASE}${path}`, {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ML API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Types (mirrors Python models) ───────────────────────────────────────────
export interface TaskInput {
  id: string;
  title?: string;
  status?: string;
  category?: string;
  priority?: string;
  total_time?: number;
  deadline?: number | null;
  subtasks?: unknown[];
  sessions?: unknown[];
}

export interface ScheduleInput {
  _id?: string;
  task_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status?: string;
}

export interface LearningExample {
  id: string;
  task_id: string;
  category: string;
  priority: string;
  planned_minutes: number;
  predicted_minutes: number;
  actual_minutes: number;
  start_hour: number;
  end_hour: number;
  weekday: number;
  deadline_distance_days?: number;
  postponement_count?: number;
  completion_status: number;
  session_count?: number;
  total_pause_duration_mins?: number;
  recommendation_shown?: boolean;
  recommendation_accepted?: boolean;
  recommendation_rejected?: boolean;
  feedback?: string;
  prediction_error_mins: number;
  baseline_minutes: number;
  baseline_error_mins: number;
  created_at: number;
}

export interface FeedbackItem {
  id: string;
  prediction_type: string;
  task_id?: string;
  rating: string;
  notes?: string;
  created_at: number;
}

export interface ExplicitPreference {
  id: string;
  key: string;
  value: string;
  priority?: string;
}

export interface PredictionRange {
  min_mins: number;
  max_mins: number;
}

export interface DurationPrediction {
  predicted_minutes: number;
  confidence: string;
  confidence_score: number;
  prediction_range: PredictionRange;
  historical_average_mins: number;
  data_points_used: number;
  model_version: string;
  baseline_minutes: number;
  feature_version: string;
  explanation: string;
}

export interface CompletionPrediction {
  completion_probability: number;
  confidence: string;
  factors: string[];
}

export interface SlotRecommendation {
  start_time: string;
  end_time: string;
  score: number;
  confidence: string;
  reason: string;
}

export interface PersonalProfile {
  total_tasks_analyzed: number;
  total_sessions_analyzed: number;
  total_schedules_analyzed: number;
  overall_completion_rate: number;
  overall_estimate_bias_ratio: number;
  hourly_productivity: Record<string, number>;
  weekday_productivity: Record<string, number>;
  category_bias_ratio: Record<string, number>;
  preferred_hours: number[];
  avoided_hours: number[];
  recommendation_acceptance_rate: number;
  learning_phase: string;
  last_updated: string;
}

export interface ModelMetrics {
  duration_mae: number;
  baseline_duration_mae: number;
  duration_rmse: number;
  completion_accuracy: number;
  recommendation_acceptance_rate: number;
  successful_recommendation_rate: number;
  schedule_adherence_rate: number;
  model_version: string;
  trained_at: string;
  training_example_count: number;
}

export interface CategoryStats {
  category: string;
  example_count: number;
  avg_actual_mins: number;
  avg_predicted_mins: number;
  bias_ratio: number;
  completion_rate: number;
  avg_start_hour: number;
  postponement_rate: number;
}

export interface HourlyStats {
  hour: number;
  sample_count: number;
  completion_rate: number;
  avg_actual_mins: number;
  avg_planned_mins: number;
  avg_accuracy: number;
  postponement_rate: number;
}

export interface DriftReport {
  detected: boolean;
  dimension: string | null;
  historic_avg: number;
  recent_avg: number;
  delta_percent: number;
  message: string;
}

export interface WeeklySummary {
  total_worked_mins: number;
  avg_session_mins: number;
  best_focus_window: string;
  estimate_accuracy_percent: number;
  schedule_adherence_percent: number;
  pattern_insight: string | null;
}

// ── API Methods ─────────────────────────────────────────────────────────────

export const mlApi = {
  /** Health check */
  health: () => mlFetch<{ status: string; version: string; examples_count: number }>('/health'),

  /** Derive personal productivity profile */
  getProfile: (tasks: TaskInput[], schedules: ScheduleInput[], feedbackItems?: FeedbackItem[]) =>
    mlFetch<PersonalProfile>('/ml/profile', { tasks, schedules, feedback_items: feedbackItems || [] }),

  /** Get stored learning examples */
  getExamples: () => mlFetch<LearningExample[]>('/ml/examples'),

  /** Predict task duration using adaptive EWA + category bias */
  predictDuration: (task: TaskInput, examples: LearningExample[], categoryStats?: Record<string, CategoryStats>) =>
    mlFetch<DurationPrediction>('/ml/predict-duration', { task, examples, category_stats: categoryStats || {} }),

  /** Predict completion probability for a task at a given time */
  predictCompletion: (task: TaskInput, startTime: string, examples: LearningExample[], hourlyStats?: HourlyStats[]) =>
    mlFetch<CompletionPrediction>('/ml/predict-completion', { task, start_time: startTime, examples, hourly_stats: hourlyStats || [] }),

  /** Score a time slot for scheduling a task */
  scoreSlot: (startTime: string, endTime: string, task: TaskInput, examples: LearningExample[], hourlyStats?: HourlyStats[], explicitPrefs?: ExplicitPreference[]) =>
    mlFetch<SlotRecommendation>('/ml/score-slot', {
      start_time: startTime, end_time: endTime, task, examples,
      hourly_stats: hourlyStats || [], explicit_prefs: explicitPrefs || [],
    }),

  /** Get category-level statistics */
  getCategoryStats: (examples: LearningExample[]) =>
    mlFetch<Record<string, CategoryStats>>('/ml/category-stats', { examples }),

  /** Get hourly-level statistics */
  getHourlyStats: (examples: LearningExample[]) =>
    mlFetch<HourlyStats[]>('/ml/hourly-stats', { examples }),

  /** Compute model evaluation metrics (MAE, RMSE, etc.) */
  getMetrics: (examples: LearningExample[]) =>
    mlFetch<ModelMetrics>('/ml/metrics', { examples }),

  /** Detect model drift (recent vs historical behavior change) */
  getDrift: (examples: LearningExample[]) =>
    mlFetch<DriftReport>('/ml/drift', { examples }),

  /** Get a single data-backed daily insight */
  getInsight: (examples: LearningExample[], metrics?: ModelMetrics, drift?: DriftReport) =>
    mlFetch<{ insight: string | null }>('/ml/insight', { examples, metrics, drift }),

  /** Get weekly performance summary */
  getWeeklySummary: (examples: LearningExample[]) =>
    mlFetch<WeeklySummary | null>('/ml/weekly-summary', { examples }),

  /** Add learning examples */
  addExamples: (examples: LearningExample[]) =>
    mlFetch<{ added: number; total: number }>('/ml/examples', examples),

  /** Record user feedback on a recommendation */
  addFeedback: (item: Omit<FeedbackItem, 'id'>) =>
    mlFetch<FeedbackItem>('/ml/feedback', item),

  /** Get stored feedback */
  getFeedback: () => mlFetch<FeedbackItem[]>('/ml/feedback'),

  /** Set an explicit preference */
  setPreference: (pref: Omit<ExplicitPreference, 'id'>) =>
    mlFetch<ExplicitPreference>('/ml/preferences', pref),

  /** Get explicit preferences */
  getPreferences: () => mlFetch<ExplicitPreference[]>('/ml/preferences'),

  /** Delete an explicit preference */
  deletePreference: (key: string) =>
    mlFetch<{ deleted: string }>(`/ml/preferences/${key}`, undefined, 'DELETE'),

  /** Reset all ML data */
  reset: () => mlFetch<{ status: string }>('/ml/reset', {}),
};
