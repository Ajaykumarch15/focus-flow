# Epic: Sprint & Feature Management (Delivery Data Plane)

**Blueprint for Phase 3 — the next major product milestone**
**Branch:** `feature/updates` · **Phase ID scheme:** `IES-P3-xx` (continues IES P0/P1/P2)
**Status:** Proposed · **Gate:** Phase 2 (S9) release-readiness checklist closed (§8.4) before kickoff

---

## 1. Current Product State — Maturity Assessment

### 1.1 Fully complete (real, persisted, tested, gated)

| Area | Evidence |
|---|---|
| Authentication | JWT-in-httpOnly-cookie, CSRF origin check, OAuth PKCE/rotation, rate limiting, token versioning |
| Personal Workspace | Dashboard, Tasks, Timer/Sessions (offline queue + reaper), Work Logs (24-route sub-doc API), Reports (+share links), Journal, Habits, Analytics, Focus Mode, Leaderboard, Settings |
| Collaboration backbone | Workspaces/Teams/Projects CRUD + RBAC (`middleware/workspace.js`), Activity feed, Notifications, Search — all real Mongoose models |
| Security & platform | 398/398 server tests, 136/136 frontend tests, tsc clean, build clean, audit gate allowlists only 1 false-positive GHSA |
| CI/CD · Docker · Release | GitHub Actions (client+server), docker-compose + nginx, `scripts/audit-gate.mjs`, `RELEASES.md` |

### 1.2 Partially complete — **UI exists, data plane is client-local ephemeral** (the gap)

| Surface | UI exists (client-local only) | Missing |
|---|---|---|
| Sprint Board | Kanban UI in `TeamWorkspace.tsx` (5 columns: backlog/ready/in_progress/review/done) | `createSprint`/`updateTaskStatus` are zustand `set()` only; **no `Sprint` model/route** |
| Features | `FeaturesPage.tsx` renders collab `tasks` | `createTask` local-only, hardcoded `ownerId:'m1'`, fake ids `ct-${Date.now()}` |
| QADashboard | Approve→`updateTaskStatus(...,'done')` | Local-only; doesn't honor `settings.requireReviewForDone` |
| Blockers | Tab + create/resolve | `createBlocker` local-only |
| Knowledge Base | Docs tab + modal | `createDoc` local-only |
| Calendar | Calendar tab | `createEvent` local-only |
| Discussions | DiscussionsModal | `addComment` local-only, author hardcoded `'Ajay Kumar'` |

**Confirmed by `collabPersistence.test.ts`:** only workspaces/projects/teams/settings/notifications/activity are durable; **tasks/sprints/docs/blockers/calendar/discussions are intentionally not asserted** because no backend exists.

### 1.3 Unimplemented (spec'd in WPS, no UI or data plane)

Mission Control (§11.5), Releases (§8.6), Stakeholder Dashboard (§12.8), Feature Health (§10.5), Feature Dependency Graph (§10.6), Feature/Workspace Templates (§8.5/§3.6), Engineering Intelligence / team analytics (E16), AI platform (E17), enterprise/SSO/audit (E18), plugins/API (E19), mobile/desktop (E20).

### 1.4 Cross-cutting gap statement

Phase 2 proved the principle on the workspace/team/project layer: **no client-side seed, no fabricated ids, no in-memory-only state.** Phase 3 must apply that same principle to the work-item layer. This is the single largest remaining integrity gap and it is exactly the MPEP critical path (E9 Sprints & Board → E12 Mission Control → E16 Analytics → E17 AI).

---

## 2. Next Epic Recommendation

**Epic: Sprint & Feature Management** (MPEP **E9**, WPS §9 + §10; "the delivery data plane").

### 2.1 Why this epic, in order of weight

1. **Closes the flagship loop.** PRD core belief: *"a focus session feeds a work log, a work log feeds a report, and a report feeds a sprint review."* Today the last hop is fake — sprints/features/board are ephemeral. This epic makes the team loop real.
2. **It is the unbuilt critical path.** Every later epic *consumes* sprint/feature data: Mission Control (E12), Engineering Intelligence (E16), Stakeholder Reports (E15), AI standups/insights (E17), Releases. Building them before the delivery data plane exists would repeat the Phase-2 "mirage" mistake at a higher level.
3. **Biggest integrity fix per effort.** Sprint/Feature/Blocker are the only core delivery entities still client-local. Persisting them uses *already-built* infrastructure (role middleware, activity, notifications, search, pagination, `runMutation`, `@hello-pangea/dnd`).
4. **Highest business value.** Team leads get velocity, burndown, capacity, and an auto-generated sprint report — "see what the team actually shipped, without asking" (PRD §2.2).
5. **Roadmap alignment.** MPEP E9 is the immediate next unbuilt epic after E5–E8 (all delivered); P3/P4/P5 gate on it (MPEP §3.5 interlock).

