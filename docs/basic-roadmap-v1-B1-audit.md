# FocusFlow Basic Roadmap V1 — B1: Current Roadmap Audit

> Audit stage only. No production code modified.
>
> **Key finding:** the existing Personal Roadmap system already implements exactly the
> target V1 hierarchy — `Roadmap → Phase → Milestone → Task`. No custom node types,
> Subjects, Modules, Chapters, Topics, Concepts or Mastery layers exist in it.

---

## ⚠️ Naming-collision warning

Two unrelated "roadmap" systems coexist in this repo. All B2 work must touch ONLY the
personal system:

| System | Hierarchy | Backend mount | Frontend |
|---|---|---|---|
| **Personal Roadmaps** (V1 target) | `Roadmap → RoadmapPhase → RoadmapMilestone → Task` | `/api/roadmaps` | `/roadmaps*` |
| Collaboration spine (EEP2) | `Feature → Milestone → Phase → Module` | `/api/milestones\|phases\|modules` | `/w/:workspaceId/...` |

Colliding names to avoid importing by mistake:
`server/models/Milestone.js`, `server/models/Phase.js`, `server/models/Module.js`
(collab) vs `RoadmapPhase.js`, `RoadmapMilestone.js` (personal).
Also collab-only despite generic names: `src/lib/roadmapSelectors.ts`,
`src/components/roadmap/RoadmapTimeline.tsx`.

---

## 1. Current Roadmap architecture

**Backend** — Express + Mongoose, no controllers/services layer. One monolithic router
(`server/routes/personalRoadmaps.js`, 649 lines) holds CRUD for all three levels, task
linking, and analytics. Inline zod validation (`utils/validation.js`) + patch sanitizer
(`utils/patchSanitizer.js`). Every query is user-scoped via `req.user._id`.

A cascade helper (`server/utils/roadmapCascade.js`) auto-propagates task status changes
upward; it is invoked from the task PATCH handler
(`server/routes/tasks.js:19,614–616`) whenever the patched task has a `milestoneRef`.

**Frontend** — React 18 + Zustand (`src/store/useRoadmapStore.ts`) wrapping
`utils/api.ts → api.personalRoadmaps.*`. All progress is server-computed; pages only
clamp it locally (`safeProgress()` duplicated in 4 pages).

## 2. Existing files

Backend:
- `server/models/Roadmap.js`
- `server/models/RoadmapPhase.js`
- `server/models/RoadmapMilestone.js`
- `server/models/Task.js` (roadmap refs at lines 42–44)
- `server/routes/personalRoadmaps.js` (all roadmap/phase/milestone/link/analytics endpoints)
- `server/routes/tasks.js` (task CRUD; triggers cascade at line 615)
- `server/utils/roadmapCascade.js`
- Mount: `server/index.js:142` (`app.use('/api/roadmaps', personalRoadmapRoutes)`)

Frontend:
- Pages: `src/pages/RoadmapsPage.tsx`, `RoadmapDetailPage.tsx`, `PhaseDetailPage.tsx`,
  `MilestoneDetailPage.tsx`, `PersonalAnalyticsPage.tsx`
- Components: `src/components/roadmap/CreateRoadmapModal.tsx`, `RoadmapStatusBadge.tsx`
  (`RoadmapTimeline.tsx` is COLLAB-only, not used by personal pages)
- Store: `src/store/useRoadmapStore.ts`
- API client: `src/utils/api.ts:642–695` (`personalRoadmaps` block)
- Types: `src/types/roadmap.ts`
- Routes: `src/App.tsx` lines 224–227; nav: `src/components/layout/Sidebar.tsx`
  (`PERSONAL_ROADMAPS_NAV`, lines 15–19)

## 3. Existing APIs (`/api/roadmaps`)

| Method & path | Purpose |
|---|---|
| `GET /` | List, enriched with counts + progress (aggregations) |
| `POST /` | Create |
| `GET /:id` | Detail: phases w/ progress, milestones w/ progress, flat `tasks[]`, totals |
| `PATCH /:id` | Update (allowlisted fields via `buildPatch`) |
| `DELETE /:id` | Delete + deleteMany phases/milestones + null out task refs |
| `GET /analytics?days=` | Overview/today/per-roadmap/per-phase/activity/recentActivity |
| `GET /available-tasks` | User's unlinked non-completed tasks |
| `POST /link-task` | Validate chain ownership, set `roadmapRef/phaseRef/milestoneRef` on task |
| `DELETE /unlink-task/:taskId` | Clear the three refs |
| `GET/POST /:roadmapId/phases` | Phase list/create |
| `PATCH/DELETE /phases/:id` | Phase update/delete (delete unlinks its tasks, deletes milestones) |
| `GET/POST /phases/:phaseId/milestones` | Milestone list/create |
| `PATCH/DELETE /milestones/:id` | Milestone update/delete (delete only unlinks tasks) |

