# ML Service

Python/FastAPI microservice providing adaptive task intelligence for FocusFlow. Predicts task durations, completion probability, optimal time slots, and generates productivity insights.

## Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| Language | Python | 3.11+ |
| Framework | FastAPI | ≥0.115.0 |
| Server | Uvicorn | ≥0.30.0 |
| Async MongoDB | Motor | ≥3.5.0 |
| MongoDB Driver | PyMongo | ≥4.8.0 |
| Data Validation | Pydantic | ≥2.9.0 |
| Numerical | NumPy | ≥1.26.4 |
| ML (planned) | scikit-learn | ≥1.5.1 |

## Architecture & Design Decisions

### Why Statistical/Heuristic Over ML Models?

The engine uses **statistical formulas and weighted heuristics** instead of trained ML models (regression, classification, etc.). This is intentional:

| Consideration | Statistical Approach | Trained ML Model |
|---------------|---------------------|------------------|
| Cold start | Works from first interaction | Requires hundreds of examples |
| Interpretability | Every prediction has a human-readable explanation | Black-box feature weights |
| Infrastructure | Zero GPU/pipeline overhead | Needs training jobs, model versioning |
| Maintenance | No retraining drift | Requires periodic retraining |
| Accuracy at scale | Good for small-to-medium datasets | Better at large scale |

Current dependencies include `scikit-learn` and `numpy` for future model upgrades, but **no scikit-learn models are currently instantiated or trained**.

### How It Learns

The system improves predictions through three mechanisms:

1. **Exponential Weighted Moving Average (EWMA)** — Recent actual durations are weighted more heavily than older ones using α=0.15
2. **Bias Ratios** — Per-category comparison of actual vs predicted duration, applied as correction factors
3. **Hourly Completion Stats** — Historical success rates by hour of day inform slot recommendations

### Shared MongoDB

Connects to the **same MongoDB Atlas cluster** as the Node.js backend. ML data lives in separate collections:

| Collection | Purpose |
|------------|---------|
| `ml_examples` | Completed task records used for learning |
| `ml_feedback` | User ratings on predictions (thumbs up/down, about_right) |
| `ml_preferences` | Explicit user constraints (e.g., no tasks after 18:00) |

## Project Structure

```text
ml-service/
  run.py                  Entry point — loads .env, starts Uvicorn on port 8000
  requirements.txt        Python dependencies
  .env                    MONGODB_URI and PORT config
  app/
    __init__.py           Marks app/ as a Python package
    models.py             All Pydantic models (request/response schemas, data models)
    database.py           MongoDB CRUD for ml_examples, ml_feedback, ml_preferences
    engine.py             Core ML logic: predictions, stats, drift, insights, summaries
    main.py               FastAPI app with all REST endpoints and CORS config
```

## Setup & Running

### Prerequisites

- Python 3.11+
- MongoDB Atlas cluster (or local MongoDB)

### Install

```bash
cd ml-service
pip install -r requirements.txt
```

### Configure

Edit `.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/focusflow
PORT=8000
```

### Run

```bash
python run.py
```

Server starts at `http://localhost:8000` with hot-reload enabled.

### Verify

```bash
curl http://localhost:8000/health
# → {"status":"ok","version":"1.0.0"}
```

## API Reference

All endpoints accept `application/json`. ML-persisted endpoints require an `Authorization` header (currently a simple hash for user identification).

---

### GET /health

Health check.

**Response:**

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

### POST /ml/profile

Build a personal productivity profile from tasks, schedules, and feedback.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `tasks` | `TaskInput[]` | User's tasks |
| `schedules` | `ScheduleInput[]` | Scheduled time blocks |
| `feedback_items` | `FeedbackItem[]` | Prediction feedback |

**Response:** `PersonalProfile`

