# ARK — Engineering Execution Plan (EEP_V2)

**Status:** LOCKED — the only execution roadmap for building ARK. Every future implementation task originates from this plan.

**Supersedes:** `docs/engineering-execution-plan.md` (V1 — the frontend-only DCX operating manual). V1's *execution rules* (git workflow, PR checklist, testing gates) carry forward unchanged; V1's *backlog* is replaced by this document.

**Sources of truth (LOCKED, do not redesign):**
1. `docs/DDS.md` — Domain Design Specification (canonical domain truth)
2. `docs/IMPLEMENTATION_BLUEPRINT.md` — traceability map + structure
3. `docs/engineering-companion-phase1.md`, `docs/developer-companion-experience.md`, `docs/ark-information-architecture.md` — experience / IA constraints

**Scope guardrails (locked):**
- This document is planning only. It generates no production code, no migrations, no API changes.
- Every phase ends with a **STOP point**: gates verified, Definition of Done signed, next phase not started until review.
- Task IDs: `EEP2-P<phase>.<epic>.<feature>.<task>`; subtasks `-s<sub>`. Each task is independently executable and fits in one implementation session (< 1 working day).
- Gates (run in every task, same order as V1 §6.2): `npx tsc --noEmit` -> targeted tests -> `npx vitest run` (mainApp) -> `npx vitest run` (mainApp/server) -> `npm run build` (mainApp).
- Traceability: every task cites its DDS section (e.g. DDS §4.5) and Blueprint entity (e.g. BP §2.4). One task = one PR.

## Phase Map

| Phase | Name | Depends on | Complexity | Duration |
|---|---|---|---|---|
| 1 | Core Foundation | — | M | ~1 wk |
| 2 | Workspace Management | 1 | M | ~1.5 wk |
| 3 | Roadmap Engine | 2 | L | ~3 wk |
| 4 | Sprint Planning | 3 | M | ~2 wk |
| 5 | Execution Engine | 4 | L | ~3 wk |
| 6 | Developer Companion | 3, 5 | M | ~2 wk |
| 7 | Project Intelligence | 5, 6 | L | ~3 wk |
| 8 | Knowledge System | 3, 6 | M | ~2.5 wk |
| 9 | Reports & Intelligence | 7, 8 | M | ~2 wk |
| 10 | AI Companion | 7, 8, 9 | L | ~4+ wk |

Parallel-safe tracks (disjoint-file rule of V1 §8.2 applies): Phase 8 (Knowledge) may run in parallel with Phase 7 (Project Intelligence) after Phase 6 merges. Phase 9 and Phase 10 must follow their dependencies. Any task touching `AppLayout`, `WorkspaceLayout`, `ProjectLayout`, or `src/utils/api.ts` serializes with everything else that touches the same file.

---

# PHASE 1 — Core Foundation

- **Purpose:** Establish identity, authorization vocabulary, bootstrapping, navigation shells, theming, and the quality gates every later phase builds on.
- **Scope:** Authentication (register/login/logout/me/session), authorization (platform-admin + workspace role gates), users/roles/permissions vocabulary, workspace bootstrap, navigation (AppLayout/WorkspaceLayout/AdminLayout), theme tokens, core layouts.
- **Dependencies:** none.
- **Database work:** No schema change. Verify `users` collection and `workspaces.members` shape (DDS §4.1-4.2). **[C]** none.
- **Backend work:** Verify/harden `routes/auth.js` (login/register/logout/me, rate limits, session cookie, CSRF), `middleware/auth.js`, `middleware/admin.js`, `middleware/workspace.js` (member/editor/owner-admin/owner gates). Add `utils/permissions.js` [N] — single-source vocabulary `ROLE_TIERS`, `EDITOR_ROLES`, `MANAGER_ROLES` consumed by middleware and tests. No API contract change.
- **Frontend work:** Landing/Login/Register exist — verify loading/empty/error/success states. AppLayout/AdminLayout/WorkspaceLayout exist — verify shell integrity + responsive behavior. Theme: `lib/config.ts` + `ThemeToggle` — verify tokens, contrast, reduced-motion. Navigation registry [N]: single `lib/navigation.ts` route/sidebar data source consumed by all three layouts (removes hardcoded sidebar copies).
- **Store work:** `useAuthStore` (restoreSession, workspace-switcher mode, role-aware redirects) — verify + test. `useStore.loadAll` composition — keep unchanged.
- **Selectors:** `lib/navigation.ts` sidebar-group selector per role (pure). No domain selectors yet.
- **Tests:** Auth-flow integration (register -> login -> me -> logout), role-gate matrix table test (member/editor/owner-admin/owner x action, DDS §7), a11y on auth screens, navigation-registry unit tests, responsive smoke on the three layouts.
- **Documentation:** Update V1 reuse inventory (§11); document gate commands in README; record any hardened behavior in V1 §12 Decision Log.
- **Acceptance criteria:** Full auth lifecycle green under rate-limit + CSRF; permission matrix encoded and unit-tested; admin vs user workspace-switcher behavior correct; all three layouts render from the single nav registry; theme toggle + reduced motion verified; all five gates green.
- **Risks:** Auth regression (cookie/rate-limit tests must pin behavior); nav dedup touches shared shell files (serialize shell-touching tasks).
- **Definition of Done:** Permission vocabulary module tested; nav registry drives all sidebars; zero API/model changes; server + client suites green; STOP approved by Architecture + Release roles.
- **Estimated complexity:** M. **Estimated duration:** ~1 wk.

### Epic 1.1 — Identity & Session
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P1.1.1 | Auth lifecycle | Verify + test register/login/logout/me | s1 register validations; s2 login rate-limit + CSRF; s3 me + session restore | none | Flow green under limits; CSRF enforced; cookie flags pinned |
| EEP2-P1.1.2 | Auth lifecycle | Test session restore + workspace-switcher mode in `useAuthStore` | s1 restoreSession on boot; s2 admin -> /workspace vs user -> /hub redirects | P1.1.1 | Restore correct; role-aware redirects covered by tests |
| EEP2-P1.1.3 | Auth lifecycle | a11y + responsive pass on Landing/Login/Register | s1 axe assertions; s2 keyboard + focus; s3 mobile layout | P1.1.1 | No axe violations; tap targets >= 40px |

