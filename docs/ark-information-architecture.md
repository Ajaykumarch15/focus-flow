# ARK — Information Architecture (IA)

Source of truth: [`docs/engineering-companion-phase1.md`](engineering-companion-phase1.md) + [`docs/developer-companion-experience.md`](developer-companion-experience.md) — **approved; do not redesign the philosophy.**
Status: **UX architecture blueprint — no code.**
Scope guardrails (locked):
- Do **NOT** redesign the backend, database, or existing models.
- Do **NOT** introduce new APIs.
- Do **NOT** generate implementation code.
- Every target page composes existing stores, endpoints, and components.
- This document is the final UX architecture before UI implementation.

---

## 1. Current Page Inventory & Decisions

Every existing page/route reviewed. Decision key: **Keep** · **Merge** · **Move** · **Rename** · **Hide** · **Remove**.

### 1.1 Auth & shared
| Current (route) | Decision | Target | Why |
|---|---|---|---|
| Landing `/`, Login `/login`, Register `/register` | Keep | Auth shell | Public entry, unchanged. |
| ShareReport `/reports/share/token/:token` | Keep | Public share view | Standalone token surface, unchanged. |
| SearchResults `/search` | Keep | Search results page | Backs the global search/palette engine. |

### 1.2 Personal Companion (current personal workspace)
| Current (route) | Decision | Target | Why |
|---|---|---|---|
| Dashboard `/dashboard` | **Rename** | **Today** | DCX homepage: answers "what should I do now / continue / attention". Becomes the companion landing. |
| Tasks `/tasks` | Keep | Task library | The searchable backlog of the developer's own tasks. |
| TaskDetail `/tasks/:id` | **Rename + redesign** | **Current Task** | DCX continuation view: Now strip, subtasks, session, branch/PR, "where I stopped", capture. |
| FocusMode `/focus` | **Rename** | **Focus** | Companion focus shell (deep work). |
| WorkLog `/worklog` | **Rename** | **Work Log** | Engineering Memory; timeline of the day. |
| WorkLogDetail `/worklog/:id` | **Merge** | → Work Log (master/detail) | Avoids page-jump between list and item; one surface. |
| Journal `/journal` | Keep | Journal | Reflect pillar; per-task reflection + mood. |
| Reports `/reports` | Keep | Personal Reports | Time/effort retrospective. |
| Analytics `/analytics` | **Merge** | → Personal Reports | Duplicate KPIs; analytics becomes a view/filters of Reports. |
| Habits `/habits` | Keep (de-emphasized) | Habits | Supporting/motivation layer; secondary in nav. |
| Leaderboard `/leaderboard` | **Hide by default** | → under Reports/Org | Motivation + competitive; not a daily surface. |
| Settings `/settings` | Keep | Personal settings | Personal configuration. |
| `/team` (personal) | **Remove** | — | Route collision with the real `/team` (TeamProjects). Duplicate navigation. |

### 1.3 Project Companion (current workspace routes)
| Current (route) | Decision | Target | Why |
|---|---|---|---|
| `/w/:id/overview` (TeamWorkspace Mission Control) | **Rename** | **Mission Control** | Workspace companion landing (already built); the team "Today". |
| `/w/:id/sprints` (TeamWorkspace Sprint tab) | **Split to own page** | **Sprint** | "What are we delivering?"; one question per page. |
| `/w/:id/features` (FeaturesPage) | Keep | **Features** | Feature registry + per-feature progress. |
| Backlog (ProjectBacklog inside Sprint tab) | **Split to own page** | **Backlog** | "What is waiting to be scheduled?"; distinct question from Sprint. |
| `/w/:id/qa` (QADashboardPage) | **Rename** | **Reviews** | Quality + review queue; the developer's team review surface. |
| Blockers (TeamWorkspace Blockers tab) | **Split to own page** | **Blockers** | Part of Mission Control attention zone; also its own resolution board. |
| `/w/:id/activity` (ActivityFeedPage) | Keep | **Activity** | "What changed?" |
| `/w/:id/reports` (ReportsAnalyticsPage) | Keep | **Project Reports** | Delivery + velocity retrospective. |
| `/w/:id/analytics` (ReportsAnalyticsPage) | **Merge** | → Project Reports | Same component, duplicate KPI wall. |
| `/w/:id/knowledge` (TeamWorkspace Docs tab) | **Split + Move** | **Knowledge** (cross-layer) | Knowledge serves personal + team; deduplicate docs/decisions/lessons in one surface. |
| `/w/:id/calendar` (TeamWorkspace Calendar tab) | Keep | **Calendar** | Supporting: sprints, releases, milestones, leave. |
| `/w/:id/projects` (TeamWorkspace Projects tab) | **Move** | → Workspace Administration | Project *list* is administration; project *overview* becomes context (see §5). |
| `/w/:id/teams` (TeamWorkspace Teams tab) | **Move** | → Workspace Administration | Roster management, not daily work. |
| `/w/:id/members` (MemberProfilePage) | **Move** | → Workspace Administration | Directory + profiles, not daily work. |
| `/w/:id/settings` (WorkspaceSettingsPage) | Keep | → Workspace Administration | Configuration. |

