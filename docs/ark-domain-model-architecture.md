# ARK — Product-Hierarchy Domain Model (Architecture)

Status: **Proposed — design only, no code.**
Source of truth: [`docs/engineering-companion-phase1.md`](engineering-companion-phase1.md) + [`docs/migration-recommendation-1.md`](migration-recommendation-1.md) + [`docs/ark-information-architecture.md`](ark-information-architecture.md) — **approved; do not redesign the philosophy.**
Scope guardrails (locked):
- This document proposes the domain model, ownership, relationships, schema, API, routing, migration, risks, and sequencing. **No implementation code.**
- Sprints are **execution containers**, not part of the product hierarchy. Tasks are *assigned to* a sprint but *owned by* a feature.
- Personal stack (non-workspace) is preserved byte-for-byte: every new/extended field defaults to null/empty.
- New entities follow the established conventions: `Ref` suffix on Mongo refs, denormalized `workspaceRef` derived server-side from the owning Project (never client body), zod `validate`, `Activity` writes, no cascade deletes.

---

## 1. Proposed Domain Model

### 1.1 Target hierarchy

```
Workspace
  └── Project
        ├── Project Info     → Project document (description · key · status · visibility · members · teamIds)
        ├── Roadmap          → query over Milestone (ordered by targetDate)  [virtual, not a collection]
        │     └── Milestone ── Phase ── Module ── Feature ── Task ── Subtask   (product spine, 6 levels)
        ├── Sprint Planning  → Sprint collection (execution containers beside the spine)
        ├── Knowledge Base   → KnowledgeDoc collection (currently client-mock only — see §4)
        ├── Members          → Project.members / Project.teamIds
        ├── Reports          → computed views over Tasks/Features/Sprints (no new store)
        └── Settings         → project-scoped configuration (minimal; see §4)
```

### 1.2 Entities

| Entity | Kind | Parent | Notes |
|---|---|---|---|
| `Milestone` | **new collection** | Project | Roadmap item. Replaces the embedded `Project.milestones` array (migration §7). |
| `Phase` | **new collection** | Milestone | Delivery phase within a milestone. |
| `Module` | **new collection** | Phase | Capability area within a phase. |
| `Feature` | existing, **extended** | Module (optional) | `moduleRef` nullable ⇒ unassigned features live at the Project backlog level. Keeps `sprintRef` (planning) independent of `moduleRef` (ownership). |
| `Task` | existing, **unchanged structurally** | Feature | Already carries `featureRef` + `sprintRef` + `projectRef` + `workspaceRef` — the "owned by feature, assigned to sprint" rule already works. |
| `Subtask` | existing embedded array | Task | Checklist items (`subtasks[]` on Task). Kept embedded: no per-subtask ownership/roles required. Promote to a collection only if a real demand appears (§8 risk). |
| `Sprint` | existing, **unchanged** | Project (execution) | Not in the product spine. Tasks enter a sprint via `Task.sprintRef` assignment. |
| `Roadmap` | **virtual** | — | `{ milestoneRef: none, projectRef }` ordered list of milestones — same pattern as the Project Backlog (a query, not a collection; `migration-recommendation-1.md` §9.1). |

### 1.3 Design decision — Roadmap as a query, not a collection

The Project Backlog was established as a *query* (`{ projectRef, sprintRef: null }`) to avoid an empty container collection (`migration-recommendation-1.md` §9.1). The Roadmap follows the identical rule: it is the ordered set of `Milestone`s of a project, surfaced by `GET /api/milestones?projectId=`. Creating a Milestone creates a roadmap entry; nothing holds a separate "roadmap" doc.

### 1.4 Design decision — Feature is the flex point

`Feature` sits between the structural spine (Milestone → Phase → Module) and the execution layer (Sprint/Task). It is the one entity that links **both**:
- **Ownership** → `moduleRef` (product spine).
- **Planning** → `sprintRef` (execution; `null` = Project Backlog).

This is deliberate: a feature can be planned into a sprint while its owning module is still being shaped, and moving a feature between modules never disturbs sprint assignment.