Route-ordering hazard: literal segments (`/analytics`, `/available-tasks`, `/link-task`)
must stay registered before `/:id`; `/phases/*` and `/milestones/*` PATCH/DELETE live in
the same router after the nested GETs — fragile if reordered.

## 4. Existing models

- **Roadmap**: `userId`, `title`, `description`, `type`
  (`learning|project|career|certification|interview-prep|personal|custom`),
  `startDate`, `targetDate`, `status` (`planning|active|completed|paused|archived`),
  `icon`, `color`, `workspaceContext`. Indexes `{userId,status}`, `{userId,createdAt}`.
- **RoadmapPhase**: `userId`, `roadmapId` (req), `title`, `description`, `order`,
  `startDate`, `targetDate`, status (`upcoming|active|completed|paused`).
  Index `{roadmapId, order}`.
- **RoadmapMilestone**: `userId`, `roadmapId`, `phaseId` (**required**), `title`,
  `description`, `order`, `targetDate`, status (`todo|in-progress|completed`).
  Indexes `{phaseId, order}`, `{roadmapId}`.
- **Task**: optional denormalized back-refs `roadmapRef`, `phaseRef`, `milestoneRef`
  (default null; indexes on `roadmapRef` and `milestoneRef` — none on `phaseRef`).

Relationship shape: tasks are *linked*, never owned. Unparenting nulls refs instead of
deleting tasks. Milestones cannot exist without a phase (required `phaseId`).

### Task → Session

- `Session.taskId` — required ObjectId ref `'Task'`, indexed (`models/Session.js:13`).
- On session stop (`PATCH /api/sessions/:id/stop` → `utils/sessionFinalize.js`):
  re-sums the task's inactive sessions and writes `Task.totalTime`
  (and resets `status:'todo'`), then `syncTaskWorkLogs` rebuilds WorkLog day entries
  from the task's sessions (`utils/worklogSync.js`). Same accounting runs on orphan
  sweep at session start and zombie reaping (`jobs/reaper.js`).
- Consequence: roadmap-linked task time flows into roadmaps through
  `Task.totalTime` aggregation (list endpoint `$sum:'$totalTime'`), not through Session.

## 5. Existing store actions (`useRoadmapStore.ts`)

State: `roadmaps: RoadmapListItem[]`, `activeRoadmap: RoadmapDetail | null`,
`loading`, `detailLoading`, `error`.

Actions: `loadRoadmaps`, `getRoadmap(id)`, `createRoadmap(data)` (injects
workspaceContext from `useWorkspaceStore`), `updateRoadmap(id, updates)`,
`deleteRoadmap(id)`, `createPhase(roadmapId, data)`, `updatePhase(id, updates)`,
`deletePhase(id)`, `createMilestone(phaseId, data)`, `updateMilestone(id, updates)`,
`deleteMilestone(id)`, `clearActiveRoadmap()`, `refreshIfLinked(roadmapId?)`,
`linkTask({taskId,roadmapId,phaseId,milestoneId})`, `unlinkTask(taskId)`.

Pattern: every mutation re-fetches both detail and list (coarse but consistent);
toasts on success/error; no caching/dedup.

## 6. Existing progress formulas (server-side only)

- Roadmap % = completed milestones ÷ total milestones × 100
- Phase % = completed milestones ÷ milestones-in-phase × 100
- Milestone % = completed tasks ÷ linked tasks × 100
- List endpoint mirrors these via aggregations. Tasks influence progress only
  indirectly through milestone completion. Client clamps values (`safeProgress`).

Computed independently in ≥3 places: `GET /`, `GET /:id`, `GET /analytics`.

## 7. Existing status behavior

Enums: roadmap `planning|active|completed|paused|archived`;
phase `upcoming|active|completed|paused`; milestone `todo|in-progress|completed`;
task `todo|active|paused|completed`.

Cascade (`roadmapCascade.js`, fired from task PATCH only when `milestoneRef` present
AND patch contains `status`; errors swallowed):
- All linked tasks completed → milestone `completed`.
- Any task active/paused & milestone was `todo` → `in-progress`.
- Nothing active anymore & milestone was `in-progress` → reset `todo`.
- All milestones completed → phase `completed`; any milestone in-progress/completed &
  phase was `upcoming` → `active`.
- Phase completion auto-activates next `upcoming` phase by `order`.

Manual status edits via PATCH remain possible at every level.

## 8. Existing timeline behavior

Personal roadmaps have NO date-bucketed timeline. Detail page lists phases by `order`;
milestones sort by `order`. A date-based Gantt exists only for the collaboration system
(`RoadmapTimeline.tsx` + `selectMilestonesByDate`). Analytics' AreaChart plots *current*
progress per roadmap as pseudo time-series (no historical snapshots exist).

## 9. Existing health behavior

