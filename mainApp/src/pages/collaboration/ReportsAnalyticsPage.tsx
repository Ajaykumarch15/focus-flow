import { useState, useMemo } from 'react';
import {
  BarChart3, LineChart, TrendingUp, Flame, ShieldCheck,
  Download
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { saveAs } from 'file-saver';

type ReportType = 'sprint' | 'developer' | 'productivity' | 'engineering';

// IES-P1-20: an empty task set is not a 100% completion rate — it's "no data".
// Returns null so callers can render an explicit empty state instead of a
// fabricated metric.
export function computeFeatureCompletionRate(tasks: { sprintStatus: string }[]): number | null {
  if (tasks.length === 0) return null;
  const completed = tasks.filter((t) => t.sprintStatus === 'done').length;
  return Math.round((completed / tasks.length) * 100);
}

export function ReportsAnalyticsPage() {
  const { tasks, members, sprints, blockers } = useCollaborationStore();

  const [activeReportType, setActiveReportType] = useState<ReportType>('sprint');

  const completedTasks = useMemo(() => tasks.filter((t) => t.sprintStatus === 'done'), [tasks]);
  const featureCompletionRate = useMemo(() => computeFeatureCompletionRate(tasks), [tasks]);

  // IES-P2-08: every KPI is derived from real store/API data — never hardcoded.
  const activeSprint = sprints.find((s) => s.status === 'active');
  const velocityPct = activeSprint && activeSprint.targetVelocity
    ? Math.round(((activeSprint.actualVelocity ?? 0) / activeSprint.targetVelocity) * 100)
    : null;
  const resolvedBlockers = blockers.filter((b) => b.status === 'resolved').length;

  const handleExport = () => {
    const report = {
      reportType: activeReportType,
      exportedAt: new Date().toISOString(),
      featureCompletionRate,
      completedFeatures: completedTasks.length,
      totalFeatures: tasks.length,
      resolvedBlockers: blockers.filter((b) => b.status === 'resolved').length,
      openBlockers: blockers.filter((b) => b.status !== 'resolved').length,
      activeSprints: sprints.filter((s) => s.status === 'active').length,
      members: members.map((m) => ({ name: m.name, role: m.role, status: m.status })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `workspace-analytics-${activeReportType}.json`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-800 pb-5">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-surface-50 flex items-center gap-2.5">
            <BarChart3 size={24} className="text-sky-400" /> Workspace Analytics & Engineering Reports
          </h1>
          <p className="text-xs text-surface-400 mt-1">
            Managers gain full insight into sprint velocity, developer focus hours, lead times, and project health without interrupting deep work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExport} type="button"
            className="px-4 py-2.5 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-750 text-xs font-bold text-surface-200 flex items-center gap-1.5 transition-colors">
            <Download size={14} /> Export Report (JSON)
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl border border-surface-800 bg-surface-900 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Sprint Velocity</span>
          {activeSprint ? (
            <>
              <p className="text-3xl font-display font-extrabold text-brand-400">
                {activeSprint.actualVelocity ?? 0} / {activeSprint.targetVelocity} pts
              </p>
              <p className="text-[11px] text-brand-400/80 font-medium">
                {velocityPct === null ? '—' : `${velocityPct}%`} of target reached
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-display font-extrabold text-surface-600">No data</p>
              <p className="text-[11px] text-surface-500 font-medium">No active sprint</p>
            </>
          )}
        </div>

        <div className="p-5 rounded-3xl border border-surface-800 bg-surface-900 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Feature Completion Rate</span>
          <p className="text-3xl font-display font-extrabold text-emerald-400">
            {featureCompletionRate === null ? 'No data' : `${featureCompletionRate}%`}
          </p>
          <p className="text-[11px] text-emerald-400/80 font-medium">
            {tasks.length === 0 ? 'No features tracked' : `${completedTasks.length} features merged`}
          </p>
        </div>

        <div className="p-5 rounded-3xl border border-surface-800 bg-surface-900 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Average Developer Cycle Time</span>
          <p className="text-3xl font-display font-extrabold text-amber-400">—</p>
          <p className="text-[11px] text-amber-400/80 font-medium">No cycle-time data yet</p>
        </div>

        <div className="p-5 rounded-3xl border border-surface-800 bg-surface-900 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Project Health Score</span>
          <p className="text-3xl font-display font-extrabold text-purple-400">
            {featureCompletionRate === null ? 'No data' : `${featureCompletionRate} / 100`}
          </p>
          <p className="text-[11px] text-purple-400/80 font-medium">Derived from task completion</p>
        </div>
      </div>

      {/* Report Type Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-800 pb-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'sprint' as ReportType, label: 'Sprint & Velocity Report', icon: LineChart },
          { id: 'developer' as ReportType, label: 'Developer Focus Hours', icon: Flame },
          { id: 'productivity' as ReportType, label: 'Productivity & Cycle Time', icon: TrendingUp },
          { id: 'engineering' as ReportType, label: 'Engineering Health & Blockers', icon: ShieldCheck },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveReportType(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeReportType === tab.id ? 'bg-surface-850 text-surface-50 border border-surface-700 shadow' : 'text-surface-400 hover:text-surface-200'
            }`}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Details Container */}
      <div className="rounded-3xl border border-surface-800 bg-surface-900 p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-extrabold text-surface-50 capitalize">
            {activeReportType} Executive Summary
          </h2>
          <span className="text-xs text-surface-400 font-mono">Updated: {new Date().toLocaleString()}</span>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-surface-850 border border-surface-800 space-y-3">
            <h3 className="text-sm font-bold text-surface-100">Developer Focus Time Breakdown</h3>
            <div className="space-y-3">
              {members.length === 0 ? (
                <p className="text-xs text-surface-500 py-2">No focus-time data yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-surface-200 font-medium">{m.name}</span>
                    <span className="text-surface-500 font-mono font-bold capitalize">{m.status.replace('_', ' ')}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-850 border border-surface-800 space-y-3">
            <h3 className="text-sm font-bold text-surface-100">Sprint Burndown & Quality Gates</h3>
            <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-2 text-xs">
              <div className="flex justify-between text-surface-300">
                <span>Code Review Lead Time:</span>
                <span className="font-bold text-purple-400 font-mono">—</span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>QA Pass Rate:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {featureCompletionRate === null ? '—' : `${featureCompletionRate}%`}
                </span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>Resolved Blockers This Sprint:</span>
                <span className="font-bold text-cyan-400 font-mono">{resolvedBlockers} Blockers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