### Epic 1.2 — Roles & Permissions
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P1.2.1 | Permission vocabulary | Create `utils/permissions.js` + unit tests | s1 export ROLE_TIERS/EDITOR/MANAGER; s2 table test: role x action allowed/denied | none | Matches DDS §7 matrix exactly |
| EEP2-P1.2.2 | Permission enforcement | Verify workspace gates (member/editor/owner-admin/owner) against vocabulary | s1 refactor middleware to consume vocabulary; s2 add matrix server tests | P1.2.1 | All 4 gates tested; no behavior change |
| EEP2-P1.2.3 | Permission enforcement | Verify platform-admin gate (`middleware/admin.js`) | s1 admin-route coverage; s2 non-member admin has no implicit workspace access | P1.2.1 | DDS §4.1 rule enforced by test |

### Epic 1.3 — Bootstrap, Navigation, Theme
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P1.3.1 | Navigation registry | Create `lib/navigation.ts` (routes + sidebar groups per role) | s1 data model; s2 group per layer (L1/L2/L3); s3 role filtering | none | Pure, unit-tested; matches IA sitemap |
| EEP2-P1.3.2 | Navigation registry | Rewire AppLayout/WorkspaceLayout/AdminLayout sidebars to the registry | s1 AppLayout; s2 WorkspaceLayout; s3 AdminLayout | P1.3.1 | No hardcoded sidebar copies; routes resolve |
| EEP2-P1.3.3 | Theme & layouts | Verify tokens, ThemeToggle, reduced-motion, responsive shells | s1 token/contrast audit; s2 motion; s3 mobile drawers | none | AA contrast; motion <= 250ms; single column mobile |

**STOP POINT P1:** all gates green; DDS §7 matrix encoded; nav registry live; phase review approved. **Proceed to Phase 2 only after sign-off.**


# PHASE 2 — Workspace Management

- **Purpose:** Make the workspace a complete managed container: membership, projects (incl. project info persistence), settings, activity feed, and audit.
- **Scope:** Workspace CRUD, Members (invite/remove/role/status), Projects (list/create + **new GET/:id + PATCH/:id**), Workspace Settings, Activity feed, Admin Audit, Project members/teams reference management.
- **Dependencies:** Phase 1.
- **Database work:** No new collections. **[C]** `projects` gets no new fields in this phase (PATCH targets existing `description/key/status/members/teamIds`). Verify indexes `{workspaceRef,nameKey}`, `{userId,nameKey}`.
- **Backend work:** [C] `routes/projects.js`: add `GET /api/projects/:id` (member-gated) and `PATCH /api/projects/:id` (editor-gated for meta; Owner/Admin for `members[]`/`teamIds[]`/`settings`), zod schemas, `Activity('project.updated')`. Verify `routes/workspaces.js` member + settings endpoints and `GET /:id/activity` keyset pagination. Audit: verify `routes/admin.js` audit endpoints + `middleware/health.js` readiness.
- **Frontend work:** Verify `WorkspaceHub`, `WorkspaceProjectsPage`, `WorkspaceTeamsPage`, `WorkspaceMembersPage`, `MemberProfilePage`, `WorkspaceSettingsPage`, `ActivityFeedPage`. **[N]** `ProjectMembersPanel`, `ProjectInfoForm`, `ProjectSettingsPanel` (consumed later by ProjectLayout in Phase 3). Project cards render persisted `description/key/status`.
- **Store work:** `useCollaborationStore` — [C] `updateProjectMeta(id, patch)` -> `api.projects.update`; keep `loadProjects/createProject`. Verify `loadMembers/updateMemberRole/updateMemberStatus`, `updateWorkspaceSettings`.
- **Selectors:** `lib/collaborationKpis.ts` (workspace progress), `lib/missionControlSelectors.ts` (pending reviews, deadlines) — verify against persisted project meta.
- **Tests:** Server: project GET/PATCH gates, member/team ref validation, optimistic-write rollback on PATCH, activity feed pagination, audit scoping. Client: project card renders persisted meta, project info form loading/empty/error/success, member panel.
- **Documentation:** Blueprint §2.2 / §2.12 confirmation; project PATCH contract documented.
- **Acceptance criteria:** `GET/PATCH /api/projects/:id` persist meta without regressing `sync-drive`; member/team refs validated against workspace; invite/remove/role flows green; activity + audit surfaces correct; all gates green.
- **Risks:** Project PATCH is the first mutation of a previously read-only surface — gate and contract tests mandatory; `sync-drive` must not break.
- **Definition of Done:** Project Info gap closed (DDS §4.4); workspace admin surfaces verified; no new collections; suites green; STOP approved.
- **Estimated complexity:** M. **Estimated duration:** ~1.5 wk.

### Epic 2.1 — Workspace & Membership
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P2.1.1 | Workspace CRUD | Verify create/update/delete workspace + settings | s1 gates; s2 settings patch; s3 owner-only delete | P1 | DDS §4.1 rules hold |
| EEP2-P2.1.2 | Membership | Verify invite/remove/role/status flows | s1 invite -> join; s2 role change; s3 removal nulls assignee refs | P2.1.1 | DDS §4.2 deletion rule tested |

### Epic 2.2 — Projects as managed entities
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P2.2.1 | Project Info | Add `GET /api/projects/:id` | s1 member gate; s2 404/403 paths | P1 | Member-only read; personal project still self-scoped |
| EEP2-P2.2.2 | Project Info | Add `PATCH /api/projects/:id` | s1 zod schema; s2 meta fields; s3 members/teamIds Owner/Admin gate; s4 Activity write; s5 sync-drive regression test | P2.2.1 | Persists meta; member/team refs validated; sync-drive untouched |
| EEP2-P2.2.3 | Project UI | `ProjectInfoForm` + `ProjectSettingsPanel` + `ProjectMembersPanel` [N] | s1 form; s2 settings; s3 members | P2.2.2 | Save via `updateProjectMeta`; optimistic + rollback; 4 states |

### Epic 2.3 — Activity & Audit
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P2.3.1 | Activity | Verify `GET /:id/activity` keyset pagination + feed UI | s1 pagination; s2 feed rendering | P2.1.1 | Newest-first; cursor stable |
| EEP2-P2.3.2 | Audit | Verify admin audit scoping + health readiness | s1 audit lists; s2 health endpoints | P1 | Owner/Admin scoped; no data leak |