```json
// Request
{
  "tasks": [
    {
      "id": "t1",
      "title": "Write docs",
      "status": "completed",
      "category": "Writing",
      "priority": "high",
      "total_time": 3600000,
      "subtasks": [{"id": "s1"}],
      "sessions": [{"duration": 3600000}]
    }
  ],
  "schedules": [
    {
      "task_id": "t1",
      "date": "2026-08-26",
      "start_time": "09:00",
      "end_time": "10:00",
      "status": "completed"
    }
  ],
  "feedback_items": []
}

// Response
{
  "total_tasks_analyzed": 1,
  "total_sessions_analyzed": 1,
  "total_schedules_analyzed": 1,
  "overall_completion_rate": 1.0,
  "overall_estimate_bias_ratio": 1.0,
  "hourly_productivity": {"9": 1},
  "weekday_productivity": {"0": 0.7, "1": 0.9, "2": 0.95, "3": 0.88, "4": 0.82, "5": 0.75, "6": 0.6},
  "category_bias_ratio": {"Writing": 1.0},
  "preferred_hours": [9],
  "avoided_hours": [13, 14],
  "recommendation_acceptance_rate": 0.85,
  "learning_phase": "cold_start",
  "last_updated": "2026-08-26T12:00:00"
}
```

---

### POST /ml/predict-duration

Predict how long a task will take based on historical examples.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `task` | `TaskInput` | Task to predict for |
| `examples` | `LearningExample[]` | Historical learning examples |
| `category_stats` | `dict` | Pre-computed category stats (optional) |

**Response:** `DurationPrediction`

```json
// Request
{
  "task": {
    "id": "t2",
    "title": "Code review",
    "category": "Development",
    "priority": "medium",
    "subtasks": [{"id": "s1"}, {"id": "s2"}]
  },
  "examples": []
}

// Response
{
  "predicted_minutes": 60,
  "confidence": "learning",
  "confidence_score": 0.25,
  "prediction_range": {"min_mins": 51, "max_mins": 69},
  "historical_average_mins": 0,
  "data_points_used": 0,
  "model_version": "python-ml-v1",
  "baseline_minutes": 60,
  "feature_version": "features-v2",
  "explanation": "Still learning your patterns for \"Development\". Baseline estimate: 60m."
}
```

---

### POST /ml/predict-completion

Predict the probability that a task will be completed by a given start time.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `task` | `TaskInput` | Task to predict for |
| `start_time` | `string` | Proposed start time (HH:MM) |
| `examples` | `LearningExample[]` | Historical learning examples |

**Response:** `CompletionPrediction`

```json
// Request
{
  "task": {
    "id": "t3",
    "title": "Design mockups",
    "category": "Design",
    "priority": "high"
  },
  "start_time": "09:00",
  "examples": []
}

// Response
{
  "completion_probability": 0.8,
  "confidence": "learning",
  "factors": ["High priority drives stronger follow-through"]
}
```

---

### POST /ml/score-slot

Score a time slot for scheduling a task, considering historical performance at that hour.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `start_time` | `string` | Slot start (HH:MM) |
| `end_time` | `string` | Slot end (HH:MM) |
| `task` | `TaskInput` | Task to schedule |
| `examples` | `LearningExample[]` | Historical learning examples |
| `explicit_prefs` | `ExplicitPreference[]` | User constraints |

**Response:** `SlotRecommendation`

```json
// Request
{
  "start_time": "09:00",
  "end_time": "10:00",
  "task": {
    "id": "t4",
    "title": "Deep work",
    "category": "Development",
    "priority": "high"
  },
  "examples": [],
  "explicit_prefs": []
}

// Response
{
  "start_time": "09:00",
  "end_time": "10:00",
  "score": 0.5,
  "confidence": "learning",
  "reason": "Available slot with no strong signal yet."
}
```

---

### POST /ml/category-stats

Get per-category statistics from learning examples.

**Request Body:** Same as `/ml/predict-duration`.

**Response:** `dict[str, CategoryStats]`

```json
// Response
{
  "Development": {
    "category": "Development",
    "example_count": 12,
    "avg_actual_mins": 45,
    "avg_predicted_mins": 40,
    "bias_ratio": 1.125,
    "completion_rate": 0.83,
    "avg_start_hour": 10.2,
    "postponement_rate": 0.08
  }
}
```