### 2.2 Runners-up (deliberately not chosen)

| Candidate | Why not now |
|---|---|
| **Mission Control** (E12) | Pure read/aggregation surface — meaningless until sprint/feature data is real. Schedule immediately after this epic (Phase 3b). |
| **Knowledge Base** (E11) | Valuable but independent; no downstream epic blocks on it. Lower critical-path weight. |
| **Calendar** (E20-adjacent) | No dedicated MPEP epic; low dependency leverage. |
| **AI Assistant** (E17) | Explicitly depends on E16 + real work-item data (MPEP §4.19). Premature. |
| **Plugin Platform** (E19) | Needs a stable public API surface first. |

---

## 3. Epic Specification

### Purpose
Make sprint planning, feature delivery, the sprint board, and blockers **real, persisted, and workspace-scoped** — completing the PRD's session→worklog→report→sprint-review loop with data that survives refresh and is governed by existing workspace roles.

### Business value
- Team leads/stakeholders get truthful delivery signal: velocity, burndown, capacity, done counts.
- Auto-generated sprint report replaces manual transcription (PRD §2.1).
- Unlocks the entire downstream roadmap (Mission Control, Analytics, AI).

### User value
- Sprint Board actually remembers what you moved (no reset on refresh).
- QA gate honors workspace `requireReviewForDone` setting.
- Features carry owners, assignees, estimates, actuals (derived from real sessions/worklogs), git context, dependencies, discussions.
- Notifications for assignment, review requests, blockers, sprint start.

### Architecture impact
- **New backend models:** `Sprint`, `Feature` (replaces the frontend-only `CollaborativeTask` concept for workspace work-items; personal `Task` model untouched).
- **New routes:** workspace-scoped sprint/feature CRUD + status transition + dependency edges; reuse `middleware/workspace.js` RBAC (Viewer = read-only, Developer = transition own items, Manager = plan/assign, Owner = config).
- **Frontend:** `useCollaborationStore` keeps its loaders/mutation pattern; add `sprints`/`features`/`blockers` loaders + `runMutation` actions; retire client-local `createSprint`/`createTask`/`updateTaskStatus`/`createBlocker`/`updateGitContext`.
- **Derived values are computed, never self-reported** (mirrors Phase-1 integrity rules): `actualHours` from linked sessions/worklogs; velocity/capacity from sprint-scoped features.
- **Reuse:** activity feed events (`sprint.created`, `feature.status_changed`, `blocker.resolved`), notification types (already modeled: `assigned`, `review_requested`, `blocker_added`, `sprint_started`), search facets, `runMutation`, DnD lib.

### Dependencies
- Hard: Phase-2 workspace/team/project/roles/notifications/activity/search (done).
- Hard: personal worklog/session APIs for actual-hours derivation (done).
- Soft: workspace `settings.requireReviewForDone` (exists) gates `done` transition.

### Risks
| Risk | Mitigation |
|---|---|
| Data-model churn (rename `CollaborativeTask`→`Feature`) | Internal rename in collab types + store only; personal `Task` untouched; do it early in the epic |
| Existing ephemeral collab tasks/sprints lost | Acceptable & documented; they never persisted; no backfill needed |
| Board DnD drag-state bugs | Reuse installed `@hello-pangea/dnd`; guard optimistic rollback |
| `actualHours`/velocity accuracy | Derive from sessions/worklogs server-side (already integrity-tested), not client-reported |
| Status-workflow bypass (skip review when `requireReviewForDone`) | Enforce transition rules in the route + store |
| Scope creep into realtime/presence/Mission Control | Explicitly out of scope; tracked as Phase 3b |

### Success criteria
1. Create/edit sprint, create feature, move feature across board columns, and resolve a blocker all **persist across refresh** (e2e suite).
2. `actualHours` on a feature reflects linked worklog/session time (server-derived).
3. QA gate blocks `backlog→done` when `requireReviewForDone` is on.
4. Notifications fire for: assigned, review_requested, blocker_added, sprint_started.
5. Sprint header shows capacity, committed, done, and burndown from real data.
6. All gates green: tsc, frontend+server vitest, build, audit gate; no new High/Critical.

