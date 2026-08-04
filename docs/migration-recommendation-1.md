# Migration Plan — Sprint / Feature / Task Domain + API (Recommendation 1)

Status: **Proposed — no code written yet**

Source: Architecture Assessment (workspace hierarchy & domain model) — Recommendation 1.

## 1. Goal & non-goals

**Goal:** Replace the in-memory mock collaboration layer (`useCollaborationStore.ts:408-479` — `createSprint`, `createTask`, `updateTaskStatus`, `updateGitContext`, hardcoded `'m1'`) with persisted `Sprint`, `Feature`, and workspace-scoped `Task` collections backed by real endpoints, so sprint/feature/task data survives refresh and is shared across members.

**Out of scope (later recommendations):** navigation drill-down routes + breadcrumbs (Rec 4), project/workspace analytics pipelines (Rec 6), unifying the personal/workspace *UI* and WorkLog `taskRef` validation (Rec 3), permission-matrix overhaul (Rec 7). The schema decision below is designed so Rec 2 (link personal Tasks upward) becomes mostly UI work afterwards.

## 2. Key design decision (needs sign-off)

| Option | Description | Trade-off |
|---|---|---|
| **A — Single Task collection (recommended)** | Extend the existing `Task` model with optional `workspaceRef/projectRef/sprintRef/featureRef` + collaboration fields. Personal tasks stay `userId`-only (refs null). | One task system forever; existing personal-task code/tests untouched; Rec 2 becomes a UI attach + backfill. Risk: collab task queries must be scoped carefully. |
| B — Separate `CollaborativeTask` collection | Parallel mock-free collection | Low risk to personal stack, but re-creates the two-task-system split the assessment flagged as a Critical gap. |

**Recommend A.** `projects.js:43-51` already demonstrates the exact dual-mode (workspace-vs-personal) pattern we will mirror in `tasks.js`.

### Decisions to confirm before implementation

- (a) Single `Task` collection (A) vs separate `CollaborativeTask` (B).
- (b) `Feature.sprintRef` nullable to allow backlog features (recommended: yes).
- (c) Sprint/Feature delete = null-out child refs, no cascade delete (recommended: yes).
- (d) Extend `Project` model now (Phase 3.5) or later.
- (e) Adopt §9 additions: Project Backlog, Feature `type`/`labels`/`ownerId`/`estimatedHours`, ownership invariants (recommended: yes — see §9 for rationale).

## 3. Schema changes (new models + model extensions)

All new models follow `Project.js`/`Team.js` conventions (ref suffix naming, `workspaceRef` denormalization like `Activity.js:15`).

### 3.1 New `server/models/Sprint.js`

```js
{
  projectRef:  { ObjectId, ref 'Project', required, index },   // belongs to exactly ONE project
  workspaceRef:{ ObjectId, ref 'Workspace', required, index }, // denormalized for permission gating
  name:        { String, required, trim, maxlength: 150 },
  goal:        { String, default: '' },
  startDate:   { Date, required },
  endDate:     { Date, required },
  status:      { enum: ['future','active','completed'], default: 'future' },
  capacityHours: { Number, default: 0 },
  targetVelocity: { Number, default: 0 },
  createdBy:   { ObjectId, ref 'User', required },
}, { timestamps: true }
indexes: { projectRef:1, startDate:-1 }, { workspaceRef:1, status:1 }
```

Note: `status` matches the frontend `Sprint.status` (`types/collaboration.ts:79`). The board column `'backlog'|'ready'|'in_progress'|'review'|'done'` belongs to **tasks**, not sprints.

### 3.2 New `server/models/Feature.js`

```js
{
  projectRef:  { ObjectId, ref 'Project', required },
  sprintRef:   { ObjectId, ref 'Sprint', default: null },   // null ⇒ Project Backlog (see §9.1)
  workspaceRef:{ ObjectId, ref 'Workspace', required },
  name:        { String, required, trim, maxlength: 150 },
  description: { String, default: '' },
  type:        { enum: ['feature','bug','spike','chore','research','debt','improvement'], default: 'feature' },  // §9.2
  labels:      [{ String }],                              // §9.1 backlog filter
  ownerId:     { ObjectId, ref 'User', default: null },   // §9.1 backlog owner
  estimatedHours: { Number, default: 0 },                 // §9.1 backlog estimation
  status:      { enum: ['backlog','ready','in_progress','review','done'], default: 'backlog' },
  order:       { Number, default: 0 },                    // §9.1 prioritization/ordering
  createdBy:   { ObjectId, ref 'User', required },
}, { timestamps: true }
indexes: { projectRef:1, order:1 }, { sprintRef:1, status:1 }, { workspaceRef:1 }, { type:1 }
```

