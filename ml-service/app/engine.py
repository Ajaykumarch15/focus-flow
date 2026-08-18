"""
ML Engine — Python port of mlIntelligenceEngine.ts + mlAdaptiveEngine.ts
All core ML logic: predictions, stats, drift detection, insights, weekly summaries.
"""

import math
import time
from datetime import datetime, timedelta
from typing import Optional

from .models import (
    DurationPrediction, CompletionPrediction, SlotRecommendation,
    PersonalProfile, ModelMetrics, CategoryStats, HourlyStats,
    DriftReport, WeeklySummary, LearningExample, FeedbackItem,
    TaskInput, PredictionRange,
)

EWA_ALPHA = 0.15


# ── Exponential Weighted Average ─────────────────────────────────────────────
def exponential_weighted_average(values: list[float], alpha: float = EWA_ALPHA) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    ewa = values[0]
    for v in values[1:]:
        ewa = alpha * v + (1 - alpha) * ewa
    return ewa


# ── Personalization Weight ───────────────────────────────────────────────────
def personalization_weight(example_count: int) -> float:
    if example_count < 3:
        return 0.0
    if example_count < 8:
        return 0.15
    if example_count < 15:
        return 0.35
    if example_count < 30:
        return 0.60
    if example_count < 60:
        return 0.80
    return 0.92


# ── Baseline Duration ────────────────────────────────────────────────────────
def compute_baseline_minutes(task: TaskInput) -> int:
    subtask_count = len(task.subtasks) if task.subtasks else 0
    return subtask_count * 30 if subtask_count > 0 else 60


# ── Model Status ─────────────────────────────────────────────────────────────
def derive_model_status(example_count: int) -> str:
    if example_count == 0:
        return 'COLD_START'
    if example_count < 5:
        return 'INSUFFICIENT_DATA'
    if example_count < 15:
        return 'LEARNING'
    if example_count < 30:
        return 'PERSONALIZED'
    return 'MATURE'


def _status_to_confidence(status: str) -> tuple[str, float]:
    mapping = {
        'MATURE': ('high', 0.90),
        'PERSONALIZED': ('medium', 0.73),
        'LEARNING': ('low', 0.52),
        'INSUFFICIENT_DATA': ('learning', 0.35),
        'COLD_START': ('learning', 0.25),
    }
    return mapping.get(status, ('learning', 0.25))


# ── Profile Derivation ───────────────────────────────────────────────────────
def derive_profile(
    tasks: list[TaskInput],
    schedules: list[dict],
    feedback_items: list[FeedbackItem] | None = None,
) -> PersonalProfile:
    if feedback_items is None:
        feedback_items = []

    completed = [t for t in tasks if t.status == 'completed']
    total = len(tasks)

    # Estimate bias per category
    total_ratio_sum = 0.0
    ratio_count = 0
    category_ratios: dict[str, dict] = {}

    for task in completed:
        if task.total_time > 0:
            estimated_ms = (len(task.subtasks) * 30 if task.subtasks else 60) * 60 * 1000
            ratio = task.total_time / estimated_ms if estimated_ms > 0 else 1.15
            total_ratio_sum += ratio
            ratio_count += 1
            cat = task.category or 'General'
            if cat not in category_ratios:
                category_ratios[cat] = {'sum': 0.0, 'count': 0}
            category_ratios[cat]['sum'] += ratio
            category_ratios[cat]['count'] += 1

    category_bias = {}
    for cat, data in category_ratios.items():
        if data['count'] > 0:
            category_bias[cat] = round(data['sum'] / data['count'], 2)

    overall_bias = round(total_ratio_sum / ratio_count, 2) if ratio_count > 0 else 1.15

    # Hourly productivity
    hourly: dict[int, int] = {h: 0 for h in range(24)}
    for s in schedules:
        if s.get('status') == 'completed' and s.get('start_time'):
            try:
                h = int(s['start_time'].split(':')[0])
                if 0 <= h < 24:
                    hourly[h] = hourly.get(h, 0) + 1
            except (ValueError, IndexError):
                pass

    sorted_hours = sorted(
        [(h, c) for h, c in hourly.items() if c > 0],
        key=lambda x: x[1], reverse=True,
    )
    preferred = [h for h, _ in sorted_hours[:3]]

    # Feedback acceptance rate
    total_fb = len(feedback_items)
    positive_fb = sum(1 for f in feedback_items if f.rating in ('thumbs_up', 'about_right'))
    acceptance_rate = round(positive_fb / total_fb, 2) if total_fb > 0 else 0.85

    # Learning phase
    total_sessions = sum(len(t.sessions) if t.sessions else 0 for t in tasks)
    if total >= 30 or len(schedules) >= 50:
        phase = 'mature'
    elif total >= 15 or len(schedules) >= 20:
        phase = 'personalized'
    elif total >= 5 or len(schedules) >= 5:
        phase = 'transition'
    else:
        phase = 'cold_start'

    return PersonalProfile(
        total_tasks_analyzed=total,
        total_sessions_analyzed=total_sessions,
        total_schedules_analyzed=len(schedules),
        overall_completion_rate=round(len(completed) / total, 2) if total > 0 else 0,
        overall_estimate_bias_ratio=overall_bias,
        hourly_productivity={str(k): v for k, v in hourly.items()},
        weekday_productivity={'0': 0.7, '1': 0.9, '2': 0.95, '3': 0.88, '4': 0.82, '5': 0.75, '6': 0.6},
        category_bias_ratio=category_bias,
        preferred_hours=preferred,
        avoided_hours=[13, 14],
        recommendation_acceptance_rate=acceptance_rate,
        learning_phase=phase,
        last_updated=datetime.utcnow().isoformat(),
    )