### Definition of Done
- No client-local work-item state remains in `useCollaborationStore` (all sprint/feature/blocker actions API-backed with `runMutation`).
- Persistence proven by e2e refresh test (extends `collabPersistence.test.ts`).
- Role enforcement tests for Viewer read-only / Developer transition / Manager planning.
- Docs updated (SAD, AIS, BAG, DDD, IES phase, this epic); release notes written.
- Deployed per §8.4 checklist.

### Acceptance criteria (epic-level)
- AC1: A user can create a workspace sprint, drag features across the 5 columns, refresh, and the board state is identical.
- AC2: A feature's actual hours match the sum of its linked sessions/worklogs.
- AC3: A Manager can assign features; assigned/review-requested users receive notifications.
- AC4: A Viewer cannot create/modify sprints or features (403).
- AC5: Sprint report exports the sprint goal, features, points/status, and per-developer actual hours.

---

## 4. Epic → Features

| ID | Feature | Priority | Deps | Complexity | Acceptance criteria (summary) | DoD |
|---|---|---|---|---|---|---|
| **F3.1** | Sprint domain (backend) | High | P2 layer | M | CRUD + lifecycle transitions; capacity/velocity fields; scoped by workspace; role-enforced | Routes+tests green; no local state |
| **F3.2** | Feature domain (backend) | High | F3.1 | L | CRUD + status workflow + deps + git context + subtasks + estimates; `actualHours` derived server-side | Routes+tests green; derived actuals verified |
| **F3.3** | Store wiring (frontend) | High | F3.1,F3.2 | M | `sprints`/`features`/`blockers` loaded on mount; mutations via `runMutation`; persistence e2e | Persistence test extends; tsc clean |
| **F3.4** | Sprint Board (frontend) | High | F3.3 | M | Reuse existing Kanban UI + DnD; sprint selector; add-to-sprint; optimistic moves | Board state survives refresh |
| **F3.5** | Feature detail + QA gate | High | F3.3 | M | Detail drawer; status transitions honoring `requireReviewForDone`; git context edit | Workflow enforced + tests |
| **F3.6** | Sprint metrics | Med | F3.3,F3.4 | M | Capacity, committed/done, velocity, burndown (derived, no fake numbers) | Numbers traceable to store/API |
| **F3.7** | Sprint report | Med | F3.6 | M | Auto-generated from sprint data + worklogs; export JSON/DOCX (reuse doc engine) | Report fidelity verified |
| **F3.8** | Blockers persistence | Med | F3.3 | S | Create/resolve against real features; link to worklogs; `blocker_added`/resolved events | Persists + activity/notification |
| **F3.9** | Notifications & search integration | Med | F3.3 | S | `assigned`/`review_requested`/`sprint_started`; features+sprints in search | Notification/search tests |
| **F3.10** | E2E + release readiness | High | all | M | Extend persistence suite; role/QA-gate e2e; regression; release notes | All gates green; notes written |

---

## 5. Feature → Engineering Tasks

Task ID scheme: `IES-P3-<F#>-<N>` (e.g. `IES-P3-02-03`). Effort in developer-days (1 FE + 1 BE/QA capacity per sprint, matching IES cadence).

### F3.1 Sprint domain (backend)

**IES-P3-01-01 · Sprint model + indexes**
- Desc: New `server/models/Sprint.js`: workspaceRef, projectRef, name, goal, startDate/endDate, status enum (`future|active|completed`), capacityHours, targetVelocity, createdBy, timestamps. Indexes: `{workspaceRef, status}`, `{workspaceRef, endDate}`.
- Effort: 0.5d · FE: — · BE: `models/Sprint.js` · DB: new collection + 2 indexes · API: — · Testing: model bounds, workspace-scoped uniqueness · Deploy: additive, no migration.

**IES-P3-01-02 · Sprint routes + RBAC**
- Desc: `server/routes/sprints.js` mounted under `/api/workspaces/:id/sprints` (list/create) and `/api/sprints/:id` (get/patch/delete, `POST :id/start`, `POST :id/complete`). Reuse `loadWorkspace`/`requireMember/Manager`. Lifecycle rules: only `future→active→completed`; `active` needs valid date range. Emit `sprint.created`/`sprint.completed` Activity events.
- Effort: 1.5d · FE: — · BE: `routes/sprints.js`, activity hooks · DB: — · API: new endpoints · Testing: CRUD, role matrix, lifecycle transitions, soft-delete behavior · Deploy: route mount in `index.js`.

### F3.2 Feature domain (backend)