---

### POST /ml/hourly-stats

Get per-hour statistics from learning examples.

**Request Body:** Same as `/ml/predict-duration`.

**Response:** `HourlyStats[]`

```json
// Response
[
  {
    "hour": 9,
    "sample_count": 8,
    "completion_rate": 0.88,
    "avg_actual_mins": 42,
    "avg_planned_mins": 35,
    "avg_accuracy": 0.72,
    "postponement_rate": 0.12
  },
  {
    "hour": 14,
    "sample_count": 5,
    "completion_rate": 0.6,
    "avg_actual_mins": 55,
    "avg_planned_mins": 35,
    "avg_accuracy": 0.51,
    "postponement_rate": 0.2
  }
]
```

---

### POST /ml/metrics

Compute model accuracy metrics (MAE, RMSE, adherence rate).

**Request Body:** Same as `/ml/predict-duration`.

**Response:** `ModelMetrics`

```json
// Response
{
  "duration_mae": 12.3,
  "baseline_duration_mae": 18.7,
  "duration_rmse": 15.1,
  "completion_accuracy": 0.78,
  "recommendation_acceptance_rate": 0.65,
  "successful_recommendation_rate": 0.72,
  "schedule_adherence_rate": 0.81,
  "model_version": "python-ml-v1",
  "trained_at": "2026-08-26T12:00:00",
  "training_example_count": 45
}
```

---

### POST /ml/drift

Detect behavioral drift by comparing recent vs historical patterns.

**Request Body:** Same as `/ml/predict-duration`.

**Response:** `DriftReport`

```json
// Response (drift detected)
{
  "detected": true,
  "dimension": "session_duration",
  "historic_avg": 42,
  "recent_avg": 28,
  "delta_percent": 33,
  "message": "Your recent focus sessions have become shorter (avg 28m vs 42m historically)."
}

// Response (no drift)
{
  "detected": false,
  "historic_avg": 42,
  "recent_avg": 40,
  "delta_percent": 5,
  "message": ""
}
```

---

### POST /ml/insight

Generate a daily insight based on patterns, drift, and metrics.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `examples` | `LearningExample[]` | Historical learning examples |
| `metrics` | `ModelMetrics` | Pre-computed metrics (optional) |
| `drift` | `DriftReport` | Pre-computed drift report (optional) |

**Response:**

```json
{
  "insight": "Your strongest focus window is 9:00–10:00 with 88% task completion. Schedule deep work here."
}
```

Returns `{"insight": null}` if not enough data (<5 examples).

---

### POST /ml/weekly-summary

Generate a weekly productivity summary.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `examples` | `LearningExample[]` | Historical learning examples |

**Response:** `WeeklySummary`

```json
// Response
{
  "total_worked_mins": 840,
  "avg_session_mins": 42,
  "best_focus_window": "9:00 – 10:00",
  "estimate_accuracy_percent": 71,
  "schedule_adherence_percent": 83,
  "pattern_insight": "You perform best when deep-work blocks stay under 60 minutes this week."
}
```

---

### GET /ml/examples

List learning examples for the authenticated user.

**Headers:** `Authorization: <token>`

**Response:** `LearningExample[]`

```json
[
  {
    "id": "ex_001",
    "task_id": "t1",
    "category": "Writing",
    "priority": "high",
    "planned_minutes": 60,
    "predicted_minutes": 55,
    "actual_minutes": 68,
    "start_hour": 9,
    "end_hour": 10,
    "weekday": 1,
    "completion_status": 1,
    "prediction_error_mins": 13,
    "baseline_minutes": 60,
    "baseline_error_mins": 8,
    "created_at": 1724649600000
  }
]
```

---

### POST /ml/examples

Add learning examples for the authenticated user. Deduplicates by `id`.

**Headers:** `Authorization: <token>`

**Request Body:** `LearningExample[]`

