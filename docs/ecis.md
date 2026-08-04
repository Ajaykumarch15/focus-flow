# ARK — Engineering Companion Implementation Specification (ECIS)

Sources of truth (LOCKED): `docs/engineering-companion-phase1.md` · `docs/developer-companion-experience.md` · `docs/ark-information-architecture.md`.
Status: **Final planning document — no code in this document.** Any engineer can begin implementation from this spec with zero ambiguity.
Scope guardrails (LOCKED):
- No backend redesign, no database redesign, no API changes, no new models.
- Reuse-first: new UI composes existing stores, endpoints, and components.
- Pure computation extracted as exported helpers with tests (pattern: Mission Control helpers).
- Every task independently shippable, < 1 working day.

Environment commands (verified): typecheck `npm run typecheck` (mainApp) · frontend tests `npm test` (mainApp) · server tests `npx vitest run` (mainApp/server) — server suite must stay green throughout (no backend change).

---

## A. Spec Standards (apply to every item below)

### A.1 Screen spec template (fields used for every screen)
`Purpose` · `Primary Question` · `Role Visibility` · `Required Existing Components` · `Required Existing Stores` · `Required Existing APIs` · `Required Existing Selectors` · `UI Sections` · `Loading State` · `Empty State` · `Error State` · `Success State` · `Navigation` · `Context Sources` · `Resume Behavior` · `Accessibility Requirements` · `Responsive Behavior` · `Future AI Hooks`.

### A.2 Component spec template
`Component Name` · `Responsibility` · `Inputs` · `Outputs` · `State Source` · `Reuse Existing?` · `Needs Refactor?` · `Needs Replacement?` · `Dependencies` · `Events` · `Interaction Rules`.

### A.3 Task template (implementation checklist)
`ID` · `Page/Section` · `Priority` · `Dependencies` · `Complexity (S/M/L)` · `Risk (L/M/H)` · `Acceptance Criteria` · `Testing Requirements`.

### A.4 Quality gates (every task)
`Definition of Done` · `Accessibility Checklist` · `Performance Checklist` · `Responsive Checklist` · `Testing Checklist` · `Regression Checklist`. (Full gate definitions in §10.)

### A.5 Naming & conventions
- New pure selectors live in the owning store file or a `lib/` module, exported, unit-tested.
- New UI sections reuse the UI kit (`Card`, `Button`, `Badge`, `EmptyState`, `Skeleton`, `Spinner`, `Progress`, `Breadcrumbs`).
- Motion: 150–250 ms transitions; respect `MotionConfig reducedMotion` and `theme.reducedMotion`.
- Honest data: show `—` when a value is not derivable; never fabricate.

---

## B. Engineering Companion Implementation Specification — Screen by Screen

### B.1 Today (homepage) — L1