Client-only, duplicated in two files with identical math:
`RoadmapsPage.tsx:34–53` and `RoadmapDetailPage.tsx:31–47`.
Expected linear progress from `startDate`(fallback `createdAt`, fallback epoch) →
`targetDate`: within expected−10 ⇒ "On Track" (success); within expected−25 ⇒
"At Risk" (warning); else "Behind" (danger). Special cases: completed/paused/archived,
missing targetDate, or progress 0 ⇒ On Track; target ≤ start ⇒ Behind.

## 10. Existing analytics behavior

`GET /api/roadmaps/analytics?days=N` loads ALL roadmaps+phases+milestones+linked tasks
into memory (JS filtering, O(N·M), no aggregation pipeline):
overview KPIs, today counters, per-roadmap breakdown, per-phase stats,
activity days derived from `updatedAt` date strings of completions (unreliable — any
edit bumps `updatedAt`), recent-activity feed (last 15 completions).

## 11. Problems / inconsistencies found

1. **Stale cascade on task delete** — `DELETE /api/tasks/:id` deletes Sessions/Journals
   and resyncs WorkLogs but never calls `cascadeTaskStatusChange`; milestone/phase
   statuses can go stale.
2. **Session stop resets `Task.status='todo'`** on every stop (`sessionFinalize.js:97–99`)
   — interacts oddly with cascades that read task status.
3. **Progress computed in 3+ places** (list/detail/analytics) — drift risk.
4. **Health logic duplicated client-side** in 2 files with copy-pasted thresholds.
5. **Completion dates derived from `updatedAt`** in analytics — unreliable.
6. **No index on `Task.phaseRef`** while it is filtered in queries.
7. **Route-order fragility** inside `personalRoadmaps.js`.
8. **Bad URLs show skeleton forever** (`MilestoneDetailPage` has no not-found state;
   breadcrumb falls back to `'Phase'`).
9. **Analytics loads whole graph into memory** each call; pseudo-time-series chart.
10. **No migration exists for personal roadmap collections** (`0012` is collab-only).
11. **Naming collisions** with the collab spine (see warning above).
12. **No phase-creation UI on the detail page** — store action exists but no button;
    users must discover phases elsewhere (empty state text only).

## 12. Minimal changes required for Basic Roadmap V1

Good news: the current system ALREADY matches the V1 structure
(`Roadmap → Phase → Milestone → Task`). No new hierarchy, node types, or abstractions
are needed. V1 is therefore mostly hardening + gap-filling:

1. Add phase-creation UI on `RoadmapDetailPage` (store action already exists).
2. Extract one shared server module for progress computation; use it from
   list/detail/analytics endpoints.
3. Fix stale-cascade bug: call `cascadeTaskStatusChange` (or a recalc) after task delete.
4. Add missing index `{ userId: 1, phaseRef: 1 }` on Task (migration).
5. Optional polish: not-found states on deep pages; single shared health util.
6. Tests: unit tests for `roadmapCascade.js` (currently untested) and progress formulas.

Nothing else should change — no schema redesign, no renames, no new abstractions.

---

## B2 Implementation Plan

Goal: ship Basic Roadmap V1 as-is-plus-fixes, without touching structure.

**Step 1 — Shared progress module (backend)**
New `server/utils/roadmapProgress.js`: pure helpers computing roadmap/phase/milestone
progress from plain arrays. Refactor `personalRoadmaps.js` list/detail/analytics to use
it. Behavior must be byte-for-byte identical (verify against existing responses).

**Step 2 — Cascade correctness**
In `DELETE /api/tasks/:id` handler, after WorkLog resync, recascade affected
milestone/phase (reuse `cascadeTaskStatusChange` with the deleted task's refs captured
before deletion). Add regression test.

**Step 3 — Index migration**
New migration `0013_task_phase_ref_index.js` creating `{userId:1, phaseRef:1}` on
`tasks` (idempotent pattern copied from `0012_roadmap_collections.js`).

**Step 4 — Phase creation UI**
Add "Add Phase" affordance + small dialog to `RoadmapDetailPage` calling the existing
`useRoadmapStore.createPhase` (title/description/dates/status defaults). Reuses existing
endpoint; no backend change.

**Step 5 — Health deduplication (client)**
Extract `getHealth(roadmap)` into `src/lib/roadmapHealth.ts`; both pages import it.
Identical thresholds; snapshot-test.

**Step 6 — Cascade unit tests**
`server/__tests__/roadmapCascade.test.js` covering: all-completed→completed,
any-active→in-progress, reset-to-todo, phase activation, next-phase progression,
no-op without `milestoneRef`.

**Step 7 — Verification**
- `npm run lint` / typecheck in `mainApp` and `mainApp/server`.
- Run frontend tests (`src/__tests__`, store/component suites).
- Run server tests (`node --test` or repo-configured runner).
- Manual smoke: create roadmap → phase → milestone → link task → toggle task status →
  verify cascade + progress + health badge.

Order matters: Steps 1–3 are behavior-preserving fixes; 4–5 are additive UI/util work;
6–7 validate everything. Each step is independently shippable.