```json
[
  {
    "id": "ex_002",
    "task_id": "t2",
    "category": "Development",
    "priority": "medium",
    "planned_minutes": 45,
    "predicted_minutes": 40,
    "actual_minutes": 52,
    "start_hour": 14,
    "end_hour": 15,
    "weekday": 3,
    "completion_status": 1,
    "prediction_error_mins": 12,
    "baseline_minutes": 60,
    "baseline_error_mins": 8,
    "created_at": 1724736000000
  }
]
```

**Response:**

```json
{
  "added": 1,
  "total": 46
}
```

---

### GET /ml/feedback

List feedback for the authenticated user.

**Headers:** `Authorization: <token>`

**Response:** `FeedbackItem[]`

```json
[
  {
    "id": "fb_about_right",
    "prediction_type": "duration",
    "task_id": "t1",
    "rating": "about_right",
    "notes": null,
    "created_at": 1724649600000
  }
]
```

---

### POST /ml/feedback

Add a feedback item for the authenticated user.

**Headers:** `Authorization: <token>`

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `rating` | `string` | `thumbs_up`, `thumbs_down`, `about_right`, `too_short`, `too_long` |
| `prediction_type` | `string` | `duration`, `completion`, `slot` (optional) |
| `task_id` | `string` | Related task (optional) |
| `notes` | `string` | Free-text notes (optional) |

**Response:**

```json
{
  "id": "fb_thumbs_up",
  "rating": "thumbs_up",
  "prediction_type": "duration",
  "task_id": "t1",
  "notes": null,
  "created_at": 1724649600000
}
```

---

### GET /ml/preferences

List explicit preferences for the authenticated user.

**Headers:** `Authorization: <token>`

**Response:** `ExplicitPreference[]`

```json
[
  {
    "id": "pref_no_schedules_after_hour",
    "key": "no_schedules_after_hour",
    "value": "18",
    "priority": "preferred"
  }
]
```

---

### POST /ml/preferences

Set or update a preference (upserts by key).

**Headers:** `Authorization: <token>`

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Preference key |
| `value` | `string` | Preference value |
| `priority` | `string` | `required`, `preferred`, `optional` (default: `preferred`) |

**Response:**

```json
{
  "id": "pref_no_schedules_after_hour",
  "key": "no_schedules_after_hour",
  "value": "18",
  "priority": "preferred"
}
```

---

### DELETE /ml/preferences/{key}

Delete a preference by key.

**Headers:** `Authorization: <token>`

**Response:**

```json
{
  "deleted": "no_schedules_after_hour"
}
```

---

### POST /ml/reset

Reset all ML data for the authenticated user (examples, feedback, preferences).

**Headers:** `Authorization: <token>`

**Request Body:** `{}` (empty)

**Response:**

```json
{
  "status": "reset"
}
```

## Data Models Reference

### TaskInput

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | required | Task ID |
| `title` | `string` | `""` | Task title |
| `status` | `string` | `"pending"` | `pending`, `in_progress`, `completed` |
| `category` | `string` | `"General"` | Task category |
| `priority` | `string` | `"medium"` | `low`, `medium`, `high`, `urgent` |
| `total_time` | `int` | `0` | Total time spent (ms) |
| `deadline` | `float` | `null` | Deadline timestamp (ms) |
| `subtasks` | `dict[]` | `[]` | Subtask objects |
| `sessions` | `dict[]` | `[]` | Timer session objects |

### LearningExample

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | required | Unique example ID |
| `task_id` | `string` | required | Source task ID |
| `category` | `string` | required | Task category |
| `priority` | `string` | required | Task priority |
| `planned_minutes` | `int` | required | User-planned duration |
| `predicted_minutes` | `int` | required | ML-predicted duration |
| `actual_minutes` | `int` | required | Actual duration |
| `start_hour` | `int` | required | Hour task started (0-23) |
| `end_hour` | `int` | required | Hour task ended (0-23) |
| `weekday` | `int` | required | Day of week (0=Mon, 6=Sun) |
| `completion_status` | `int` | `0` | 1=completed, 0=not completed |
| `prediction_error_mins` | `int` | `0` | Actual - predicted (minutes) |
| `baseline_minutes` | `int` | `60` | Baseline estimate used |
| `baseline_error_mins` | `int` | `0` | Actual - baseline (minutes) |
| `created_at` | `float` | `0` | Timestamp (ms) |