---

## 2. Entity Ownership

| Owner | Owns | Enforced by |
|---|---|---|
| **Workspace** | memberships/roles, teams, projects, activity, notifications, workspace knowledge, blockers, calendar | existing `requireWorkspace*` gates + `Workspace.members`; `workspaceRef` on Project/Team/Activity/Notification |
| **Project** | Milestone · Phase · Module · Feature · Task · Subtask, Sprint (execution), Project.members/teamIds, project knowledge, project reports (derived), project settings | `projectRef` required on every spine entity + Sprint; **`workspaceRef` always derived server-side from the owning Project** |
| **Milestone** | Phases | `phase.milestoneRef` |
| **Phase** | Modules | `module.phaseRef` |
| **Module** | Features | `feature.moduleRef` (nullable) |
| **Feature** | Tasks | `task.featureRef` |
| **Task** | Subtasks, sessions, worklogs (transitively) | embedded `subtasks[]`; `session.taskId`; `worklog.taskRef` |
| **Sprint** | *assignment only* (no ownership) | `Task.sprintRef` — sprint delete nulls the ref, it never owns the task |

Ownership invariants (mirror `migration-recommendation-1.md` §9.3):
1. Every spine entity carries `projectRef` (required) and denormalized `workspaceRef` (required, server-derived).
2. All refs beneath a Project must share its `projectRef`. Cross-project `milestoneRef`/`phaseRef`/`moduleRef`/`sprintRef`/`featureRef` are rejected with a 400.
3. Delete = **null-out child refs**, never cascade (established rule): Milestone delete nulls `phase.milestoneRef`; Phase delete nulls `module.phaseRef`; Module delete nulls `feature.moduleRef`; Feature delete nulls `task.featureRef` (already implemented); Sprint delete nulls `Task.sprintRef`/`Feature.sprintRef` (already implemented).

---

## 3. Relationships

### 3.1 Spine (ownership)

```
Milestone 1 ────► * Phase 1 ────► * Module 1 ────► * Feature 1 ────► * Task 1 ──► * Subtask (embedded)
projectRef:required  milestoneRef:required   phaseRef:required    moduleRef:nullable  featureRef:required
```

- `Milestone.milestoneRef` ⇒ Project. Roadmap = ordered milestones of one project.
- `Feature.moduleRef` nullable: `null` = "Project-level feature" (unassigned to any module). These are the features a `Roadmap`-without-modules project still creates today — backward compatible with current `Feature` docs.
- Move operations revalidate the parent's `projectRef` (the existing `validateSprintForProject` pattern generalizes to `validateParentForProject`).

### 3.2 Execution (assignment)

```
Sprint 1 ──* (assigned, via Task.sprintRef)
Task 1 ─────► Feature (owner, via Task.featureRef)
```

A Task is simultaneously:
- **owned by** exactly one Feature (`featureRef`),
- **optionally assigned to** at most one Sprint (`sprintRef`).

This already exists in the schema and is the correct shape for "Tasks assigned to sprints but owned by Features." No change required — only a clarifying rule: assigning a Task to a sprint never changes its feature owner, and a Task with `featureRef: null` remains legal only for legacy/personal docs (new workspace tasks require a feature).

### 3.3 Project-level satellites

- Sprint → Project (unchanged). Sprint Planning = `GET /api/sprints?projectId=`.
- Project members = `Project.members[]` (User refs) + `Project.teamIds[]` (Team refs). A user may work in a project via the workspace membership; `Project.members` refines project-level scope.
- Knowledge = `KnowledgeDoc` (see §4). Blockers/Comments/Calendar events remain workspace-scoped client-mock today (documented boundary, not code).

---

## 4. Required Schema Changes

All changes additive; personal stack untouched (defaults null/empty).

### 4.1 New models