When `sprintRef` is set, the route validates `Feature.projectRef` equals `Sprint.projectRef` (no cross-project sprints — enforces assessment Q5/Q14). When `sprintRef` is null, the feature belongs to the Project Backlog by definition (§9.1) — the backlog is a query (`projectRef = p, sprintRef = null`), not a collection.

### 3.3 Extend `server/models/Task.js` (append; existing fields untouched)

```js
workspaceRef: { ObjectId, ref 'Workspace', default: null },
projectRef:   { ObjectId, ref 'Project',   default: null },
sprintRef:    { ObjectId, ref 'Sprint',    default: null },
featureRef:   { ObjectId, ref 'Feature',   default: null },
assigneeId:   { ObjectId, ref 'User',      default: null },
reviewerId:   { ObjectId, ref 'User',      default: null },
followerIds:  [{ ObjectId, ref 'User' }],
labels:       [{ String }],
dependencies: [{ ObjectId, ref 'Task' }],
estimatedHours: { Number, default: 0 },
actualHours:    { Number, default: 0 },
sprintStatus:   { enum: ['backlog','ready','in_progress','review','done'], default: 'backlog' },
gitContext: { repository, branch, commitHash, prNumber, prUrl,
              reviewStatus, reviewerName, mergeStatus, deploymentStatus }  // mirrors types/collaboration.ts:85-95
indexes: { workspaceRef:1, sprintRef:1 }, { featureRef:1 }, { projectRef:1 }
```

Existing personal-task behavior is byte-for-byte identical (new fields default to null/empty).

### 3.4 Optional (Phase 3.5): extend `server/models/Project.js`

Persist `description`, `key`, `status`, `milestones`, `members`, `teamIds` — currently optimistic-only (`useCollaborationStore.ts:77-90`). Include only if project cards should reflect edited fields across members.

## 4. Database migrations (framework: `server/migrations/`, `core.js`, idempotent `{ up({ db }) }`)

| File | Operations |
|---|---|
| `0010_create_sprint_feature_collections.js` | `createIndex` on sprints + features (auto-creates collections); idempotent via guard on existing index / `db.collection('sprints').findOne` |
| `0011_task_collab_links.js` | `tasks.updateMany({}, { $set: { workspaceRef:null, projectRef:null, sprintRef:null, featureRef:null, sprintStatus:'backlog', labels:[], dependencies:[], followerIds:[], estimatedHours:0, actualHours:0 } })` — backfills all legacy personal tasks safely |

Apply: `node migrations/run.js --apply --db=<MONGODB_URI>` (dry-run first). No data backfill needed — current sprints/tasks are ephemeral mock and intentionally not carried over.

**Additions impact (§9):** no new migrations required. The `features` collection created by `0010` includes the backlog/work-item fields (§3.2); adding them *after* shipping would require a separate migration + backfill, which is the main reason they are included now.

**Rollback:** migrations are forward-only (`core.js` has no `down`); rollback = revert code + manual `dropIndex`/`$unset`. Plan for a single release.

## 5. API routes (follow `projects.js` conventions: zod `validate`, `findMember`, Activity writes)

Mount in `server/index.js` after line 125: `app.use('/api/sprints', sprintRoutes)`, `app.use('/api/features', featureRoutes)`.

**First, extract shared gates** into `server/middleware/workspace.js` (fixes the assessment §8 fragmentation for new code):

- `requireWorkspaceMember` (any role incl. Viewer) — for reads
- `requireWorkspaceEditor` (any role except Viewer) — for create/update
- `requireWorkspaceOwnerAdmin` (Owner|Admin) — for delete/settings

Backed by one `Workspace.findById().select('members')` + `findMember` (pattern from `projects.js:25-36`), applied via `loadWorkspace`/`requireRole` factories (existing `workspace.js:38-62`).

### `server/routes/sprints.js` → `/api/sprints`

| Endpoint | Gate | Notes |
|---|---|---|
| `GET /?projectId=` | `requireWorkspaceMember` | Resolve project → `workspaceRef`; return its sprints |
| `POST /` (projectId, name, startDate, endDate, goal) | `requireWorkspaceEditor` | Validates `startDate < endDate`, writes `Activity('sprint.created')` |
| `PATCH /:id` (goal, dates, capacity, targetVelocity, status) | `requireWorkspaceEditor` | Scoped by `workspaceRef` |
| `DELETE /:id` | `requireWorkspaceOwnerAdmin` | **Nulls** `sprintRef` on tasks/features (no cascade delete) |

### `server/routes/features.js` → `/api/features`

