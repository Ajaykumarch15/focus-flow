"""
FastAPI ML Service — FocusFlow Personal Intelligence
Port of TypeScript ML engine to Python with scikit-learn, numpy.
Data persisted to MongoDB (shared with Node.js backend).
"""

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .models import (
    PredictDurationRequest, PredictCompletionRequest, ScoreSlotRequest,
    ProfileRequest, InsightsRequest, WeeklySummaryRequest, ResetRequest,
    DurationPrediction, CompletionPrediction, SlotRecommendation,
    PersonalProfile, ModelMetrics, CategoryStats, HourlyStats,
    DriftReport, WeeklySummary, LearningExample, PredictionRange,
)
from .engine import (
    derive_profile, derive_category_stats, derive_hourly_stats,
    adaptive_predict_duration, adaptive_predict_completion, score_slot,
    compute_model_metrics, detect_drift, generate_daily_insight,
    generate_weekly_summary,
)
from .database import (
    get_learning_examples, upsert_learning_examples,
    get_feedback, add_feedback,
    get_preferences, set_preference, delete_preference,
    reset_ml_data,
)

app = FastAPI(title='FocusFlow ML Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def _get_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract user ID from JWT or fallback to 'default' for local dev."""
    if not authorization:
        return 'default'
    # In production, decode JWT here. For now, use a simple hash fallback.
    try:
        import hashlib
        return hashlib.md5(authorization.encode()).hexdigest()[:24]
    except Exception:
        return 'default'


@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '1.0.0'}


# ── Profile ──────────────────────────────────────────────────────────────────
@app.post('/ml/profile', response_model=PersonalProfile)
async def get_profile(req: ProfileRequest):
    schedules_dicts = [s.model_dump() for s in req.schedules]
    feedback_dicts = [f.model_dump() for f in req.feedback_items]
    return derive_profile(req.tasks, schedules_dicts, feedback_dicts)


# ── Duration Prediction ──────────────────────────────────────────────────────
@app.post('/ml/predict-duration', response_model=DurationPrediction)
async def predict_duration(req: PredictDurationRequest):
    cat_stats = derive_category_stats(req.examples)
    return adaptive_predict_duration(req.task, req.examples, cat_stats)


# ── Completion Prediction ────────────────────────────────────────────────────
@app.post('/ml/predict-completion', response_model=CompletionPrediction)
async def predict_completion(req: PredictCompletionRequest):
    hourly = derive_hourly_stats(req.examples)
    return adaptive_predict_completion(req.task, req.start_time, req.examples, hourly)


# ── Slot Scoring ─────────────────────────────────────────────────────────────
@app.post('/ml/score-slot', response_model=SlotRecommendation)
async def score_slot_endpoint(req: ScoreSlotRequest):
    hourly = derive_hourly_stats(req.examples)
    prefs = [p.model_dump() for p in req.explicit_prefs]
    return score_slot(req.start_time, req.end_time, req.task, req.examples, hourly, prefs)


# ── Category Stats ───────────────────────────────────────────────────────────
@app.post('/ml/category-stats')
async def get_category_stats(req: PredictDurationRequest):
    return derive_category_stats(req.examples)


# ── Hourly Stats ─────────────────────────────────────────────────────────────
@app.post('/ml/hourly-stats')
async def get_hourly_stats(req: PredictDurationRequest):
    return derive_hourly_stats(req.examples)


# ── Model Metrics ────────────────────────────────────────────────────────────
@app.post('/ml/metrics', response_model=ModelMetrics)
async def get_metrics(req: PredictDurationRequest):
    return compute_model_metrics(req.examples)


# ── Drift Detection ──────────────────────────────────────────────────────────
@app.post('/ml/drift', response_model=DriftReport)
async def get_drift(req: PredictDurationRequest):
    return detect_drift(req.examples)


# ── Daily Insight ────────────────────────────────────────────────────────────
@app.post('/ml/insight')
async def get_insight(req: InsightsRequest):
    drift = req.drift or detect_drift(req.examples)
    insight = generate_daily_insight(req.examples, req.metrics, drift)
    return {'insight': insight}


# ── Weekly Summary ───────────────────────────────────────────────────────────
@app.post('/ml/weekly-summary')
async def get_weekly_summary(req: WeeklySummaryRequest):
    return generate_weekly_summary(req.examples)


# ── Learning Examples (MongoDB-persisted) ────────────────────────────────────
@app.get('/ml/examples')
async def list_examples(authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    return await get_learning_examples(uid)


@app.post('/ml/examples')
async def add_examples(examples: list[LearningExample], authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    docs = [ex.model_dump() for ex in examples]
    added = await upsert_learning_examples(uid, docs)
    total = len(await get_learning_examples(uid))
    return {'added': added, 'total': total}


# ── Feedback (MongoDB-persisted) ────────────────────────────────────────────
@app.get('/ml/feedback')
async def list_feedback(authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    return await get_feedback(uid)


@app.post('/ml/feedback')
async def add_feedback_item(item: dict, authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    item['id'] = f"fb_{item.get('rating', 'unknown')}"
    return await add_feedback(uid, item)


# ── Explicit Preferences (MongoDB-persisted) ────────────────────────────────
@app.get('/ml/preferences')
async def list_preferences(authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    return await get_preferences(uid)


@app.post('/ml/preferences')
async def set_preference_item(pref: dict, authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    pref['id'] = f"pref_{pref.get('key', 'unknown')}"
    return await set_preference(uid, pref)


@app.delete('/ml/preferences/{key}')
async def delete_preference_item(key: str, authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    await delete_preference(uid, key)
    return {'deleted': key}


# ── Reset ────────────────────────────────────────────────────────────────────
@app.post('/ml/reset')
async def reset_ml(_: ResetRequest, authorization: Optional[str] = Header(None)):
    uid = _get_user_id(authorization)
    await reset_ml_data(uid)
    return {'status': 'reset'}
