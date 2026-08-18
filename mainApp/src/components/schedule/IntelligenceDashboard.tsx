/**
 * Intelligence Dashboard — Python ML API backed.
 * All ML computation happens on the FastAPI service.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Task, ScheduleItem } from '../../types';
import { mlApi, type LearningExample, type PersonalProfile, type ModelMetrics, type CategoryStats, type HourlyStats, type DriftReport, type WeeklySummary } from '../../utils/mlApi';

interface Props {
  tasks: Task[];
  schedules: ScheduleItem[];
}

function confidenceColor(conf: string): string {
  if (conf === 'high') return 'text-emerald-400';
  if (conf === 'medium') return 'text-amber-400';
  if (conf === 'low') return 'text-orange-400';
  return 'text-surface-500';
}

function modelStatusLabel(status: string): string {
  switch (status) {
    case 'COLD_START': return 'Cold Start';
    case 'INSUFFICIENT_DATA': return 'Gathering data';
    case 'LEARNING': return 'Learning';
    case 'PERSONALIZED': return 'Personalized';
    case 'MATURE': return 'Mature';
    default: return status;
  }
}

function modelStatusColor(status: string): string {
  if (status === 'MATURE') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (status === 'PERSONALIZED') return 'text-brand-300 bg-brand-500/10 border-brand-500/30';
  if (status === 'LEARNING') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-surface-400 bg-surface-800 border-surface-700';
}

export function IntelligenceDashboard({ tasks, schedules }: Props) {
  const [showWeekly, setShowWeekly] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [examples, setExamples] = useState<LearningExample[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, CategoryStats>>({});
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [drift, setDrift] = useState<DriftReport>({ detected: false, dimension: null, historic_avg: 0, recent_avg: 0, delta_percent: 0, message: '' });
  const [dailyInsight, setDailyInsight] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [profile, setProfile] = useState<PersonalProfile | null>(null);

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      setLoading(true);
      setError(null);

      // Load examples from Python service
      const storedExamples = await mlApi.getExamples();
      if (signal?.cancelled) return;
      setExamples(storedExamples);

      // Derive stats via Python API
      const [catStats, hStats, modelMetrics, driftReport] = await Promise.all([
        mlApi.getCategoryStats(storedExamples),
        mlApi.getHourlyStats(storedExamples),
        mlApi.getMetrics(storedExamples),
        mlApi.getDrift(storedExamples),
      ]);
      if (signal?.cancelled) return;
      setCategoryStats(catStats);
      setHourlyStats(hStats);
      setMetrics(modelMetrics);
      setDrift(driftReport);

      // Get profile from Python
      const scheduleInputs = schedules.map(s => ({
        _id: s._id || '',
        task_id: typeof s.taskId === 'string' ? s.taskId : (s.taskId as any)?._id ?? '',
        date: s.date,
        start_time: s.startTime,
        end_time: s.endTime,
        status: s.status,
      }));
      const prof = await mlApi.getProfile(tasks, scheduleInputs);
      if (signal?.cancelled) return;
      setProfile(prof);

      // Get daily insight
      const insightRes = await mlApi.getInsight(storedExamples, modelMetrics, driftReport);
      if (signal?.cancelled) return;
      setDailyInsight(insightRes.insight);

      // Get weekly summary
      const summary = await mlApi.getWeeklySummary(storedExamples);
      if (signal?.cancelled) return;
      setWeeklySummary(summary);
    } catch (e: any) {
      if (!signal?.cancelled) setError(e?.message || 'Failed to load ML data');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [tasks, schedules]);

  useEffect(() => {
    const signal = { cancelled: false };
    loadData(signal);
    return () => { signal.cancelled = true; };
  }, [loadData]);

  const peakHour = hourlyStats.filter(h => h.sample_count >= 2).sort((a, b) => b.completion_rate - a.completion_rate)[0] || null;
  const avgSessionMins = examples.length > 0 ? Math.round(examples.reduce((s, e) => s + e.actual_minutes, 0) / examples.length) : 0;
  const biasPercent = profile ? Math.round((profile.overall_estimate_bias_ratio - 1) * 100) : 0;
  const isOverEstimating = biasPercent < 0;

  const handleReset = async () => {
    try {
      await mlApi.reset();
      setResetDone(true);
      setShowReset(false);
      loadData();
    } catch { /* silent */ }
  };

  const handleFeedback = async (rating: 'thumbs_up' | 'thumbs_down') => {
    try {
      await mlApi.addFeedback({ prediction_type: 'time_slot', rating, created_at: Date.now() });
      setFeedbackDone(true);
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="p-4 bg-surface-900/90 border border-surface-800 rounded-2xl shadow-md">
        <div className="flex items-center gap-2 text-surface-400 text-xs">
          <Loader2 size={14} className="animate-spin" />
          Loading intelligence data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-surface-900/90 border border-surface-800 rounded-2xl shadow-md">
        <div className="flex items-center gap-2 text-amber-400 text-xs">
          <AlertTriangle size={14} />
          {error}
          <button onClick={() => loadData()} className="ml-auto text-brand-400 hover:text-brand-300">Retry</button>
        </div>
      </div>
    );
  }

  const modelStatus: string = profile?.learning_phase === 'mature' ? 'MATURE' : profile?.learning_phase === 'personalized' ? 'PERSONALIZED' : profile?.learning_phase === 'transition' ? 'LEARNING' : 'COLD_START';

  return (
    <div className="p-4 bg-surface-900/90 border border-surface-800 rounded-2xl space-y-4 shadow-md">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-400" />
          <h3 className="text-xs font-bold text-surface-100 uppercase tracking-wider">FocusFlow Intelligence</h3>
          <span className={`text-[10px] border px-2 py-0.5 rounded-full font-medium ${modelStatusColor(modelStatus)}`}>
            {modelStatusLabel(modelStatus)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-surface-500">
            {examples.length} data points · {Object.keys(categoryStats).length} categories
          </span>
          <button onClick={() => setShowReset(v => !v)} className="text-[10px] text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1" title="Reset personal learning">
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Reset Confirmation */}
      {showReset && !resetDone && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs space-y-2">
          <p className="text-red-300 font-medium flex items-center gap-1.5">
            <AlertTriangle size={13} /> Reset Personal Learning
          </p>
          <p className="text-surface-400 leading-relaxed">
            This will clear your derived intelligence data. Tasks, Sessions, Schedules, and WorkLogs will NOT be affected.
          </p>
          <div className="flex gap-2">
            <button onClick={handleReset} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors">Reset</button>
            <button onClick={() => setShowReset(false)} className="px-3 py-1 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {resetDone && <p className="text-xs text-emerald-400">✓ Personal learning data cleared. Restarting from Cold Start.</p>}

      {/* Drift Alert */}
      {drift.detected && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs flex items-start gap-2">
          <TrendingDown size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <span className="text-amber-200">{drift.message}</span>
        </div>
      )}

      {/* Daily Insight */}
      {dailyInsight && (
        <div className="p-2.5 bg-brand-500/8 border border-brand-500/25 rounded-xl text-xs flex items-start gap-2">
          <Info size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
          <span className="text-surface-200">{dailyInsight}</span>
        </div>
      )}

      {modelStatus === 'COLD_START' || modelStatus === 'INSUFFICIENT_DATA' ? (
        <div className="text-xs text-surface-400 text-center py-3">
          <p className="font-medium text-surface-300 mb-1">Learning your work patterns</p>
          <p>Complete a few more tasks with time-tracked sessions to unlock personal predictions.</p>
          <p className="mt-1 text-surface-500">{examples.length} / 5 examples needed to start learning</p>
        </div>
      ) : (
        <>
          {/* Your Patterns */}
          <div>
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Your Patterns</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-surface-950/80 rounded-xl border border-surface-800/80">
                <span className="text-[10px] uppercase font-bold text-surface-500 block mb-1">Peak Focus</span>
                {peakHour ? (
                  <>
                    <span className={`font-semibold ${confidenceColor(peakHour.sample_count >= 6 ? 'high' : 'medium')}`}>
                      {peakHour.hour}:00 – {peakHour.hour + 1}:00
                    </span>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {Math.round(peakHour.completion_rate * 100)}% completion · {peakHour.sample_count} sessions
                    </p>
                  </>
                ) : (
                  <span className="text-surface-500">Not enough data</span>
                )}
              </div>

              <div className="p-3 bg-surface-950/80 rounded-xl border border-surface-800/80">
                <span className="text-[10px] uppercase font-bold text-surface-500 block mb-1">Avg Session</span>
                {avgSessionMins > 0 ? (
                  <>
                    <span className="font-semibold text-brand-300">{avgSessionMins}m</span>
                    <p className="text-[11px] text-surface-400 mt-0.5">Based on {examples.length} sessions</p>
                  </>
                ) : (
                  <span className="text-surface-500">Not enough data</span>
                )}
              </div>

              <div className="p-3 bg-surface-950/80 rounded-xl border border-surface-800/80">
                <span className="text-[10px] uppercase font-bold text-surface-500 block mb-1">Estimate Bias</span>
                <span className={`font-semibold ${biasPercent > 10 ? 'text-amber-400' : biasPercent < -10 ? 'text-sky-400' : 'text-emerald-400'}`}>
                  {biasPercent >= 0 ? '+' : ''}{biasPercent}%
                </span>
                <p className="text-[11px] text-surface-400 mt-0.5">
                  Tasks take {Math.abs(biasPercent)}% {isOverEstimating ? 'less' : 'more'} than planned
                </p>
              </div>
            </div>
          </div>

          {/* Category Stats */}
          {Object.keys(categoryStats).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">By Category</p>
              <div className="space-y-1.5">
                {Object.values(categoryStats).slice(0, 4).map(cat => {
                  const catBias = Math.round((cat.bias_ratio - 1) * 100);
                  return (
                    <div key={cat.category} className="flex items-center justify-between text-xs px-3 py-1.5 bg-surface-950/70 rounded-lg border border-surface-800/60">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-200">{cat.category}</span>
                        <span className="text-surface-500">{cat.example_count} tasks</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-surface-400">{cat.avg_actual_mins}m avg</span>
                        <span className={catBias > 10 ? 'text-amber-400' : catBias < -5 ? 'text-sky-400' : 'text-emerald-400'}>
                          {catBias >= 0 ? '+' : ''}{catBias}%
                        </span>
                        <span className="text-emerald-400">{Math.round(cat.completion_rate * 100)}%✓</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Performance */}
          {metrics && metrics.training_example_count >= 5 && (
            <div>
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Model Performance</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-surface-950/80 rounded-lg border border-surface-800/60 text-center">
                  <span className="block text-[10px] text-surface-500 mb-0.5">Duration MAE</span>
                  <span className={`font-semibold ${metrics.duration_mae < metrics.baseline_duration_mae ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {metrics.duration_mae}m
                  </span>
                  {metrics.duration_mae < metrics.baseline_duration_mae && (
                    <span className="text-[10px] text-emerald-500 block">↓ vs baseline {metrics.baseline_duration_mae}m</span>
                  )}
                </div>
                <div className="p-2.5 bg-surface-950/80 rounded-lg border border-surface-800/60 text-center">
                  <span className="block text-[10px] text-surface-500 mb-0.5">Rec Acceptance</span>
                  <span className="font-semibold text-emerald-400">
                    {Math.round(metrics.recommendation_acceptance_rate * 100)}%
                  </span>
                </div>
                <div className="p-2.5 bg-surface-950/80 rounded-lg border border-surface-800/60 text-center">
                  <span className="block text-[10px] text-surface-500 mb-0.5">Adherence</span>
                  <span className="font-semibold text-brand-300">
                    {Math.round(metrics.schedule_adherence_rate * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-surface-600 mt-1.5">
                Model: <span className="text-surface-400">{metrics.model_version}</span> · {metrics.training_example_count} examples
              </p>
            </div>
          )}
        </>
      )}

      {/* Weekly Summary */}
      {weeklySummary && (
        <div>
          <button onClick={() => setShowWeekly(v => !v)} className="flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-surface-200 transition-colors">
            <BarChart3 size={13} />
            Weekly Summary
            {showWeekly ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showWeekly && (
            <div className="mt-2 p-3 bg-surface-950/80 border border-surface-800/60 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-surface-400">Time Worked</span><span className="text-surface-200 font-medium">{Math.floor(weeklySummary.total_worked_mins / 60)}h {weeklySummary.total_worked_mins % 60}m</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Avg Session</span><span className="text-surface-200 font-medium">{weeklySummary.avg_session_mins}m</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Best Window</span><span className="text-surface-200 font-medium">{weeklySummary.best_focus_window}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Estimate Accuracy</span><span className="text-surface-200 font-medium">{weeklySummary.estimate_accuracy_percent}%</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Schedule Adherence</span><span className="text-surface-200 font-medium">{weeklySummary.schedule_adherence_percent}%</span></div>
              {weeklySummary.pattern_insight && (
                <p className="text-[11px] text-brand-300 pt-1 border-t border-surface-800/60">{weeklySummary.pattern_insight}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback Row */}
      {!feedbackDone ? (
        <div className="flex items-center justify-between text-xs pt-1 text-surface-400 border-t border-surface-800/60">
          <span>Were today&apos;s recommendations helpful?</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleFeedback('thumbs_up')} className="px-2 py-1 bg-surface-800 hover:bg-surface-700 rounded text-surface-200 transition-colors">👍 Helpful</button>
            <button onClick={() => handleFeedback('thumbs_down')} className="px-2 py-1 bg-surface-800 hover:bg-surface-700 rounded text-surface-200 transition-colors">👎 Not useful</button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-emerald-400 pt-1 flex items-center gap-1">
          <CheckCircle size={12} /> Feedback recorded for personal learning loop.
        </p>
      )}
    </div>
  );
}
