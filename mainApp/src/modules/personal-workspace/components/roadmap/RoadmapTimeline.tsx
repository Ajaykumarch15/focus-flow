import { useMemo } from 'react';
import { Layers, Minus, Trash2 } from 'lucide-react';
import { selectMilestoneProgress } from '@personal/services/roadmapSelectors';
import {
  compareByTargetDate,
  expandSpan,
  milestoneAxisX,
  selectTimelineSpan,
  selectTimelineTicks,
} from '@personal/services/roadmapTimeline';
import { RoadmapStatusBadge } from './RoadmapStatusBadge';
import { formatDateShort } from '@shared/utils/time';
import type { RoadmapMilestone, RoadmapPhase } from '@collab/types/collaboration';

// EEP2-P3.4.5 / DDS §9: the Roadmap timeline view — Milestones placed along a
// horizontal time axis by `targetDate`, each with a live progress bar. Dates
// are honest: a Milestone without a `targetDate` cannot sit on the axis, so it
// renders in an "Undated" lane with a literal `-` in place of the date and no
// axis marker. The pure math lives in lib/roadmapTimeline (shared with the
// personal Basic Roadmap timeline) and is re-exported here for compatibility.
export { expandSpan, milestoneAxisX, selectTimelineSpan, selectTimelineTicks };

const statusColor = (status: RoadmapMilestone['status']) =>
  status === 'completed' ? 'bg-success-500' : status === 'active' ? 'bg-brand-500' : 'bg-info-500';

interface RoadmapTimelineProps {
  milestones: RoadmapMilestone[];
  phases: RoadmapPhase[];
  onOpen: (milestone: RoadmapMilestone) => void;
  onDelete: (milestone: RoadmapMilestone) => void;
}

export function RoadmapTimeline({ milestones, phases, onOpen, onDelete }: RoadmapTimelineProps) {
  const span = useMemo(() => selectTimelineSpan(milestones), [milestones]);
  const ticks = useMemo(() => (span ? selectTimelineTicks(span) : []), [span]);

  // Timeline rows sort by date (undated last), then by `order` for stability.
  const rows = useMemo(
    () => [...milestones].sort(compareByTargetDate),
    [milestones],
  );

  if (milestones.length === 0) return null;

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 overflow-x-auto">
      <div className="min-w-[720px] space-y-4">
        {/* Axis header */}
        <div className="grid grid-cols-[220px_1fr_120px] items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Milestone</span>
          <div className="relative h-5">
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2 text-[10px] font-semibold text-surface-600"
                style={{ left: `${t.x}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
          <span className="text-right text-[11px] font-bold uppercase tracking-wider text-surface-500">Target</span>
        </div>

        {/* Timeline rows */}
        <div className="space-y-3">
          {rows.map((milestone) => {
            const progress = selectMilestoneProgress(milestone, phases);
            const x = span ? milestoneAxisX(milestone, span) : null;
            const fillTone = progress.pct === 100 ? 'bg-success-500' : 'bg-brand-500';
            return (
              <div key={milestone.id} className="grid grid-cols-[220px_1fr_120px] items-center gap-3 group">
                {/* Name */}
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen(milestone)}
                    className="flex items-center gap-2 min-w-0 text-left w-full group-hover:text-brand-300 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(milestone.status)}`} />
                    <span className="truncate text-xs font-bold text-surface-100">{milestone.name}</span>
                  </button>
                  <div className="mt-1">
                    <RoadmapStatusBadge status={milestone.status} />
                  </div>
                </div>

                {/* Track: progress bar + date marker */}
                <div className="relative h-7 flex items-center">
                  <div className="absolute inset-x-0 h-2.5 rounded-full bg-surface-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${fillTone} transition-all duration-500`}
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                  {x !== null ? (
                    <div
                      className="absolute top-1 bottom-1 w-0.5 rounded bg-surface-300"
                      style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
                      title={milestone.targetDate ?? undefined}
                    />
                  ) : (
                    <Minus
                      size={14}
                      className="absolute left-1/2 -translate-x-1/2 text-surface-600"
                      aria-label="No target date"
                    />
                  )}
                </div>

                {/* Date — honest `-` when unset */}
                <div className="text-right text-[11px] font-mono text-surface-400 flex items-center justify-end gap-2">
                  {progress.total > 0 && (
                    <span className="flex items-center gap-1 text-surface-600">
                      <Layers size={11} />
                      {progress.done}/{progress.total}
                    </span>
                  )}
                  {milestone.targetDate
                    ? formatDateShort(new Date(`${milestone.targetDate}T00:00:00`))
                    : <Minus size={12} className="text-surface-600" aria-label="No target date" />}
                  <button
                    type="button"
                    onClick={() => onDelete(milestone)}
                    aria-label={`Delete ${milestone.name}`}
                    className="p-1 rounded text-surface-600 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {rows.length === 0 && (
          <p className="text-xs text-surface-500 italic py-6 text-center">
            No milestones to plot.
          </p>
        )}
      </div>
    </div>
  );
}
