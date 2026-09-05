import type { ReactNode } from 'react';
import { Zap, Play, Pause, Users, ListChecks, GitBranch, ArrowRight, Plus } from 'lucide-react';
import type { NowContext } from '@personal/services/nowSelectors';
import type { TeamTodayItem, TeamTodayView, TeamWorkingMember } from '@personal/services/missionControlSelectors';
import { Button } from '@shared/components/ui/Button';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Avatar, AvatarGroup } from '@shared/components/ui/Avatar';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { Progress } from '@shared/components/ui/Progress';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { formatMs } from '@shared/utils/time';

// ── S3-T4: TeamTodaySection ───────────────────────────────────────────────────
// The "lead" block of Mission Control (ECIS B.7). Answers "What is the state of
// our work today?" before any stat card: the viewer's running session (running
// timer + one-tap resume), today's focused time, who is in focus now, and which
// workspace tasks are in progress. Pure presentational — every value is derived
// upstream by selectors and passed in; nothing is fabricated here.

interface TeamTodaySectionProps {
  loading: boolean;
  error: string | null;
  running: NowContext | null;
  timerLabel: string;
  todayLabel: string | null;
  goalPct: number | null;
  view: TeamTodayView;
  accent: string;
  workspaceName: string;
  dateLabel: string;
  onResume: () => void;
  onPause: () => void;
  onOpenFocus: () => void;
  onStartToday: () => void;
  onOpenTask: (taskId: string) => void;
}

const PRIORITY_TONE: Record<TeamTodayItem['priority'], BadgeTone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'brand',
  low: 'neutral',
};