| Field | Spec |
|---|---|
| **Purpose** | The companion landing. Preserves continuity: shows what to continue, what to do now, what needs attention. |
| **Primary Question** | What should I do now? |
| **Role Visibility** | All roles (personal layer). |
| **Required Existing Components** | `ui/Card`, `ui/Button`, `ui/Badge`, `ui/Progress`, `ui/EmptyState`, `ui/Skeleton`, `ui/PageHeader`, `tasks/TaskCard`, `ui/StatusBadge` |
| **Required Existing Stores** | `useStore` (tasks, activeTaskId, activeTimerState, activeSessionId, getTodayTime, getWeekTime), `useAuthStore` (user) |
| **Required Existing APIs** | `workLogs.list(true)` (active), `reports.summary()` (today total), `sessions.list({ active: true })` |
| **Required Existing Selectors** | `getTask`, `getTodayTime`, `getWeekTime`; new pure helpers `selectContinue(tasks, activeTaskId, activeSessionId, workLogs)`, `selectDoNow(tasks)`, `selectAttention(tasks, blockers, reviews, deadlines)` |
| **UI Sections** | 1 Header · 2 Continue Working · 3 Today's Focus · 4 Attention · 5 Now Strip (persistent) · 6 Recent Activity (personal, quiet) · 7 Footer (tomorrow-plan seed hint) |
| **Loading State** | Skeleton cards per section (use `ui/Skeleton`); block only sections awaiting their data, never the whole page. |
| **Empty State** | Continue: `ui/EmptyState` "Nothing to resume — start something new." Focus: "No tasks yet." Attention: "Nothing needs attention." |
| **Error State** | Per-section inline retry (`ui/Button` "Retry"); global error banner for auth/load failure (reuse `ErrorBoundary`). |
| **Success State** | Resume click → navigates to Current Task; capture confirms via `ToastContainer`. |
| **Navigation** | Sidebar L1 (Today default-active); palette; Now strip anchor; breadcrumb none (home). |
| **Context Sources** | Personal store only; workspace context shown only as a muted badge if a sprint/feature is active. |
| **Resume Behavior** | Primary CTA "Resume" (top of Continue section) → `sessions.resume` if paused, else `sessions.start`; navigate `/tasks/:id` with Focus shell available. |
| **Accessibility** | Landmarks (`<main>`, `<nav>`), headings order (h1→h2), Resume is the single primary button, keyboard reachable, focus moves to section on load, reduced-motion respected. |
| **Responsive** | Single column on mobile; Continue/Do-now/Attention stack; Now strip collapses to a compact row. |
| **Future AI Hooks** | Predicted resume rank; "what changed" digest injection into Attention. |

### B.2 Current Task — L1

| Field | Spec |
|---|---|
| **Purpose** | Continuation view for the task in progress. |
| **Primary Question** | What am I working on right now? |
| **Role Visibility** | All roles. |
| **Required Existing Components** | `tasks/TaskCard`, `tasks/CreateTaskModal`, `ui/Card`, `ui/Button`, `ui/Badge`, `ui/Progress`, `ui/Textarea`, `worklog/TechnicalDecisionsView`, `worklog/StructuredBlockersView`, `ui/Breadcrumbs` |
| **Required Existing Stores** | `useStore` (getTask, updateTask, toggleSubtask, addSubtask, deleteSubtask, startTimer/pauseTimer/resumeTimer/stopTimer, activeTimerState) |
| **Required Existing APIs** | `sessions.list({ taskId })`, `workLogs.list()` + `workLogs.linkTask(id, taskId)`, `journals.list(taskId)` |
| **Required Existing Selectors** | `getTask`; new `selectTaskContinuation(task, sessions, workLogs)` (last session end, last timeline entry, active session) |
| **UI Sections** | 1 Header (title, status, priority) · 2 Now strip (task context) · 3 Subtasks ("what remains") · 4 Session clock + Focus CTA · 5 Git context (branch/PR) · 6 Where I stopped (last timeline/snapshot) · 7 Decisions · 8 Blockers · 9 Discussions (existing modal) |
| **Loading/Empty/Error/Success** | Loading: skeleton; Empty: "No subtasks yet"; Error: inline retry; Success: toast on complete/update. |
| **Navigation** | Breadcrumb `Workspace › Project › Feature › Task` (if collab); sidebar L1; palette. |
| **Context Sources** | Personal store; if task is collaborative (`collabStore.tasks` by id), merge `gitContext`, sprint, feature. |
| **Resume Behavior** | "Resume session" → same rules as B.1 Resume; if a session exists paused, resume it; if active, offer pause. |
| **Accessibility / Responsive** | Subtask toggles are checkboxes; Focus CTA single primary; mobile: subtask list + clock stack, git badges wrap. |
| **Future AI Hooks** | Suggested next subtask; auto-decision detection from timeline. |

### B.3 Focus — L1