**IES-P3-02-01 · Feature model + indexes**
- Desc: New `server/models/Feature.js`: workspaceRef, projectRef, sprintRef?, title≤200, description≤5000, status enum (reuse `backlog|ready|in_progress|review|done`), priority, ownerId/assigneeId/reviewerId, followerIds[], labels[], estimatedHours, subtasks[{title,completed}], dependencies[] (feature ids), gitContext, actualHours (server-derived), timestamps. Indexes: `{workspaceRef, status}`, `{workspaceRef, sprintRef}`, `{assigneeId, status}`. Replaces the frontend-only `CollaborativeTask` for workspace scope.
- Effort: 1d · FE: types rename · BE: `models/Feature.js` · DB: new collection + indexes · API: — · Testing: bounds, status enum, sub-doc caps · Deploy: additive.

**IES-P3-02-02 · Feature routes + derived actuals**
- Desc: `server/routes/features.js`: list (filter by workspace/sprint/status/assignee), create, get, patch, delete, `PATCH :id/status` (enforces transition rules + `requireReviewForDone`), `PATCH :id/git-context`, subtasks + dependency edges. `actualHours` recomputed from linked WorkLogs/Sessions server-side on read (aggregation, cached at sprint granularity). Role rules: Viewer read-only; Developer transitions items where assignee/owner; Manager create/assign/plan.
- Effort: 2.5d · FE: — · BE: `routes/features.js` + `utils/featureDerived.js` · DB: — · API: new endpoints · Testing: workflow matrix, QA-gate setting, actuals vs fixtures, deps cycle rejection · Deploy: route mount.

### F3.3 Store wiring (frontend)

**IES-P3-03-01 · Types + API client**
- Desc: `src/types/collaboration.ts`: rename/replace `CollaborativeTask`→`Feature` (keep `CollaborativeTask` alias if pages still import it, migrate callers), align `Sprint` to model; extend `src/utils/api.ts` with `api.sprints.*` and `api.features.*` (+blockers).
- Effort: 1d · FE: types + api.ts · BE: — · DB: — · API: consumes new endpoints · Testing: `api.collaboration.test.ts` surface tests · Deploy: —.

**IES-P3-03-02 · Store loaders + runMutation actions**
- Desc: `useCollaborationStore`: add `sprints`/`features`/`blockers` to load graph in `loadCollabData`; replace `createSprint/createTask/updateTaskStatus/updateGitContext/createBlocker/resolveBlocker` with `runMutation`-backed actions; remove hardcoded `'m1'`/fake ids (use `useAuthStore` user). Optimistic move + rollback on status transitions.
- Effort: 2d · FE: `useCollaborationStore.ts` · BE: — · DB: — · API: consumes · Testing: store unit tests for every new action (optimistic + rollback + failure) · Deploy: —.

**IES-P3-03-03 · Persistence e2e extension**
- Desc: Extend `collabPersistence.test.ts`: create sprint → add feature → move status → resolve blocker → simulate refresh → assert restored. Update the coverage note (no longer "client-local").
- Effort: 1d · FE: test file · Testing: e2e refresh suite · Deploy: —.

### F3.4 Sprint Board (frontend)

**IES-P3-04-01 · Board data + sprint selector**
- Desc: `TeamWorkspace.tsx` sprints tab: sprint selector (active/completed/future), board scoped to selected sprint; header shows capacity, committed, done from real store data.
- Effort: 1d · FE: TeamWorkspace · Testing: component renders with store fixtures · Deploy: —.

**IES-P3-04-02 · Drag-and-drop status moves**
- Desc: Wire `@hello-pangea/dnd` (already a dependency) across the 5 columns; drop → `updateFeatureStatus` via `runMutation` (optimistic, rollback on failure); quick-status select retained for a11y fallback. No direct DOM dragging fallback needed.
- Effort: 2d · FE: TeamWorkspace · Testing: store-level move/rollback; component smoke · Deploy: —.

### F3.5 Feature detail + QA gate (frontend)

**IES-P3-05-01 · Feature detail drawer**
- Desc: Drawer/modal from board card + FeaturesPage row: fields edit (title, desc, priority, labels, estimate, assignee/reviewer, git context), subtask add/toggle, discussions (existing modal), dependency links.
- Effort: 2d · FE: `components/collaboration/FeatureDetail.tsx` · Testing: component + store actions · Deploy: —.

