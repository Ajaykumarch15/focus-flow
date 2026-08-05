import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertOctagon, ArrowLeft, Flag, Gauge, History, Layers,
  ListChecks, Rocket, UserCheck, Users,
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { selectProjectOverview } from '../../lib/projectOverviewSelectors';
import type { BlockerSeverity, ProjectMilestone } from '../../types/collaboration';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Progress } from '../../components/ui/Progress';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { WorkItemTypeBadge } from '../../components/collaboration/WorkItemTypeBadge';
import { formatDateShort, formatRelativeTime } from '../../utils/time';

const SEVERITY_TONE: Record<BlockerSeverity, 'danger' | 'warning' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'warning',
  low: 'neutral',
};

const MILESTONE_STATUS: Record<ProjectMilestone['status'], { label: string; tone: 'success' | 'brand' | 'info' }> = {
  completed: { label: 'Released', tone: 'success' },
  active: { label: 'Active', tone: 'brand' },
  planning: { label: 'Planning', tone: 'info' },
};

function HealthStat({
  label, icon, value, sub, toneClass,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  sub: string;
  toneClass: string;
}) {
  return (
    <div className={`rounded-2xl border border-surface-800 bg-gradient-to-br ${toneClass} p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-surface-400">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-display font-extrabold text-surface-50">{value}</p>
      <p className="text-[11px] text-surface-400 mt-1 font-medium">{sub}</p>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-display font-extrabold text-surface-50 flex items-center gap-2">
      {icon}
      {children}
    </h2>
  );
}

export function ProjectOverviewPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const { projects, sprints, features, tasks, members, teams, blockers, activeWorkspaceId } = useCollaborationStore();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId && p.workspaceId === (workspaceId ?? activeWorkspaceId)),
    [projects, projectId, workspaceId, activeWorkspaceId],
  );

  const overview = useMemo(
    () => (project ? selectProjectOverview({ project, sprints, features, tasks, members, teams, blockers }) : null),
    [project, sprints, features, tasks, members, teams, blockers],
  );

  const wsKey = workspaceId ?? activeWorkspaceId;
  const projectsUrl = `/w/${wsKey}/projects`;

  if (!project || !overview) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <EmptyState
          icon={<Rocket size={26} />}
          title="Project not found"
          description="This project does not exist in the current workspace, or it may have been removed."
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate(projectsUrl)} leftIcon={<ArrowLeft size={14} />}>
              Back to Projects
            </Button>
          }
        />
      </div>
    );
  }

  const { health, currentSprint, teamProgress, sprintProgress } = overview;
  const velocityLabel = health.velocity.pct !== null ? `${health.velocity.pct}%` : '—';

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title={overview.project.name}
        description={overview.project.description || `Engineering overview for ${overview.project.key}.`}
        eyebrow={`${overview.project.key} · ${overview.project.status}`}
        icon={<Rocket size={18} className="text-cyan-400" />}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(projectsUrl)} leftIcon={<ArrowLeft size={14} />}>
            Back to Projects
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthStat
          label="Sprint Velocity"
          icon={<Gauge size={16} className="text-brand-400" />}
          value={velocityLabel}
          sub={currentSprint ? `${health.velocity.delivered}/${currentSprint.targetVelocity} pts delivered` : 'No active sprint'}
          toneClass="from-brand-500/10 to-surface-900"
        />
        <HealthStat
          label="Feature Completion"
          icon={<ListChecks size={16} className="text-emerald-400" />}
          value={health.featureCompletion !== null ? `${health.featureCompletion}%` : '—'}
          sub={health.featureCompletion !== null ? 'of project features done' : 'No features yet'}
          toneClass="from-emerald-500/10 to-surface-900"
        />
        <HealthStat
          label="Open Blockers"
          icon={<AlertOctagon size={16} className="text-amber-400" />}
          value={health.openBlockers}
          sub={health.openBlockers === 1 ? 'blocker open' : 'blockers open'}
          toneClass="from-amber-500/10 to-surface-900"
        />
        <HealthStat
          label="Pending Reviews"
          icon={<UserCheck size={16} className="text-purple-400" />}
          value={health.pendingReviews}
          sub={health.pendingReviews === 1 ? 'task awaiting review' : 'tasks awaiting review'}
          toneClass="from-purple-500/10 to-surface-900"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle icon={<Layers size={16} className="text-purple-400" />}>Current Sprint</SectionTitle>
              {currentSprint && <StatusBadge status="active" label="Active" />}
            </div>
            {currentSprint ? (
              <>
                <div>
                  <h3 className="text-base font-display font-bold text-surface-50">{currentSprint.name}</h3>
                  <p className="text-xs text-surface-400 italic mt-0.5">{currentSprint.goal}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-surface-850 border border-surface-800 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Dates</p>
                    <p className="font-semibold text-surface-200 mt-1">
                      {formatDateShort(new Date(currentSprint.startDate))} → {formatDateShort(new Date(currentSprint.endDate))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-850 border border-surface-800 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Capacity</p>
                    <p className="font-semibold text-surface-200 mt-1">{currentSprint.capacityHours}h</p>
                  </div>
                  <div className="rounded-xl bg-surface-850 border border-surface-800 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Target Velocity</p>
                    <p className="font-semibold text-surface-200 mt-1">{currentSprint.targetVelocity} pts</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Progress value={sprintProgress.pct} ariaLabel="Sprint task progress" />
                  <p className="text-[11px] text-surface-400">
                    {sprintProgress.done}/{sprintProgress.total} tasks · {health.velocity.delivered}/{currentSprint.targetVelocity} pts delivered
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-surface-500 italic">No sprint is active for this project yet.</p>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <SectionTitle icon={<ListChecks size={16} className="text-emerald-400" />}>Active Features</SectionTitle>
            {overview.activeFeatures.length > 0 ? (
              <ul className="space-y-3">
                {overview.activeFeatures.map(({ feature, progress }) => (
                  <li key={feature.id} className="rounded-xl bg-surface-850 border border-surface-800 p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <WorkItemTypeBadge type={feature.type} />
                        <h3 className="text-sm font-semibold text-surface-100 truncate">{feature.name}</h3>
                      </div>
                      <StatusBadge status={feature.status} />
                    </div>
                    {progress.pct !== null ? (
                      <>
                        <Progress value={progress.pct} ariaLabel={`${feature.name} progress`} />
                        <p className="text-[11px] text-surface-400">
                          {progress.done}/{progress.total} linked tasks done · {progress.pct}%
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-surface-500 italic">No linked tasks yet.</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-surface-500 italic">No features are being worked on right now.</p>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <SectionTitle icon={<Users size={16} className="text-cyan-400" />}>Team Progress</SectionTitle>
            <div className="space-y-1.5">
              <Progress value={teamProgress.pct} ariaLabel="Project task progress" tone={teamProgress.pct >= 100 ? 'success' : 'brand'} />
              <p className="text-[11px] text-surface-400">
                {teamProgress.done}/{teamProgress.total} tasks done · {teamProgress.pct}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {overview.members.map((m) => (
                <Badge key={m.id} tone="neutral" className="border border-surface-800 px-2.5 py-1">
                  {m.name}
                </Badge>
              ))}
              {overview.teams.map((t) => (
                <Badge key={t.id} tone="info" className="border border-surface-800 px-2.5 py-1">
                  {t.name} team
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <SectionTitle icon={<History size={16} className="text-brand-400" />}>Recent Work</SectionTitle>
            {overview.recentWork.length > 0 ? (
              <ul className="space-y-3">
                {overview.recentWork.map((t) => {
                  const assignee = overview.members.find((m) => m.id === t.assigneeId);
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-surface-100 truncate">{t.title}</h3>
                        <p className="text-[11px] text-surface-500 mt-0.5">
                          {assignee?.name ?? 'Unassigned'} · {formatRelativeTime(t.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge status={t.sprintStatus} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-surface-500 italic">No recent work yet.</p>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <SectionTitle icon={<AlertOctagon size={16} className="text-amber-400" />}>Blockers</SectionTitle>
            {overview.blockers.length > 0 ? (
              <ul className="space-y-3">
                {overview.blockers.map((b) => (
                  <li key={b.id} className="rounded-xl bg-surface-850 border border-surface-800 p-3.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={SEVERITY_TONE[b.severity]} className="text-[10px] font-extrabold uppercase">
                        {b.severity}
                      </Badge>
                      <StatusBadge status={b.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-surface-100">{b.title}</h3>
                    {b.taskTitle && <p className="text-[11px] text-surface-500">On: {b.taskTitle}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-surface-500 italic">No blockers raised for this project.</p>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <SectionTitle icon={<Flag size={16} className="text-success-400" />}>Releases & Milestones</SectionTitle>
            {overview.milestones.length > 0 ? (
              <ul className="space-y-3">
                {overview.milestones.map((ms) => {
                  const meta = MILESTONE_STATUS[ms.status];
                  return (
                    <li key={ms.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-surface-100 truncate">{ms.title}</h3>
                        <p className="text-[11px] text-surface-500 mt-0.5">Due: {formatDateShort(new Date(ms.dueDate))} · {ms.targetPoints} pts</p>
                      </div>
                      <Badge tone={meta.tone} className="text-[10px] font-extrabold uppercase">
                        {meta.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-surface-500 italic">No milestones scheduled yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