# ── Category Stats ───────────────────────────────────────────────────────────
def derive_category_stats(examples: list[LearningExample]) -> dict[str, CategoryStats]:
    by_cat: dict[str, list[LearningExample]] = {}
    for ex in examples:
        by_cat.setdefault(ex.category, []).append(ex)

    result: dict[str, CategoryStats] = {}
    for cat, exs in by_cat.items():
        if len(exs) < 2:
            continue
        avg_actual = sum(e.actual_minutes for e in exs) / len(exs)
        avg_predicted = sum(e.predicted_minutes for e in exs) / len(exs)
        completion_rate = sum(1 for e in exs if e.completion_status == 1) / len(exs)
        avg_start = sum(e.start_hour for e in exs) / len(exs)
        postponement_rate = sum(1 for e in exs if e.postponement_count > 0) / len(exs)

        result[cat] = CategoryStats(
            category=cat,
            example_count=len(exs),
            avg_actual_mins=round(avg_actual),
            avg_predicted_mins=round(avg_predicted),
            bias_ratio=round(avg_actual / avg_predicted, 3) if avg_predicted > 0 else 1.15,
            completion_rate=round(completion_rate, 2),
            avg_start_hour=round(avg_start, 1),
            postponement_rate=round(postponement_rate, 2),
        )
    return result


# ── Hourly Stats ─────────────────────────────────────────────────────────────
def derive_hourly_stats(examples: list[LearningExample]) -> list[HourlyStats]:
    by_hour: dict[int, list[LearningExample]] = {}
    for ex in examples:
        by_hour.setdefault(ex.start_hour, []).append(ex)

    stats = []
    for hour, exs in sorted(by_hour.items()):
        completion_rate = sum(1 for e in exs if e.completion_status == 1) / len(exs)
        avg_actual = sum(e.actual_minutes for e in exs) / len(exs)
        avg_planned = sum(e.planned_minutes for e in exs) / len(exs)
        qualifying = [e for e in exs if e.actual_minutes > 0]
        avg_accuracy = (
            sum(max(0, 1 - abs(e.prediction_error_mins) / e.actual_minutes) for e in qualifying) / len(qualifying)
            if qualifying else 0
        )
        postponement_rate = sum(1 for e in exs if e.postponement_count > 0) / len(exs)

        stats.append(HourlyStats(
            hour=hour,
            sample_count=len(exs),
            completion_rate=round(completion_rate, 2),
            avg_actual_mins=round(avg_actual),
            avg_planned_mins=round(avg_planned),
            avg_accuracy=round(avg_accuracy, 2),
            postponement_rate=round(postponement_rate, 2),
        ))
    return stats


