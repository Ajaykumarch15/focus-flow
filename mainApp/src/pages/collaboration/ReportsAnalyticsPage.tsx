import { useState, useMemo } from 'react';
import {
  BarChart3, LineChart, TrendingUp, Flame, ShieldCheck,
  Download
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { saveAs } from 'file-saver';
import { Card } from '../../components/ui/Card';
import { computeVelocity, computeFeatureCompletionRate } from '../../lib/collaborationKpis';

// S4-T2 (ECIS B.9): the KPI math now lives in the canonical lib module so the
// same computed source feeds Mission Control and Project Reports (R3/R5). The
// re-exports keep the public helper surface stable for existing consumers/tests.
export { computeVelocity, computeFeatureCompletionRate };

type ReportType = 'sprint' | 'developer' | 'productivity' | 'engineering';

export function ReportsAnalyticsPage() {
  const { tasks, features, members, sprints, blockers, activeWorkspaceId } = useCollaborationStore();

  const [activeReportType, setActiveReportType] = useState<ReportType>('sprint');

  // IES-P2-08: every KPI is derived from real, workspace-scoped store data.
  const wsTasks = useMemo(() => tasks.filter((t) => t.workspaceId === activeWorkspaceId), [tasks, activeWorkspaceId]);
  const wsFeatures = useMemo(() => features.filter((f) => f.workspaceId === activeWorkspaceId), [features, activeWorkspaceId]);
  const wsSprints = useMemo(() => sprints.filter((s) => s.workspaceId === activeWorkspaceId), [sprints, activeWorkspaceId]);
  const wsBlockers = useMemo(() => blockers.filter((b) => b.workspaceId === activeWorkspaceId), [blockers, activeWorkspaceId]);

  const completedFeatures = useMemo(() => wsFeatures.filter((f) => f.status === 'done'), [wsFeatures]);
  const featureCompletionRate = useMemo(() => computeFeatureCompletionRate(wsFeatures), [wsFeatures]);

  const activeSprint = wsSprints.find((s) => s.status === 'active');
  const activeSprintTasks = useMemo(
    () => (activeSprint ? wsTasks.filter((t) => t.sprintId === activeSprint.id) : []),
    [wsTasks, activeSprint],
  );
  const velocity = useMemo(
    () => (activeSprint ? computeVelocity(activeSprintTasks, activeSprint.targetVelocity) : { delivered: 0, pct: null }),
    [activeSprint, activeSprintTasks],
  );
  const resolvedBlockers = wsBlockers.filter((b) => b.status === 'resolved').length;

  const handleExport = () => {
    const report = {
      reportType: activeReportType,
      exportedAt: new Date().toISOString(),
      featureCompletionRate,
      completedFeatures: completedFeatures.length,
      totalFeatures: wsFeatures.length,
      completedTasks: wsTasks.filter((t) => t.sprintStatus === 'done').length,
      totalTasks: wsTasks.length,
      resolvedBlockers: wsBlockers.filter((b) => b.status === 'resolved').length,
      openBlockers: wsBlockers.filter((b) => b.status !== 'resolved').length,
      activeSprints: wsSprints.filter((s) => s.status === 'active').length,
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
        <Card className="p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Sprint Velocity</span>
          {activeSprint ? (
            <>
              <p className="text-3xl font-display font-extrabold text-brand-400">
                {velocity.delivered} / {activeSprint.targetVelocity} pts
              </p>
              <p className="text-[11px] text-brand-400/80 font-medium">
                {velocity.pct === null ? '—' : `${velocity.pct}%`} of target reached
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-display font-extrabold text-surface-600">No data</p>
              <p className="text-[11px] text-surface-500 font-medium">No active sprint</p>
            </>
          )}
        </Card>

        <Card className="p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Feature Completion Rate</span>
          <p className="text-3xl font-display font-extrabold text-emerald-400">
            {featureCompletionRate === null ? 'No data' : `${featureCompletionRate}%`}
          </p>
          <p className="text-[11px] text-emerald-400/80 font-medium">
            {wsFeatures.length === 0 ? 'No features tracked' : `${completedFeatures.length} features done`}
          </p>
        </Card>

        <Card className="p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Average Developer Cycle Time</span>
          <p className="text-3xl font-display font-extrabold text-amber-400">—</p>
          <p className="text-[11px] text-amber-400/80 font-medium">No cycle-time data yet</p>
        </Card>

        <Card className="p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400">Project Health Score</span>
          <p className="text-3xl font-display font-extrabold text-purple-400">
            {featureCompletionRate === null ? 'No data' : `${featureCompletionRate} / 100`}
          </p>
          <p className="text-[11px] text-purple-400/80 font-medium">Derived from feature completion</p>
        </Card>
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
      <Card className="p-6 lg:p-8 space-y-6">
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
      </Card>

    </div>
  );
}