`GET /?projectId=&sprintId=` (member) · `POST /` (editor) · `PATCH /:id` (editor) · `DELETE /:id` (Owner/Admin, nulls `featureRef` on tasks). Validates feature↔sprint same-project.

Backlog support (see §9.1):
- `GET /?projectId=&backlog=true` → `{ projectRef: projectId, sprintRef: null }` (the Project Backlog).
- Drag-and-drop into Sprint = `PATCH /:id { sprintRef }` (editor) — revalidates same-project, leaves `order` intact for backlog re-prioritization.
- `type`, `labels`, `ownerId`, `estimatedHours`, `order` are writable via `PATCH /:id`.

### Ownership invariants (see §9.3) — enforced server-side on all new routes

- `workspaceRef` on Sprint/Feature/Task is **derived from the owning Project** (`project.workspaceRef`), never trusted from the client body.
- Creation routes resolve the Project first, then apply the workspace membership/role gate.
- Feature↔Sprint and Task↔Feature/Sprint refs must share the same `projectRef` (cross-project refs rejected).
- Sessions/Work Logs remain user-owned until Rec 2; project-level ownership of sessions/worklogs is a documented boundary, not code.

### Extend `server/routes/tasks.js` (backward compatible)

- `GET /`: add `?workspaceId=`/`?projectId=`/`?sprintId=`/`?featureId=` filters. No workspace filter → unchanged personal query (`{ userId, workspaceRef: null }`, like `projects.js:50`). With workspace → member-gated workspace tasks.
- `POST /`: accept optional refs (workspace-gated when present). Personal create path untouched.
- `PATCH /:id`, `DELETE /:id`: existing `{_id, userId}` scope preserved; when task is workspace-scoped, additionally require `requireWorkspaceEditor` for the task's `workspaceRef`.
- New `PATCH /:id/git` for `gitContext`.

## 6. Frontend changes

### `src/types/collaboration.ts`

- Add `Feature` interface (`id, projectId, sprintId?, workspaceId, name, description, type, labels, ownerId?, estimatedHours, status, order, createdAt`) — aligns to §3.2.
- Add `FeatureType` union (`'feature' | 'bug' | 'spike' | 'chore' | 'research' | 'debt' | 'improvement'`).
- Align `CollaborativeTask` to the server: refs become ids (`workspaceId, projectId, sprintId?, featureId?`).

### `src/utils/api.ts`

- Add `sprints: { list, create, update, remove }`, `features: { list, create, update, remove }` (pattern from `api.ts:301-309`).
- Extend `tasks` with workspace `list` filters + collab `create`/`update`/git payloads.

### `src/store/useCollaborationStore.ts` (mirror the proven `createProject`/`createTeam` pattern, `:374-406`)

- Add `toSprint`, `toFeature`, `toCollabTask` mappers (like `toProject`, `:77-91`).
- **New loaders** `loadSprints`/`loadFeatures`/`loadTasks`, wired into `loadCollabData` (`:243-250`).
- **Convert to API-backed** via `runMutation` optimistic updates: `createSprint` (`:408`), `createTask` (`:426`), `updateTaskStatus` (`:454`), `updateGitContext` (`:466`).
- **Replace hardcoded `'m1'`** with the real authenticated user (from `api.me`/auth store) and real `members` for assignee/reviewer.
- Delete the now-dead mock-only `createSprint`/`createTask` bodies.

### UI rewiring

- `TeamWorkspace.tsx` sprint board (`:336-355, 400-414`) and velocity/capacity cards (`:235-236, 346-352`): consume real `sprints`/`tasks` from the store.
- `FeaturesPage.tsx` (`:25-31, 72, 141-171`): render real `features`; "Private Implementation Tasks" lists tasks by `featureRef`.
- **New Backlog view (per Project)**: backlog features (`sprintRef == null`), ordered by `order`, filterable by `status`/`type`/`owner`/`labels`, with drag-and-drop into a Sprint (see §9.1). Search is a client-side filter initially; server `search.js` integration deferred.
- Work-item `type` badge + filter on Features/Backlog pages (see §9.2).
- Create-Sprint / Create-Task modals: real assignee dropdown (no `'m1'`).
- `ReportsAnalyticsPage.tsx` (`:15-19, 30-33`): completion rate/velocity from real feature/task data (burndown/velocity computation deferred to Rec 6).

## 7. Tests & verification