# ── Adaptive Duration Prediction ─────────────────────────────────────────────
def adaptive_predict_duration(
    task: TaskInput,
    examples: list[LearningExample],
    cat_stats: dict[str, CategoryStats],
) -> DurationPrediction:
    baseline = compute_baseline_minutes(task)
    all_count = len(examples)
    p_weight = personalization_weight(all_count)
    status = derive_model_status(all_count)

    cat_key = task.category or 'General'
    cat_examples = sorted(
        [e for e in examples if e.category == cat_key],
        key=lambda e: e.created_at,
    )
    global_examples = sorted(examples, key=lambda e: e.created_at)

    ewa_source = cat_examples if len(cat_examples) >= 3 else global_examples
    recent_actuals = [float(e.actual_minutes) for e in ewa_source]
    ewa_actual = exponential_weighted_average(recent_actuals) if recent_actuals else float(baseline)

    cat_bias = cat_stats[cat_key].bias_ratio if cat_key in cat_stats else 1.15
    cat_personal_mins = round(baseline * cat_bias)

    blended_personal = round(ewa_actual * 0.6 + cat_personal_mins * 0.4)
    predicted = round(baseline * (1 - p_weight) + blended_personal * p_weight)
    spread = round(predicted * 0.15)

    confidence, confidence_score = _status_to_confidence(status)

    explanation = _build_explanation(task.category or 'tasks', confidence, ewa_actual, baseline, len(cat_examples), p_weight)

    return DurationPrediction(
        predicted_minutes=predicted,
        confidence=confidence,
        confidence_score=confidence_score,
        prediction_range=PredictionRange(
            min_mins=max(10, predicted - spread),
            max_mins=predicted + spread,
        ),
        historical_average_mins=round(ewa_actual),
        data_points_used=all_count,
        model_version='python-ml-v1',
        baseline_minutes=baseline,
        feature_version='features-v2',
        explanation=explanation,
    )


def _build_explanation(category: str, confidence: str, ewa: float, baseline: int, cat_count: int, p_weight: float) -> str:
    if confidence == 'learning' or p_weight < 0.1:
        return f"Still learning your patterns for \"{category}\". Baseline estimate: {baseline}m."
    if cat_count >= 3:
        return f"Estimated {round(ewa)}m based on your recent history with {category} tasks ({cat_count} examples)."
    return f"Estimated {round(ewa)}m based on your general work patterns ({round(p_weight * 100)}% personal weighting)."


# ── Completion Prediction ────────────────────────────────────────────────────
def adaptive_predict_completion(
    task: TaskInput,
    start_time: str,
    examples: list[LearningExample],
    hourly_stats: list[HourlyStats],
) -> CompletionPrediction:
    base_prob = 0.72
    factors: list[str] = []

    try:
        start_hour = int(start_time.split(':')[0])
    except (ValueError, IndexError):
        start_hour = 9

    hour_stat = next((h for h in hourly_stats if h.hour == start_hour), None)
    if hour_stat and hour_stat.sample_count >= 3:
        base_prob = hour_stat.completion_rate
        if hour_stat.completion_rate > 0.8:
            factors.append(f"Strong historical completion ({round(hour_stat.completion_rate * 100)}%) at {start_hour}:00")
        elif hour_stat.completion_rate < 0.55:
            factors.append(f"Low historical completion ({round(hour_stat.completion_rate * 100)}%) at {start_hour}:00")

    if task.priority in ('urgent', 'high'):
        base_prob = min(0.98, base_prob + 0.08)
        factors.append('High priority drives stronger follow-through')

    cat_key = task.category or 'General'
    cat_examples = [e for e in examples if e.category == cat_key]
    if len(cat_examples) >= 3:
        cat_rate = sum(1 for e in cat_examples if e.completion_status == 1) / len(cat_examples)
        base_prob = (base_prob + cat_rate) / 2
        if cat_rate > 0.8:
            factors.append(f"You complete {task.category} tasks reliably ({round(cat_rate * 100)}%)")

    prob = round(min(0.98, max(0.15, base_prob)), 2)
    count = len(examples)
    confidence = 'high' if count >= 15 else 'medium' if count >= 5 else 'low' if count > 0 else 'learning'

    return CompletionPrediction(completion_probability=prob, confidence=confidence, factors=factors)