**STOP POINT P2:** Project PATCH/GET merged with tests; membership + audit verified; suites green; review approved.

---

# PHASE 3 — Roadmap Engine

- **Purpose:** Materialize PRODUCT STRUCTURE: the Roadmap as a virtual ordered Milestone list, with Milestone -> Phase -> Module -> Feature spine, visualization, and the ProjectLayout shell that hosts all project-context pages.
- **Scope:** New collections Milestone/Phase/Module; `Feature.moduleRef`; migrations 0012-0014; routes milestones/phases/modules + features `moduleId` + `validateParentForProject`; ProjectLayout shell; Roadmap/Milestone/Phase/Module pages; roadmap visualization; structural dependencies (parent moves).
- **Dependencies:** Phase 2.
- **Database work:** [N] `server/models/Milestone.js`, `Phase.js`, `Module.js` (DDS §4.5-4.7); [C] `Feature.moduleRef` + index. Migrations `0012` (collections+indexes), `0013` (embedded `projects.milestones[]` -> `milestones`), `0014` (moduleRef guard). Indexes `{projectRef,order,targetDate}`, `{milestoneRef,order}`, `{phaseRef,order}`, `{moduleRef}`, `{workspaceRef}`.
- **Backend work:** [N] `routes/milestones.js`, `phases.js`, `modules.js` (GET/POST/PATCH/DELETE per DDS §5; delete nulls child refs); [C] `routes/features.js` add `moduleId` to query/create/patch + `validateParentForProject`; mount new routers in `server/index.js`.
- **Frontend work:** [N] `ProjectLayout` (project-context shell + tabs + `ContextBreadcrumbs`); [N] `RoadmapPage`, `MilestoneDetailPage`, `PhaseDetailPage`, `ModuleDetailPage`; [C] `FeaturesPage`/`BacklogPage` gain module grouping + module picker; roadmap visualization (timeline + progress).
- **Store work:** `useCollaborationStore` — [C] `milestones[]/phases[]/modules[]`, loaders (`loadMilestones/loadPhases/loadModules`), actions (`createMilestone/updateMilestone/deleteMilestone`, phase/module equivalents, `moveFeatureModule`); wire into `loadCollabData`.
- **Selectors:** [N] `lib/roadmapSelectors.ts` (`selectRoadmapOrdered`, `selectMilestoneProgress`, `selectMilestonesByDate`, `selectPhaseProgress`), `lib/moduleSelectors.ts` (`selectModuleCompletion`, `selectFeaturesByModule`).
- **Tests:** Server: per-level member/editor/OwnerAdmin gates, same-project validation (3 levels), null-out deletes, `moduleId` move, migration dry-run/apply idempotency, `0013` backfill round-trip. Client: roadmap render, drill-down navigation, breadcrumbs, 4-state components, module picker.
- **Documentation:** Blueprint §2.3-2.7 confirmation; migration report for `0013`.
- **Acceptance criteria:** Roadmap renders real Milestones ordered by `order,targetDate`; drill-down Milestone->Phase->Module->Feature works; moving a Feature between modules revalidates same-project and never touches `sprintRef`; migrations idempotent; legacy `projects.milestones` read-compatible; all gates green.
- **Risks:** Migration `0013` is forward-only data movement; same-project integrity at 3 new levels; ProjectLayout touches shared shell (serialize); permission leaks on new routes.
- **Definition of Done:** Spine materialized end-to-end (DDS §3.1, §9); Roadmap visualization live; migrations applied; suites green; STOP approved.
- **Estimated complexity:** L. **Estimated duration:** ~3 wk.

### Epic 3.1 — Spine schema & data
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P3.1.1 | Models | Create `Milestone.js` | s1 fields per DDS §4.5; s2 indexes | P2 | Model matches spec |
| EEP2-P3.1.2 | Models | Create `Phase.js` + `Module.js` | s1 Phase; s2 Module | P3.1.1 | Models match DDS §4.6-4.7 |
| EEP2-P3.1.3 | Feature link | Add `Feature.moduleRef` + index | s1 field; s2 index | P2 | Null default; personal docs untouched |
| EEP2-P3.1.4 | Migrations | `0012` collections+indexes | s1 milestones; s2 phases; s3 modules; s4 moduleRef index | P3.1.1-3.1.3 | Idempotent; dry-run then apply |
| EEP2-P3.1.5 | Migrations | `0013` project milestones -> milestones | s1 backfill script; s2 round-trip test; s3 legacy array kept read-only | P3.1.4 | Name/date/status/order preserved; idempotent |

### Epic 3.2 — Spine API
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P3.2.1 | Milestones | `routes/milestones.js` (GET/POST/PATCH/DELETE) | s1 gates; s2 same-project; s3 delete nulls phaseRef; s4 Activity | P3.1.5 | DDS §5 table |
| EEP2-P3.2.2 | Phases | `routes/phases.js` (GET/POST/PATCH/DELETE) | s1 gates; s2 re-parent revalidation; s3 delete nulls moduleRef | P3.2.1 | Same-project enforced |
| EEP2-P3.2.3 | Modules | `routes/modules.js` (GET/POST/PATCH/DELETE) | s1 gates; s2 ownerId member check; s3 delete nulls featureRef | P3.2.2 | Same-project enforced |
| EEP2-P3.2.4 | Features | `moduleId` in query/create/patch + `validateParentForProject` | s1 schema; s2 move revalidation; s3 `?moduleId=` filter | P3.2.3 | Module move keeps sprintRef; no cross-project |
| EEP2-P3.2.5 | Mounting | Wire new routers in `server/index.js` | s1 mount; s2 smoke | P3.2.4 | Routes reachable; old routes intact |

### Epic 3.3 — Project context shell
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P3.3.1 | Layout | `ProjectLayout` + tabs + `ContextBreadcrumbs` | s1 shell; s2 tab nav; s3 breadcrumbs | P2 | IA §3 spine; deep links survive |
| EEP2-P3.3.2 | Layout | Register project route tree in `App.tsx` | s1 routes; s2 redirects | P3.3.1 | BP §4.2 tree renders |
| EEP2-P3.3.3 | Store | Spine loaders + actions + mappers | s1 loaders; s2 actions; s3 `moveFeatureModule` | P3.2.5 | Optimistic + rollback; wired to `loadCollabData` |