- **Server** (new, follow `server/__tests__` conventions): `sprints.test.js`, `features.test.js`, `workspaceTasks.test.js` — membership gates (Viewer read vs Editor write), same-project sprint/feature validation, workspace scoping on PATCH/DELETE, backward-compat personal task create.
- **Existing server tests must stay green** — especially `tasks`/`sessions` route tests pin `{userId}`-only behavior; the extension must not alter them.
- **Frontend**: extend `useCollaborationStore.test.ts` (loaders/actions now mock the API), update `api.collaboration.test.ts`.
- Commands: `npm run typecheck` + `npm test` from `mainApp`; `npx vitest run --root . server/__tests__`; migration `--dry-run` then `--apply`.

## 8. Sequencing & effort

| Step | Phase | Effort | Risk |
|---|---|---|---|
| 1 | Models (3.1–3.3) | S | Low |
| 2 | Migrations 0010/0011 | S | Low |
| 3 | Workspace gate extraction + sprints/features routes | M | Med |
| 4 | tasks.js extension | M | Med (backward-compat tests) |
| 5 | API client + store loaders/actions | M | Med |
| 6 | UI rewiring | M | Med |
| 7 | Tests + verify | M | Low |

## 9. Architectural Additions — evaluation & integration

This section evaluates four proposed additions against the plan in §1–§8. Each was adopted only where it improves the design without adding unnecessary complexity. The existing proposal (§2–§8) is unchanged except where noted (Feature schema §3.2, features route §5, frontend §6, decisions §2e).

### 9.0 Updated hierarchy diagrams

**Target after Recommendation 1 + adopted additions** (Organization deliberately deferred, §9.4):

```
Organization (future — deferred, not implemented)
  └─ Workspace
       ├─ Members · Teams · Roles · Permissions · Notifications · Activity · Workspace Analytics
       └─ Project
            ├─ Project Backlog ──────── features where sprintRef == null (virtual, no collection)
            │     · prioritize (order) · labels · owner · estimation · status · search/filter
            ├─ Sprint
            │    └─ Feature  (type: feature | bug | spike | chore | research | debt | improvement)
            │         └─ Task
            │              └─ Session
            │                   └─ Work Log
            └─ Project Reports · Project Analytics (deferred — Rec 6)
```

### 9.1 Addition 1 — Project Backlog → **Implement now**

- **Schema impact: none structurally.** The backlog is the set `{ Feature | projectRef = p, sprintRef = null }` — the plan already makes `sprintRef` nullable (`§3.2`, decision 2b). No new collection, no new model.
- **Capability → field mapping** (all on `Feature`):
  - Prioritization → `order` (already planned)
  - Drag-and-drop into Sprint → `PATCH /features/:id { sprintRef }` (already planned; revalidates same-project)
  - Ordering → `order`
  - Status → `status` (already planned)
  - Labels → **add** `labels: [String]`
  - Estimation → **add** `estimatedHours: Number`
  - Owner → **add** `ownerId` (ref User)
  - Search → client-side filter in the Backlog UI for now; server `search.js` integration **deferred** (keeps API surface tight; features are a small set per project)
- **Why adopt:** matches the intended hierarchy (a first-class Backlog between Project and Sprint), costs zero new collections, and the three added fields (`labels`, `estimatedHours`, `ownerId`) land in a brand-new collection being created by migration `0010` — free today, a migration + backfill tomorrow.
- **Backward compatibility:** personal-stack unaffected; existing personal Tasks have no Feature linkage yet (Rec 2).

### 9.2 Addition 2 — Work item types → **Implement now** (Epic deferred)

Single `Feature` collection with a `type` enum (`feature | bug | spike | chore | research | debt | improvement`, default `feature`). No separate collections.

- **Database impact:** one enum field + optional `{ type: 1 }` index. Trivial.
- **API impact:** enum added to the zod create schema; existing endpoints unchanged for the default `feature`; `PATCH` accepts `type`.
- **UI impact:** type badge + filter on Features/Backlog pages; one small shared component.
- **Reporting/analytics impact:** filtering/grouping by `type` at zero structural cost — enables later bug-vs-feature velocity and debt tracking (Rec 6).
- **Epic → Defer:** Epics require a parent/child (or hierarchy) relationship, which is real modeling complexity. Defer until a feature demands it; adding `parentRef` later is a single nullable field, not a rewrite.
- **Why now:** the collection is created in this plan; adding the enum later is a migration + backfill + UI churn for zero added complexity now.
- **Backward compatibility:** pure additive; `type` defaults to `feature`, so existing and future "features" are indistinguishable from today's behavior.

### 9.3 Addition 3 — Ownership validation → **Implement now (as invariants, not features)**

Validated against the stated ownership boundaries:

- **Workspace owns** members, teams, roles, permissions, notifications, activity, workspace analytics, projects → already enforced by the existing workspace membership/role gates (`requireWorkspace*`, §5) and by storing `workspaceRef` on Project/Team/Activity/Notification.
- **Project owns** backlog, sprints, features, tasks (+ future sessions, worklogs, project reports, project analytics) → enforced by the ownership invariants added in §5.

The proposed implementation already places `projectRef` + derived `workspaceRef` on Sprint/Feature/Task, which is correct. One hardening change is integrated:

- `workspaceRef` is **server-derived from the owning Project**, never accepted from the client (prevents cross-workspace corruption).
- All refs beneath a Project must share its `projectRef` (Feature↔Sprint, Task↔Feature/Sprint).
- **Boundary note (documented, not coded):** Sessions and Work Logs remain user-owned until Rec 2. "Project owns sessions/worklogs" therefore holds only transitively (via Task) once Rec 2 links Tasks upward. Stating this now avoids a false assumption that this plan delivers project-owned sessions.

### 9.4 Addition 4 — Future enterprise scalability → **Prepare, no schema change**

Can the hierarchy evolve to `Organization → Workspace → Project → Backlog → Sprint → Feature → Task → Session → Work Log`?

- **Yes, with today's design.** Every child already carries a denormalized `workspaceRef`, so introducing an Organization only adds an `organizationRef` field to the `Workspace` document. No child schema changes, no re-parenting, no cascade.
- **Small adjustments today that reduce future migration effort:**
  1. Keep all aggregation keys workspace-scoped (already the plan) — org rollups become a new pipeline, not a rewrite.
  2. Avoid global unique indexes on workspace fields (org-scoped uniqueness must be expressible later).
  3. Keep workspace-scoped queries explicit rather than assuming a single platform.
- **Explicitly not doing now:** adding `organizationRef` to Workspace (YAGNI — it is a document-level field, trivially added later). Also **not** modeled: Organization-level membership, cross-workspace search, and org-scoped admin analytics — these are future work, but the platform-wide pieces that assume a single platform today (global leaderboard `reports.js:348`, admin `system-analytics`) will need org scoping when Organization arrives.

### 9.5 Migration impact (additions)

- `0010` unchanged in structure — the `features` collection now simply includes `type`, `labels`, `ownerId`, `estimatedHours`, and index `{ type: 1 }` at creation. No backfill (new collection).
- `0011` (task collab links) unchanged.
- **No new migration files.** This is the decisive cost argument for including §9.1/§9.2 now.

### 9.6 Risks

| Risk | Mitigation |
|---|---|
| Denormalized `workspaceRef` drift (Sprint/Feature/Task vs Project) | Server-side derivation from `projectRef` (§9.3 invariant); reads always join through Project |
| Backlog search is client-side only at first | Scope is a single project's feature set; server `search.js` integration is a defined follow-up |
| `type` enum expansion later | Adding enum values is a one-line schema + migration; Epic (hierarchy) deliberately deferred |
| Backlog could encourage "sprint-less" work proliferation | Product guardrail (status/order discipline), not a schema concern |
| Owner/estimate fields on a new collection shipped without users' data | Zero-risk: new collection, defaults everywhere, personal stack untouched |

### 9.7 Recommendation summary

| Addition | Verdict | Why |
|---|---|---|
| 1 — Project Backlog | **Implement now** | Free via null-`sprintRef`; 3 small fields in a new collection; matches intended hierarchy |
| 2 — Work item types | **Implement now** | Trivial enum at collection creation; costs a migration + backfill if deferred; Epic deferred |
| 3 — Ownership validation | **Implement now** | Design invariants, not features; prevents cross-workspace corruption; server-side `workspaceRef` derivation |
| 4 — Enterprise scalability | **Prepare (no schema change)** | Denormalized `workspaceRef` already makes `Organization` a document-level field later; document constraints only |

All additions are backward compatible: personal stack untouched, existing mock data intentionally not carried over, and no behavior changes for the default `feature` type.

## 10. Related references

- Architecture assessment: `docs/` (see analysis for hierarchy gaps, §11 issue register rows 1–2, §8 permission fragmentation).
- Evidence anchors:
  - `server/models/Task.js:10` — Task has only `userId` (no parent refs).
  - `server/models/Project.js:44-49` — `workspaceRef` optional, `null` = personal.
  - `useCollaborationStore.ts:408-479` — mock `createSprint`/`createTask`/status/git actions, hardcoded `'m1'`.
  - `server/routes/projects.js:43-51` — dual-mode (workspace-vs-personal) GET pattern to mirror.
  - `src/types/collaboration.ts:71-118` — existing `Sprint`/`CollaborativeTask` types to align.