### PersonalProfile

| Field | Type | Description |
|-------|------|-------------|
| `total_tasks_analyzed` | `int` | Total tasks processed |
| `total_sessions_analyzed` | `int` | Total timer sessions |
| `total_schedules_analyzed` | `int` | Total schedule blocks |
| `overall_completion_rate` | `float` | 0.0–1.0 |
| `overall_estimate_bias_ratio` | `float` | Actual / predicted ratio |
| `hourly_productivity` | `dict` | Hour → completion count |
| `weekday_productivity` | `dict` | Weekday → productivity score |
| `category_bias_ratio` | `dict` | Category → bias ratio |
| `preferred_hours` | `int[]` | Top 3 productive hours |
| `avoided_hours` | `int[]` | Hours to avoid (default: 13, 14) |
| `recommendation_acceptance_rate` | `float` | 0.0–1.0 |
| `learning_phase` | `string` | `cold_start`, `transition`, `personalized`, `mature` |

### ModelMetrics

| Field | Type | Description |
|-------|------|-------------|
| `duration_mae` | `float` | Mean Absolute Error (minutes) |
| `baseline_duration_mae` | `float` | Baseline MAE for comparison |
| `duration_rmse` | `float` | Root Mean Squared Error |
| `completion_accuracy` | `float` | 0.0–1.0 |
| `recommendation_acceptance_rate` | `float` | 0.0–1.0 |
| `successful_recommendation_rate` | `float` | 0.0–1.0 |
| `schedule_adherence_rate` | `float` | % within 20 min of prediction |
| `training_example_count` | `int` | Examples used |

## ML Algorithms

### Exponential Weighted Moving Average (EWMA)

Used to weight recent actual durations more heavily than older ones.

```
ewa[0] = values[0]
ewa[i] = α × values[i] + (1 - α) × ewa[i-1]

α = 0.15
```

If ≥3 category-specific examples exist, EWMA uses those. Otherwise, falls back to global examples.

### Personalization Weight

A tiered function that determines how much personal history influences predictions:

| Example Count | Weight | Status |
|---------------|--------|--------|
| 0 | 0.00 | COLD_START |
| 1–2 | 0.00 | COLD_START |
| 3–7 | 0.15 | INSUFFICIENT_DATA |
| 8–14 | 0.35 | LEARNING |
| 15–29 | 0.60 | PERSONALIZED |
| 30–59 | 0.80 | PERSONALIZED |
| 60+ | 0.92 | MATURE |

### Duration Prediction Blend

```
baseline = subtask_count × 30 (or 60 if no subtasks)
category_personal = baseline × category_bias_ratio
blended = ewa_actual × 0.6 + category_personal × 0.4
predicted = baseline × (1 - p_weight) + blended × p_weight
spread = predicted × 0.15
```

### Slot Scoring

Time slots are scored 0.0–1.0 based on:

1. **Hourly completion rate** (70% weight) + **accuracy** (30% weight)
2. **Category-at-hour completion rate** — blended 50/50 with base score if ≥2 samples
3. **Deadline urgency** — +0.12 if ≤1 day, +0.06 if ≤3 days
4. **Rejection penalty** — -0.06 per previous rejection at that hour/category

Hard constraints (e.g., `no_schedules_after_hour`) return score=0 immediately.

### Drift Detection

Compares recent 15 examples against historical average:

```
delta = |recent_avg - historic_avg| / max(historic_avg, 1)
drift_detected = delta > 0.25 (25%)
```

### Daily Insights

Generated in priority order:
1. Drift message (if detected)
2. Under-estimation pattern (>55% of tasks underestimated by >15 min)
3. Category-specific under-estimation (>60% of tasks in a category)
4. Peak focus window (hour with highest completion rate, ≥3 samples)
5. Low recommendation acceptance (<50% accepted)