| Field | Spec |
|---|---|
| **Purpose** | Full-screen deep-work shell. |
| **Primary Question** | Am I in deep work? |
| **Role Visibility** | All roles. |
| **Required Existing Components** | `FocusMode` page (extend), `ui/Progress`, `ui/Button`, `ui/Textarea`, `worklog/StructuredBlockersView` (inline capture), `worklog/TechnicalDecisionsView` (inline capture) |
| **Required Existing Stores** | `useStore` timer actions + active state |
| **Required Existing APIs** | `sessions.start/pause/resume/stop/heartbeat`, `workLogs.addTimeline`, `workLogs.addBlocker`, `workLogs.addDecision` |
| **Required Existing Selectors** | `getTodayTime`; new `selectSessionState(session, now)` (running/paused/idle, active time, focus score) |
| **UI Sections** | 1 Timer (large clock, pause/resume/stop) · 2 Task context (compact) · 3 Subtask progress · 4 Capture panel (on intentional pause: blocker / decision) · 5 Completion prompt (reflection) |
| **Loading/Empty/Error/Success** | Loading: none (client-side); Empty: choose-task prompt; Error: heartbeat failure toast; Success: "Session stopped — 25m tracked". |
| **Navigation** | Minimal chrome (no sidebar); ESC exits; palette off during flow. |
| **Context Sources** | active task + session from personal store. |
| **Resume Behavior** | Auto-heartbeat while running; on reload, rehydrate from `timerPersist` + `sessions.list({ active: true })`. |
| **Accessibility / Responsive** | Timer readable via live region on state change; large tap targets; full-screen scales to any viewport. |
| **Future AI Hooks** | Focus-score coaching; break suggestions. |

### B.4 Work Log (Engineering Memory) — L1

| Field | Spec |
|---|---|
| **Purpose** | The day's spine: timeline, decisions, blockers, snapshots, reflection, tomorrow plan. |
| **Primary Question** | What happened during this work? |
| **Role Visibility** | All roles. |
| **Required Existing Components** | `worklog/WorkLogWidget`, `worklog/TimelineView`, `worklog/TechnicalDecisionsView`, `worklog/StructuredBlockersView`, `worklog/ReflectionView`, `worklog/TomorrowPlanView`, `worklog/ProblemFlowEditor`, `worklog/AttachmentsView`, `worklog/ReadingModeView`, `worklog/WorkLogExporterModal`, `ui/PageHeader`, `ui/Card` |
| **Required Existing Stores** | `useStore` (indirect) — WorkLogs are fetched via `api.workLogs`; consider a light wrapper hook/selector `useWorkLog(active)` |
| **Required Existing APIs** | `workLogs.list/get/create/update/close/continue`, `linkTask`, `syncTime`, `updateEntry`, `addCompleted/deleteCompleted`, `addLink/deleteLink`, `addTimeline`, `addDecision/deleteDecision`, `addBlocker/updateBlocker/deleteBlocker`, `addSnapshot/deleteSnapshot`, `addAttachment/deleteAttachment` |
| **Required Existing Selectors** | `lib/dataMapper` (doc→UI mapping), `lib/docEngine` (export); new `selectMemory(wl)` → { whereStopped, decisions, blockers, snapshots, reflection } |
| **UI Sections** | 1 Header (title, status, active) · 2 Where I stopped (highlighted last node) · 3 Timeline · 4 Decisions · 5 Blockers · 6 Snapshots · 7 Completed items · 8 Links/attachments · 9 Reflection · 10 Tomorrow plan · 11 Export |
| **Loading/Empty/Error/Success** | Loading: skeleton; Empty: "No active work log — start from a task"; Error: retry; Success: autosave toast (reuse autosave editor pattern). |
| **Navigation** | Sidebar L1 "Work Log"; master/detail (list + item) in one surface (IA merge). |
| **Context Sources** | Linked task (`taskRef`), linked project (`projectRef`), sessions via `workEntries`. |
| **Resume Behavior** | `workLogs.continue` reopens a closed log; active log pinned at top. |
| **Accessibility / Responsive** | Timeline keyboard navigable; reading mode print-friendly; list/detail collapse to stacked on mobile. |
| **Future AI Hooks** | Auto-decision ledger; daily summary generation. |

### B.5 Knowledge — L1/L2