### Epic 3.4 — Roadmap visualization
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P3.4.1 | Selectors | `roadmapSelectors.ts` + `moduleSelectors.ts` | s1 roadmap ordered; s2 progress rollups; s3 features-by-module | P3.3.3 | Pure + unit-tested |
| EEP2-P3.4.2 | Pages | `RoadmapPage` + `MilestoneDetailPage` | s1 roadmap timeline; s2 milestone drill; s3 create/delete modals | P3.4.1 | Real data; 4 states; breadcrumbs |
| EEP2-P3.4.3 | Pages | `PhaseDetailPage` + `ModuleDetailPage` | s1 phases; s2 modules; s3 module-scoped features | P3.4.2 | Drill-down complete |
| EEP2-P3.4.4 | Features UI | Module grouping + module picker on `FeaturesPage`/`BacklogPage` | s1 group by module; s2 move via picker | P3.4.3 | Move revalidates; sprint untouched |
| EEP2-P3.4.5 | Visualization | Roadmap timeline view (dates + progress bars) | s1 timeline; s2 progress | P3.4.2 | Honest `-` for unset dates |

**STOP POINT P3:** spine end-to-end; Roadmap visualization live; migrations 0012-0014 applied; suites green; review approved.


# PHASE 4 — Sprint Planning

- **Purpose:** Turn sprints into planned, capacity-aware, committed work units: sprint creation with goals/dates/state, sprint backlog (planned features), capacity + velocity, planning UI, commitment.
- **Scope:** Sprint lifecycle, sprint backlog assignment, capacity/velocity math, `SprintBoardPage` planning mode, sprint goals, state transitions, commitment.
- **Dependencies:** Phase 3.
- **Database work:** [C] `Sprint` gains `capacityDays`, `capacityHoursPerDev`, `committed`, `commitmentDate`. Index `{projectRef,state,startDate}`. **[C]** no new collections.
- **Backend work:** [C] `routes/sprints.js` verify/extend: create with goals + capacity, state transitions (draft->planned->active->completed) with DDS §10 rules, backlog re-assignment (`features.sprintRef` null-out/move), velocity calc (`SprintPlan.summaryStats`, completed story points/days), capacity guard; activity writes on plan/commit.
- **Frontend work:** [C] `SprintBoardPage` planning mode (empty/completed-day states), [N] `SprintPlanningPage` (goal, capacity, backlog builder, commit flow), [C] `SprintBoard` + `SprintColumn` verify drag/drop.
- **Store work:** `useCollaborationStore` — [C] sprint actions (`createSprint/updateSprint/advanceSprintState/planFeatureToSprint`), `sprintFeatures[]` computation stays selector-side.
- **Selectors:** [N] `lib/sprintSelectors.ts` (`selectSprintFeatures`, `selectSprintCapacity`, `selectSprintVelocity`, `selectSprintRemaining`, `selectSprintByDate`).
- **Tests:** Server: capacity guard, state-machine transitions, backlog move null-out/move, velocity correctness, plan idempotency. Client: planning builder, commit flow, capacity bar rendering, selector units.
- **Documentation:** Blueprint §2.5 / §2.10 confirmation; DDS §10 sprint model verified.
- **Acceptance criteria:** Create sprint -> plan backlog -> commit -> advance to active/completed with capacity guarded; velocity computed from completed items only; board reflects sprintRef items; all gates green.
- **Risks:** State machine edges (overdue active sprints); double-commit guard; sprintRef null-out vs delete cascade.
- **Definition of Done:** Sprint lifecycle + capacity + velocity live; commitment recorded; suites green; STOP approved.
- **Estimated complexity:** M. **Estimated duration:** ~2 wk.

### Epic 4.1 — Sprint lifecycle
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P4.1.1 | Sprint model | Add capacity/commit fields + index | s1 fields; s2 index | P3 | DDS §4.8 |
| EEP2-P4.1.2 | Sprint API | Create/update sprint with goals/capacity/dates | s1 schema; s2 gates (editor+ for create); s3 validation | P4.1.1 | Dates valid; gates test |
| EEP2-P4.1.3 | Sprint API | State transitions draft->planned->active->completed | s1 machine; s2 guards; s3 Activity | P4.1.2 | DDS §10 rules; no skip |
| EEP2-P4.1.4 | Sprint API | Commitment endpoint (committed + commitmentDate) | s1 owner/admin only; s2 write | P4.1.3 | Immutable after commit |

### Epic 4.2 — Backlog & capacity
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P4.2.1 | Backlog | Plan features into sprint (sprintRef assign + unassign) | s1 assign; s2 unassign; s3 null-out on delete | P4.1.2 | Move revalidates project; DDS §5 |
| EEP2-P4.2.2 | Capacity | Capacity math (days x devs) + guard | s1 calc; s2 guard server-side | P4.2.1 | Over-capacity rejected |
| EEP2-P4.2.3 | Velocity | Velocity from completed items (summaryStats) | s1 query; s2 calc | P4.1.3 | Completed-only |

### Epic 4.3 — Planning UI
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P4.3.1 | Selectors | `sprintSelectors.ts` (features/capacity/velocity/remaining) | s1 5 selectors; s2 units | P4.2.x | Pure + tested |
| EEP2-P4.3.2 | Page | `SprintPlanningPage` (goals/capacity/backlog builder/commit) | s1 form; s2 builder; s3 commit | P4.3.1 | 4 states; honest empty |
| EEP2-P4.3.3 | Board | Planning mode on `SprintBoardPage` + drag/drop verify | s1 planning toggle; s2 dnd verify; s3 capacity bar | P4.3.2 | Reassign works; board verified |

**STOP POINT P4:** sprint lifecycle, capacity, velocity, commitment live; suites green; review approved.

---

# PHASE 5 — Execution Engine