**`server/models/Milestone.js`** — Roadmap item:
```
projectRef    { ObjectId, ref 'Project', required, index }     // owns this milestone
workspaceRef  { ObjectId, ref 'Workspace', required, index }   // denormalized for permission gating
name          { String, required, trim, maxlength: 150 }
description   { String, default: '' }
targetDate    { Date, default: null }                          // roadmap ordering key
status        { enum: ['planned','active','completed'], default: 'planned' }
order         { Number, default: 0 }
createdBy     { ObjectId, ref 'User', required }
timestamps
indexes: { projectRef:1, order:1, targetDate:1 }, { workspaceRef:1 }
```

**`server/models/Phase.js`** — inside a milestone:
```
milestoneRef  { ObjectId, ref 'Milestone', required, index }
projectRef    { ObjectId, ref 'Project', required, index }     // denormalized for scoping/validation
workspaceRef  { ObjectId, ref 'Workspace', required, index }
name          { String, required, trim, maxlength: 150 }
description   { String, default: '' }
status        { enum: ['planned','active','completed'], default: 'planned' }
order         { Number, default: 0 }
startDate     { Date, default: null }   // optional
endDate       { Date, default: null }   // optional
createdBy     { ObjectId, ref 'User', required }
timestamps
indexes: { milestoneRef:1, order:1 }, { projectRef:1 }
```

**`server/models/Module.js`** — inside a phase:
```
phaseRef      { ObjectId, ref 'Phase', required, index }
projectRef    { ObjectId, ref 'Project', required, index }
workspaceRef  { ObjectId, ref 'Workspace', required, index }
name          { String, required, trim, maxlength: 150 }
description   { String, default: '' }
status        { enum: ['planned','active','completed'], default: 'planned' }
order         { Number, default: 0 }
ownerId       { ObjectId, ref 'User', default: null }          // module owner
createdBy     { ObjectId, ref 'User', required }
timestamps
indexes: { phaseRef:1, order:1 }, { projectRef:1 }
```

### 4.2 Extended models

**`server/models/Feature.js`** — add one field:
```
moduleRef  { ObjectId, ref 'Module', default: null, index }    // null = Project-level feature
indexes: add { moduleRef:1 }
```

**`server/models/Project.js`** — two changes:
- `milestones` embedded array: **deprecated in code** (kept for read compatibility during transition; migration §7 moves data to the `milestones` collection; remove the array in a later phase once `0012`/`0013` are applied everywhere).
- Optionally add a minimal `settings` subdocument (empty default) only when a concrete project-settings need appears — YAGNI otherwise.

**`server/models/Task.js`** — no structural change. Optional: add index `{ featureRef:1, sprintRef:1 }` for the sprint-board/feature-grouping query (matches migration `0010` style).

### 4.3 Knowledge Base gap

`KnowledgeDoc`, `Blocker`, `TeamCalendarEvent`, and comments are **client-mock only** today (`useCollaborationStore.ts:774-953` — `addComment`, `createDoc`, `createBlocker`, `createEvent` mutate in-memory arrays; no model in `server/models/`). The target hierarchy lists **Knowledge Base** as a project section. Recommendation: model `KnowledgeDoc` as a real collection in this design (workspace-scoped, `projectRef` optional for project-scoped docs), but treat it as an **independent workstream** (see §9 order 10) so it does not block the spine. Blockers/comments/calendar are explicitly **out of scope** for this architecture — they are orthogonal workspace features, not hierarchy.

---

## 5. Required API Changes

Follow the `projects.js`/`features.js` conventions: zod `validate`, shared `requireWorkspace*` gates, `Activity` writes, server-derived `workspaceRef`.

### 5.1 New routes

**`server/routes/milestones.js` → `/api/milestones`** (Roadmap)
| Endpoint | Gate | Notes |
|---|---|---|
| `GET /?projectId=` | `requireWorkspaceMember` | Roadmap: milestones ordered by `order, targetDate` |
| `POST /` | `requireWorkspaceEditor` | Creates roadmap entry; `Activity('milestone.created')` |
| `PATCH /:id` | `requireWorkspaceEditor` | name/description/targetDate/status/order |
| `DELETE /:id` | `requireWorkspaceOwnerAdmin` | **Nulls** `phaseRef` on Phases |