| Field | Spec |
|---|---|
| **Purpose** | "What do we already know?" — docs, decisions, lessons, links, searchable. |
| **Primary Question** | What do we already know? |
| **Role Visibility** | All roles. |
| **Required Existing Components** | `ui/Card`, `ui/Button`, `ui/Badge`, `MarkdownView`, `ui/EmptyState`, `collaboration/CreateDocModal`, `ui/Input` |
| **Required Existing Stores** | `useCollaborationStore` (docs, features, tasks), personal `useStore` (journals) |
| **Required Existing APIs** | `search.run(q)`, `workLogs.list()` (decision/lesson extraction), `journals.list()` |
| **Required Existing Selectors** | `lib/collaborationActivity` (labels); new `selectKnowledge(docs, workLogs, journals)` → grouped { docs, decisions, lessons, links } |
| **UI Sections** | 1 Header + search · 2 Knowledge docs · 3 Decision ledger · 4 Lessons learned · 5 Saved links |
| **Loading/Empty/Error/Success** | Loading: skeleton; Empty: "No knowledge captured yet — capture a decision in your work log"; Error: retry; Success: save toast. |
| **Navigation** | Sidebar L1 (and L2 within workspace); palette-first recall. |
| **Context Sources** | Cross-layer: personal + workspace docs + decisions + lessons. |
| **Resume Behavior** | Opens the doc/decision in its origin surface (work log). |
| **Accessibility / Responsive** | Search input labeled; results list landmarks; cards stack on mobile. |
| **Future AI Hooks** | Natural-language Q&A over developer memory. |

### B.6 Personal Reports — L1

| Field | Spec |
|---|---|
| **Purpose** | Time + focus retrospective (Analytics merged in as views). |
| **Primary Question** | How did I spend my time? |
| **Role Visibility** | All roles. |
| **Required Existing Components** | `ui/Card`, `ui/PageHeader`, `ui/Progress`, `ui/Select` (range), existing `Reports`/`Analytics` page internals |
| **Required Existing Stores** | `useStore` (tasks, getWeekTime) |
| **Required Existing APIs** | `reports.summary(from,to)`, `reports.day(date)`, `reports.leaderboard()` |
| **Required Existing Selectors** | `getTodayTime`, `getWeekTime`; `lib/dataMapper` |
| **UI Sections** | 1 Header + date range · 2 Today summary · 3 Week summary · 4 By-task breakdown · 5 Focus scores · 6 Export/share |
| **Loading/Empty/Error/Success** | Loading: skeleton; Empty: "No tracked time yet"; Error: retry; Success: share link created. |
| **Navigation** | Sidebar L1 "Reports"; not a landing. |
| **Context Sources** | Sessions aggregated server-side (reports routes). |
| **Resume Behavior** | None (read-only). |
| **Accessibility / Responsive** | Charts have text equivalents; tables responsive. |
| **Future AI Hooks** | Trend explanations. |

### B.7 Mission Control — L2 (workspace companion landing)

| Field | Spec |
|---|---|
| **Purpose** | Team "Today": current sprint, reviews, blockers, health. Already built in `TeamWorkspace`; tune only. |
| **Primary Question** | What is the state of our work today? |
| **Role Visibility** | All workspace members. |
| **Required Existing Components** | `TeamWorkspace` Mission Control tab, Mission Control pure helpers, `ui/Card`, `ui/Badge`, `ui/Button`, `ui/Progress`, `collaboration/NotificationCenter` |
| **Required Existing Stores** | `useCollaborationStore` (tasks, sprints, features, blockers, activities, docs, projects, members, notifications) |
| **Required Existing APIs** | `workspaces.activity(id)`, `notifications.list`, `sprints.list(projectId)`, `features.list(...)`, `tasks.list({ workspaceId })` |
| **Required Existing Selectors** | `computeSprintVelocity`, `computeAssignedWork`, `computePendingReviews`, `computeUpcomingDeadlines`, `computeWorkspaceProgress`, `activityActionLabel`, `activityDetail` |
| **UI Sections** | 1 Header (workspace identity) · 2 Stat cards · 3 Current Sprint · 4 Upcoming deadlines · 5 Review queue · 6 Blockers · 7 Team activity · 8 Health strip |
| **Loading/Empty/Error/Success** | Loading: skeleton; Empty per section (honest `—`); Error: retry; Success: state updates via optimistic store mutations. |
| **Navigation** | Sidebar L2 "Mission Control" (default for workspace); breadcrumb workspace-only. |
| **Context Sources** | Workspace-scoped collab data. |
| **Resume Behavior** | Task cards deep-link to Current Task; sprint board deep-links. |
| **Accessibility / Responsive** | Tab list + panels; cards stack on mobile; contrast on health strip. |
| **Future AI Hooks** | Team flow intelligence; digest injection. |