- **Purpose:** Make Tasks the working engine: statuses, assignments, dependencies, comments/attachments (persisted), worklog, timer integration, project-scoped execution view.
- **Scope:** Task CRUD verify + extend, subtasks, assignments, dependencies (blocks/blocked-by), comments + attachments persisted, worklog entries persisted, personal-vs-project scope rules, `ProjectTimelinePage`/project tasks view, timer integration (`useActiveTimer` -> task worklog).
- **Dependencies:** Phase 4.
- **Database work:** [C] `Comment` + `Attachment` collections persisted (currently client-mock), index `{targetRef}`; [C] `Task` gains `dependencyRefs`, `estimateHours`; verify worklog index. **[C]** no new collection beyond Comment/Attachment.
- **Backend work:** [C] `routes/tasks.js`: verify + add dependency write, subtask CRUD, comments/attachments endpoints (persisted, `targetRef` polymorphic), `assigneeId` validation, worklog write endpoints; personal-vs-project scoping (`workspaceRef` vs `ownerId`).
- **Frontend work:** [C] `TaskDetailPage`/`TaskItem` verify; [N] `SubtaskPanel`, `DependencyPanel`, `CommentPanel`, `AttachmentPanel`; [C] `WorklogPanel` with timer hookup; project tasks view in `ProjectTimelinePage`.
- **Store work:** `useCollaborationStore` — [C] comments/attachments/worklog actions replaced from mock to persisted (same action names — no UI change), `createTask/updateTaskStatus/assignTask/createDependency/toggleSubtask`.
- **Selectors:** [N] `lib/taskSelectors.ts` (`selectTaskStatusCounts`, `selectTaskDueToday`, `selectTaskDependencies`, `selectBlockedTasks`, `selectWorklogByTask`); `lib/todaySelectors.ts` verify.
- **Tests:** Server: task/subtask/dependency/comment/attachment/worklog CRUD gates, polymorphic targetRef validation, dependency cycle rejection, scope rules, timer->worklog write. Client: panels 4 states, optimistic updates, cycle UI.
- **Documentation:** Blueprint §2.8-2.9 confirmation; Comment/Attachment contract.
- **Acceptance criteria:** All task surfaces persisted (comments/attachments/worklog no longer mock); dependencies enforced with cycle guard; subtasks toggle; timer integration writes worklog; personal+project scope rules correct; suites green.
- **Risks:** Largest current surface; replacing mock with persisted must be behavior-identical (mock-data seeding for tests); dependency cycles; polymorphic targetRef integrity.
- **Definition of Done:** Execution engine fully persisted + enforced; panels live; suites green; STOP approved.
- **Estimated complexity:** L. **Estimated duration:** ~3 wk.

### Epic 5.1 — Task core
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P5.1.1 | Task model | Add `dependencyRefs` + `estimateHours` | s1 fields; s2 index | P4 | DDS §4.9 |
| EEP2-P5.1.2 | Task API | Verify CRUD + status + assignee + reorder | s1 verify; s2 edge cases | P5.1.1 | Scope rules (personal vs project) |
| EEP2-P5.1.3 | Subtasks | Subtask CRUD + toggle | s1 API; s2 UI | P5.1.2 | Parent rollup correct |

### Epic 5.2 — Dependencies
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P5.2.1 | Deps API | Add `dependencyRefs` write + cycle guard | s1 write; s2 cycle reject | P5.1.1 | No cycles; same-project only |
| EEP2-P5.2.2 | Deps UI | `DependencyPanel` + blocked styling | s1 panel; s2 styling | P5.2.1 | `selectBlockedTasks` used |

### Epic 5.3 — Comments & attachments (persist)
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P5.3.1 | Comments | Persist `Comment` collection + endpoints + panel | s1 model+API; s2 panel; s3 pagination | P5.1.2 | Mock->persisted; no UI change |
| EEP2-P5.3.2 | Attachments | Persist `Attachment` collection + endpoints + panel | s1 model+API; s2 upload; s3 panel | P5.3.1 | targetRef validated; size caps |

### Epic 5.4 — Worklog & timer
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P5.4.1 | Worklog | Persist worklog entries + endpoints + panel | s1 model+API; s2 panel; s3 rollup | P5.1.2 | Mock->persisted |
| EEP2-P5.4.2 | Timer | `useActiveTimer` -> task worklog write | s1 hookup; s2 stop writes entry; s3 test | P5.4.1 | Stop timer -> worklog row |

### Epic 5.5 — Project execution view
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P5.5.1 | Selectors | `taskSelectors.ts` (counts/due/deps/blocked/worklog) | s1 5 selectors; s2 units | P5.x | Pure + tested |
| EEP2-P5.5.2 | Timeline | Project tasks view in `ProjectTimelinePage` | s1 view; s2 filters | P5.5.1 | Project-scoped tasks |

**STOP POINT P5:** execution engine persisted end-to-end; comments/attachments/worklog real; dependencies enforced; suites green; review approved.


# PHASE 6 — Developer Companion

- **Purpose:** Make today/continuation/knowledge/worklog the daily companion: Today page, Current Work + Resume flows, worklog capture, journal, knowledge capture, personal reports + insights, AI recommendations.
- **Scope:** `TodayPage`, `ContinueWorkPage`/resume, worklog/journal, knowledge creation (personal), personal reports/insights, AI recommendations (recommendation surface; real AI model is Phase 10 — use deterministic rules now).
- **Dependencies:** Phase 3, Phase 5.
- **Database work:** **[C]** none. Knowledge/Journal/Worklog persist on existing collections from Phase 5 (`worklog`), or `knowledgeDoc` personal docs (already modeled). Personal analytics computed via selectors.
- **Backend work:** [C] `routes/knowledge.js` verify (personal docs CRUD); [C] worklog endpoints from P5.4; [N] no new routes unless analytics endpoints needed (`GET /api/insights/me` minimal). AI-recommendation endpoint [N] `GET /api/insights/recommendations` returns rule-based suggestions (overdue, stale, blocked, no-estimate, unplanned) — contract fixed now, model swapped in Phase 10.
- **Frontend work:** [C] `TodayPage`, `ContinueWorkPage`, `WorklogPage`, `JournalPage`, `TeamKnowledgePage` (personal filter), [C] `KnowledgeBasePage` verify; [N] `InsightCard`, `RecommendationCard`, `TodaySummary` header.
- **Store work:** `useCollaborationStore` — [C] knowledge actions persist; worklog actions (P5.4); `useActiveTimer` stays; personal-scope loaders.
- **Selectors:** [N] `lib/knowledgeSelectors.ts` (personal docs), `lib/worklogSelectors.ts` (`selectWorklogByDay`, `selectWorklogByWeek`, `selectWorklogByProject`), `lib/insightsSelectors.ts` (recommendations from rule set), verify `lib/todaySelectors.ts`, `lib/continuationSelectors.ts`, `lib/nowSelectors.ts`.
- **Tests:** Server: personal-knowledge scoping, insights endpoint contract + rule inputs. Client: Today summary, resume flow, knowledge capture, insight/recommendation cards, personal report math.
- **Documentation:** `engineering-companion-phase1.md` verification; `developer-companion-experience.md` UX verified.
- **Acceptance criteria:** Today shows due/overdue/blocked/stale with honest `-`; ContinueWork resumes most-recent active; worklog captured from timer + manual; personal knowledge persists; recommendations render from rules; suites green.
- **Risks:** Recommendations must be honest (rules, no fake AI); today/timezone rollover; resume multi-tab.
- **Definition of Done:** Companion surfaces verified + recommendations live (rule-based); personal data persists; suites green; STOP approved.
- **Estimated complexity:** M. **Estimated duration:** ~2 wk.

