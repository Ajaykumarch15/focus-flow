import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Clock, AlertTriangle,
  GripVertical,
} from 'lucide-react';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_COLORS,
  type GeneratedPlan,
  type GeneratedPhase,
  type GeneratedMilestone,
  type GeneratedTask,
  type GeneratorWarning,
} from '@personal/types/roadmap';

interface ImportRoadmapPreviewProps {
  plan: GeneratedPlan;
  warnings: GeneratorWarning[];
  onImport: () => void;
  onBack: () => void;
  importing: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TaskRow({ task }: { task: GeneratedTask }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 text-sm hover:bg-surface-800/50 rounded-lg group">
      <GripVertical size={14} className="text-surface-700 group-hover:text-surface-500 shrink-0 cursor-grab" />
      <div className="w-5 h-5 rounded border border-surface-600 shrink-0" />
      <Badge tone={TASK_TYPE_COLORS[task.category] as any || 'neutral'} className="text-[10px] px-1.5 py-0">
        {TASK_TYPE_LABELS[task.category] || task.category}
      </Badge>
      <span className="text-surface-200 flex-1 min-w-0 truncate">{task.title}</span>
      <span className="text-surface-400 text-xs whitespace-nowrap flex items-center gap-1">
        <Clock size={11} /> {task.estimatedHours}h
      </span>
      {task.durationDays && task.durationDays > 1 && (
        <span className="text-surface-500 text-xs">{task.durationDays}d</span>
      )}
      <span className="text-surface-500 text-xs whitespace-nowrap">
        {formatDate(task.scheduledDate)}
      </span>
    </div>
  );
}

function MilestoneSection({ milestone }: { milestone: GeneratedMilestone }) {
  const [expanded, setExpanded] = useState(true);
  const taskCount = milestone.tasks.length;
  const totalHours = milestone.tasks.reduce((s, t) => s + t.estimatedHours, 0);

  return (
    <div className="ml-6 border-l border-surface-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full py-2 px-3 text-left hover:bg-surface-800/30 rounded-lg transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-surface-500" /> : <ChevronRight size={14} className="text-surface-500" />}
        <span className="text-sm font-medium text-surface-200 flex-1">{milestone.title}</span>
        <span className="text-xs text-surface-500">{formatDate(milestone.targetDate)}</span>
        <span className="text-xs text-surface-500 flex items-center gap-1"><Clock size={10} />{totalHours}h</span>
        <span className="text-xs text-surface-600">{taskCount} tasks</span>
      </button>
      {expanded && (
        <div className="pb-1">
          {milestone.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseSection({ phase }: { phase: GeneratedPhase }) {
  const [expanded, setExpanded] = useState(true);
  const totalTasks = phase.milestones.reduce((s, m) => s + m.tasks.length, 0);
  const totalHours = phase.milestones.reduce((s, m) => s + m.tasks.reduce((ss, t) => ss + t.estimatedHours, 0), 0);

  return (
    <div className="border border-surface-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full py-3 px-4 text-left bg-surface-800/50 hover:bg-surface-800 transition-colors"
      >
        {expanded ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
        <div className="flex-1">
          <span className="font-semibold text-surface-100">{phase.title}</span>
          {phase.description && (
            <span className="text-xs text-surface-500 ml-2">{phase.description}</span>
          )}
        </div>
        <span className="text-xs text-surface-400">
          {formatDate(phase.startDate)} → {formatDate(phase.targetDate)}
        </span>
        <Badge tone="info" className="text-[10px]">{phase.milestones.length} milestones</Badge>
        <Badge tone="neutral" className="text-[10px]">{totalTasks} tasks</Badge>
        <span className="text-xs text-surface-500 flex items-center gap-1"><Clock size={11} />{totalHours}h</span>
      </button>
      {expanded && (
        <div className="p-2 space-y-1">
          {phase.milestones.map((ms) => (
            <MilestoneSection key={ms.id} milestone={ms} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarningBanner({ warnings }: { warnings: GeneratorWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 p-3 rounded-lg border ${
            w.severity === 'error'
              ? 'bg-danger-500/10 border-danger-500/20'
              : w.severity === 'warning'
              ? 'bg-warning-500/10 border-warning-500/20'
              : 'bg-info-500/10 border-info-500/20'
          }`}
        >
          <AlertTriangle size={16} className={
            w.severity === 'error' ? 'text-danger-400' :
            w.severity === 'warning' ? 'text-warning-400' : 'text-info-400'
          } />
          <p className={`text-sm ${
            w.severity === 'error' ? 'text-danger-300' :
            w.severity === 'warning' ? 'text-warning-300' : 'text-info-300'
          }`}>{w.message}</p>
        </div>
      ))}
    </div>
  );
}

export function ImportRoadmapPreview({ plan, warnings, onImport, onBack, importing }: ImportRoadmapPreviewProps) {
  const { stats } = plan;

  return (
    <div className="space-y-4">
      <WarningBanner warnings={warnings} />

      <div className="flex flex-wrap gap-3 p-4 bg-surface-800/50 rounded-xl">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Phases:</span>
          <span className="font-semibold text-surface-100">{stats.totalPhases}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Milestones:</span>
          <span className="font-semibold text-surface-100">{stats.totalMilestones}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Tasks:</span>
          <span className="font-semibold text-surface-100">{stats.totalTasks}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Total:</span>
          <span className="font-semibold text-surface-100">{stats.totalEstimatedHours}h</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Working days:</span>
          <span className="font-semibold text-surface-100">{stats.totalWorkingDays}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Utilization:</span>
          <span className={`font-semibold ${stats.utilization > 100 ? 'text-danger-400' : stats.utilization > 90 ? 'text-warning-400' : 'text-success-400'}`}>
            {stats.utilization}%
          </span>
        </div>
      </div>

      {Object.keys(stats.hoursByType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.hoursByType).map(([type, hours]) => (
            <Badge key={type} tone={TASK_TYPE_COLORS[type] as any || 'neutral'} className="text-xs">
              {TASK_TYPE_LABELS[type] || type}: {hours}h
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {plan.phases.map((phase) => (
          <PhaseSection key={phase.id} phase={phase} />
        ))}
      </div>

      <div className="flex gap-3 pt-4 border-t border-surface-800">
        <Button variant="secondary" onClick={onBack}>
          Back to Input
        </Button>
        <Button onClick={onImport} loading={importing} className="flex-1 sm:flex-none">
          Create Roadmap
        </Button>
      </div>
    </div>
  );
}