### B.8 Remaining screens (L2/L3) — standardized spec (complete, condensed)

| Screen | Purpose / Q | Components (existing) | Stores / APIs | Notes |
|---|---|---|---|---|
| **Sprint** | What are we delivering? · `TeamWorkspace` Sprint tab + Kanban, `ProjectBacklog` split out | collab store; `sprints.list/create`, `tasks.list({sprintId})`, `features.list({sprintId})` | Loading/empty/error per board; drag-drop preserved; now routes as its own page. |
| **Backlog** | What is waiting to be scheduled? · `ProjectBacklog`, `CreateFeatureModal` | collab store (`moveFeature`, `createFeature`); `features.list({backlog:true})`, `features.update` | Own page; filter/search/drag preserved. |
| **Features** | What are we building? · `FeaturesPage`, `WorkItemTypeBadge`, `CreateFeatureModal` | collab store; `features.list({projectId})` | Existing page; keep as-is; link to Current Task from feature tasks. |
| **Reviews** | What needs my review? · QA board, `ui/Card`, `ui/Badge` | collab store tasks (reviewerId, sprintStatus); `tasks.update` | Rename of QA; review queue filter surfaced; no new API. |
| **Blockers** | What is blocking us? · TeamWorkspace Blockers tab, `CreateBlockerModal` | collab store blockers; `resolveBlocker` | Own routed page; feeds Mission Control attention. |
| **Activity** | What changed? · `ActivityFeedPage`, `activityActionLabel/detail` | collab store; `workspaces.activity` | Keep; add deep-links to changed entities. |
| **Project Reports** | How is delivery trending? · `ReportsAnalyticsPage` (analytics merged in) | collab store + `compute*` helpers | Velocity/completion from live data; honest `—`. |
| **Calendar** | What's planned? · TeamWorkspace Calendar tab | collab store events | Supporting; keep. |
| **Workspace Home/Projects/Teams/Members/Settings** | Organization structure · `WorkspaceSettingsPage`, `MemberProfilePage`, admin pages, `NotificationCenter` | collab store; `workspaces.*`, `teams.*`, `admin.*` | Administration layer; deep links only; no daily surface. |

---

## C. Component Inventory & Reuse Matrix

Classification: **R** = reuse as-is · **A** = reuse with adaptation (pure wrapper/props) · **N** = new (composes existing) · **R**emove.

