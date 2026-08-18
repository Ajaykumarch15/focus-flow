from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Model Confidence ──────────────────────────────────────────────────────────
ModelConfidence = str  # 'learning' | 'low' | 'medium' | 'high'
ModelStatus = str     # 'COLD_START' | 'INSUFFICIENT_DATA' | 'LEARNING' | 'PERSONALIZED' | 'MATURE'


# ── Duration Prediction ──────────────────────────────────────────────────────
class PredictionRange(BaseModel):
    min_mins: int
    max_mins: int


class DurationPrediction(BaseModel):
    predicted_minutes: int
    confidence: ModelConfidence
    confidence_score: float = Field(ge=0, le=1)
    prediction_range: PredictionRange
    historical_average_mins: int = 0
    data_points_used: int
    model_version: str = 'python-ml-v1'
    baseline_minutes: int = 0
    feature_version: str = 'features-v2'
    explanation: str = ''


# ── Completion Prediction ────────────────────────────────────────────────────
class CompletionPrediction(BaseModel):
    completion_probability: float = Field(ge=0, le=1)
    confidence: ModelConfidence
    factors: list[str] = []


# ── Slot Recommendation ──────────────────────────────────────────────────────
class SlotRecommendation(BaseModel):
    start_time: str
    end_time: str
    score: float = Field(ge=0, le=1)
    confidence: ModelConfidence
    reason: str


# ── Personal Profile ─────────────────────────────────────────────────────────
class PersonalProfile(BaseModel):
    total_tasks_analyzed: int
    total_sessions_analyzed: int
    total_schedules_analyzed: int
    overall_completion_rate: float
    overall_estimate_bias_ratio: float
    hourly_productivity: dict[str, int] = {}
    weekday_productivity: dict[str, float] = {}
    category_bias_ratio: dict[str, float] = {}
    preferred_hours: list[int] = []
    avoided_hours: list[int] = [13, 14]
    recommendation_acceptance_rate: float = 0.85
    learning_phase: str = 'cold_start'
    last_updated: str = ''


# ── Model Metrics ────────────────────────────────────────────────────────────
class ModelMetrics(BaseModel):
    duration_mae: float = 0
    baseline_duration_mae: float = 0
    duration_rmse: float = 0
    completion_accuracy: float = 0
    recommendation_acceptance_rate: float = 0
    successful_recommendation_rate: float = 0
    schedule_adherence_rate: float = 0
    model_version: str = 'python-ml-v1'
    trained_at: str = ''
    training_example_count: int = 0


# ── Category / Hourly Stats ──────────────────────────────────────────────────
class CategoryStats(BaseModel):
    category: str
    example_count: int
    avg_actual_mins: int
    avg_predicted_mins: int
    bias_ratio: float
    completion_rate: float
    avg_start_hour: float
    postponement_rate: float


class HourlyStats(BaseModel):
    hour: int
    sample_count: int
    completion_rate: float
    avg_actual_mins: int
    avg_planned_mins: int
    avg_accuracy: float
    postponement_rate: float


# ── Drift Report ─────────────────────────────────────────────────────────────
class DriftReport(BaseModel):
    detected: bool = False
    dimension: Optional[str] = None
    historic_avg: float = 0
    recent_avg: float = 0
    delta_percent: float = 0
    message: str = ''


# ── Weekly Summary ───────────────────────────────────────────────────────────
class WeeklySummary(BaseModel):
    total_worked_mins: int
    avg_session_mins: int
    best_focus_window: str
    estimate_accuracy_percent: int
    schedule_adherence_percent: int
    pattern_insight: Optional[str] = None


# ── Learning Example ─────────────────────────────────────────────────────────
class LearningExample(BaseModel):
    id: str
    task_id: str
    category: str
    priority: str
    planned_minutes: int
    predicted_minutes: int
    actual_minutes: int
    start_hour: int
    end_hour: int
    weekday: int
    deadline_distance_days: int = -1
    postponement_count: int = 0
    completion_status: int = 0
    session_count: int = 0
    total_pause_duration_mins: int = 0
    recommendation_shown: bool = False
    recommendation_accepted: bool = False
    recommendation_rejected: bool = False
    feedback: Optional[str] = None
    prediction_error_mins: int = 0
    baseline_minutes: int = 60
    baseline_error_mins: int = 0
    created_at: float = 0


# ── Feedback ─────────────────────────────────────────────────────────────────
class FeedbackItem(BaseModel):
    id: str = ''
    prediction_type: str = ''
    task_id: Optional[str] = None
    rating: str
    notes: Optional[str] = None
    created_at: float = 0


# ── Explicit Preference ──────────────────────────────────────────────────────
class ExplicitPreference(BaseModel):
    id: str
    key: str
    value: str
    priority: str = 'preferred'


# ── Request / Response models for API ────────────────────────────────────────
class TaskInput(BaseModel):
    id: str
    title: str = ''
    status: str = 'pending'
    category: str = 'General'
    priority: str = 'medium'
    total_time: int = 0  # ms
    deadline: Optional[float] = None  # timestamp ms
    subtasks: list[dict] = []
    sessions: list[dict] = []


class ScheduleInput(BaseModel):
    _id: str = ''
    task_id: str
    date: str
    start_time: str
    end_time: str
    status: str = 'scheduled'


class PredictDurationRequest(BaseModel):
    task: TaskInput
    examples: list[LearningExample] = []
    category_stats: dict[str, CategoryStats] = {}


class PredictCompletionRequest(BaseModel):
    task: TaskInput
    start_time: str
    examples: list[LearningExample] = []
    hourly_stats: list[HourlyStats] = []


class ScoreSlotRequest(BaseModel):
    start_time: str
    end_time: str
    task: TaskInput
    examples: list[LearningExample] = []
    hourly_stats: list[HourlyStats] = []
    explicit_prefs: list[ExplicitPreference] = []


class ProfileRequest(BaseModel):
    tasks: list[TaskInput] = []
    schedules: list[ScheduleInput] = []
    feedback_items: list[FeedbackItem] = []


class InsightsRequest(BaseModel):
    examples: list[LearningExample] = []
    metrics: Optional[ModelMetrics] = None
    drift: Optional[DriftReport] = None


class WeeklySummaryRequest(BaseModel):
    examples: list[LearningExample] = []


class ResetRequest(BaseModel):
    pass