### 1.4 Hub & administration
| Current (route) | Decision | Target | Why |
|---|---|---|---|
| WorkspaceHub `/hub` | **Rename role** | **Companion switcher** | "Where are we working?" — entry to any workspace/personal. |
| TeamProjects `/team` | Keep | TeamProjects | All-projects context hub (front-end). |
| WorkspaceSelector `/workspace` (admin) | Keep | WorkspaceSelector | Admin-only workspace switcher. |
| AdminOverview `/admin/overview` | **Merge** | → Admin Audit | Org-wide state overlaps with AdminAnalytics/AdminActivity. |
| AdminPeople `/admin/people` | Keep | Members & Roles | Org directory + roles. |
| AdminTeams `/admin/teams` | Keep | Teams | Org team management. |
| AdminAnalytics `/admin/analytics` | **Merge** | → Admin Audit | Duplicate KPI wall. |
| AdminActivity `/admin/activity` | Keep | **Audit** | Org-wide activity/audit log. |
| AdminSettings `/admin/settings` | Keep | Org settings | Global configuration. |

---

## 2. Product Layers

Three distinct experiences with hard separation. The developer spends the day in Layer 1; Layer 2 is where the team builds; Layer 3 is only entered to manage.

### 2.1 Personal Companion — "where developers live"
Responsibility: **preserve the individual's continuity.** Remember/resume/focus/reflect on one developer's work.
- Today, Current Task, Focus, Work Log, Journal, Knowledge, Personal Reports.
- Navigation is minimal; the Now strip and palette carry the day.

### 2.2 Project Companion — "where teams build"
Responsibility: **continue team work.** Sprint, backlog, features, reviews, blockers, activity, project reports, Mission Control.
- Entered by context (which project/sprint/feature), not by administration.
- Everything is delivery-focused; roster and permissions never appear here.

### 2.3 Workspace Administration — "where orgs are managed"
Responsibility: **organize and govern.** Projects (as a managed list), teams, members, roles, permissions, workspace settings, audit, billing (future), security (future).
- Deep links only; never the homepage; never mixed into work surfaces.

---

## 3. Navigation

| Element | Location | Behavior |
|---|---|---|
| **Top bar** | Global shell (both personal + workspace) | Workspace switcher · search trigger · command palette (`Cmd+K`/`/`) · notifications · profile. |
| **Sidebar** | Primary nav, grouped by layer | Grouped links (Phase 1 already implemented this grouping pattern in `WorkspaceLayout`). |
| **Context navigation** | Secondary tabs within a context | Task: Subtasks / Session / Work Log / Decisions / Discussions. Sprint: Board / Backlog / Review. |
| **Breadcrumbs** | Content header when a context is active | `Workspace › Project › Sprint › Feature › Task` — the context spine, always clickable back up. |
| **Quick actions** | Surface-scoped, never global | "New Task / New Sprint / New Feature / Report Blocker / Resume" appear only on the surface they belong to (Phase 1 already removed global buttons). |
| **Command palette** | Global | Palette-first resume/navigate/search — the companion's default interface. |
| **Search** | Global (top bar) | One engine; full results page backs it. |
| **Notifications** | Global (top bar) | Quiet, batchable, suppressed during Focus. |
| **Now strip** | Persistent, every surface | Current task · session clock · subtasks x/y · branch/PR · last snapshot. The constant anchor. |