| Component | Status | Notes |
|---|---|---|
| `ui/Card, Button, Badge, Input, Select, Textarea, Spinner, Skeleton, Progress, Tooltip, StatusBadge, Breadcrumbs, PageHeader, EmptyState, StandardEmptyState, ToastContainer, Dialog, Field, ErrorBoundary` | R | Core kit; used by all new surfaces unchanged. |
| `ui/GlobalHeader`, `layout/AppLayout`, `layout/Sidebar` | A | AppLayout/Sidebar re-organized to L1 grouped IA (labels/routes only). |
| `layout/WorkspaceLayout` | R | Already grouped L2/L3 nav + identity block + Mission Control label. |
| `layout/AdminLayout`, `layout/AdminSidebar` | R | L3 administration shell. |
| `tasks/TaskCard`, `tasks/CreateTaskModal` | R | Reused in Today + Current Task. |
| `collaboration/GlobalCommandPalette`, `collaboration/NotificationCenter` | R | Palette-first resume/navigate/search; single mount. |
| `collaboration/CreateProjectModal/SprintModal/TaskModal/FeatureModal/BlockerModal/DocModal` | R | All quick-action creation; already contextual. |
| `collaboration/ProjectBacklog`, `collaboration/FeaturesPage`, `collaboration/WorkItemTypeBadge` | R | Backlog + Features pages. |
| `collaboration/DiscussionsModal` | R | Task discussions. |
| `TeamWorkspace` (Mission Control) | A | Split mega-tabs into routed pages; keep Mission Control + helpers. |
| `worklog/WorkLogWidget, TimelineView, TechnicalDecisionsView, StructuredBlockersView, ReflectionView, TomorrowPlanView, ProblemFlowEditor, AttachmentsView, ReadingModeView, WorkLogExporterModal` | R | Engineering Memory; reuse unchanged. |
| `FocusMode` page | A | Focus shell enhancements (inline capture, completion prompt). |
| `Dashboard` page | R→A | Rebrand to Today; sections re-present existing data. |
| `TaskDetail` page | A | Continuation view additions (Now strip, git context, where I stopped). |
| `WorkLog` / `WorkLogDetail` pages | A | Master/detail merge in one surface. |
| `Reports` / `Analytics` pages | A | Merge into Personal Reports with range views. |
| `ReportsAnalyticsPage` | A | Merge analytics view; keep KPI computations. |
| `AdminOverview`, `AdminAnalytics` | **R**emove | Merged into Audit (activity). |
| `SearchResultsPage` | R | Backs palette + search. |
| `utils/timerPersist`, `utils/api.ts` | R | Timer rehydration + all API access. |
| `lib/collaborationActivity`, `lib/dataMapper`, `lib/docEngine`, `lib/markdown`, `MarkdownView` | R | Labels, mapping, export, markdown rendering. |

**New components (compose existing — small, testable):**
- `TodayPage` (composes Dashboard data + TaskCard + pure selectors).
- `NowStrip` (persistent context rail; composes personal + collab stores).
- `ResumeFlow` logic module (pure resolver: which session/task/worklog to resume).
- `selectToday`, `selectContinue`, `selectDoNow`, `selectAttention`, `selectTaskContinuation`, `selectMemory`, `selectKnowledge`, `selectSessionState` — pure exported helpers with tests.

---

## D. State Dependency Matrix

| Screen | Store(s) | State fields | APIs |
|---|---|---|---|
| Today | useStore, useAuthStore | tasks, activeTaskId, activeSessionId, activeTimerState, getTodayTime | workLogs.list(true), reports.summary(), sessions.list({active:true}) |
| Now Strip | useStore + useCollaborationStore | activeTaskId, activeTimerState, activeSessionId; sprints/features/tasks (active) | sessions.*, collab loaders |
| Current Task | useStore (+ collab for git) | getTask, subtasks, sessions, activeTimerState | sessions.list({taskId}), workLogs.linkTask, journals.list(taskId) |
| Focus | useStore | timer actions, active state | sessions.start/pause/resume/stop/heartbeat, workLogs.addTimeline/addBlocker/addDecision |
| Work Log | useStore (light hook) | — | workLogs.* full set |
| Knowledge | useCollaborationStore + useStore | docs, features, tasks, journals | search.run, workLogs.list, journals.list |
| Personal Reports | useStore | getWeekTime, getTodayTime | reports.summary/day/leaderboard |
| Mission Control | useCollaborationStore | tasks, sprints, features, blockers, activities, notifications, docs, projects, members | workspaces.activity, notifications.list, sprints/features/tasks list |
| Sprint/Backlog/Features/Reviews/Blockers/Activity/Reports(L2) | useCollaborationStore | full collab graph | existing collab + workspace APIs |
| Admin (L3) | useCollaborationStore + useAuthStore | workspaces, members, teams, notifications | workspaces.*, teams.*, admin.* |

