import { useMemo, useState } from 'react';
import { CalendarRange, Layers, Minus, BarChart3, Waypoints, ZoomIn, ZoomOut } from 'lucide-react';
import {
  milestoneAxisX,
  parseUtc,
  selectTimelineSpan,
  selectTimelineTicks,
  sortMilestonesChronologically,
  splitDatedUndated,
  todayAxisX,
} from '@personal/services/roadmapTimeline';
import { formatDateShort } from '@shared/utils/time';
import { getDetailHealth } from '@personal/services/roadmapProgress';
import type { RoadmapMilestoneDoc, RoadmapMilestoneStatus } from '@personal/types/roadmap';

// B9 · Basic Roadmap timeline: personal milestones on a targetDate axis.
// Reuses the collaboration timeline's pure math (lib/roadmapTimeline) and
// FocusFlow visual language. Undated milestones stay visible in an explicit
// "Undated" lane; a Today marker appears only when today is inside the span.

const STATUS_DOT: Record<RoadmapMilestoneStatus, string> = {
  completed: 'bg-success-500',
  'in-progress': 'bg-brand-500',
  todo: 'bg-surface-600',
};

interface PersonalRoadmapTimelineProps {
  milestones: RoadmapMilestoneDoc[];
  startDate?: string | null;
  targetDate?: string | null;
  status?: string | null;
  progress?: number;
  todayKey?: string;
  onOpen: (milestone: RoadmapMilestoneDoc) => void;
}