### Epic 6.1 — Today & Continue
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P6.1.1 | Today | Verify `TodayPage` against real data (todaySelectors) | s1 verify; s2 honest empty/dash | P5.5 | Real project+personal mix |
| EEP2-P6.1.2 | Today | `TodaySummary` header (counts, focus) | s1 summary; s2 links | P6.1.1 | Counts match selectors |
| EEP2-P6.1.3 | Resume | `ContinueWorkPage` resume most-recent worklog/timer | s1 selector; s2 flow | P5.4.2 | Resumes correct task |

### Epic 6.2 — Worklog & journal
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P6.2.1 | Worklog UI | `WorklogPage` + journal merge | s1 day/week rollups; s2 journal entry | P5.4.1 | selectWorklogByDay used |
| EEP2-P6.2.2 | Worklog | Manual entry + timer entry parity | s1 manual; s2 parity test | P6.2.1 | Both persist same shape |

### Epic 6.3 — Knowledge capture (personal)
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P6.3.1 | Knowledge | Verify personal doc CRUD in `KnowledgeBasePage` | s1 CRUD; s2 scoping | P3 | ownerId-scoped docs only |
| EEP2-P6.3.2 | Knowledge | `knowledgeSelectors.ts` personal filter | s1 selector; s2 units | P6.3.1 | Personal-only |

### Epic 6.4 — Recommendations & personal insights
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P6.4.1 | Insights API | `GET /api/insights/me` + `GET /api/insights/recommendations` (rule-based) | s1 contract; s2 rules; s3 scoping | P5.5 | Contract stable for P10 |
| EEP2-P6.4.2 | Insights UI | `InsightCard` + `RecommendationCard` | s1 cards; s2 dismiss/do | P6.4.1 | Rules drive; honest |
| EEP2-P6.4.3 | Reports | Personal reports (worklog/insights weekly) | s1 math; s2 UI | P6.4.2 | Matches selectors |

**STOP POINT P6:** companion verified; recommendations live (rules); personal data persisted; suites green; review approved.

---

# PHASE 7 — Project Intelligence

- **Purpose:** Give projects analytical depth: analytics, roadmap health, sprint health, delivery forecast, blockers, risk analysis.
- **Scope:** Project analytics rollups, roadmap health (milestone variance, slips), sprint health (capacity/velocity trend, burnout), delivery forecast (completion vs estimate), blocker board, risk analysis (overdue, stale, blocked, unplanned, over-capacity).
- **Dependencies:** Phase 5, Phase 6.
- **Database work:** **[C]** none — all analytics via aggregate queries. Index verification for `{projectRef,status}`, `{projectRef,startDate}`, worklog date.
- **Backend work:** [N] `routes/projectAnalytics.js`: `GET /api/projects/:id/analytics` (rollups), `GET /api/projects/:id/roadmap-health`, `GET /api/projects/:id/sprint-health`, `GET /api/projects/:id/forecast`, `GET /api/projects/:id/risks`, `GET /api/projects/:id/blockers`. Aggregate-only (MongoDB aggregation pipelines), member-gated.
- **Frontend work:** [C] `ProjectTimelinePage` verify + analytics tab, [C] `ReportsAnalyticsPage` project scope, [N] `BlockersPage` board, [N] risk widgets, `QADashboardPage` verify.
- **Store work:** `useCollaborationStore` — [N] analytics/health/risks/blockers slices (loaded on project entry), keep optimistic-writing surfaces small.
- **Selectors:** [N] `lib/projectOverviewSelectors.ts` verify + extend, `lib/reportsSelectors.ts` (health/forecast/risk scoring), `lib/insightsSelectors.ts` extend (project-level recommendations), `lib/collaborationKpis.ts` verify.
- **Tests:** Server: aggregate queries correctness on seeded data, health score bounds, forecast math, risk classification, member gate. Client: dashboards, blockers board, risk cards.
- **Documentation:** Blueprint §2.12 confirmation; health/forecast formulas documented.
- **Acceptance criteria:** Per-project analytics + health + forecast + risks render from real data; blockers board aggregates `blocked` tasks; risk rules match DDS §15 (future extensions); suites green.
- **Risks:** Aggregate query perf on large workspaces (index verification); honest scoring (no hand-waving); forecast is an estimate with stated assumptions.
- **Definition of Done:** Project intelligence live across the 6 endpoints; health/forecast/risks documented; suites green; STOP approved.
- **Estimated complexity:** L. **Estimated duration:** ~3 wk.

### Epic 7.1 — Analytics endpoints
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P7.1.1 | Analytics | `GET /api/projects/:id/analytics` rollups | s1 query; s2 gate | P5.5 | Counts correct |
| EEP2-P7.1.2 | Analytics | `GET /api/projects/:id/roadmap-health` | s1 variance; s2 slips | P3.4 | Health bounded 0-1 |
| EEP2-P7.1.3 | Analytics | `GET /api/projects/:id/sprint-health` | s1 capacity; s2 velocity trend | P4.3 | Trend honest |

### Epic 7.2 — Forecast, risks, blockers
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P7.2.1 | Forecast | `GET /api/projects/:id/forecast` | s1 completion vs estimate; s2 assumptions field | P7.1.1 | Estimate labeled |
| EEP2-P7.2.2 | Risks | `GET /api/projects/:id/risks` classification | s1 rules; s2 scoring | P7.2.1 | Overdue/stale/blocked/unplanned/over-capacity |
| EEP2-P7.2.3 | Blockers | `GET /api/projects/:id/blockers` | s1 query; s2 board | P5.2 | Deps + status blocked |

