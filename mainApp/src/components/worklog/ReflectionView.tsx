import React, { useState, useEffect } from 'react';
import { HeartPulse, Sparkles, Star, Zap, Target, Shield, Flame } from 'lucide-react';
import { WorkLog, useWorkLogStore } from '../../store/useWorkLogStore';

interface ReflectionViewProps {
  workLog: WorkLog;
}

export function ReflectionView({ workLog }: ReflectionViewProps) {
  const { updateNestedField } = useWorkLogStore();
  const ref = workLog.reflection || { wentWell: '', slowedDown: '', learned: '', improvement: '', rating: 4 };
  const mood = workLog.moodMetrics || { energy: 3, focus: 4, stress: 2, confidence: 4, motivation: 4 };

  const [wentWell, setWentWell] = useState(ref.wentWell || '');
  const [slowedDown, setSlowedDown] = useState(ref.slowedDown || '');
  const [learned, setLearned] = useState(ref.learned || '');
  const [improvement, setImprovement] = useState(ref.improvement || '');

  useEffect(() => {
    setWentWell(ref.wentWell || '');
    setSlowedDown(ref.slowedDown || '');
    setLearned(ref.learned || '');
    setImprovement(ref.improvement || '');
  }, [workLog._id]);

  const saveRef = (field: string, val: any) => {
    updateNestedField(workLog._id, 'reflection', field, val);
  };

  const saveMoodMetric = (field: string, val: number) => {
    updateNestedField(workLog._id, 'moodMetrics', field, val);
  };

  const MOOD_METRICS_LIST = [
    { key: 'energy', label: 'Energy Level', icon: Zap, value: mood.energy, color: 'text-amber-400' },
    { key: 'focus', label: 'Deep Focus', icon: Target, value: mood.focus, color: 'text-sky-400' },
    { key: 'stress', label: 'Stress Level', icon: HeartPulse, value: mood.stress, color: 'text-red-400' },
    { key: 'confidence', label: 'Confidence', icon: Shield, value: mood.confidence, color: 'text-emerald-400' },
    { key: 'motivation', label: 'Motivation', icon: Flame, value: mood.motivation, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
          <Sparkles size={18} className="text-amber-400" />
          End of Day Reflection & Mindset Metrics
        </h3>
        <p className="text-xs text-surface-400">
          Reflect on daily achievements, blockers, and track personal energy & focus trends over time.
        </p>
      </div>

      {/* Multi-Dimensional Energy/Mood Sliders */}
      <div className="card p-5 rounded-2xl border border-surface-800 bg-surface-900/60 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">Daily Engineering Well-Being & Focus Ratings (1 - 5)</h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {MOOD_METRICS_LIST.map(metric => {
            const Icon = metric.icon;
            return (
              <div key={metric.key} className="space-y-2 text-center p-3 rounded-xl bg-surface-800/40 border border-surface-700/40">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-surface-200">
                  <Icon size={14} className={metric.color} />
                  {metric.label}
                </div>
                <div className="text-lg font-bold text-surface-50">{metric.value}/5</div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => saveMoodMetric(metric.key, val)}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${metric.value === val ? 'bg-brand-500 text-white shadow-sm' : 'bg-surface-800 text-surface-400 hover:text-surface-100'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Structured Prompts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 rounded-xl border border-emerald-500/20 bg-surface-900/60 space-y-2">
          <label className="text-xs font-semibold text-emerald-400 block">
            What went particularly well today?
          </label>
          <textarea
            className="input text-sm w-full resize-none rounded-lg" rows={2}
            placeholder="Key breakthroughs, clean code refactors, or fast bug resolutions..."
            value={wentWell} onChange={e => setWentWell(e.target.value)} onBlur={e => saveRef('wentWell', e.target.value)}
          />
        </div>

        <div className="card p-4 rounded-xl border border-red-500/20 bg-surface-900/60 space-y-2">
          <label className="text-xs font-semibold text-red-400 block">
            What slowed you down or interrupted deep work?
          </label>
          <textarea
            className="input text-sm w-full resize-none rounded-lg" rows={2}
            placeholder="Unexpected meetings, unclear specs, or slow build tools..."
            value={slowedDown} onChange={e => setSlowedDown(e.target.value)} onBlur={e => saveRef('slowedDown', e.target.value)}
          />
        </div>

        <div className="card p-4 rounded-xl border border-sky-500/20 bg-surface-900/60 space-y-2">
          <label className="text-xs font-semibold text-sky-400 block">
            What key technical lesson did you learn today?
          </label>
          <textarea
            className="input text-sm w-full resize-none rounded-lg" rows={2}
            placeholder="New API trick, framework behavior, or architecture pattern..."
            value={learned} onChange={e => setLearned(e.target.value)} onBlur={e => saveRef('learned', e.target.value)}
          />
        </div>

        <div className="card p-4 rounded-xl border border-purple-500/20 bg-surface-900/60 space-y-2">
          <label className="text-xs font-semibold text-purple-400 block">
            One single improvement for tomorrow?
          </label>
          <textarea
            className="input text-sm w-full resize-none rounded-lg" rows={2}
            placeholder="Better timeblocking, turning off Slack notifications, or clearer branch naming..."
            value={improvement} onChange={e => setImprovement(e.target.value)} onBlur={e => saveRef('improvement', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