**`server/routes/phases.js` → `/api/phases`**
| Endpoint | Gate | Notes |
|---|---|---|
| `GET /?milestoneId=&projectId=` | `requireWorkspaceMember` | Phase list within a milestone (validates milestone↔project same-project) |
| `POST /` | `requireWorkspaceEditor` | `Activity('phase.created')` |
| `PATCH /:id` | `requireWorkspaceEditor` | Also supports `milestoneId` move (revalidates same-project) |
| `DELETE /:id` | `requireWorkspaceOwnerAdmin` | **Nulls** `phaseRef` on Modules |

**`server/routes/modules.js` → `/api/modules`** — same shape against Phases: `GET ?phaseId=` / `POST` / `PATCH :id` (supports `phaseId` move) / `DELETE :id` (**nulls** `moduleRef` on Features).

### 5.2 Extended routes

**`server/routes/features.js`**
- Add `moduleId` to the query/create/patch zod schemas (`nullableRef` pattern from `sprintId`).
- `GET /?moduleId=` filter; `GET /?backlog=true` unchanged (Project-level backlog).
- `PATCH /:id { moduleId }` = move feature between modules (generalize `validateSprintForProject` → `validateParentForProject`; also validate `module.projectRef === feature.projectRef`).

**`server/routes/projects.js`** — **real gap to close**
- No `GET /:id` and no `PATCH /:id` exist today (`projects.js:39-180` has only `GET /`, `POST /`, `POST /:id/sync-drive`). `description`, `key`, `status`, `members`, `teamIds` on `Project.js:50-78` are therefore **unpersistable via any route** (store writes are optimistic-only). Add:
  - `GET /:id` (member-gated via workspace)
  - `PATCH /:id` (editor-gated): `description`, `key`, `status`, `members`, `teamIds`, `settings` — validates member/team refs belong to the workspace. This is a prerequisite for "Project Info" in the target model.

**`server/routes/tasks.js`** — no structural change; the sprint/feature scoping (`resolveTaskScope`, `tasks.js:156-204`) already enforces same-project invariants. Optionally add a `?moduleId=` passthrough filter (resolved via `feature.moduleRef`) only if the UI needs task lists grouped by module server-side.

### 5.3 Mounting
`server/index.js`: `app.use('/api/milestones', milestoneRoutes)`, `app.use('/api/phases', phaseRoutes)`, `app.use('/api/modules', moduleRoutes)` — same block as sprints/features (`migration-recommendation-1.md` §5).

---

## 6. Required Frontend Routing

### 6.1 Routing spine (context drill-down)

Breadcrumb spine per `ark-information-architecture.md` §3: `Workspace › Project › Milestone › Phase › Module › Feature › Task`. Today the app has no project-level layout: `/w/:workspaceId/projects/:projectId` renders a single page (`App.tsx:138`).

Introduce a **`ProjectLayout`** shell under the project context:

```
/w/:workspaceId/projects/:projectId
   ├── (index)              → Project Overview (Project Info)      [existing ProjectOverviewPage]
   ├── roadmap              → Roadmap (milestones timeline)        [new]
   ├── roadmap/:milestoneId → Phase list (drill from milestone)    [new]
   ├── phases/:phaseId      → Module list                          [new]
   ├── modules/:moduleId    → Feature list (module-scoped)         [new / reuse FeaturesPage]
   ├── sprints              → Sprint Planning                      [existing SprintBoardPage]
   ├── backlog              → Project Backlog                      [existing BacklogPage]
   ├── features             → Features (all)                       [existing FeaturesPage]
   ├── knowledge            → Knowledge Base                       [existing TeamKnowledgePage — scope to project]
   ├── members              → Project Members                      [new lightweight]
   ├── reports              → Project Reports                      [existing ReportsAnalyticsPage]
   └── settings             → Project Settings                     [new lightweight]
```