### Epic 7.3 — Dashboards
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P7.3.1 | Project page | Analytics + health tab in project context | s1 tab; s2 widgets | P7.1.x | Drives from endpoints |
| EEP2-P7.3.2 | Selectors | `reportsSelectors.ts` health/forecast/risk scoring | s1 scoring; s2 units | P7.2.x | Pure + tested |
| EEP2-P7.3.3 | Blockers UI | `BlockersPage` board | s1 list; s2 unblock action | P7.2.3 | Unblock updates dependency/status |
| EEP2-P7.3.4 | Reports page | `ReportsAnalyticsPage` project scope verify | s1 verify; s2 empty states | P7.3.2 | Real data; honest dash |

**STOP POINT P7:** project intelligence live; forecasts documented as estimates; suites green; review approved.


# PHASE 8 — Knowledge System

- **Purpose:** Persistent, linked, searchable team knowledge: docs, ADRs, meeting notes, architecture docs, linking, full-text search. Parallel-safe with Phase 7 (disjoint files).
- **Scope:** Knowledge doc types (knowledge/architecture/meeting/ADR), CRUD + publishing, linking (related docs), full-text search, TeamKnowledge workspace surface, feed/activity.
- **Dependencies:** Phase 3, Phase 6 (base knowledge persistence).
- **Database work:** [C] `KnowledgeDoc` gains `docType`, `published`, `linkedRefs`, index `{workspaceRef,docType}`, text index for search. **[C]** no new collection.
- **Backend work:** [C] `routes/knowledge.js` extend: docType filter, publish, linkedRefs write+validation, full-text search endpoint `GET /api/knowledge/search?q=`, activity writes.
- **Frontend work:** [C] `TeamKnowledgePage`/`KnowledgeBasePage` verify + doc-type filters, [N] `KnowledgeSearch` bar, [N] `KnowledgeEditor` (markdown), [N] `KnowledgeDetailPage` with linked docs + breadcrumbs, `WorkspaceDashboard` knowledge feed verify.
- **Store work:** `useCollaborationStore` — [C] knowledge actions extend (docType, publish, link), search slice.
- **Selectors:** `lib/knowledgeSelectors.ts` extend (`selectDocsByType`, `selectRelatedDocs`, `selectPublishedDocs`).
- **Tests:** Server: docType + publish rules, link validation (no self/cycle? no — links allowed both ways), search relevance on seeded corpus, member gate. Client: filters, editor, search, linked-doc navigation.
- **Documentation:** `ark-information-architecture.md` verification.
- **Acceptance criteria:** Docs typed/filtered/published; links navigate; search returns relevant docs; workspace knowledge surface real; suites green.
- **Risks:** Search quality (Mongo text index bounds — accept + document); parallel-phase file discipline (no shared shell edits).
- **Definition of Done:** Knowledge system live; search + linking working; suites green; STOP approved.
- **Estimated complexity:** M. **Estimated duration:** ~2.5 wk.

### Epic 8.1 — Doc model & API
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P8.1.1 | Model | `docType`, `published`, `linkedRefs` + indexes | s1 fields; s2 text index | P6.3 | DDS §4.13 |
| EEP2-P8.1.2 | API | docType filter + publish + link writes | s1 filter; s2 publish; s3 link validation | P8.1.1 | Links resolve; gates |
| EEP2-P8.1.3 | API | Full-text search endpoint | s1 index query; s2 relevance test | P8.1.2 | Search > mock |

### Epic 8.2 — Knowledge UI
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P8.2.1 | List | Doc-type filters on `TeamKnowledgePage` | s1 filters; s2 publish badge | P8.1.2 | Filters real |
| EEP2-P8.2.2 | Editor | `KnowledgeEditor` markdown + save | s1 editor; s2 save; s3 4 states | P8.2.1 | Markdown intact |
| EEP2-P8.2.3 | Detail | `KnowledgeDetailPage` + `KnowledgeSearch` | s1 detail + links; s2 search bar; s3 breadcrumbs | P8.2.2 | IA verified |
| EEP2-P8.2.4 | Feed | Workspace knowledge feed verify | s1 verify; s2 empty state | P8.2.1 | Real recent docs |

**STOP POINT P8:** knowledge typed/searched/linked; suites green; review approved.

---

# PHASE 9 — Reports & Intelligence

- **Purpose:** Cross-cutting reporting: executive, developer, manager reports; AI insights; historical trends; forecasting across workspaces/projects.
- **Scope:** Report generators (executive/developer/manager), trend history (rollup snapshots), forecasting (cross-project), AI insights surface (rule-based until Phase 10), scheduled export (CSV/PDF stub).
- **Dependencies:** Phase 7, Phase 8.
- **Database work:** [N] `Report` snapshot collection (generated reports stored, `{workspaceRef,type,period}`), [N] `Insight` collection (persisted AI/rule insights, `{targetRef,kind}`).
- **Backend work:** [N] `routes/reports.js`: `GET /api/reports/executive`, `GET /api/reports/developer`, `GET /api/reports/manager`, `GET /api/reports/trends?period=`, `POST /api/reports/:type/generate` (snapshot write), export stub. [N] `routes/insights.js`: `GET /api/insights` (workspace scope), persist rule insights.
- **Frontend work:** [C] `ReportsAnalyticsPage` full report views + tabs, [N] `ReportCard`, [N] trend charts (reuse roadmap chart primitives), [N] export button (stub).
- **Store work:** `useCollaborationStore` — reports/trends/insights slices, generate-trigger action.
- **Selectors:** `lib/reportsSelectors.ts` extend (period rollups, trend deltas), `lib/insightsSelectors.ts` extend (workspace insights, persist read).
- **Tests:** Server: report generator math vs seeded data, period boundaries, snapshot idempotency (same period re-generate overwrites), permission scoping (executive=owner/admin, manager=manager+, developer=member self). Client: report views, trend charts, export stub.
- **Documentation:** Blueprint §2.13-2.14 confirmation; report contract.
- **Acceptance criteria:** Three report types render real data; trends computed across periods; insights persisted; permissions enforced; suites green.
- **Risks:** Report scope creep; snapshot growth (retention policy documented); trend gaps.
- **Definition of Done:** Reports + trends + insights persisted; export stub; suites green; STOP approved.
- **Estimated complexity:** M. **Estimated duration:** ~2 wk.