export function PersonalRoadmapTimeline({
  milestones,
  startDate,
  targetDate,
  status,
  progress,
  todayKey,
  onOpen,
}: PersonalRoadmapTimelineProps) {
  const [viewMode, setViewMode] = useState<'dots' | 'gantt'>('gantt');
  const [zoomLevel, setZoomLevel] = useState(1);
  const span = useMemo(() => selectTimelineSpan(milestones), [milestones]);
  const ticks = useMemo(() => (span ? selectTimelineTicks(span, Math.round(5 * zoomLevel)) : []), [span, zoomLevel]);
  const { dated, undated } = useMemo(() => splitDatedUndated(milestones), [milestones]);
  const ordered = useMemo(() => sortMilestonesChronologically(milestones), [milestones]);

  const key = todayKey ?? new Date().toISOString().slice(0, 10);
  const todayX = span ? todayAxisX(key, span) : null;
  const health = status !== undefined
    ? getDetailHealth({ status, progress: progress ?? 0, startDate, targetDate })
    : null;

  // Gantt bar calculations
  const spanStart = span?.min ?? 0;
  const spanRange = (span?.max ?? 0) - spanStart || 1;

  const getBarPositions = (milestone: RoadmapMilestoneDoc) => {
    if (!span || !milestone.targetDate) return null;
    const targetMs = parseUtc(milestone.targetDate);
    const idx = dated.findIndex(m => m._id === milestone._id);
    let startMs: number;
    if (startDate) {
      startMs = parseUtc(startDate);
    } else if (idx > 0 && dated[idx - 1].targetDate) {
      startMs = parseUtc(dated[idx - 1].targetDate!);
    } else {
      startMs = spanStart;
    }
    const startX = ((startMs - spanStart) / spanRange) * 100;
    const endX = ((targetMs - spanStart) / spanRange) * 100;
    return { startX: Math.max(0, startX), endX: Math.min(100, endX) };
  };

  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-8 text-center">
        <CalendarRange size={28} className="mx-auto text-surface-600 mb-2" />
        <p className="text-sm font-semibold text-surface-300">No milestones yet</p>
        <p className="text-xs text-surface-500 mt-1">
          Add milestones with target dates to see them plotted on the roadmap timeline.
        </p>
      </div>
    );
  }

  const rangeLabel = startDate || targetDate
    ? `${startDate ? formatDateShort(new Date(`${startDate}T00:00:00`)) : '—'} → ${targetDate ? formatDateShort(new Date(`${targetDate}T00:00:00`)) : '—'}`
    : null;

  const renderRow = (milestone: RoadmapMilestoneDoc) => {
    const x = span ? milestoneAxisX(milestone, span) : null;
    const bar = getBarPositions(milestone);
    const overdue =
      !!milestone.targetDate &&
      milestone.status !== 'completed' &&
      milestone.targetDate < key;
    return (
      <div key={milestone._id} className="grid grid-cols-[220px_1fr_120px] items-center gap-3 group">
        {/* Name + status */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(milestone)}
            className="flex items-center gap-2 min-w-0 text-left w-full group-hover:text-brand-300 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[milestone.status] ?? 'bg-surface-600'}`} />
            <span className="truncate text-xs font-bold text-surface-100">{milestone.title}</span>
          </button>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-surface-500">
            {milestone.status}
          </p>
        </div>

        {/* Track: Gantt bar or dot */}
        <div className="relative h-8 flex items-center">
          {todayX !== null && (
            <div
              data-testid="today-marker"
              className="absolute -top-1 -bottom-1 w-px bg-brand-400/70 z-10"
              style={{ left: `${todayX}%` }}
              title="Today"
            />
          )}
          {viewMode === 'gantt' && bar ? (
            // Gantt bar
            <div className="absolute inset-y-0 flex items-center" style={{ left: `${bar.startX}%`, width: `${bar.endX - bar.startX}%` }}>
              <div className={`w-full h-5 rounded-md relative overflow-hidden ${
                milestone.status === 'completed' ? 'bg-emerald-500/25 border border-emerald-500/40' :
                overdue ? 'bg-red-500/20 border border-red-500/40' :
                'bg-brand-500/20 border border-brand-500/30'
              }`}>
                <div
                  className={`absolute inset-y-0 left-0 rounded-l-md transition-all duration-500 ${
                    milestone.status === 'completed' ? 'bg-emerald-500/60' : 'bg-brand-500/60'
                  }`}
                  style={{ width: `${milestone.progress}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-surface-200 z-10">
                  {milestone.progress}%
                </span>
              </div>
            </div>
          ) : x !== null ? (
            // Dot marker
            <div
              className={`absolute top-1 bottom-1 w-0.5 rounded ${overdue ? 'bg-red-400' : 'bg-surface-300'}`}
              style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
              title={milestone.targetDate}
            />
          ) : (
            <Minus size={14} className="absolute left-1/2 -translate-x-1/2 text-surface-600" aria-label="No target date" />
          )}
        </div>

        {/* Target date — honest `-` when unset */}
        <div className="text-right text-[11px] font-mono flex items-center justify-end gap-2">
          {milestone.totalTasks > 0 && (
            <span className="flex items-center gap-1 text-surface-600">
              <Layers size={11} />
              {milestone.completedTasks}/{milestone.totalTasks}
            </span>
          )}
          {milestone.targetDate ? (
            <span className={overdue ? 'text-red-400 font-semibold' : 'text-surface-400'}>
              {formatDateShort(new Date(`${milestone.targetDate}T00:00:00`))}
            </span>
          ) : (
            <Minus size={12} className="text-surface-600" aria-label="No target date" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 overflow-x-auto">
      <div className="min-w-[720px] space-y-4">
        {/* Roadmap range + health + controls */}
        {(rangeLabel || health) && (
          <div className="flex items-center justify-between gap-3">
            {rangeLabel && (
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-surface-500">
                <CalendarRange size={13} />
                Roadmap range · {rangeLabel}
              </div>
            )}
            <div className="flex items-center gap-2">
              {health && (
                <span
                  title={health.description}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${health.className} ${health.color}`}
                >
                  {health.label}
                </span>
              )}
              <div className="flex items-center gap-0.5 bg-surface-800 rounded-lg p-0.5">
                <button onClick={() => setViewMode('gantt')} className={`p-1.5 rounded-md text-xs transition-colors ${viewMode === 'gantt' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-500 hover:text-surface-300'}`} title="Gantt view">
                  <BarChart3 size={13} />
                </button>
                <button onClick={() => setViewMode('dots')} className={`p-1.5 rounded-md text-xs transition-colors ${viewMode === 'dots' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-500 hover:text-surface-300'}`} title="Dot view">
                  <Waypoints size={13} />
                </button>
              </div>
              <div className="flex items-center gap-0.5 bg-surface-800 rounded-lg p-0.5">
                <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-md text-surface-500 hover:text-surface-300 transition-colors" title="Zoom out">
                  <ZoomOut size={13} />
                </button>
                <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))} className="p-1.5 rounded-md text-surface-500 hover:text-surface-300 transition-colors" title="Zoom in">
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Axis header */}
        {span && (
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
        )}

        {/* Dated rows first (chronological), then an explicit Undated lane */}
        <div className="space-y-3">
          {dated.map(renderRow)}

          {undated.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Undated</span>
                <span className="h-px flex-1 bg-surface-800" />
                <span className="text-[10px] text-surface-600">{undated.length} milestone{undated.length > 1 ? 's' : ''}</span>
              </div>
              {undated.map(renderRow)}
            </>
          )}
        </div>

        {dated.length === 0 && undated.length > 0 && (
          <p className="text-[11px] text-surface-500 italic">
            All milestones are undated — set target dates to plot them on the axis.
          </p>
        )}

        {/* Full ordered list kept honest: same rows, chronological guarantee */}
        <p className="sr-only" data-testid="timeline-order">
          {ordered.map(m => m._id).join(',')}
        </p>
      </div>
    </div>
  );
}