**IES-P3-05-02 · QA gate enforcement**
- Desc: Status transition UI disables/explains disallowed moves; when `settings.requireReviewForDone` is on, `backlog/in_progress→done` must route through `review` with a reviewerId set; QADashboard approve → `review→done` only.
- Effort: 1d · FE: board + QADashboard · Testing: gate logic unit tests; store guard · Deploy: —.

### F3.6 Sprint metrics (frontend)

**IES-P3-06-01 · Burndown + velocity widgets**
- Desc: Replace fabricated "Active Sprint Velocity" tile (TeamWorkspace.tsx:231) and sprint header numbers with derived values: burndown series from feature done-dates (or sprint-scoped actual hours per day from worklogs), velocity = completed points over last N sprints, capacity hours. All numbers traceable to store/API; empty states per FE-32.
- Effort: 2d · FE: TeamWorkspace + `lib/sprintMetrics.ts` · Testing: metrics unit tests against fixtures · Deploy: —.

### F3.7 Sprint report (frontend)

**IES-P3-07-01 · Auto-generated sprint report + export**
- Desc: Report tab/section for the selected sprint: goal, dates, feature list w/ status+estimates+actuals, per-developer actual hours, blockers, link to worklog summaries. Export JSON + DOCX (reuse `docx` engine used by reports). Read-only; role-gated.
- Effort: 2d · FE: `pages/collaboration/SprintReport.tsx` + export util · Testing: report content matches fixtures; export smoke · Deploy: —.

### F3.8 Blockers persistence (backend + frontend)

**IES-P3-08-01 · Blocker model + routes**
- Desc: `server/models/Blocker.js` (workspaceRef, featureRef?, worklogRef?, title, severity, status, ownerId, reporterId, impactDescription, resolvedAt) + routes create/resolve/list. Activity: `blocker.added`/`blocker.resolved`. Notification `blocker_added` to assignee/owner.
- Effort: 1.5d · BE: model+routes+activity · DB: new collection+index · API: new endpoints · Testing: CRUD, resolve idempotency · Deploy: route mount.

**IES-P3-08-02 · Store + UI wiring**
- Desc: `createBlocker`/`resolveBlocker` API-backed; TeamWorkspace blockers tab + WorkspaceLayout badge use real data; remove hardcoded `'m1'`.
- Effort: 1d · FE: store + TeamWorkspace · Testing: store action tests; persistence test add · Deploy: —.

### F3.9 Notifications & search integration (backend + frontend)

**IES-P3-09-01 · Workflow notifications**
- Desc: Emit `assigned` (on assignee set/change), `review_requested` (on move to review), `sprint_started` (on sprint start) using existing Notification model; render in existing bell + NotificationCenter.
- Effort: 1.5d · BE: notification emission in features/sprints routes · FE: NotificationCenter covers types · Testing: notification creation tests · Deploy: —.

**IES-P3-09-02 · Search facets**
- Desc: Add `sprints` + `features` to `routes/search.js` and `SearchResultItem` kinds; global palette + SearchResults page render them.
- Effort: 1d · BE: search route · FE: SearchResults · Testing: search suite extension · Deploy: —.

### F3.10 E2E + release readiness

**IES-P3-10-01 · Role + QA-gate e2e**
- Desc: Server e2e: Viewer 403 on create; Developer cannot move to `done` when `requireReviewForDone`; Manager planning flows.
- Effort: 1d · BE: test file · Testing: role/QA matrix · Deploy: —.

**IES-P3-10-02 · Regression + docs + release notes**
- Desc: Full frontend+server suites, tsc, build, audit gate; update SAD/AIS/BAG/DDD/IES for new models+routes; write Phase-3 release notes.
- Effort: 1.5d · Docs · Testing: full regression · Deploy: per §8.4.

**Total effort ≈ 26 developer-days (≈ 2 sprints at IES capacity), plus 25% contingency ≈ 33 days.**

---

## 6. GitHub Planning

### Epic
- **Epic title:** `epic: Sprint & Feature Management (delivery data plane)`
- **Label:** `epic/P3-delivery`
- **Milestones:**
  - `M3.1 · Sprint & Feature domain (backend)` — F3.1, F3.2, F3.8-BE
  - `M3.2 · Store + board (frontend)` — F3.3, F3.4, F3.5
  - `M3.3 · Metrics, report, integration` — F3.6, F3.7, F3.8-FE, F3.9
  - `M3.4 · Release (Phase 3 close)` — F3.10