# ── Slot Scoring ─────────────────────────────────────────────────────────────
def score_slot(
    start_time: str,
    end_time: str,
    task: TaskInput,
    examples: list[LearningExample],
    hourly_stats: list[HourlyStats],
    explicit_prefs: list[dict],
) -> SlotRecommendation:
    try:
        start_hour = int(start_time.split(':')[0])
    except (ValueError, IndexError):
        start_hour = 9

    score = 0.5
    reason = 'Available slot with no strong signal yet.'

    # Explicit prefs (hard constraints)
    for pref in explicit_prefs:
        if pref.get('key') == 'no_schedules_after_hour' and start_hour >= int(pref.get('value', 99)):
            return SlotRecommendation(
                start_time=start_time, end_time=end_time,
                score=0, confidence='high',
                reason=f"Blocked — you prefer no tasks after {pref['value']}:00.",
            )

    # Hourly stats
    hour_stat = next((h for h in hourly_stats if h.hour == start_hour), None)
    if hour_stat and hour_stat.sample_count >= 3:
        score = hour_stat.completion_rate * 0.7 + hour_stat.avg_accuracy * 0.3
        if hour_stat.completion_rate > 0.8:
            reason = f"Strong historical completion ({round(hour_stat.completion_rate * 100)}%) for tasks starting at {start_hour}:00."
        elif hour_stat.completion_rate < 0.5:
            reason = f"Lower completion rate ({round(hour_stat.completion_rate * 100)}%) at {start_hour}:00 — consider another window."

    # Category preference
    cat_key = task.category or 'General'
    cat_at_hour = [e for e in examples if e.category == cat_key and e.start_hour == start_hour]
    if len(cat_at_hour) >= 2:
        cat_comp = sum(1 for e in cat_at_hour if e.completion_status == 1) / len(cat_at_hour)
        score = (score + cat_comp) / 2
        if cat_comp > 0.8:
            reason = f"Your completion rate for {task.category} at {start_hour}:00 is {round(cat_comp * 100)}%."

    # Deadline urgency
    if task.deadline:
        days_left = (task.deadline - time.time() * 1000) / 86_400_000
        if days_left <= 1:
            score = min(1.0, score + 0.12)
        elif days_left <= 3:
            score = min(1.0, score + 0.06)

    # Rejection penalty
    rejected = [e for e in examples if e.start_hour == start_hour and e.recommendation_rejected and e.category == cat_key]
    if len(rejected) >= 2:
        score = max(0.05, score - len(rejected) * 0.06)
        reason = f"Score reduced: previous recommendations at {start_hour}:00 for {task.category} were rejected."

    score = round(min(1, max(0, score)), 2)
    sample_basis = max(hour_stat.sample_count if hour_stat else 0, len(cat_at_hour))
    confidence = 'high' if sample_basis >= 10 else 'medium' if sample_basis >= 4 else 'low' if sample_basis >= 1 else 'learning'

    return SlotRecommendation(start_time=start_time, end_time=end_time, score=score, confidence=confidence, reason=reason)


# ── Model Metrics ────────────────────────────────────────────────────────────
def compute_model_metrics(examples: list[LearningExample]) -> ModelMetrics:
    resolved = [e for e in examples if e.actual_minutes > 0]
    if not resolved:
        return ModelMetrics()

    duration_mae = sum(abs(e.prediction_error_mins) for e in resolved) / len(resolved)
    baseline_mae = sum(abs(e.baseline_error_mins) for e in resolved) / len(resolved)
    duration_rmse = math.sqrt(sum(e.prediction_error_mins ** 2 for e in resolved) / len(resolved))
    completion_accuracy = sum(1 for e in resolved if e.completion_status == 1) / len(resolved)

    with_rec = [e for e in resolved if e.recommendation_shown]
    rec_acceptance = (
        sum(1 for e in with_rec if e.recommendation_accepted) / len(with_rec)
        if with_rec else 0
    )
    accepted = [e for e in with_rec if e.recommendation_accepted]
    successful_rec = sum(1 for e in accepted if e.completion_status == 1) / len(accepted) if accepted else 0

    adherence = sum(1 for e in resolved if abs(e.prediction_error_mins) <= 20) / len(resolved)

    return ModelMetrics(
        duration_mae=round(duration_mae, 1),
        baseline_duration_mae=round(baseline_mae, 1),
        duration_rmse=round(duration_rmse, 1),
        completion_accuracy=round(completion_accuracy, 2),
        recommendation_acceptance_rate=round(rec_acceptance, 2),
        successful_recommendation_rate=round(successful_rec, 2),
        schedule_adherence_rate=round(adherence, 2),
        model_version='python-ml-v1',
        trained_at=datetime.utcnow().isoformat(),
        training_example_count=len(resolved),
    )


# ── Drift Detection ──────────────────────────────────────────────────────────
def detect_drift(examples: list[LearningExample]) -> DriftReport:
    recent_window = 15
    threshold = 0.25

    if len(examples) < recent_window + 5:
        return DriftReport()

    sorted_exs = sorted(examples, key=lambda e: e.created_at)
    recent = sorted_exs[-recent_window:]
    historical = sorted_exs[:-recent_window]

    historic_avg = sum(e.actual_minutes for e in historical) / len(historical)
    recent_avg = sum(e.actual_minutes for e in recent) / len(recent)
    delta = abs(recent_avg - historic_avg) / max(historic_avg, 1)

    if delta > threshold:
        direction = 'shorter' if recent_avg < historic_avg else 'longer'
        return DriftReport(
            detected=True,
            dimension='session_duration',
            historic_avg=round(historic_avg),
            recent_avg=round(recent_avg),
            delta_percent=round(delta * 100),
            message=f"Your recent focus sessions have become {direction} (avg {round(recent_avg)}m vs {round(historic_avg)}m historically).",
        )

    return DriftReport(
        detected=False,
        historic_avg=round(historic_avg),
        recent_avg=round(recent_avg),
        delta_percent=round(delta * 100),
    )