---

## 4. Page Responsibilities

Every page answers **one primary question** and explicitly **never** shows secondary admin.

| Page | Primary question | NEVER on this page |
|---|---|---|
| **Today** | What should I do now? | Project admin, roster, metrics walls. |
| **Current Task** | What am I working on right now? | Other tasks' management, org admin. |
| **Focus** | Am I in deep work? | Notifications, admin, metrics. |
| **Work Log** | What happened during this work? | Future planning, metrics walls. |
| **Journal** | How do I feel about the work? | Task management. |
| **Knowledge** | What do we already know? | To-do lists, admin. |
| **Personal Reports** | How did I spend my time? | Live editing. |
| **Mission Control** | What is the state of our work today? | Roster management. |
| **Project Overview** | How is this project progressing? | Org admin. |
| **Sprint** | What are we delivering? | Org admin, personal tasks. |
| **Backlog** | What work is waiting to be scheduled? | Completed-work metrics. |
| **Features** | What are we building? | Org admin. |
| **Reviews** | What needs my review? | My own deep-work queue. |
| **Blockers** | What is blocking us? | Everything not blocking. |
| **Activity** | What changed? | Admin. |
| **Project Reports** | How is delivery trending? | Live editing. |
| **Workspace Home** | How is the organization structured? | Personal tasks. |
| **Teams / Members** | Who does what? | Individual task detail. |
| **Settings** | How is this configured? | Daily work. |
| **Audit** | What is happening across the org? | Personal productivity. |

---

## 5. Context Model

The context spine, and how developers move through it.

```
Workspace
   ↓   (choose context)
Project        ← "which product?"
   ↓
Sprint         ← "which iteration?"
   ↓
Feature        ← "which capability?"
   ↓
Task           ← "which unit of work?"
   ↓
Session        ← "which focus block?"
   ↓
Work Log       ← "what happened?"
```

**Natural movement:**
- Entry points: **Today** (personal) or **Mission Control** (team) — both surface the active thread.
- **Drill down** via breadcrumbs / context links (task card → Current Task → Work Log).
- **Sideways** via "continue" (resume a different thread) and "what changed" (activity).
- **Up** via breadcrumb spine, never a dashboard reset.
- Personal and project spines share the **same task/session/work-log spine**, so moving between Today and Mission Control never loses the thread.

Rule: switching context is always a **re-frame**, never a reset. The Now strip survives every transition.

---

## 6. Remove Product Clutter

Duplicates found and the simplification:

| Duplicate | Where | Resolution |
|---|---|---|
| `/team` route collision | Personal `/team` → TeamWorkspace vs `/team` → TeamProjects | Remove the personal duplicate. |
| Personal Analytics vs Reports | `/analytics` + `/reports` | Merge analytics into Reports as view filters. |
| Workspace Analytics vs Reports | `/w/:id/analytics` + `/w/:id/reports` (same component) | Merge into Project Reports. |
| Multi-tab mega-page | TeamWorkspace tabs (dashboard/sprints/projects/blockers/docs/calendar/analytics/admin) vs routed pages (Features, QA, Activity, Members, Settings) | Split tabs into routed single-responsibility pages; kill tab duplication. |
| Velocity / progress KPIs | Mission Control + ReportsAnalyticsPage + FeaturesPage | Single computed source (existing pure helpers); each page shows only its own primary KPI. |
| Global action buttons | Header New Project / Report Blocker | Already removed (Phase 1); keep actions contextual. |
| Command palette mounts | WorkspaceLayout + TeamWorkspace | Already single-mounted in `WorkspaceLayout`. |
| WorkLog list vs detail | `/worklog` + `/worklog/:id` | Master/detail in one surface. |
| Admin analytics overlap | AdminOverview / AdminAnalytics / AdminActivity | Merge into Audit. |

---

## 7. Role-Aware Navigation