Sidebar/tabs in `ProjectLayout`: Overview · Roadmap · Sprints · Backlog · Features · Knowledge · Members · Reports · Settings. This mirrors the established `WorkspaceLayout` grouped-sidebar pattern (`ark-information-architecture.md` §8.6).

### 6.2 Store/type changes
- `src/types/collaboration.ts`: add `Milestone`, `Phase`, `Module` interfaces; extend `Feature` with `moduleId?: string`.
- `src/store/useCollaborationStore.ts`: add `loadMilestones/loadPhases/loadModules` loaders + `create/update/delete` actions wired into `loadCollabData`; add `updateProjectMeta` (backed by new `PATCH /projects/:id`); the existing `moveFeature` pattern (`:717`) generalizes to `moveFeature(featureId, moduleId | null)`.
- `src/utils/api.ts`: add `milestones/phases/modules` clients; extend `features` with `moduleId`; add `projects.update`.
- Deep-link entry: Mission Control / Project Overview → Roadmap → milestone card → drill down. Command palette + global search stay the jump entry (`ark-information-architecture.md` §3).

### 6.3 Breadcrumb component
Add a `ContextBreadcrumbs` component rendering `Workspace › Project › Milestone › Phase › Module › Feature › Task`, each segment clickable back up — reuses the store's loaded spine. (IA §3 lists this as required global navigation.)

---

## 7. Migration Strategy

Framework: existing `server/migrations/` (`core.js` — versioned, idempotent, `{ up({ db }) }`, recorded in `schema_migrations`, forward-only). Apply: `node migrations/run.js --dry-run` then `--apply`.

| File | Operations | Notes |
|---|---|---|
| `0012_create_hierarchy_collections.js` | `createIndex` on `milestones`/`phases`/`modules` (+ `features.moduleRef_1`) | Auto-creates the collections; idempotent via existing-index guard (mirror `0010_create_sprint_feature_collections.js`) |
| `0013_migrate_project_milestones.js` | For each `projects.milestones[]` item, upsert a `Milestone` doc (`projectRef`, `workspaceRef`, name/targetDate/status from the embedded item, `order` preserved); then **leave the legacy array in place** | Additive only. Keep `Project.milestones` readable until all clients read from the collection; drop the array in a follow-up migration once safe |
| `0014_backfill_feature_module_links.js` | Optional. `features.updateMany({}, { $set: { moduleRef: null } })` | Purely for index/field consistency; normally unnecessary since the default `null` covers it |

