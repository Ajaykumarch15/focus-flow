import { create } from 'zustand';
import {
  Workspace, WorkspaceTeam, WorkspaceMember, Project, ProjectPatch,
  Feature, Sprint, CollaborativeTask, WorkspaceActivity, DiscussionComment,
  NotificationItem, KnowledgeDoc, CentralBlocker, TeamCalendarEvent,
  SprintStatus, BlockerSeverity, DocCategory, EventType, MemberRole,
  RoadmapMilestone, RoadmapPhase, RoadmapModule,
} from '../types/collaboration';
import { toast } from './useToastStore';
import { api } from '../utils/api';
import type { MilestoneUpdatePayload, PhaseUpdatePayload, ModuleUpdatePayload, SprintUpdatePayload } from '../utils/api';
import { runMutation } from '../utils/mutation';
import { useAuthStore } from './useAuthStore';

// IES-R1 (P5-T4): real authenticated user identity — replaces the hardcoded
// `'m1'` mock owner/author ids. Empty string when offline / not signed in.
function currentUserId(): string {
  return useAuthStore.getState().user?._id ?? '';
}

function currentUserName(): string {
  return useAuthStore.getState().user?.name ?? 'Unknown';
}

// ── API → frontend shape mappers (IES-P2-07: server docs → client models) ─────
const DEFAULT_WORKSPACE_SETTINGS: Workspace['settings'] = {
  allowMemberInvites: true,
  requireReviewForDone: false,
  autoSyncTimerWorkLogs: true,
  defaultVisibility: 'Workspace',
};

function workspaceIconFor(type: string): string {
  switch (type) {
    case 'Personal': return '🚀';
    case 'Startup': return '⚡';
    case 'Enterprise': return '🏢';
    case 'Open Source': return '🌐';
    case 'College Project': return '🎓';
    case 'Internship': return '💼';
    default: return '🚀';
  }
}

function toWorkspace(raw: any): Workspace {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: raw.name ?? 'Untitled Workspace',
    type: raw.type ?? 'Startup',
    icon: raw.icon ?? '🚀',
    description: raw.description ?? '',
    membersCount: Number(raw.membersCount ?? 0),
    projectsCount: Number(raw.projectsCount ?? 0),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    settings: {
      allowMemberInvites: raw.settings?.allowMemberInvites ?? DEFAULT_WORKSPACE_SETTINGS.allowMemberInvites,
      requireReviewForDone: raw.settings?.requireReviewForDone ?? DEFAULT_WORKSPACE_SETTINGS.requireReviewForDone,
      autoSyncTimerWorkLogs: raw.settings?.autoSyncTimerWorkLogs ?? DEFAULT_WORKSPACE_SETTINGS.autoSyncTimerWorkLogs,
      defaultVisibility: raw.settings?.defaultVisibility ?? DEFAULT_WORKSPACE_SETTINGS.defaultVisibility,
    },
  };
}