Default views per role — never show what the role doesn't own. Anything else is one search away.

| Role | Default pages (Layer 1 → Layer 2 → Layer 3) | Never by default |
|---|---|---|
| **Developer** | Today · Current Task · Focus · Work Log · Journal · Knowledge · Personal Reports → Mission Control · Sprint · Features · Reviews | Teams, Members, Settings, Admin. |
| **Team Leader** | Developer set + Backlog · Blockers · Activity · Project Reports · Project Overview | Org admin, member management. |
| **Project Manager** | Team Leader set + Reviews (all) · Members (view) · Sprint planning admin | Org-level admin, billing/security. |
| **Workspace Owner** | Full set + Administration (Projects · Teams · Members · Roles · Settings · Audit) | — |

---

## 8. Implementation Readiness

### 8.1 Final sitemap
```
AUTH            Landing · Login · Register · ShareReport
GLOBAL SHELL    Top bar (workspace · search · palette · notifications · profile) + Now strip

L1 PERSONAL COMPANION
  Today                (ex Dashboard)
  Tasks · Current Task (ex /tasks, /tasks/:id)
  Focus                (ex /focus)
  Work Log             (ex /worklog + /worklog/:id, merged)
  Journal
  Knowledge            (personal + shared docs/decisions/lessons)
  Reports              (ex /reports + /analytics, merged)
  Habits · Settings    (secondary)

L2 PROJECT COMPANION  (context-scoped under a workspace/project)
  Mission Control      (ex TeamWorkspace dashboard)
  Sprint · Backlog     (ex sprint tab + ProjectBacklog, split)
  Features             (ex FeaturesPage)
  Reviews              (ex QA)
  Blockers             (ex blockers tab, split)
  Activity             (ex ActivityFeedPage)
  Project Reports      (ex /reports + /analytics, merged)
  Calendar             (supporting)

L3 WORKSPACE ADMINISTRATION
  Workspace Home (structure) · Projects (managed list) · Teams · Members · Roles/Permissions
  Workspace Settings · Audit (ex admin analytics/activity merged)

HUB             /hub Companion switcher · /team TeamProjects · /workspace admin selector
ORG ADMIN       /admin/* (merged into Audit + Members/Roles + Teams + Settings)
```

### 8.2 Navigation diagrams
```
GLOBAL:  [Workspace switcher] [Search/Cmd+K] [Notifications] [Profile]   ← top bar
         [ Now strip: task · clock · subtasks · branch/PR ]               ← persistent
         [ Sidebar (grouped by layer) ] [ Context tabs ] [ Breadcrumbs ] ← navigation

PERSONAL SIDEBAR:   Today · Tasks · Focus · Work Log · Journal · Knowledge · Reports | Habits · Settings
PROJECT SIDEBAR:    Mission Control · Sprint · Backlog · Features · Reviews · Blockers · Activity · Reports | Calendar
ADMIN SIDEBAR:      Workspace Home · Projects · Teams · Members · Settings · Audit
```

### 8.3 Screen hierarchy
1. **Global shell**: top bar + Now strip (all layers).
2. **Layer 1 landing**: Today (homepage of record).
3. **Layer 2 landing**: Mission Control.
4. **Drill hierarchy**: Mission Control/Today → Context (Sprint/Feature/Task) → Surface (Board/Backlog/Current Task) → Spine (Session → Work Log).

### 8.4 Context transition diagram
```
Today ──resume──► Current Task ──focus──► Focus ──pause/resume──► (loop)
   │                  │  capture
   │                  ▼
   │              Work Log ──reflect──► Journal ──► Knowledge
   ▼
Mission Control ──► Sprint ──► Backlog/Features ──► Task ──► Session ──► Work Log
   │                  │  reviews/blockers/activity
   ▼
Project Reports ◄── (velocity/completion from done tasks)
```