### Stories (issue templates `story/*`)
- `story/sprint/domain` → IES-P3-01-01..02
- `story/feature/domain` → IES-P3-02-01..02
- `story/workspace/store` (extends existing story) → IES-P3-03-01..03
- `story/sprint/board` → IES-P3-04-01..02
- `story/feature/ui` → IES-P3-05-01..02
- `story/sprint/metrics-report` → IES-P3-06-01, IES-P3-07-01
- `story/blockers/persist` → IES-P3-08-01..02
- `story/workflow/integration` → IES-P3-09-01..02
- `story/release` → IES-P3-10-01..02

### Checklist hierarchy
`Epic → Milestone → Story → Issue → DoD checklist`
Each issue gets a task-list body mirroring its DoD bullet points (backend: model+routes+DB+API+tests; frontend: store+UI+persistence).

### Branch names
- `story/sprint/domain`
- `story/feature/domain`
- `story/workspace/store`
- `story/sprint/board`
- `story/feature/ui`
- `story/sprint/metrics-report`
- `story/blockers/persist`
- `story/workflow/integration`
- `story/release`

### Conventional Commit scopes
- `feat(sprints)` — sprint model/routes/board
- `feat(features)` — feature model/routes/detail/QA gate
- `feat(blockers)` — blocker persistence
- `feat(workflow)` — notifications/search integration
- `refactor(collab)` — `CollaborativeTask`→`Feature` rename, store rewiring
- `test(e2e)` — persistence/role/QA-gate suites
- `docs(phase3)` — SAD/AIS/IES/release notes

---

## 7. Execution Strategy

### 7.1 Implementation order (critical path)
```
F3.1 (Sprint model/routes)
  → F3.2 (Feature model/routes, depends on F3.1 for sprintRef)
  → F3.3 (types/api/store wiring — consumes F3.1+F3.2)
  → F3.4 (board) ─┬→ F3.6 (metrics) → F3.7 (report)
                  └→ F3.5 (detail + QA gate)
  F3.8 + F3.9 run in parallel after F3.3 (blockers BE, notifications, search)
  → F3.10 (e2e + release)
```

### 7.2 Parallel opportunities
- **Sprint 1:** BE track (F3.1 + F3.2 backend models/routes) ∥ FE track (F3.3-01 types/api client, built against agreed API contract).
- **Sprint 2:** Store wiring (F3.3-02/03) ∥ F3.8-BE (blockers backend) ∥ F3.9-BE (notification emission).
- **Sprint 3:** Board + detail (F3.4/F3.5) ∥ metrics/report (F3.6/F3.7) ∥ F3.9-FE.
- **Sprint 4:** E2E + regression + docs + release (F3.10).

### 7.3 Testing checkpoints
- **T1 (end F3.1/3.2):** backend suite green (sprint CRUD, feature workflow, actuals, RBAC).
- **T2 (end F3.3):** frontend suite green; **persistence e2e extended** (refresh survival).
- **T3 (end F3.4/3.5):** board + QA-gate component/store tests.
- **T4 (end F3.6–3.9):** metrics/report/notifications/search tests.
- **T5 (F3.10):** full regression + audit gate + build.

### 7.4 Review checkpoints
- **R1:** API contract review (sprints/features/blockers schemas) before FE wiring — the critical review.
- **R2:** Derived-actuals design review (how `actualHours`/velocity are computed) — no fake numbers.
- **R3:** UX review of board + detail drawer + report.
- **R4:** Release review per §8.4.

### 7.5 Release strategy
- Additive migrations only (new collections/indexes); no destructive changes; existing data untouched.
- Follow the Phase-2 pattern: `feature/updates` → CI green → §8.4 checklist → production. Feature-flag not required (additive), but board rewrite ships behind the same page to avoid a blank state (empty-state per FE-32).
- Release notes per milestone and final Phase-3 notes.

---

## Appendix A — Explicit non-goals for Phase 3
- Realtime/presence (E10) — later.
- Mission Control (E12), Stakeholder Dashboard (§12.8) — Phase 3b, after this epic.
- Knowledge Base persistence (E11), Calendar persistence, Discussions persistence — separate epics (tracked backlog).
- Personal `Task` model changes — out of scope.
- Public API / webhooks / plugins / AI / enterprise — not in this epic.

## Appendix B — Open questions for kickoff
1. Feature point system: story points vs. estimated hours? (WPS spec ambiguous; recommend story points with an hours proxy.)
2. Should `actualHours` be recomputed live or at sprint granularity? (Recommend cached at sprint with per-feature invalidation.)
3. Dependency graph UI (WPS §10.6) — include in this epic or Phase 3b? (Recommend 3b; store the edges now.)