### Epic 9.1 — Report engine
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P9.1.1 | Model | `Report` snapshot collection | s1 model; s2 index; s3 retention | P7, P8 | DDS §4.14 |
| EEP2-P9.1.2 | API | Executive + developer + manager reports | s1 executive; s2 developer; s3 manager | P9.1.1 | Correct scope per role |
| EEP2-P9.1.3 | API | Trends endpoint + generate (idempotent snapshot) | s1 trends; s2 generate; s3 overwrite | P9.1.2 | Periods bounded |

### Epic 9.2 — Insights
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P9.2.1 | Model | `Insight` collection + persist rule insights | s1 model; s2 persistence | P7.2 | DDS §4.15 |
| EEP2-P9.2.2 | API | `GET /api/insights` workspace scope | s1 query; s2 scoping | P9.2.1 | Member-gated |

### Epic 9.3 — Reports UI
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P9.3.1 | View | `ReportsAnalyticsPage` full views + tabs | s1 tabs; s2 empty/loading | P9.1.3 | Real data |
| EEP2-P9.3.2 | Charts | Trend charts + `ReportCard` | s1 charts; s2 cards | P9.3.1 | Reuse chart primitives |
| EEP2-P9.3.3 | Export | Export button (CSV stub) | s1 button; s2 stub endpoint | P9.3.2 | Contract documented |

**STOP POINT P9:** reports/trends/insights persisted + scoped; suites green; review approved.

---

# PHASE 10 — AI Companion

- **Purpose:** Swap rule-based recommendations for real AI assistance across developer/project/workspace surfaces, with code context + engineering intelligence, designed for future MCP integration.
- **Scope:** Developer assistant (today/resume/worklog summarizer), project assistant (health narrative, forecast explanation), workspace assistant (cross-project trends), code context (repo/file references), engineering intelligence (suggestions), MCP readiness seams.
- **Dependencies:** Phase 7, Phase 8, Phase 9.
- **Database work:** **[C]** none (insights/recommendations persist on `Insight`); MCP/tool registration data only.
- **Backend work:** [N] `routes/ai.js`: `POST /api/ai/assist` (provider-agnostic), prompt assembly from insights/health/forecast, streaming stubs, tool schemas for MCP future, capability flags. **[C]** existing rule endpoints remain as fallback.
- **Frontend work:** [N] `AiAssistantPanel` (dockable), [N] summary bubbles on Today/Project/Reports, [C] `RecommendationCard` upgrade to AI-driven (flag-gated), [N] code-context chip (file/ref links).
- **Store work:** `useCollaborationStore` — [N] `aiSlice` (session, streaming buffer, capability flags), settings toggle.
- **Selectors:** `lib/insightsSelectors.ts` extend (AI vs rule source), `lib/aiSelectors.ts` [N] (`selectAiSession`, `selectAiReady`).
- **Tests:** Server: prompt assembly determinism, fallback when provider unavailable, scoping (assistant never exceeds caller's workspace), streaming. Client: panel dock/resize, flag-gated cards, code-context links.
- **Documentation:** MCP integration seam documented (future tool registration); model/provider config documented; DDS §16 extension points.
- **Acceptance criteria:** AI assistant live with fallback; summaries on 3 surfaces; code context works where repo refs available; capability flags gate AI vs rules; suites green.
- **Risks:** Provider availability (fallback mandatory); prompt injection (no workspace data beyond caller scope); streaming complexity.
- **Definition of Done:** AI Companion live, flag-gated, fallback-safe, MCP-ready; suites green; STOP approved.
- **Estimated complexity:** L. **Estimated duration:** ~4+ wk.

### Epic 10.1 — AI core
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P10.1.1 | API | `POST /api/ai/assist` provider-agnostic | s1 contract; s2 provider adapter; s3 fallback | P9 | Rules fallback when offline |
| EEP2-P10.1.2 | API | Prompt assembly from insights/health/forecast | s1 assembly; s2 scoping guard | P10.1.1 | Never exceeds caller scope |
| EEP2-P10.1.3 | API | Streaming stub + capability flags | s1 streaming; s2 flags | P10.1.2 | Flag-gated UI |

### Epic 10.2 — Assistant surfaces
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P10.2.1 | Panel | `AiAssistantPanel` dockable | s1 dock; s2 resize; s3 session | P10.1.x | Works in all layouts |
| EEP2-P10.2.2 | Summaries | Summary bubbles on Today/Project/Reports | s1 Today; s2 Project; s3 Reports | P10.2.1 | Flag-gated |
| EEP2-P10.2.3 | Upgrade | `RecommendationCard` AI-driven (flag) | s1 AI source; s2 fallback | P10.2.1 | Rules when flag off |

### Epic 10.3 — Code context & MCP readiness
| ID | Feature | Task | Subtasks | Deps | Acceptance |
|---|---|---|---|---|---|
| EEP2-P10.3.1 | Context | Code-context chip (repo/file refs) | s1 chip; s2 links | P10.2.1 | Links resolve |
| EEP2-P10.3.2 | MCP | Tool schema seam for future MCP registration | s1 schemas; s2 docs | P10.1.2 | Registerable later |

**STOP POINT P10:** AI Companion live, flag-gated, fallback-safe; MCP seam documented; suites green; final review.

---

## Execution Rules (carried from V1, binding)

1. One task = one branch = one PR; PR checklist per V1 §4 (no self-review, tests attached, screenshots when UI).
2. Gates run in every task, in order (see Scope guardrails). A task is not done until all five pass.
3. Touching shared shells (`AppLayout`, `WorkspaceLayout`, `ProjectLayout`, `src/utils/api.ts`, `server/index.js`) serializes with other shell-touching work (V1 §8.2 disjoint-file rule).
4. No backend = no migration = no API change unless a task explicitly calls for it in its Database work / Backend work lines. Anything marked [N] must have its own DDS + Blueprint reference.
5. Honest UI: never fake data; empty states and `-` for unset values.
6. STOP points are gated by Architecture + Release review; do not proceed across a STOP without sign-off.
7. Update `docs/` decision log on any deviation; a deviation never silently changes DDS.

## Definition of Done — program level
All 10 phases complete, every STOP signed, rules mode toggles documented (rule-based AI fallback remains), MCP seam stubbed, and the four experience docs + DDS + Blueprint remain the single source of truth.