export function TeamTodaySection({
  loading, error, running, timerLabel, todayLabel, goalPct, view,
  accent, workspaceName, dateLabel,
  onResume, onPause, onOpenFocus, onStartToday, onOpenTask,
}: TeamTodaySectionProps) {
  const hasContent = Boolean(running) || view.working.length > 0 || view.inProgress.length > 0;
  const showSkeleton = loading && !hasContent && !error;
  const showError = Boolean(error) && !hasContent;

  return (
    <section aria-label="Team today" className="space-y-6">
      {/* ── Lead hero: running timer + today's focus ── */}
      <div className="relative overflow-hidden rounded-3xl border border-surface-800/60 bg-surface-900 p-6 lg:p-7">
        <div
          className="absolute top-0 right-0 w-[420px] h-[280px] opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top right, ${accent}40, transparent 70%)` }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                Team Today
              </Badge>
              <span className="text-[11px] text-surface-500 font-medium">{dateLabel}</span>
              <span className="text-[11px] text-surface-500 font-medium truncate">· {workspaceName}</span>
            </div>

            {showSkeleton ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-8 w-64 rounded-xl" />
                <Skeleton className="h-4 w-56 rounded" />
              </div>
            ) : showError ? (
              <p className="text-xs text-danger-400 font-semibold">{error}</p>
            ) : running ? (
              <>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs text-surface-400 font-semibold">Focusing now</span>
                  <StatusBadge status={running.sessionState} />
                </div>
                <p className="text-lg font-display font-extrabold text-surface-50 truncate">{running.title}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {running.branch && (
                    <Badge tone="neutral" icon={<GitBranch size={11} />} className="font-mono">
                      {running.branch}
                    </Badge>
                  )}
                  <span className="timer-display text-lg font-bold text-brand-400" aria-live="polite">{timerLabel}</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-display font-extrabold text-surface-50">Nothing running right now.</p>
                <p className="text-xs text-surface-400 mt-1">Resume a task or start a fresh focus session to pick up today's work.</p>
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-5">
              {running?.sessionState === 'running' && running.taskId && (
                <Button size="sm" variant="outline" leftIcon={<Pause size={13} />} onClick={onPause}>Pause</Button>
              )}
              {running?.sessionState === 'paused' && running.taskId && (
                <Button size="sm" leftIcon={<Play size={13} />} onClick={onResume}>Resume</Button>
              )}
              {running ? (
                <Button size="sm" leftIcon={<Zap size={13} />} style={{ backgroundColor: accent, boxShadow: `0 6px 18px -4px ${accent}50` }} onClick={onOpenFocus}>
                  Open Focus
                </Button>
              ) : (
                <Button size="sm" leftIcon={<Plus size={13} />} style={{ backgroundColor: accent, boxShadow: `0 6px 18px -4px ${accent}50` }} onClick={onStartToday}>
                  Start something
                </Button>
              )}
            </div>
          </div>

          {/* Today's focus */}
          <div className="w-full lg:w-52 shrink-0 rounded-2xl border border-surface-800/60 bg-surface-950/40 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-2">Today's Focus</p>
            <p className="text-3xl font-display font-extrabold text-surface-50 leading-none">{todayLabel ?? '—'}</p>
            <div className="mt-3">
              {goalPct === null ? (
                <p className="text-[11px] text-surface-500">Set a daily goal in Settings to track progress.</p>
              ) : (
                <>
                  <Progress value={goalPct} tone={goalPct >= 100 ? 'success' : 'brand'} className="h-1.5" ariaLabel="Daily goal progress" />
                  <p className="text-[11px] text-surface-400 mt-1.5 font-semibold">{goalPct}% of daily goal</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Team Today lists ── */}
      {!showSkeleton && !showError && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodayCard
            icon={<Users size={15} className="text-cyan-400" />}
            title="Working Now"
            count={view.working.length}
            headerExtra={
              view.working.length > 0 ? (
                <AvatarGroup items={view.working.map(m => ({ name: m.memberName }))} max={3} size="xs" className="ml-auto" />
              ) : undefined
            }
          >
            {view.working.length === 0 ? (
              <p className="text-xs text-surface-500 italic py-4 text-center">No one is in focus right now.</p>
            ) : (
              <div className="space-y-2">
                {view.working.map((m) => <WorkingRow key={m.memberId} member={m} />)}
              </div>
            )}
          </TodayCard>

          <TodayCard icon={<ListChecks size={15} className="text-brand-400" />} title="In Progress" count={view.inProgress.length}>
            {view.inProgress.length === 0 ? (
              <p className="text-xs text-surface-500 italic py-4 text-center">Nothing in progress right now.</p>
            ) : (
              <div className="space-y-2">
                {view.inProgress.map((t) => <TaskRow key={t.taskId} item={t} onOpen={() => onOpenTask(t.taskId)} />)}
              </div>
            )}
          </TodayCard>
        </div>
      )}
    </section>
  );
}

function TodayCard({ icon, title, count, headerExtra, children }: {
  icon: ReactNode; title: string; count: number; headerExtra?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
      <h3 className="flex items-center gap-2 font-display font-extrabold text-surface-50 text-sm">
        {icon}
        {title}
        <Badge tone="neutral" className="text-[10px] font-extrabold">{count}</Badge>
        {headerExtra && <span className="ml-auto">{headerExtra}</span>}
      </h3>
      {children}
    </div>
  );
}

function WorkingRow({ member }: { member: TeamWorkingMember }) {
  return (
    <div className="p-3 rounded-xl bg-surface-850 border border-surface-800 flex items-center gap-3 text-xs">
      <Avatar name={member.memberName} size="sm" className="ring-2 ring-surface-850" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-surface-100 truncate">{member.memberName}</p>
        <p className="text-[10px] text-surface-400 truncate">{member.focusTask ?? 'No current task'}</p>
      </div>
      {member.focusTimeMs != null && (
        <span className="font-mono text-[10px] text-cyan-400 font-bold shrink-0">{formatMs(member.focusTimeMs)}</span>
      )}
    </div>
  );
}

function TaskRow({ item, onOpen }: { item: TeamTodayItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${item.title}`}
      className="w-full text-left p-3 rounded-xl bg-surface-850 border border-surface-800 hover:border-surface-700 hover:bg-surface-900 transition-all group flex items-center gap-3 text-xs">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge tone={PRIORITY_TONE[item.priority]} className="text-[10px] font-bold uppercase">{item.priority}</Badge>
          {item.assignedToMe && <Badge tone="brand" className="text-[10px] font-bold uppercase">Yours</Badge>}
        </div>
        <p className="font-bold text-surface-100 truncate">{item.title}</p>
        <p className="text-[10px] text-surface-400 truncate">{item.assigneeName ?? 'Unassigned'}</p>
      </div>
      {item.branch && (
        <Badge tone="neutral" icon={<GitBranch size={11} />} className="hidden sm:inline-flex font-mono">{item.branch}</Badge>
      )}
      <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors shrink-0" />
    </button>
  );
}
