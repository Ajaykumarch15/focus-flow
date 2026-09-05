import type { CollaborativeTask, WorkspaceMember } from '@collab/types/collaboration';

// ── S3-T4: pure Mission Control "team today" selector (ECIS B.7 · G) ─────────
// Answers "What is the state of our work today?" with the two lead facts the
// tuned landing surfaces before any stat card: who is in focus right now, and
// which workspace tasks are in progress. 100% pure — same inputs always produce
// the same result, no Date.now(), no localStorage, no side effects. Unknown
// assignees and members without a focus task resolve to `null` so the surface
// renders an honest gap (nothing fabricated).

export interface TeamWorkingMember {
  memberId: string;
  memberName: string;
  focusTask: string | null;
  focusTimeMs: number | null;
}

export interface TeamTodayItem {
  taskId: string;
  title: string;
  priority: CollaborativeTask['priority'];
  assigneeId: string | null;
  assigneeName: string | null;
  assignedToMe: boolean;
  branch: string | null;
  updatedAt: number;
}

export interface TeamTodayView {
  working: TeamWorkingMember[];
  inProgress: TeamTodayItem[];
}

const PRIORITY_RANK: Record<CollaborativeTask['priority'], number> = { urgent: 4, high: 3, medium: 2, low: 1 };

function toMs(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function selectTeamToday(
  workspaceTasks: Pick<
    CollaborativeTask,
    'id' | 'title' | 'priority' | 'assigneeId' | 'sprintStatus' | 'gitContext' | 'updatedAt'
  >[],
  members: Pick<WorkspaceMember, 'id' | 'name' | 'status' | 'currentFocusTask' | 'currentFocusTimeMs'>[],
  userId: string | null,
  limit = 6,
): TeamTodayView {
  const memberById = new Map(members.map((m) => [m.id, m]));

  const working = members
    .filter((m) => m.status === 'in_focus')
    .map((m) => ({
      memberId: m.id,
      memberName: m.name,
      focusTask: m.currentFocusTask ?? null,
      focusTimeMs: typeof m.currentFocusTimeMs === 'number' ? m.currentFocusTimeMs : null,
    }));

  const inProgress = workspaceTasks
    .filter((t) => t.sprintStatus === 'in_progress')
    .map((t) => {
      const assignee = t.assigneeId ? memberById.get(t.assigneeId) : undefined;
      return {
        taskId: t.id,
        title: t.title,
        priority: t.priority,
        assigneeId: t.assigneeId ?? null,
        assigneeName: assignee?.name ?? null,
        assignedToMe: Boolean(t.assigneeId && userId && t.assigneeId === userId),
        branch: t.gitContext?.branch ?? null,
        updatedAt: toMs(t.updatedAt),
      };
    })
    .sort(
      (a, b) =>
        Number(b.assignedToMe) - Number(a.assignedToMe) ||
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, limit);

  return { working, inProgress };
}