# ── Daily Insight ────────────────────────────────────────────────────────────
def generate_daily_insight(
    examples: list[LearningExample],
    metrics: Optional[ModelMetrics],
    drift: DriftReport,
) -> Optional[str]:
    if len(examples) < 5:
        return None

    if drift.detected:
        return drift.message

    # Under-estimation pattern
    under = [e for e in examples if e.prediction_error_mins > 15 and e.actual_minutes > 0]
    if len(under) / len(examples) > 0.55:
        avg_over = round(sum(e.prediction_error_mins for e in under) / len(under))
        return f"You've been underestimating task durations by ~{avg_over}m on average. Schedule extra buffer time."

    # Category insight
    cat_data: dict[str, dict] = {}
    for ex in examples:
        cat_data.setdefault(ex.category, {'total': 0, 'under': 0})
        cat_data[ex.category]['total'] += 1
        if ex.prediction_error_mins > 15:
            cat_data[ex.category]['under'] += 1

    for cat, data in cat_data.items():
        if data['total'] >= 4 and data['under'] / data['total'] > 0.6:
            cat_exs = [e for e in examples if e.category == cat and e.prediction_error_mins > 0]
            bias = round(sum(e.prediction_error_mins for e in cat_exs) / data['total']) if cat_exs else 0
            return f"You consistently underestimate {cat} tasks by ~{bias}m. Consider adding buffer when scheduling."

    # Peak hours
    by_hour: dict[int, dict] = {}
    for ex in examples:
        by_hour.setdefault(ex.start_hour, {'completed': 0, 'total': 0})
        by_hour[ex.start_hour]['total'] += 1
        if ex.completion_status == 1:
            by_hour[ex.start_hour]['completed'] += 1

    best = None
    best_rate = 0
    for h, d in by_hour.items():
        if d['total'] >= 3:
            rate = d['completed'] / d['total']
            if rate > best_rate:
                best_rate = rate
                best = h

    if best is not None:
        return f"Your strongest focus window is {best}:00–{best+1}:00 with {round(best_rate * 100)}% task completion. Schedule deep work here."

    if metrics and metrics.training_example_count >= 10:
        rate = round(metrics.recommendation_acceptance_rate * 100)
        if rate < 50:
            return f"Only {rate}% of scheduling recommendations were accepted. Adjust your preferences for better suggestions."

    return None


# ── Weekly Summary ───────────────────────────────────────────────────────────
def generate_weekly_summary(examples: list[LearningExample]) -> Optional[WeeklySummary]:
    if len(examples) < 5:
        return None

    one_week_ago = time.time() * 1000 - 7 * 86_400_000
    week = [e for e in examples if e.created_at > one_week_ago]
    if len(week) < 3:
        return None

    total_mins = sum(e.actual_minutes for e in week)
    avg = round(total_mins / len(week))

    by_hour: dict[int, dict] = {}
    for ex in week:
        by_hour.setdefault(ex.start_hour, {'completed': 0, 'total': 0})
        by_hour[ex.start_hour]['total'] += 1
        if ex.completion_status == 1:
            by_hour[ex.start_hour]['completed'] += 1

    best_h, best_rate = None, 0
    for h, d in by_hour.items():
        if d['total'] >= 2:
            r = d['completed'] / d['total']
            if r > best_rate:
                best_rate = r
                best_h = h

    best_window = f"{best_h}:00 – {best_h+1}:00" if best_h is not None else "Not enough data"

    accurate = sum(1 for e in week if abs(e.prediction_error_mins) <= 15)
    adherent = sum(1 for e in week if abs(e.prediction_error_mins) <= 20)

    # Pattern insight
    long_s = [e for e in week if e.actual_minutes > 90]
    short_s = [e for e in week if e.actual_minutes <= 60]
    pattern = None
    if len(short_s) / len(week) >= 0.7 and len(week) >= 4:
        pattern = "You perform best when deep-work blocks stay under 60 minutes this week."
    elif len(long_s) >= 2 and all(e.completion_status == 1 for e in long_s):
        pattern = "Long focused sessions (90m+) had a strong completion record this week."

    return WeeklySummary(
        total_worked_mins=total_mins,
        avg_session_mins=avg,
        best_focus_window=best_window,
        estimate_accuracy_percent=round(accurate / len(week) * 100),
        schedule_adherence_percent=round(adherent / len(week) * 100),
        pattern_insight=pattern,
    )