---

## E. Navigation Dependency Matrix

| Nav element | Where | Shows | Depends on |
|---|---|---|---|
| Top bar | Global shell | workspace switcher, search/palette trigger, notifications, profile | useAuthStore, useCollaborationStore |
| Now strip | Global, persistent | task, clock, subtasks, branch/PR | useStore, collab store |
| Sidebar L1 | AppLayout | Today · Tasks · Focus · Work Log · Journal · Knowledge · Reports \| Habits · Settings | route table (IA §3) |
| Sidebar L2/L3 | WorkspaceLayout | Mission Control · Sprint · Backlog · Features · Reviews · Blockers · Activity · Reports · Calendar \| Admin | route table (IA §3) |
| Context tabs | Within context | Subtasks / Session / Work Log / Decisions / Discussions | active task id |
| Breadcrumbs | Content header | Workspace › Project › Sprint › Feature › Task | route params + stores |
| Quick actions | Surface-scoped | New Task/Sprint/Feature/Blocker/Doc · Resume | surface owner |
| Palette / Search | Global | resume/navigate/search | search.run, stores |

---

## F. Feature Dependency Graph

```
selectToday (pure) ← useStore + workLogs.list + reports.summary + sessions.list
NowStrip ← selectSessionState + collab active sprint/feature
ResumeFlow ← selectContinue + sessions.*  →  Current Task
Current Task ← selectTaskContinuation + workLogs.linkTask + journals.list
Focus ← timer actions + workLogs.addTimeline/addBlocker/addDecision
Work Log ← workLogs.* (+ docEngine export)  →  selectMemory
Knowledge ← search.run + selectKnowledge(docs, workLogs, journals)
Reports ← reports.* + getTodayTime/getWeekTime
Mission Control ← compute* helpers + collab loaders + workspaces.activity
L2 pages ← collab store (features/sprints/tasks/blockers/activity) — no new data source
```

Hard dependencies: `Today → selectToday → stores+APIs`; `Resume → Current Task`; `Focus capture → workLogs subdocs`; `Knowledge → search`. No task depends on a new API or model.

---

## G. Sprint Implementation Plan

### Sprint 1 — Continuity core (Today + Now Strip + Resume)
| ID | Task | Pri | Dep | Cx | Risk | Acceptance | Tests |
|---|---|---|---|---|---|---|---|
| S1-T1 | `selectToday`/`selectContinue`/`selectDoNow`/`selectAttention` pure helpers | P0 | — | S | L | Correct ranking; honest `—`; 100% pure (no side effects) | unit |
| S1-T2 | `TodayPage` sections Header/Continue/Focus/Attention | P0 | S1-T1 | M | M | Renders from store; empty/loading/error states; no admin | unit + a11y |
| S1-T3 | `NowStrip` (task · clock · subtasks · branch/PR) | P0 | S1-T1 | M | M | Persistent across surfaces; correct clock from session state | unit |
| S1-T4 | `selectSessionState` + rehydration from `timerPersist` + `sessions.list({active:true})` | P0 | S1-T3 | M | H | Running/paused/idle correct after reload; no double-start | unit + integration |
| S1-T5 | Resume flow (one tap → Current Task + session + work log) | P0 | S1-T3, S1-T4 | M | H | Single CTA resumes correct session; idempotent via opId | unit + integration |

### Sprint 2 — Working (Current Task + Focus)
| ID | Task | Pri | Dep | Cx | Risk | Acceptance | Tests |
|---|---|---|---|---|---|---|---|
| S2-T1 | Current Task continuation view (Now strip, subtasks, session, git, where I stopped) | P0 | S1-T5 | M | M | `selectTaskContinuation` correct; task/session/worklog linked | unit |
| S2-T2 | Focus shell: inline blocker + decision capture on intentional pause | P1 | S2-T1 | M | M | Capture posts to `workLogs.addBlocker/addDecision`; never during flow | unit + integration |
| S2-T3 | Focus completion prompt → reflection (journal + completed item) | P1 | S2-T2 | S | L | Completion writes journal + `addCompleted`; prompt optional | unit |