### 8.5 Page ownership matrix
| Page | Layer | Pillar | Default role |
|---|---|---|---|
| Today | L1 | Resume/Focus | All |
| Current Task | L1 | Remember/Focus | All |
| Focus | L1 | Focus | All |
| Work Log | L1 | Remember/Reflect | All |
| Journal | L1 | Reflect | All |
| Knowledge | L1+L2 | Knowledge | All |
| Reports (personal) | L1 | Reflect | All |
| Mission Control | L2 | Resume/Remember | All |
| Sprint / Backlog / Features | L2 | Collaborate | Leader+ |
| Reviews | L2 | Collaborate | Leader+ |
| Blockers | L2 | Collaborate/Remember | Leader+ |
| Activity | L2 | Remember | Leader+ |
| Project Reports | L2 | Reflect | PM+ |
| Workspace Home/Projects/Teams/Members | L3 | — (Admin) | Owner |
| Settings / Audit | L3 | — (Admin) | Owner |

### 8.6 Component reuse opportunities
- `WorkspaceLayout` grouped sidebar → the L2/L3 nav shell; pattern reused for personal L1 sidebar.
- TeamWorkspace Mission Control + pure helpers (`computeSprintVelocity`, `computeWorkspaceProgress`, `computePendingReviews`, `computeAssignedWork`, `computeUpcomingDeadlines`) → Today + Mission Control.
- `ProjectBacklog`, `WorkItemTypeBadge`, `FeaturesPage` → Backlog/Features pages.
- Create modals (project/sprint/task/feature/blocker/doc) → all quick actions.
- `GlobalCommandPalette` + `SearchResultsPage` + `SearchResultItem` → palette-first resume.
- Timer engine (`activeTimerState`, `timerPersist`, session client) → Focus/Now strip/Resume.
- `WorkLog` schema (`timelineEntries`, `decisions`, `blockerList`, `snapshots`, `reflection`, `tomorrowPlan`) → Work Log + Knowledge + Tomorrow plan.
- UI kit (Card/Button/Badge/Input/Select/Textarea/Toast) + motion variants (150–250 ms) → all surfaces.

### 8.7 Pages to retire
1. Personal `/team` (route collision).
2. `/w/:id/analytics` (merged into Project Reports).
3. `/analytics` personal (merged into Reports).
4. Standalone WorkLogDetail page (merged as master/detail).
5. AdminOverview + AdminAnalytics (merged into Audit).
6. TeamWorkspace mega-tab container (split into routed pages).

### 8.8 Pages to merge
| Merge | Into |
|---|---|
| Personal Analytics | Personal Reports |
| Workspace Analytics | Project Reports |
| WorkLogDetail | Work Log (master/detail) |
| AdminOverview + AdminAnalytics | Audit |
| TeamWorkspace tabs | Routed single-responsibility pages |

### 8.9 Pages requiring redesign
1. **Dashboard → Today** (DCX homepage; three-question landing).
2. **TaskDetail → Current Task** (continuation view + Now strip + capture).
3. **FocusMode → Focus** (companion focus shell).
4. **WorkLog → Engineering Memory** (where I stopped; decisions; lessons).
5. **Knowledge** (new presentation combining docs + decisions + lessons).
6. **WorkspaceHub → Companion switcher**.
7. **TeamWorkspace → Mission Control** (already built; tune to lead with Today/resume/running timer).

### 8.10 Recommended implementation order
| Order | Work | Scope |
|---|---|---|
| 1 | **Today** homepage + Now strip (reuse Dashboard state + pure helpers) | L1 |
| 2 | **Current Task** continuation view + one-tap Resume | L1 |
| 3 | **Work Log as Engineering Memory** (master/detail merge) | L1 |
| 4 | **Knowledge** surface (docs + decisions + lessons) | L1/L2 |
| 5 | **Mission Control** tune (Today/resume/running timer) | L2 |
| 6 | **Sprint/Backlog/Features/Reviews** split from mega-tab into routed pages | L2 |
| 7 | **Reports** merge (personal + project analytics → reports) | L1/L2 |
| 8 | **Administration** layer extraction (Projects/Teams/Members/Settings/Audit) | L3 |
| 9 | **Role-aware default navigation** | All |
| 10 | Clutter cleanup: route collision, palette single-mount, KPI canonicalization | All |

Each step is independently shippable, composes existing stores/endpoints/components, and keeps the server test suite green (no backend change).