function toMember(raw: any): WorkspaceMember {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: raw.name ?? 'Unknown Member',
    email: raw.email ?? '',
    avatar: raw.avatar,
    role: raw.role ?? 'Developer',
    teams: raw.teams ?? [],
    status: 'available',
    currentFocusTask: undefined,
    currentFocusTimeMs: undefined,
    joinedAt: raw.joinedAt ? new Date(raw.joinedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function toTeam(raw: any): WorkspaceTeam {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    name: raw.name ?? 'Untitled Team',
    description: raw.description ?? '',
    memberIds: (raw.members ?? []).map((m: any) => String(m._id ?? m.id ?? m)),
    color: raw.color ?? '#0ea5e9',
    leaderId: raw.leaderId ? String(raw.leaderId) : undefined,
  };
}

function toProject(raw: any): Project {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Project',
    key: raw.nameKey ? raw.nameKey.toUpperCase() : (raw.name || 'PRJ').substring(0, 3).toUpperCase(),
    description: raw.description ?? '',
    repositoryUrl: raw.repositoryUrl,
    members: (raw.members ?? []).map((m: any) => String(m._id ?? m.id ?? m)),
    teamIds: (raw.teamIds ?? []).map(String),
    status: raw.status ?? 'active',
    milestones: raw.milestones ?? [],
    settings: raw.settings ?? {},
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

// ── IES-R1 (P5-T1): sprint/feature/collab-task mappers (mirror toProject) ──────
function toSprint(raw: any): Sprint {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    name: raw.name ?? 'Untitled Sprint',
    startDate: raw.startDate ? new Date(raw.startDate).toISOString().slice(0, 10) : '',
    endDate: raw.endDate ? new Date(raw.endDate).toISOString().slice(0, 10) : '',
    goal: raw.goal ?? '',
    status: raw.status ?? 'draft',
    committed: Boolean(raw.committed ?? false),
    commitmentDate: raw.commitmentDate ? new Date(raw.commitmentDate).toISOString() : undefined,
    committedBy: raw.committedBy ? String(raw.committedBy) : undefined,
    capacityHours: Number(raw.capacityHours ?? 0),
    targetVelocity: Number(raw.targetVelocity ?? 0),
    actualVelocity: raw.actualVelocity != null ? Number(raw.actualVelocity) : undefined,
  };
}

// ── EEP2-P3.3: roadmap spine mappers (DDS §4.5-4.7; mirror toSprint/toFeature).
// `projectRef`/`milestoneRef`/`phaseRef` become the client id fields; the legacy
// `planning` status was normalized to `planned` by migration 0013.
function toMilestone(raw: any): RoadmapMilestone {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Milestone',
    description: raw.description ?? '',
    targetDate: raw.targetDate ? new Date(raw.targetDate).toISOString().slice(0, 10) : null,
    order: Number(raw.order ?? 0),
    status: raw.status ?? 'planned',
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function toPhase(raw: any): RoadmapPhase {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    milestoneId: raw.milestoneRef ? String(raw.milestoneRef) : '',
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Phase',
    description: raw.description ?? '',
    status: raw.status ?? 'planned',
    order: Number(raw.order ?? 0),
    startDate: raw.startDate ? new Date(raw.startDate).toISOString().slice(0, 10) : null,
    endDate: raw.endDate ? new Date(raw.endDate).toISOString().slice(0, 10) : null,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function toModule(raw: any): RoadmapModule {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    phaseId: raw.phaseRef ? String(raw.phaseRef) : '',
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Module',
    description: raw.description ?? '',
    status: raw.status ?? 'planned',
    order: Number(raw.order ?? 0),
    ownerId: raw.ownerId ? String(raw.ownerId) : null,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

// Normalizes API date inputs (string | number | null) to the client's ISO-date
// (or null) shape used by optimistic updates. Undefined passes through untouched.
function toDateInputValue(v: string | number | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v == null) return null;
  return new Date(v).toISOString().slice(0, 10);
}

// Payload → optimistic client patch. The API payloads permit `number`
// timestamps; the client models use `string | null`, so dates are normalized
// before the optimistic merge (keeps the store shape stable).
function toMilestonePatch(patch: MilestoneUpdatePayload): Partial<RoadmapMilestone> {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.targetDate !== undefined ? { targetDate: toDateInputValue(patch.targetDate) as string | null } : {}),
    ...(patch.order !== undefined ? { order: patch.order } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
}

function toPhasePatch(patch: PhaseUpdatePayload): Partial<RoadmapPhase> {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.order !== undefined ? { order: patch.order } : {}),
    ...(patch.milestoneId !== undefined ? { milestoneId: patch.milestoneId } : {}),
    ...(patch.startDate !== undefined ? { startDate: toDateInputValue(patch.startDate) as string | null } : {}),
    ...(patch.endDate !== undefined ? { endDate: toDateInputValue(patch.endDate) as string | null } : {}),
  };
}

function toFeature(raw: any): Feature {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    sprintId: raw.sprintRef ? String(raw.sprintRef) : undefined,
    moduleId: raw.moduleRef ? String(raw.moduleRef) : undefined,
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Feature',
    description: raw.description ?? '',
    type: raw.type ?? 'feature',
    labels: (raw.labels ?? []).map(String),
    ownerId: raw.ownerId ? String(raw.ownerId) : undefined,
    estimatedHours: Number(raw.estimatedHours ?? 0),
    status: raw.status ?? 'backlog',
    order: Number(raw.order ?? 0),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function toCollabTask(raw: any): CollaborativeTask {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    sprintId: raw.sprintRef ? String(raw.sprintRef) : undefined,
    featureId: raw.featureRef ? String(raw.featureRef) : undefined,
    title: raw.title ?? 'Untitled Task',
    description: raw.description ?? '',
    sprintStatus: raw.sprintStatus ?? 'backlog',
    priority: raw.priority ?? 'medium',
    ownerId: String(raw.ownerId ?? raw.userId ?? ''),
    assigneeId: raw.assigneeId ? String(raw.assigneeId) : undefined,
    reviewerId: raw.reviewerId ? String(raw.reviewerId) : undefined,
    followerIds: (raw.followerIds ?? []).map(String),
    labels: (raw.labels ?? []).map(String),
    dependencies: (raw.dependencies ?? []).map(String),
    estimatedHours: Number(raw.estimatedHours ?? 0),
    actualHours: Number(raw.actualHours ?? 0),
    gitContext: raw.gitContext ?? undefined,
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.map((s: any) => ({
          id: String(s._id ?? s.id ?? ''),
          title: s.title ?? '',
          completed: Boolean(s.completed),
        }))
      : [],
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

// ── Interface & State ──────────────────────────────────────────────────────────
interface CollaborationStore {
  workspaces: Workspace[];
  workspacesLoading: boolean;
  activeWorkspaceId: string;
  members: WorkspaceMember[];
  teams: WorkspaceTeam[];
  projects: Project[];
  sprints: Sprint[];
  features: Feature[];
  milestones: RoadmapMilestone[];
  phases: RoadmapPhase[];
  modules: RoadmapModule[];
  tasks: CollaborativeTask[];
  activities: WorkspaceActivity[];
  activityLoading: boolean;
  activityHasMore: boolean;
  activityNextCursor: string | null;
  discussions: DiscussionComment[];
  notifications: NotificationItem[];
  notificationsLoading: boolean;
  notificationsHasMore: boolean;
  notificationsNextCursor: string | null;
  docs: KnowledgeDoc[];
  blockers: CentralBlocker[];
  events: TeamCalendarEvent[];

  // Loaders (IES-P2-07: real data replaces the removed seed).
  loadWorkspaces: () => Promise<void>;
  loadMembers: (workspaceId: string) => Promise<void>;
  loadTeams: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadSprints: () => Promise<void>;
  loadFeatures: () => Promise<void>;
  loadMilestones: () => Promise<void>;
  loadPhases: () => Promise<void>;
  loadModules: () => Promise<void>;
  loadTasks: () => Promise<void>;
  loadCollabData: () => Promise<void>;

  // Actions
  setActiveWorkspace: (id: string) => void;
  updateWorkspaceSettings: (workspaceId: string, settings: Partial<Workspace['settings']>) => Promise<void>;
  createWorkspace: (name: string, type: any, description: string) => Promise<Workspace | undefined>;
  createTeam: (name: string, description: string, color: string, memberIds: string[]) => Promise<void>;
  updateMemberRole: (memberId: string, role: MemberRole) => Promise<void>;
  updateMemberStatus: (memberId: string, status: any, currentTask?: string) => void;

  // Project & Sprint Actions
  createProject: (data: Partial<Project>) => Promise<Project | undefined>;
  // EEP2-P2.2.3: persist DDS §4.4 Project Info (description/key/status/members/
  // teamIds/settings). Optimistic with rollback — see updateWorkspaceSettings.
  updateProjectMeta: (projectId: string, patch: ProjectPatch) => Promise<void>;
  createFeature: (data: Partial<Feature>) => Promise<Feature | undefined>;
  createSprint: (projectId: string, name: string, startDate: string, endDate: string, goal: string, opts?: { capacityHours?: number; targetVelocity?: number }) => Promise<Sprint | undefined>;
  // EEP2-P4.3.2: planning-page persistence (DDS §10). updateSprint PATCHes
  // goals/capacity/velocity/dates/status; advanceSprintState is the lifecycle
  // step (draft → planned → active → completed); commitSprint latches the
  // one-way commitment (POST /sprints/:id/commit, Owner/Admin).
  updateSprint: (sprintId: string, patch: SprintUpdatePayload) => Promise<void>;
  advanceSprintState: (sprintId: string, status: Sprint['status']) => Promise<void>;
  commitSprint: (sprintId: string) => Promise<void>;
  createTask: (data: Partial<CollaborativeTask>) => Promise<CollaborativeTask | undefined>;
  updateTaskStatus: (taskId: string, sprintStatus: SprintStatus) => Promise<void>;
  // IES-R1 (P6-T3): drag a feature into/out of a Sprint (backlog ⇄ sprintRef).
  // `null` un-tethers the feature (back to the Project Backlog).
  moveFeature: (featureId: string, sprintId: string | null) => Promise<void>;
  // EEP2-P3.3.3: Roadmap spine CRUD (DDS §4.5-4.7). Delete nulls child refs
  // store-side to mirror the server's orphan-protection behaviour (§6.3).
  createMilestone: (data: Partial<RoadmapMilestone>) => Promise<RoadmapMilestone | undefined>;
  updateMilestone: (id: string, patch: MilestoneUpdatePayload) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  createPhase: (data: Partial<RoadmapPhase>) => Promise<RoadmapPhase | undefined>;
  updatePhase: (id: string, patch: PhaseUpdatePayload) => Promise<void>;
  deletePhase: (id: string) => Promise<void>;
  createModule: (data: Partial<RoadmapModule>) => Promise<RoadmapModule | undefined>;
  updateModule: (id: string, patch: ModuleUpdatePayload) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
  // EEP2-P3.3.3: move a Feature between Modules (or back to project-level with
  // `null`). Same-project revalidated server-side; `sprintRef` never touched.
  moveFeatureModule: (featureId: string, moduleId: string | null) => Promise<void>;
  updateGitContext: (taskId: string, gitData: Partial<CollaborativeTask['gitContext']>) => Promise<void>;

  // Discussions & Comments
  addComment: (targetType: 'task' | 'worklog' | 'project' | 'doc', targetId: string, content: string, parentCommentId?: string) => void;
  addReaction: (commentId: string, emoji: string) => void;
  resolveThread: (commentId: string) => void;

  // Notifications (IES-P2-05: real, user-scoped — no more seed data)
  loadNotifications: (opts?: { limit?: number; cursor?: string; append?: boolean }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Knowledge Base & Blockers & Calendar
  createDoc: (title: string, category: DocCategory, content: string, tags: string[]) => KnowledgeDoc;
  updateDoc: (id: string, title: string, content: string, tags: string[]) => void;
  createBlocker: (title: string, severity: BlockerSeverity, impactDescription: string, taskId?: string) => void;
  resolveBlocker: (id: string) => void;
  createEvent: (title: string, type: EventType, date: string, color: string) => void;

  // IES-P2-04: real workspace activity feed
  loadWorkspaceActivity: (workspaceId: string, opts?: { limit?: number; cursor?: string; append?: boolean }) => Promise<void>;
}

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  workspaces: [],
  workspacesLoading: false,
  activeWorkspaceId: '',
  members: [],
  teams: [],
  projects: [],
  sprints: [],
  features: [],
  milestones: [],
  phases: [],
  modules: [],
  tasks: [],
  activities: [],
  activityLoading: false,
  activityHasMore: false,
  activityNextCursor: null,
  discussions: [],
  notifications: [],
  notificationsLoading: false,
  notificationsHasMore: false,
  notificationsNextCursor: null,
  docs: [],
  blockers: [],
  events: [],

  // ── Loaders ─────────────────────────────────────────────────────────────────
  loadWorkspaces: async () => {
    set({ workspacesLoading: true });
    try {
      const rawList = await api.workspaces.list();
      const workspaces = (Array.isArray(rawList) ? rawList : []).map(toWorkspace);
      set((state) => {
        const stillValid = workspaces.some((w) => w.id === state.activeWorkspaceId);
        return {
          workspaces,
          activeWorkspaceId: stillValid ? state.activeWorkspaceId : workspaces[0]?.id ?? '',
        };
      });
    } catch {
      // IES-P2-07: a failed fetch must never crash the workspace pages (offline).
      set({ workspaces: [], activeWorkspaceId: '' });
    } finally {
      set({ workspacesLoading: false });
    }
  },

  loadMembers: async (workspaceId) => {
    if (!workspaceId) {
      set({ members: [] });
      return;
    }
    try {
      const rawList = await api.workspaces.members(workspaceId);
      set({ members: (Array.isArray(rawList) ? rawList : []).map(toMember) });
    } catch {
      set({ members: [] });
    }
  },

  loadTeams: async () => {
    const workspaceId = get().activeWorkspaceId;
    try {
      const rawList = await api.teams.list();
      set({
        teams: (Array.isArray(rawList) ? rawList : [])
          .filter((t: any) => !workspaceId || String(t.workspaceRef ?? t.workspaceId ?? '') === workspaceId)
          .map(toTeam),
      });
    } catch {
      set({ teams: [] });
    }
  },

  loadProjects: async () => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) {
      set({ projects: [] });
      return;
    }
    try {
      const rawList = await api.projects.list(workspaceId);
      set({ projects: (Array.isArray(rawList) ? rawList : []).map(toProject) });
    } catch {
      set({ projects: [] });
    }
  },

  // ── IES-R1 (P5-T2): sprint/feature/task loaders (workspace-keyed, offline-safe).
  loadSprints: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ sprints: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.sprints.list(p.id).catch(() => [] as Sprint[])),
      );
      set({ sprints: lists.flat().map(toSprint) });
    } catch {
      set({ sprints: [] });
    }
  },

  loadFeatures: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ features: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.features.list({ projectId: p.id }).catch(() => [] as Feature[])),
      );
      set({ features: lists.flat().map(toFeature) });
    } catch {
      set({ features: [] });
    }
  },

  // ── EEP2-P3.3.3: Roadmap spine loaders (DDS §9). Keyed by the projects the
  // active workspace already loaded — offline-safe like the sprint/feature loaders.
  loadMilestones: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ milestones: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.milestones.list(p.id).catch(() => [] as RoadmapMilestone[])),
      );
      set({ milestones: lists.flat().map(toMilestone) });
    } catch {
      set({ milestones: [] });
    }
  },

  loadPhases: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ phases: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.phases.list(p.id).catch(() => [] as RoadmapPhase[])),
      );
      set({ phases: lists.flat().map(toPhase) });
    } catch {
      set({ phases: [] });
    }
  },

  loadModules: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ modules: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.modules.list(p.id).catch(() => [] as RoadmapModule[])),
      );
      set({ modules: lists.flat().map(toModule) });
    } catch {
      set({ modules: [] });
    }
  },

  loadTasks: async () => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) {
      set({ tasks: [] });
      return;
    }
    try {
      const rawList = await api.tasks.list({ workspaceId });
      set({ tasks: (Array.isArray(rawList) ? rawList : []).map(toCollabTask) });
    } catch {
      set({ tasks: [] });
    }
  },

  loadCollabData: async () => {
    await get().loadWorkspaces();
    await Promise.all([
      get().loadMembers(get().activeWorkspaceId),
      get().loadTeams(),
    ]);
    await get().loadProjects();
    await Promise.all([
      get().loadSprints(),
      get().loadFeatures(),
      get().loadMilestones(),
      get().loadPhases(),
      get().loadModules(),
      get().loadTasks(),
    ]);
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
    const ws = get().workspaces.find(w => w.id === id);
    if (ws) toast.info(`Switched to workspace: ${ws.name}`);
  },

  updateWorkspaceSettings: async (workspaceId, settings) => {
    const prev = get().workspaces.find((w) => w.id === workspaceId)?.settings;
    await runMutation(
      () => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, settings: { ...w.settings, ...settings } } : w
          ),
        }));
        return () => {
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w.id === workspaceId && prev ? { ...w, settings: prev } : w
            ),
          }));
        };
      },
      () => api.workspaces.update(workspaceId, { settings }),
      { errorTitle: 'Settings save failed' },
    );
  },

  createWorkspace: async (name, type, description) => {
    const tempId = `ws-tmp-${Date.now()}`;
    const prevActive = get().activeWorkspaceId;
    const temp: Workspace = {
      id: tempId,
      name,
      type,
      icon: workspaceIconFor(type),
      description,
      membersCount: 1,
      projectsCount: 0,
      createdAt: new Date().toISOString(),
      settings: { ...DEFAULT_WORKSPACE_SETTINGS },
    };
    const created = await runMutation(
      () => {
        set((state) => ({ workspaces: [temp, ...state.workspaces], activeWorkspaceId: tempId }));
        return () => {
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== tempId),
            activeWorkspaceId: prevActive,
          }));
        };
      },
      () => api.workspaces.create({ name, type, description }),
      { errorTitle: 'Workspace creation failed' },
    );
    if (!created) return undefined;
    const ws = toWorkspace(created);
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === tempId ? ws : w)),
      activeWorkspaceId: ws.id,
    }));
    toast.success('Workspace created', `You are now in ${ws.name}`);
    return ws;
  },

  createTeam: async (name, description, color, memberIds) => {
    const tempId = `team-${Date.now()}`;
    const temp: WorkspaceTeam = {
      id: tempId,
      name,
      description,
      memberIds,
      color,
      leaderId: memberIds[0],
    };
    const created = await runMutation(
      () => {
        set((state) => ({ teams: [...state.teams, temp] }));
        return () => set((state) => ({ teams: state.teams.filter((t) => t.id !== tempId) }));
      },
      () => api.teams.create({ name, description, members: memberIds, color, workspaceId: get().activeWorkspaceId || undefined }),
      { errorTitle: 'Team creation failed' },
    );
    if (!created) return;
    const team = toTeam(created);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === tempId ? team : t)),
    }));
    toast.success(`Team ${team.name} created`);
  },

  updateMemberRole: async (memberId, role) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) return;
    const prevRole = get().members.find((m) => m.id === memberId)?.role;
    await runMutation(
      () => {
        set((state) => ({
          members: state.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
        }));
        return () => {
          set((state) => ({
            members: state.members.map((m) =>
              m.id === memberId && prevRole ? { ...m, role: prevRole } : m
            ),
          }));
        };
      },
      () => api.workspaces.setRole(workspaceId, memberId, role),
      { errorTitle: 'Role update failed' },
    );
  },

  updateMemberStatus: (memberId, status, currentTask) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, status, currentFocusTask: currentTask } : m
      ),
    }));
  },

  createProject: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `proj-${Date.now()}`;
    const prevProjects = get().projects;
    const temp: Project = {
      id: tempId,
      workspaceId: activeWsId,
      name: data.name || 'New Engineering Project',
      key: (data.name || 'PROJ').substring(0, 3).toUpperCase(),
      description: data.description || '',
      repositoryUrl: data.repositoryUrl || '',
      members: data.members || [],
      teamIds: data.teamIds || [],
      status: 'active',
      milestones: data.milestones || [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ projects: [temp, ...state.projects] }));
        return () => set({ projects: prevProjects });
      },
      () => api.projects.create({ name: temp.name, workspaceId: activeWsId || undefined }),
      { errorTitle: 'Project creation failed' },
    );
    if (!created) return undefined;
    const project = toProject(created);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === tempId ? project : p)),
    }));
    toast.success('Project created', `${project.name} is ready for tracking.`);
    return project;
  },

  // EEP2-P2.2.3: optimistic Project Info save with rollback. `patch` holds only
  // the changed DDS §4.4 fields; the server re-validates member/team refs and
  // enforces the editor vs Owner/Admin role split.
  updateProjectMeta: async (projectId, patch) => {
    const prev = get().projects.find((p) => p.id === projectId);
    if (!prev) return;
    await runMutation(
      () => {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)),
        }));
        return () => {
          set((state) => ({
            projects: state.projects.map((p) => (p.id === projectId ? prev : p)),
          }));
        };
      },
      () => api.projects.update(projectId, patch),
      { errorTitle: 'Project update failed' },
    );
  },

  // IES-R1 (P6-T5/UX-R1): create a backlog feature (sprintRef stays null). Real
  // owner comes from the modal's member picker; falls back to the auth user.
  createFeature: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `ft-${Date.now()}`;
    const prevFeatures = get().features;
    const temp: Feature = {
      id: tempId,
      workspaceId: activeWsId,
      projectId: data.projectId || '',
      moduleId: data.moduleId ?? undefined,
      name: data.name || 'Untitled Feature',
      description: data.description || '',
      type: data.type || 'feature',
      labels: data.labels || [],
      ownerId: data.ownerId || currentUserId(),
      estimatedHours: data.estimatedHours || 0,
      status: data.status || 'backlog',
      order: data.order ?? 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ features: [temp, ...state.features] }));
        return () => set({ features: prevFeatures });
      },
      () => api.features.create({
        projectId: temp.projectId,
        name: temp.name,
        description: temp.description,
        type: temp.type,
        labels: temp.labels,
        ownerId: temp.ownerId || undefined,
        estimatedHours: temp.estimatedHours,
        status: temp.status,
        order: temp.order,
        moduleId: temp.moduleId ?? undefined,
      }),
      { errorTitle: 'Feature creation failed' },
    );
    if (!created) return undefined;
    const feature = toFeature(created);
    set((state) => ({ features: state.features.map((f) => (f.id === tempId ? feature : f)) }));
    toast.success('Feature created', feature.name);
    return feature;
  },

  createSprint: async (projectId, name, startDate, endDate, goal, opts) => {
    const activeWsId = get().activeWorkspaceId;
    const capacityHours = opts?.capacityHours ?? 160;
    const targetVelocity = opts?.targetVelocity ?? 80;
    const tempId = `sp-${Date.now()}`;
    const prevSprints = get().sprints;
    const temp: Sprint = {
      id: tempId,
      workspaceId: activeWsId,
      projectId,
      name,
      startDate,
      endDate,
      goal,
      status: 'draft',
      committed: false,
      capacityHours,
      targetVelocity,
    };
    const created = await runMutation(
      () => {
        set((state) => ({ sprints: [...state.sprints, temp] }));
        return () => set({ sprints: prevSprints });
      },
      () => api.sprints.create({ projectId, name, startDate, endDate, goal, capacityHours, targetVelocity }),
      { errorTitle: 'Sprint creation failed' },
    );
    if (!created) return undefined;
    const sprint = toSprint(created);
    set((state) => ({ sprints: state.sprints.map((s) => (s.id === tempId ? sprint : s)) }));
    toast.success('Sprint created', name);
    return sprint;
  },

  // EEP2-P4.3.2: persist goal/capacity/velocity/dates/status via PATCH. Date
  // inputs are normalized to the client's ISO-day shape before the optimistic
  // merge; a committed sprint's scope stays frozen (server rejects with 409).
  updateSprint: async (sprintId, patch) => {
    const prev = get().sprints.find((s) => s.id === sprintId);
    if (!prev) return;
    const optimistic: Partial<Sprint> = {};
    if (patch.name !== undefined) optimistic.name = patch.name;
    if (patch.goal !== undefined) optimistic.goal = patch.goal;
    if (patch.startDate !== undefined) optimistic.startDate = new Date(patch.startDate).toISOString().slice(0, 10);
    if (patch.endDate !== undefined) optimistic.endDate = new Date(patch.endDate).toISOString().slice(0, 10);
    if (patch.capacityHours !== undefined) optimistic.capacityHours = patch.capacityHours;
    if (patch.targetVelocity !== undefined) optimistic.targetVelocity = patch.targetVelocity;
    if (patch.status !== undefined) optimistic.status = patch.status;
    await runMutation(
      () => {
        set((state) => ({
          sprints: state.sprints.map((s) => (s.id === sprintId ? { ...s, ...optimistic } : s)),
        }));
        return () => {
          set((state) => ({
            sprints: state.sprints.map((s) => (s.id === sprintId && prev ? prev : s)),
          }));
        };
      },
      () => api.sprints.update(sprintId, patch),
      { errorTitle: 'Sprint update failed' },
    );
  },

  // EEP2-P4.3.2: explicit lifecycle step through the server state machine.
  advanceSprintState: async (sprintId, status) => {
    await get().updateSprint(sprintId, { status });
  },

  // EEP2-P4.3.2/P4.1.4: one-way commitment latch. Optimistically freezes the
  // committed scope client-side; the server keeps the original commitmentDate.
  commitSprint: async (sprintId) => {
    const prev = get().sprints.find((s) => s.id === sprintId);
    if (!prev) return;
    await runMutation(
      () => {
        set((state) => ({
          sprints: state.sprints.map((s) =>
            s.id === sprintId
              ? {
                  ...s,
                  committed: true,
                  commitmentDate: new Date().toISOString(),
                  ...(s.status === 'draft' ? { status: 'planned' as Sprint['status'] } : {}),
                }
              : s,
          ),
        }));
        return () => {
          set((state) => ({
            sprints: state.sprints.map((s) => (s.id === sprintId && prev ? prev : s)),
          }));
        };
      },
      () => api.sprints.commit(sprintId),
      { errorTitle: 'Sprint commit failed' },
    );
    toast.success('Sprint committed', `Scope frozen for ${prev.name}`);
  },

  createTask: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const ownerId = currentUserId();
    const tempId = `ct-${Date.now()}`;
    const prevTasks = get().tasks;
    const tempTask: CollaborativeTask = {
      id: tempId,
      workspaceId: activeWsId,
      projectId: data.projectId || '',
      sprintId: data.sprintId || get().sprints[0]?.id,
      featureId: data.featureId,
      title: data.title || 'Untitled Task',
      description: data.description || '',
      sprintStatus: data.sprintStatus || 'backlog',
      priority: data.priority || 'medium',
      ownerId,
      assigneeId: data.assigneeId || ownerId,
      reviewerId: data.reviewerId,
      followerIds: ownerId ? [ownerId] : [],
      labels: data.labels || ['General'],
      dependencies: data.dependencies || [],
      estimatedHours: data.estimatedHours || 8,
      actualHours: data.actualHours || 0,
      gitContext: data.gitContext,
      subtasks: data.subtasks || [],
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ tasks: [tempTask, ...state.tasks] }));
        return () => set({ tasks: prevTasks });
      },
      () => api.tasks.create({
        title: tempTask.title,
        description: tempTask.description,
        priority: tempTask.priority,
        status: 'todo',
        category: 'Work',
        color: '#0ea5e9',
        tags: [],
        subtasks: [],
        workspaceId: activeWsId || undefined,
        projectId: tempTask.projectId || undefined,
        sprintId: tempTask.sprintId || undefined,
        featureId: tempTask.featureId || undefined,
        assigneeId: tempTask.assigneeId || undefined,
        reviewerId: tempTask.reviewerId || undefined,
        followerIds: tempTask.followerIds,
        labels: tempTask.labels,
        dependencies: tempTask.dependencies,
        estimatedHours: tempTask.estimatedHours,
        actualHours: tempTask.actualHours,
        sprintStatus: tempTask.sprintStatus,
      }),
      { errorTitle: 'Task creation failed' },
    );
    if (!created) return undefined;
    const task = toCollabTask(created);
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === tempId ? task : t)) }));
    toast.success('Task created', task.title);
    return task;
  },

  updateTaskStatus: async (taskId, sprintStatus) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    await runMutation(
      () => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, sprintStatus, updatedAt: new Date().toISOString() } : t
          ),
        }));
        return () => {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId && prevTask
                ? { ...t, sprintStatus: prevTask.sprintStatus, updatedAt: prevTask.updatedAt }
                : t
            ),
          }));
        };
      },
      () => api.tasks.update(taskId, { sprintStatus }),
      { errorTitle: 'Status update failed' },
    );
    toast.info('Status updated', `Task moved to ${sprintStatus.replace('_', ' ').toUpperCase()}`);
  },

  // IES-R1 (P6-T3): moveFeature persists the sprintRef change via
  // `PATCH /features/:id { sprintId }` (server validates same-project). Dropping
  // back onto the Backlog sends `sprintId: null` (explicit un-tether).
  moveFeature: async (featureId, sprintId) => {
    const prevFeature = get().features.find((f) => f.id === featureId);
    await runMutation(
      () => {
        set((state) => ({
          features: state.features.map((f) =>
            f.id === featureId
              ? { ...f, sprintId: sprintId ?? undefined }
              : f
          ),
        }));
        return () => {
          set((state) => ({
            features: state.features.map((f) =>
              f.id === featureId && prevFeature
                ? { ...f, sprintId: prevFeature.sprintId }
                : f
            ),
          }));
        };
      },
      () => api.features.update(featureId, { sprintId }),
      { errorTitle: 'Feature move failed' },
    );
  },

  // ── EEP2-P3.3.3: Roadmap spine actions (DDS §4.5-4.7, §6.3). ───────────────
  // Optimistic with rollback, mirroring the sprint/feature actions above.
  // `workspaceRef` is derived server-side; `projectId` always comes from data.
  createMilestone: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `ms-${Date.now()}`;
    const prevMilestones = get().milestones;
    const temp: RoadmapMilestone = {
      id: tempId,
      projectId: data.projectId || '',
      workspaceId: activeWsId,
      name: data.name || 'Untitled Milestone',
      description: data.description || '',
      targetDate: data.targetDate ?? null,
      order: data.order ?? 0,
      status: data.status || 'planned',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ milestones: [...state.milestones, temp] }));
        return () => set({ milestones: prevMilestones });
      },
      () => api.milestones.create({
        projectId: temp.projectId,
        name: temp.name,
        description: temp.description,
        targetDate: temp.targetDate ?? undefined,
        order: temp.order,
        status: temp.status,
      }),
      { errorTitle: 'Milestone creation failed' },
    );
    if (!created) return undefined;
    const milestone = toMilestone(created);
    set((state) => ({ milestones: state.milestones.map((m) => (m.id === tempId ? milestone : m)) }));
    toast.success('Milestone created', milestone.name);
    return milestone;
  },

  updateMilestone: async (id, patch) => {
    const prev = get().milestones.find((m) => m.id === id);
    const optimistic = toMilestonePatch(patch);
    await runMutation(
      () => {
        set((state) => ({
          milestones: state.milestones.map((m) => (m.id === id ? { ...m, ...optimistic } : m)),
        }));
        return () => {
          set((state) => ({
            milestones: state.milestones.map((m) =>
              m.id === id && prev ? { ...m, ...prev } : m
            ),
          }));
        };
      },
      () => api.milestones.update(id, optimistic),
      { errorTitle: 'Milestone update failed' },
    );
  },

  deleteMilestone: async (id) => {
    const prev = get().milestones.find((m) => m.id === id);
    if (!prev) return;
    const prevPhases = get().phases;
    await runMutation(
      () => {
        set((state) => ({
          milestones: state.milestones.filter((m) => m.id !== id),
          // DDS §6.3: child Phases stay but detach from the deleted milestone.
          phases: state.phases.map((p) => (p.milestoneId === id ? { ...p, milestoneId: '' } : p)),
        }));
        return () => set({ milestones: [...get().milestones.filter((m) => m.id !== id), prev], phases: prevPhases });
      },
      () => api.milestones.remove(id),
      { errorTitle: 'Milestone deletion failed' },
    );
    toast.success('Milestone deleted', prev.name);
  },

  createPhase: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `ph-${Date.now()}`;
    const prevPhases = get().phases;
    const temp: RoadmapPhase = {
      id: tempId,
      milestoneId: data.milestoneId || '',
      projectId: data.projectId || '',
      workspaceId: activeWsId,
      name: data.name || 'Untitled Phase',
      description: data.description || '',
      status: data.status || 'planned',
      order: data.order ?? 0,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ phases: [...state.phases, temp] }));
        return () => set({ phases: prevPhases });
      },
      () => api.phases.create({
        projectId: temp.projectId,
        milestoneId: temp.milestoneId,
        name: temp.name,
        description: temp.description,
        status: temp.status,
        order: temp.order,
        startDate: temp.startDate ?? undefined,
        endDate: temp.endDate ?? undefined,
      }),
      { errorTitle: 'Phase creation failed' },
    );
    if (!created) return undefined;
    const phase = toPhase(created);
    set((state) => ({ phases: state.phases.map((p) => (p.id === tempId ? phase : p)) }));
    toast.success('Phase created', phase.name);
    return phase;
  },

  updatePhase: async (id, patch) => {
    const prev = get().phases.find((p) => p.id === id);
    const optimistic = toPhasePatch(patch);
    await runMutation(
      () => {
        set((state) => ({
          phases: state.phases.map((p) => (p.id === id ? { ...p, ...optimistic } : p)),
        }));
        return () => {
          set((state) => ({
            phases: state.phases.map((p) =>
              p.id === id && prev ? { ...p, ...prev } : p
            ),
          }));
        };
      },
      () => api.phases.update(id, optimistic),
      { errorTitle: 'Phase update failed' },
    );
  },

  deletePhase: async (id) => {
    const prev = get().phases.find((p) => p.id === id);
    if (!prev) return;
    const prevModules = get().modules;
    await runMutation(
      () => {
        set((state) => ({
          phases: state.phases.filter((p) => p.id !== id),
          // DDS §6.3: child Modules stay but detach from the deleted Phase.
          modules: state.modules.map((mod) => (mod.phaseId === id ? { ...mod, phaseId: '' } : mod)),
        }));
        return () => set({ phases: [...get().phases.filter((p) => p.id !== id), prev], modules: prevModules });
      },
      () => api.phases.remove(id),
      { errorTitle: 'Phase deletion failed' },
    );
    toast.success('Phase deleted', prev.name);
  },

  createModule: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `md-${Date.now()}`;
    const prevModules = get().modules;
    const temp: RoadmapModule = {
      id: tempId,
      phaseId: data.phaseId || '',
      projectId: data.projectId || '',
      workspaceId: activeWsId,
      name: data.name || 'Untitled Module',
      description: data.description || '',
      status: data.status || 'planned',
      order: data.order ?? 0,
      ownerId: data.ownerId ?? null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ modules: [...state.modules, temp] }));
        return () => set({ modules: prevModules });
      },
      () => api.modules.create({
        projectId: temp.projectId,
        phaseId: temp.phaseId,
        name: temp.name,
        description: temp.description,
        status: temp.status,
        order: temp.order,
        ownerId: temp.ownerId ?? undefined,
      }),
      { errorTitle: 'Module creation failed' },
    );
    if (!created) return undefined;
    const module = toModule(created);
    set((state) => ({ modules: state.modules.map((m) => (m.id === tempId ? module : m)) }));
    toast.success('Module created', module.name);
    return module;
  },

  updateModule: async (id, patch) => {
    const prev = get().modules.find((m) => m.id === id);
    await runMutation(
      () => {
        set((state) => ({
          modules: state.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
        return () => {
          set((state) => ({
            modules: state.modules.map((m) =>
              m.id === id && prev ? { ...m, ...prev } : m
            ),
          }));
        };
      },
      () => api.modules.update(id, patch),
      { errorTitle: 'Module update failed' },
    );
  },

  deleteModule: async (id) => {
    const prev = get().modules.find((m) => m.id === id);
    if (!prev) return;
    const prevFeatures = get().features;
    await runMutation(
      () => {
        set((state) => ({
          modules: state.modules.filter((m) => m.id !== id),
          // DDS §6.3: child Features become project-level (moduleRef null).
          features: state.features.map((f) => (f.moduleId === id ? { ...f, moduleId: undefined } : f)),
        }));
        return () => set({ modules: [...get().modules.filter((m) => m.id !== id), prev], features: prevFeatures });
      },
      () => api.modules.remove(id),
      { errorTitle: 'Module deletion failed' },
    );
    toast.success('Module deleted', prev.name);
  },

  // EEP2-P3.3.3: moveFeatureModule persists the moduleRef change via
  // `PATCH /features/:id { moduleId }` (server revalidates same-project). Moving
  // between modules never touches `sprintRef` (DDS §4.8 flex point). `null`
  // drops the feature back to project-level while staying sprint-scheduled.
  moveFeatureModule: async (featureId, moduleId) => {
    const prevFeature = get().features.find((f) => f.id === featureId);
    await runMutation(
      () => {
        set((state) => ({
          features: state.features.map((f) =>
            f.id === featureId
              ? { ...f, moduleId: moduleId ?? undefined }
              : f
          ),
        }));
        return () => {
          set((state) => ({
            features: state.features.map((f) =>
              f.id === featureId && prevFeature
                ? { ...f, moduleId: prevFeature.moduleId }
                : f
            ),
          }));
        };
      },
      () => api.features.update(featureId, { moduleId }),
      { errorTitle: 'Module move failed' },
    );
  },

  updateGitContext: async (taskId, gitData) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    await runMutation(
      () => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  gitContext: { ...t.gitContext, ...gitData },
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
        return () => {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId && prevTask
                ? { ...t, gitContext: prevTask.gitContext, updatedAt: prevTask.updatedAt }
                : t
            ),
          }));
        };
      },
      () => api.tasks.patchGit(taskId, gitData ?? {}),
      { errorTitle: 'Git details save failed' },
    );
    toast.success('Git details linked');
  },

  addComment: (targetType, targetId, content, parentCommentId) => {
    const newComment: DiscussionComment = {
      id: `comm-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      targetType,
      targetId,
      author: { id: currentUserId(), name: currentUserName() },
      content,
      createdAt: new Date().toISOString(),
      reactions: {},
      replies: [],
    };

    set((state) => {
      if (parentCommentId) {
        return {
          discussions: state.discussions.map((c) =>
            c.id === parentCommentId ? { ...c, replies: [...c.replies, newComment] } : c
          ),
        };
      }
      return { discussions: [newComment, ...state.discussions] };
    });
    toast.success('Comment posted');
  },

  addReaction: (commentId, emoji) => {
    const me = currentUserId();
    set((state) => ({
      discussions: state.discussions.map((c) => {
        if (c.id === commentId) {
          const current = c.reactions[emoji] || [];
          const updated = current.includes(me)
            ? current.filter((id) => id !== me)
            : [...current, me];
          return {
            ...c,
            reactions: { ...c.reactions, [emoji]: updated },
          };
        }
        return c;
      }),
    }));
  },

  resolveThread: (commentId) => {
    set((state) => ({
      discussions: state.discussions.map((c) =>
        c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
      ),
    }));
    toast.info('Discussion thread updated');
  },

  loadNotifications: async (opts) => {
    set({ notificationsLoading: true });
    try {
      const page = await api.notifications.list({
        limit: opts?.limit,
        cursor: opts?.cursor,
        unreadOnly: opts?.append ? undefined : false,
      });
      const items: NotificationItem[] = page.items.map((it: any) => ({
        id: String(it.id),
        workspaceId: it.workspaceId ?? '',
        recipientId: it.recipientId ?? '',
        actor: {
          id: String(it.actor?.id ?? ''),
          name: it.actor?.name ?? 'Unknown',
          avatar: it.actor?.avatar,
        },
        type: it.type,
        title: it.title,
        body: it.body ?? '',
        targetUrl: it.targetUrl,
        createdAt: it.createdAt,
        read: Boolean(it.read),
      }));
      set((state) => ({
        notifications: opts?.append ? [...state.notifications, ...items] : items,
        notificationsHasMore: page.hasMore,
        notificationsNextCursor: page.nextCursor,
      }));
    } catch {
      // IES-P2-05: a failed feed must never crash the header (demo/offline).
      if (!opts?.append) set({ notifications: [], notificationsHasMore: false, notificationsNextCursor: null });
    } finally {
      set({ notificationsLoading: false });
    }
  },

  markNotificationRead: async (id) => {
    // Optimistic local flip; the server round-trip is fire-and-forget so the UI
    // reflects the read state immediately and heals on the next poll.
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    try {
      await api.notifications.markRead(id);
    } catch {
      // Re-sync on the next poll — never block the UI on a failed mark.
    }
  },

  markAllNotificationsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await api.notifications.markAllRead();
    } catch {
      // Re-sync on the next poll — never block the UI on a failed mark.
    }
  },

  createDoc: (title, category, content, tags) => {
    const newDoc: KnowledgeDoc = {
      id: `doc-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      title,
      category,
      content,
      authorId: currentUserId(),
      version: 1,
      tags,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    set((state) => ({ docs: [newDoc, ...state.docs] }));
    toast.success('Doc created', title);
    return newDoc;
  },

  updateDoc: (id, title, content, tags) => {
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              title,
              content,
              tags,
              version: d.version + 1,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : d
      ),
    }));
    toast.success('Doc updated', `Saved version ${get().docs.find((d) => d.id === id)?.version || 1}`);
  },

  createBlocker: (title, severity, impactDescription, taskId) => {
    const newBlocker: CentralBlocker = {
      id: `blk-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      taskId,
      title,
      severity,
      ownerId: currentUserId(),
      reporterId: currentUserId(),
      status: 'open',
      impactDescription,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ blockers: [newBlocker, ...state.blockers] }));
    toast.error('Blocker reported', `${title} (${severity.toUpperCase()})`);
  },

  resolveBlocker: (id) => {
    set((state) => ({
      blockers: state.blockers.map((b) =>
        b.id === id
          ? { ...b, status: 'resolved', resolvedAt: new Date().toISOString() }
          : b
      ),
    }));
    toast.success('Blocker resolved');
  },

  createEvent: (title, type, date, color) => {
    const newEv: TeamCalendarEvent = {
      id: `ev-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      title,
      type,
      date,
      color,
    };
    set((state) => ({ events: [...state.events, newEv] }));
    toast.success('Calendar event added');
  },

  loadWorkspaceActivity: async (workspaceId, opts) => {
    set({ activityLoading: true });
    try {
      const page = await api.workspaces.activity(workspaceId, opts?.limit, opts?.cursor);
      const items: WorkspaceActivity[] = page.items.map((it: any) => ({
        id: String(it._id),
        workspaceId: String(it.workspaceRef),
        actor: {
          id: String(it.userId?._id ?? ''),
          name: it.userId?.name ?? 'Unknown',
          email: it.userId?.email,
          avatar: it.userId?.avatar,
        },
        action: it.action,
        details: it.details ?? {},
        timestamp: it.createdAt,
      }));
      set((state) => ({
        activities: opts?.append ? [...state.activities, ...items] : items,
        activityHasMore: page.hasMore,
        activityNextCursor: page.nextCursor,
      }));
    } catch {
      // IES-P2-04: a failed feed must never crash the page (demo/offline).
      if (!opts?.append) set({ activities: [], activityHasMore: false, activityNextCursor: null });
    } finally {
      set({ activityLoading: false });
    }
  },
}));