### Sprint 3 — Memory & Knowledge (Work Log + Knowledge + Reports)
| ID | Task | Pri | Dep | Cx | Risk | Acceptance | Tests |
|---|---|---|---|---|---|---|---|
| S3-T1 | Work Log master/detail merge ("Where I stopped" highlighted) | P0 | — | M | M | `selectMemory` correct; list+detail one surface | unit |
| S3-T2 | `selectKnowledge` (docs + decisions + lessons) + Knowledge surface | P1 | S3-T1 | M | M | Groups from real data; search wired | unit |
| S3-T3 | Personal Reports merge (analytics → views) | P2 | — | S | L | Range filters work; KPIs deduplicated | unit |
| S3-T4 | Mission Control tune (lead with Today/resume/running timer) | P1 | S1-T1 | S | L | Helper-driven stats; no fabricated numbers | unit |

### Sprint 4 — Team split + cleanup
| ID | Task | Pri | Dep | Cx | Risk | Acceptance | Tests |
|---|---|---|---|---|---|---|---|
| S4-T1 | Split TeamWorkspace mega-tabs → routed Sprint/Backlog/Blockers pages | P1 | — | M | M | Routes + sidebar updated; behavior preserved | unit + regression |
| S4-T2 | Merge ReportsAnalyticsPage analytics view; canonicalize KPIs | P2 | — | S | L | One KPI per page; helpers reused | unit |
| S4-T3 | L3 administration extraction (Projects/Teams/Members/Settings/Audit) | P2 | — | M | M | Deep-link only; never on daily nav | regression |
| S4-T4 | Role-aware default navigation + `/team` route collision cleanup | P2 | — | S | L | Default views per role; no dead route | unit + regression |

---

## H. Acceptance Criteria (global)

1. Every screen answers its single primary question; no admin on work surfaces.
2. Resume is one tap and restores task + session + work log + branch/PR; sessions never double-start.
3. Auto-captured context is invisible until it answers a Now question.
4. Data is honest: `—` instead of fabricated values; no new API/model.
5. All new computation is pure, exported, unit-tested.
6. Server test suite stays green (no backend change) on every merge.
7. Quality gates (§10) pass per task.
8. No duplicate page/widget/KPI/action/nav introduced (clutter gate).

---

## I. Final MVP Roadmap

| Phase/Sprint | Delivers | Exit |
|---|---|---|
| S1 | Today · Now Strip · Resume flow | Continuity core live on existing data |
| S2 | Current Task continuation · Focus capture · Completion reflection | Working loop continuous |
| S3 | Work Log memory · Knowledge · Reports merge · Mission Control tune | Memory + knowledge surfacing |
| S4 | Team page split · KPI canonicalization · L3 extraction · role nav · cleanup | Companion IA across all layers |

MVP = S1–S4 with server suite green throughout. Nothing outside existing stores/APIs/components.

---

## J. Quality Gates

**Definition of Done:** spec fields implemented; selectors pure+tested; no new API/model; reuse verified; gates below pass; server suite green.

**Accessibility Checklist:** landmarks/heading order; labels on all inputs/selects; single primary action per screen; keyboard operable; focus managed on load/nav; contrast ≥ AA; reduced-motion respected; live regions for timer state.

**Performance Checklist:** lazy routes; skeleton over blocking; no re-fetch on tab switch (cache in store); no layout thrash; animation ≤ 250 ms and GPU-friendly.

**Responsive Checklist:** mobile single column; nav drawer on mobile; tables/boards scroll or stack; tap targets ≥ 40px; Now strip collapses gracefully.

**Testing Checklist:** unit tests for every pure helper; integration tests for resume/session flows; component tests for new sections (loading/empty/error/success); a11y assertions.

**Regression Checklist:** existing page routes still resolve; store actions unchanged; collab tests + personal tests green; no duplicate mounts (palette, timers); timer rehydration correct.