Rules:
- No destructive operations. No cascade deletes introduced (null-out rule).
- New fields default null/empty → existing personal + workspace docs unaffected.
- Rollback: forward-only migrations mean rollback = revert code + manual `$unset`/`dropIndex` (same as prior phases — plan for a single release).
- Defer adding `organizationRef` and any org-scoped uniqueness (YAGNI; `migration-recommendation-1.md` §9.4).

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **Cross-project refs** (feature in project A linked to module in project B) | Generalize `validateSprintForProject` → `validateParentForProject`; every move/create validates parent's `projectRef === child's projectRef`. Server tests per level. |
| **Denormalized `workspaceRef` drift** (6 spine entities vs Project) | Server-only derivation from the owning Project (invariant §2.1). Never trust client body. Reads always join through Project. |
| **`Project.milestones` legacy array divergence** after `0013` | Keep array read-only during transition; single source = `Milestone` collection; remove array in a later release with a migration + client update in lockstep. |
| **Sprint vs spine confusion** ("is a feature part of the product or of the sprint?") | Product rule enforced by schema shape: `moduleRef` = ownership, `sprintRef` = planning. Document the rule in the model header and the Sprint/Feature route comments. |
| **N+1 query explosion** at deep drill (milestone → phases → modules → features → tasks) | Project-scoped reads return only the current level + parent context; Features/Tasks are loaded once per project (existing `loadCollabData`). Add a project aggregate endpoint only if profiling shows need. |
| **Reorder/move churn** on Roadmap (drag milestones, re-parent modules) | `order` + re-parenting are plain PATCHes with same-project validation; no cascade. Batch reorder endpoint deferred until UI demands it. |
| **Knowledge Base scope creep** | `KnowledgeDoc` collection is an independent workstream (§9 order 10). It does not block the product spine; Blockers/Comments/Calendar remain explicitly out of scope. |
| **Subtask promotion pressure** (checklists become real work items) | Keep embedded while checklists suffice; promoting = new `Subtask` collection + `task.subtaskRef`, a nullable field addition later — no rewrite (same argument as Epic deferral in `migration-recommendation-1.md` §9.2). |
| **New PATCH /projects/:id enables non-member project editing** | Member list edits validated against the workspace; role gate = `requireWorkspaceEditor`. Owner-only for `members`/`teamIds` if tightened later. |
| **UI churn across 5 pages moving under a new layout** | `ProjectLayout` wraps existing page components; each page keeps its URL so deep links/bookmarks survive. Additive routes; nothing removed. |

---

## 9. Recommended Implementation Order

Each step is independently shippable and keeps the server suite green.

| Order | Work | Scope |
|---|---|---|
| 1 | New models `Milestone.js` / `Phase.js` / `Module.js` + extend `Feature.moduleRef` | Schema |
| 2 | Migrations `0012` (collections + indexes), `0013` (project milestones → collection), `0014` (optional backfill) | Migrations |
| 3 | `PATCH /projects/:id` + `GET /projects/:id` (closes the Project Info gap) | API |
| 4 | Routes `milestones.js` / `phases.js` / `modules.js` + extend `features.js` (`moduleId`, `validateParentForProject`) + mount in `server/index.js` | API |
| 5 | Server tests: membership gates, same-project validation per level, null-out deletes, `moduleId` move, project PATCH | Tests |
| 6 | Types (`Milestone`/`Phase`/`Module`, `Feature.moduleId`) + `api.ts` clients + store loaders/actions | Frontend |
| 7 | `ProjectLayout` shell + routing tree (§6.1) + `ContextBreadcrumbs` | Frontend |
| 8 | Roadmap page + milestone → phases → modules drill | Frontend |
| 9 | Module-scoped Features + backlog/feature wiring to `moduleId` | Frontend |
| 10 | Knowledge Base persistence workstream (`KnowledgeDoc` collection + routes + store) — independent, after the spine | Frontend + API |
| 11 | End-to-end verification: `npx vitest run` (mainApp + mainApp/server), `npx tsc --noEmit`, `npm run build`, migration dry-run then apply | Verify |

---

## 10. Evidence anchors (current state)

- `server/models/Project.js:67-76` — embedded `milestones` array; **no route persists it** (`server/routes/projects.js:39-180` has GET/POST/sync-drive only).
- `server/models/Task.js` — already has `workspaceRef/projectRef/sprintRef/featureRef/assigneeId/reviewerId` + embedded `subtasks` (ownership + sprint assignment already shaped correctly).
- `server/models/Feature.js` — `sprintRef` nullable (backlog) + `type/labels/ownerId/estimatedHours/order/status`; no `moduleRef` yet.
- `server/models/Sprint.js` — execution container with `projectRef` required, `workspaceRef` denormalized.
- `server/routes/features.js:83-90` — `validateSprintForProject` same-project invariant; generalizes to `validateParentForProject`.
- `server/middleware/workspace.js:104-121` — `resolveProjectWorkspace` derives `workspaceRef` from the owning Project (the pattern every new route reuses).
- `server/migrations/migrations/0010_*.js` — `createIndex`-based collection creation precedent.
- `src/store/useCollaborationStore.ts:196-243` — loaders/actions surface; `moveFeature` (`:717`) and optimistic `runMutation` are the pattern for the new actions.
- `src/store/useCollaborationStore.ts:774-953` — `addComment`/`createDoc`/`createBlocker`/`createEvent` are **client-mock only** (no server model).
- `src/App.tsx:135-155` — current `/w/:workspaceId/*` routes; no project-level layout yet.
- `docs/ark-information-architecture.md:103,150-159` — breadcrumb spine + context model the new routes implement.
