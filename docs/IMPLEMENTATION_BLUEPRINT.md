# IMPLEMENTATION_BLUEPRINT.md

**Status:** Planning only — approved to translate, not to build.
**Single source of truth:** [`DDS.md`](DDS.md). This document is derived from DDS; it does not alter it. If a conflict is found, DDS wins and this document is corrected.
**Scope guardrails (locked):**
- No production code. No database migrations. No API changes. No UI implementation.
- This document is the executable engineering roadmap and traceability map.
- Conventions: **[E]** = exists today · **[N]** = new in blueprint · **[C]** = change/extend existing. Code paths reference the current repo layout (`mainApp/server`, `mainApp/src`).

---

## 1. Traceability Model

Every capability must be traceable end-to-end. The chain (top = intent, bottom = effect):

```
Business Concept
      ↓   (what problem it solves — DDS §4 Purpose)
Database Model      → server/models/<Entity>.js · collection
      ↓
Backend API         → server/routes/<entity>.js · middleware gates · zod validators
      ↓
Frontend Route      → src/App.tsx / <ProjectLayout> route entries
      ↓
Frontend Component  → src/pages/<...> · src/components/<...>
      ↓
Stores              → src/store/<useXStore>.ts (zustand) · src/utils/api.ts client
      ↓
Selectors           → src/lib/<domain>Selectors.ts (pure functions)
      ↓
Analytics           → src/lib/<...>Kpis.ts (derived metrics, DDS §4.13)
      ↓
Insights            → src/lib/insightsSelectors.ts · src/pages/InsightsPage.tsx
```

Master matrix (rows = entities, columns = trace hops). All paths are current-or-planned concrete names.

| Entity | DB collection | API router | Route(s) | Store | Selector lib |
|---|---|---|---|---|---|
| Workspace | `workspaces` [E] | `routes/workspaces.js` [E] | `/w/:workspaceId/*`, `/hub` [E] | `useCollaborationStore` [E] | `missionControlSelectors`, `collaborationKpis` [E] |
| Project | `projects` [E] | `routes/projects.js` [C: GET/:id, PATCH/:id] | `/w/:id/projects/:projectId` [E] | `useCollaborationStore`, `useProjectStore` [E] | `projectOverviewSelectors`, `projectTimelineSelectors` [E] |
| Roadmap | (virtual — Milestone query, DDS §9) | `routes/milestones.js` [N] GET | `.../roadmap` [N] | `useCollaborationStore` [C] | `roadmapSelectors` [N] |
| Milestone | `milestones` [N] | `routes/milestones.js` [N] | `.../roadmap/:milestoneId` [N] | `useCollaborationStore` [C] | `roadmapSelectors` [N] |
| Phase | `phases` [N] | `routes/phases.js` [N] | `.../phases/:phaseId` [N] | `useCollaborationStore` [C] | `roadmapSelectors` [N] |
| Module | `modules` [N] | `routes/modules.js` [N] | `.../modules/:moduleId` [N] | `useCollaborationStore` [C] | `moduleSelectors` [N] |
| Feature | `features` [E] | `routes/features.js` [C: moduleId] | `.../features`, `.../backlog`, `.../modules/:moduleId` [E+N] | `useCollaborationStore` [C] | `collaborationKpis`, `moduleSelectors` [C] |
| Task | `tasks` [E] | `routes/tasks.js` [E] | `.../sprints`, `.../backlog`, `/tasks/:id` [E] | `useCollaborationStore` (workspace), `useStore` (personal) [E] | `todaySelectors`, `continuationSelectors`, `missionControlSelectors` [E] |
| Subtask | `tasks.subtasks` (embedded) [E] | `routes/tasks.js /:id/subtasks*` [E] | embedded in Task detail [E] | `useStore` / `useCollaborationStore` [E] | `focusSelectors` (subtasks x/y) [E] |
| Sprint | `sprints` [E] | `routes/sprints.js` [E] | `.../sprints` [E] | `useCollaborationStore` [E] | `missionControlSelectors` (velocity) [E] |
| KnowledgeDoc | `knowledgedocs` [N] | `routes/knowledge.js` [N] | `.../knowledge`, `/knowledge` [E page, N API] | `useKnowledgeStore` [N] | `knowledgeSelectors` [C] |
| Member | `workspaces.members` (embedded) [E] | `routes/workspaces.js /:id/members*` [E] | `.../members`, `.../members/:memberId` [E] | `useCollaborationStore` [E] | `collaborationActivity` [E] |
| Report | (derived) [E] | `routes/reports.js` [E] + `routes/reports.js /project` [N] | `.../reports`, `/reports` [E] | `useWorkLogStore` (inputs) [E] | `reportsSelectors`, `reportsAnalyticsSelectors` [C] |
| Insight | (derived) [E] | (existing endpoints as inputs) | `/insights`, `/activity` [E] | `useStore` (inputs) [E] | `insightsSelectors`, `nowSelectors`, `memorySelectors` [C] |

---

## 2. Entity Blueprints

For each entity: the 11 specs from the blueprint request. Paths are concrete; behaviour is per DDS §4–§12.

### 2.1 Workspace [E → C]

1. **Database collection:** `workspaces` [E]. Embedded `members[]` (role/status/teams/joinedAt), `settings` object.
2. **Relationships:** 1..* Teams, 1..* Projects, 1..* KnowledgeDocs, 1..* Activity. Owner of everything beneath it (DDS §2 P2).
3. **REST endpoints:** [E] `GET /api/workspaces`, `POST /api/workspaces`, `GET /api/workspaces/:id`, `PATCH /api/workspaces/:id`, `DELETE /api/workspaces/:id`, `GET|POST /:id/members`, `PATCH|DELETE /:id/members/:userId`, `POST /:id/join`, `GET /:id/activity`. [N] none required.
4. **Frontend pages:** [E] `WorkspaceHub`, `WorkspaceProjectsPage`, `WorkspaceTeamsPage`, `WorkspaceMembersPage`, `MemberProfilePage`, `WorkspaceSettingsPage`, `TeamWorkspace` (Mission Control), `ActivityFeedPage`.
5. **Components:** [E] `WorkspaceLayout` (grouped sidebar), `CreateProjectModal`, `InviteMemberModal`, member cards, `WorkspaceSettingsPage` form. [N] `ProjectLayout` is separate (see 2.2).
6. **Zustand stores:** [E] `useCollaborationStore` (`loadWorkspaces`, `loadMembers`, `loadTeams`, `loadProjects`, `updateWorkspaceSettings`, `createWorkspace`, `createTeam`, `updateMemberRole`).
7. **Selectors:** [E] `lib/missionControlSelectors.ts`, `lib/collaborationKpis.ts`, `lib/collaborationActivity.ts`.
8. **Validation:** [E] zod schemas in `workspaces.js`; `role`/`status`/`type` enums; membership uniqueness per workspace (DDS §12).
9. **Permissions:** DDS §7 — member=read, Owner/Admin=settings+membership, Owner=delete.
10. **Analytics:** [E] `computeWorkspaceProgress`, `computeSprintVelocity`, `computePendingReviews` (Mission Control). [C] workspace-level throughput once Roadmap lands (derive from done Tasks per project).
11. **Future AI hooks:** workspace-level health narrative; member availability for auto-assignment.

### 2.2 Project [E → C]

1. **Database collection:** `projects` [E]. `workspaceRef` (null = personal), `nameKey`, `status`, `members[]`, `teamIds[]`, Google Drive folder ids, `settings` [N].
2. **Relationships:** owns Milestones/Sprints/Features (project-level); references Members/Teams; scopes KnowledgeDocs; legacy embedded `milestones[]` deprecated → `milestones` collection.
3. **REST endpoints:** [E] `GET /api/projects`, `POST /api/projects`, `POST /api/projects/:id/sync-drive`. **[C] `GET /api/projects/:id`, `PATCH /api/projects/:id`** (persist `description`/`key`/`status`/`members[]`/`teamIds[]`/`settings`) — closes the DDS §4.4 Project Info gap.
4. **Frontend pages:** [E] `ProjectOverviewPage`, `ProjectTimelinePage`, `WorkspaceProjectsPage`. [N] `ProjectLayout` shell; Project Info view becomes the `(index)` of the project context.
5. **Components:** [E] `CreateProjectModal`, project cards, `ProjectOverviewPage` sections. [N] `ProjectInfoForm`, `ProjectMembersPanel`, `ProjectSettingsPanel`.
6. **Zustand stores:** [E] `useCollaborationStore.createProject`. [C] add `updateProjectMeta(id, patch)` → `api.projects.update`.
7. **Selectors:** [E] `projectOverviewSelectors`, `projectTimelineSelectors`. [C] rollups over Roadmap spine (completion % per project).
8. **Validation:** [E] name required + `nameKey` uniqueness per scope (DDS BR-10, §12.2). [C] `PATCH` zod schema; member/team refs validated against workspace.
9. **Permissions:** DDS §7 — edit meta=editor; edit members/teamIds/settings=Owner/Admin; delete=Owner/Admin.
10. **Analytics:** [C] project completion, module/phase rollups, delivery rate — derived, never stored (DDS P12).
11. **Future AI hooks:** goal→roadmap decomposition input; project risk narrative.

### 2.3 Roadmap [N]

1. **Database collection:** virtual (DDS §9). Backed by `milestones` ordered by `order`, `targetDate`. No `roadmaps` collection.
2. **Relationships:** the ordered set of a Project's Milestones; read-through of the spine `Milestone→Phase→Module→Feature`.
3. **REST endpoints:** [N] `GET /api/milestones?projectId=` (the Roadmap read). No dedicated router — served by `routes/milestones.js`.
4. **Frontend page:** [N] `pages/collaboration/RoadmapPage.tsx` at `/w/:workspaceId/projects/:projectId/roadmap` — milestone timeline, ordered, drill-into-milestone.
5. **Components:** [N] `RoadmapTimeline`, `MilestoneCard`, `MilestoneProgressBar`, `CreateMilestoneModal`.
6. **Zustand store:** [C] `useCollaborationStore` — add `roadmap` derived list (select over `milestones`), `loadMilestones`, `createMilestone`, `updateMilestone`, `deleteMilestone`.
7. **Selectors:** [N] `lib/roadmapSelectors.ts` — `selectRoadmapOrdered`, `selectMilestoneProgress`, `selectMilestonesByDate`.
8. **Validation:** per Milestone (2.4).
9. **Permissions:** reads=member; structural edits per spine matrix (DDS §7).
10. **Analytics:** [N] roadmap completion %, milestone slip (targetDate vs status).
11. **Future AI hooks:** auto-decomposition of goal → milestones (DDS §13.1).

### 2.4 Milestone [N]

1. **Database collection:** `milestones` [N] — `projectRef`, `workspaceRef`, `name`, `description`, `targetDate`, `status` (`planned|active|completed`), `order`, `createdBy`, timestamps. Indexes `{projectRef, order, targetDate}`, `{workspaceRef}`. Created by migration `0012`; backfilled from `projects.milestones[]` by `0013`.
2. **Relationships:** parent=Project; owns Phases (`Phase.milestoneRef`).
3. **REST endpoints:** [N] `GET /api/milestones?projectId=` (member), `POST /api/milestones` (editor), `PATCH /api/milestones/:id` (editor), `DELETE /api/milestones/:id` (Owner/Admin; nulls `phase.milestoneRef`).
4. **Frontend pages:** [N] `RoadmapPage` (list), `pages/collaboration/MilestoneDetailPage.tsx` at `.../roadmap/:milestoneId` (Phases).
5. **Components:** [N] `MilestoneCard`, `MilestoneDetailHeader`, `PhaseList`, `PhaseCard`, `CreateMilestoneModal`, `CreatePhaseModal`.
6. **Zustand store:** [C] `useCollaborationStore` — `milestones[]`, `phases[]`, loaders/actions (pattern: existing `loadSprints`/`createSprint`).
7. **Selectors:** [N] `roadmapSelectors.selectMilestoneProgress(phases)` — all phases complete ⇒ milestone complete (DDS BR-17).
8. **Validation:** zod in `milestones.js`; same-project; name ≤150; `targetDate` valid date.
9. **Permissions:** spine matrix (DDS §7).
10. **Analytics:** [N] milestone completion, slip, phase-burndown input.
11. **Future AI hooks:** milestone-risk prediction from status transitions.

### 2.5 Phase [N]

1. **Database collection:** `phases` [N] — `milestoneRef`, `projectRef`, `workspaceRef`, `name`, `description`, `status`, `order`, `startDate?`, `endDate?`, `createdBy`. Indexes `{milestoneRef, order}`, `{projectRef}`.
2. **Relationships:** parent=Milestone; owns Modules (`Module.phaseRef`).
3. **REST endpoints:** [N] `GET /api/phases?milestoneId=&projectId=`, `POST /api/phases`, `PATCH /api/phases/:id` (supports re-parent via `milestoneId`, same-project revalidation), `DELETE /api/phases/:id` (Owner/Admin; nulls `module.phaseRef`).
4. **Frontend pages:** [N] `MilestoneDetailPage` (phase list), `pages/collaboration/PhaseDetailPage.tsx` at `.../phases/:phaseId` (Modules).
5. **Components:** [N] `PhaseCard`, `ModuleList`, `ModuleCard`, `CreateModuleModal`.
6. **Zustand store:** [C] `useCollaborationStore` — `phases[]`, `modules[]`, loaders/actions.
7. **Selectors:** [N] `roadmapSelectors.selectPhaseProgress(modules)`.
8. **Validation:** zod in `phases.js`; same-project; `startDate < endDate` when both set (DDS §12.3).
9. **Permissions:** spine matrix.
10. **Analytics:** [N] phase progress, module rollups.
11. **Future AI hooks:** phase dependency detection.

### 2.6 Module [N]

1. **Database collection:** `modules` [N] — `phaseRef`, `projectRef`, `workspaceRef`, `name`, `description`, `status`, `order`, `ownerId?`, `createdBy`. Indexes `{phaseRef, order}`, `{projectRef}`.
2. **Relationships:** parent=Phase; owns Features (`Feature.moduleRef`).
3. **REST endpoints:** [N] `GET /api/modules?phaseId=&projectId=`, `POST /api/modules`, `PATCH /api/modules/:id` (re-parent revalidation), `DELETE /api/modules/:id` (Owner/Admin; nulls `feature.moduleRef`).
4. **Frontend pages:** [N] `PhaseDetailPage` (module list), `pages/collaboration/ModuleDetailPage.tsx` at `.../modules/:moduleId` (module-scoped Features).
5. **Components:** [N] `ModuleCard`, `ModuleDetailHeader`, `FeatureList` (reuse `FeaturesPage` internals).
6. **Zustand store:** [C] `useCollaborationStore` — `modules[]`, loaders/actions.
7. **Selectors:** [N] `lib/moduleSelectors.ts` — `selectModuleCompletion`, `selectFeaturesByModule`.
8. **Validation:** zod in `modules.js`; `ownerId` must be workspace member.
9. **Permissions:** spine matrix.
10. **Analytics:** [N] module health (features in_progress vs done), per-module velocity.
11. **Future AI hooks:** module risk from feature density and rework.

### 2.7 Feature [E → C]

1. **Database collection:** `features` [E] — add `moduleRef` (ObjectId, default null) + index `{moduleRef:1}` [N]. Keeps `sprintRef` (planning), `type`, `labels`, `ownerId`, `estimatedHours`, `status`, `order`.
2. **Relationships:** parent=Project; optional parent Module (`moduleRef`); optional plan Sprint (`sprintRef`); owns Tasks (`task.featureRef`).
3. **REST endpoints:** [E] `GET /api/features?projectId=&backlog=&sprintId=&type=&status=`, `POST /api/features`, `PATCH /api/features/:id`, `DELETE /api/features/:id`. **[C]** add `moduleId` to query/create/patch; `PATCH { moduleId }` move revalidates same-project; `GET ?moduleId=` filter.
4. **Frontend pages:** [E] `FeaturesPage`, `BacklogPage`. [N] `ModuleDetailPage` (module-scoped feature list), feature drill within Roadmap pages.
5. **Components:** [E] `WorkItemTypeBadge`, feature cards, `CreateFeatureModal`. [C] add module picker to create/move.
6. **Zustand store:** [C] `useCollaborationStore` — `loadFeatures`, `createFeature`, `moveFeature` (existing `moveFeature(featureId, sprintId)` generalizes to `(featureId, moduleId)`); add `moveFeatureModule`.
7. **Selectors:** [C] `moduleSelectors.selectFeaturesByModule`, existing backlog ordering by `order`.
8. **Validation:** [E] zod; same-project sprint; [C] same-project module; enums; bounds (DDS §12.2).
9. **Permissions:** DDS §7 (create/update=editor; delete=Owner/Admin).
10. **Analytics:** [E] feature status distribution; [C] per-module/per-phase feature completion, bug-vs-feature ratios via `type`.
11. **Future AI hooks:** estimation suggestion from historical `actualHours`; task decomposition (DDS §13.1).

### 2.8 Task [E]

1. **Database collection:** `tasks` [E] — `workspaceRef/projectRef/sprintRef/featureRef/assigneeId/reviewerId/followerIds/labels/dependencies/estimatedHours/actualHours/sprintStatus/gitContext` + personal fields + embedded `subtasks[]`.
2. **Relationships:** owned by Feature; assigned to Sprint; depends on Tasks (same project); assigned to Members; tracked by Sessions/WorkLogs.
3. **REST endpoints:** [E] `GET /api/tasks?workspaceId=&projectId=&sprintId=&featureId=`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`, `PATCH /api/tasks/:id/git`, `POST|PATCH|DELETE /:id/subtasks*`. [C] optional `?moduleId=` passthrough if module-grouped task lists are needed server-side.
4. **Frontend pages:** [E] `TodayPage`, `Tasks`, `TaskDetail`, `SprintBoardPage`, `BacklogPage`, `FocusMode`. [N] none required for the spine.
5. **Components:** [E] `SprintBoard`, `TaskCard`, `TaskDetail` sections, `FocusSessionPanel`, `NowStrip` (subtasks x/y). 
6. **Zustand stores:** [E] `useCollaborationStore` (workspace tasks: `loadTasks`, `createTask`, `updateTaskStatus`, `updateGitContext`), `useStore` (personal tasks). [C] none structural.
7. **Selectors:** [E] `todaySelectors`, `continuationSelectors`, `focusSelectors`, `missionControlSelectors.computeAssignedWork`.
8. **Validation:** [E] zod (`taskBase`, `collabCreateFields`); same-project via `resolveTaskScope`; subtasks ≤100.
9. **Permissions:** DDS §7 — editor gate on workspace-scoped tasks (`isWorkspaceEditor`); self for personal.
10. **Analytics:** [E] `totalTime`, velocity from done Tasks, completion rates. [C] module/phase attribution via `featureRef → moduleRef`.
11. **Future AI hooks:** auto-assignment, sprint capacity balancing, dependency suggestion, risk flags (DDS §13.1).

### 2.9 Subtask [E]

1. **Database collection:** `tasks.subtasks[]` embedded (`title`, `completed`, `_id`).
2. **Relationships:** belongs to exactly one Task (leaf of the spine).
3. **REST endpoints:** [E] `POST /api/tasks/:id/subtasks`, `PATCH /api/tasks/:id/subtasks/:subId`, `DELETE /api/tasks/:id/subtasks/:subId`.
4. **Frontend pages:** embedded in `TaskDetail` / `TaskCard` / `NowStrip`.
5. **Components:** [E] subtask checklist row, progress x/y.
6. **Zustand stores:** [E] `useStore.addSubtask/deleteSubtask/toggleSubtask`; workspace tasks carry `subtasks[]` in `CollaborativeTask`.
7. **Selectors:** [E] `focusSelectors` (subtask progress).
8. **Validation:** [E] title ≤200; ≤100 per task.
9. **Permissions:** via owning Task.
10. **Analytics:** [E] completion ratio input to task %.
11. **Future AI hooks:** subtask decomposition; promotion path documented (DDS E2 — no work).

### 2.10 Sprint [E]

1. **Database collection:** `sprints` [E] — `projectRef`, `workspaceRef`, `name`, `goal`, `startDate`, `endDate`, `status` (`future|active|completed`), `capacityHours`, `targetVelocity`, `createdBy`.
2. **Relationships:** parent=Project (execution); references Tasks (`sprintRef`) and Features (`sprintRef`) — owns nothing (DDS §4.11).
3. **REST endpoints:** [E] `GET /api/sprints?projectId=`, `POST /api/sprints`, `PATCH /api/sprints/:id`, `DELETE /api/sprints/:id` (nulls refs).
4. **Frontend pages:** [E] `SprintBoardPage`, `BacklogPage` (project backlog), Mission Control sprint cards.
5. **Components:** [E] `SprintBoard`, velocity/capacity cards, `CreateSprintModal`.
6. **Zustand store:** [E] `useCollaborationStore.loadSprints/createSprint`; `moveFeature` assigns sprint.
7. **Selectors:** [E] `missionControlSelectors.computeSprintVelocity`. [C] sprint burndown (assigned estimate vs done estimate over dates).
8. **Validation:** [E] dates ordered; same-project assignments.
9. **Permissions:** DDS §7.
10. **Analytics:** [C] burndown, capacity utilization (`capacityHours` vs Σ estimates), actual vs target velocity.
11. **Future AI hooks:** capacity-balanced assignment suggestions.

### 2.11 Knowledge Document [N backend]

1. **Database collection:** `knowledgedocs` [N] — `workspaceRef`, `projectRef?`, `title`, `category`, `content`, `authorId`, `version`, `tags[]`, timestamps, `archivedAt?`. Collection created by migration `0015` (createIndex).
2. **Relationships:** scoped to Workspace; optionally scoped to Project; linkable from Tasks/WorkLogs (DDS §4.12).
3. **REST endpoints:** [N] `GET /api/knowledge?workspaceId=&projectId=`, `POST /api/knowledge`, `GET /api/knowledge/:id`, `PATCH /api/knowledge/:id` (increments `version`, snapshots prior content), `DELETE /api/knowledge/:id` (soft archive; Owner/Admin hard delete).
4. **Frontend pages:** [E] `KnowledgePage` (personal), `TeamKnowledgePage` (workspace). [C] project-scoped filtering on `TeamKnowledgePage`.
5. **Components:** [E] doc cards, markdown renderer (`lib/markdown.ts`), editor. [N] `CreateKnowledgeDocModal`, version history panel.
6. **Zustand store:** [N] `useKnowledgeStore` (`loadDocs`, `createDoc`, `updateDoc`, `archiveDoc`) backed by API; replaces mock actions in `useCollaborationStore` (lines `889-920`).
7. **Selectors:** [C] `lib/knowledgeSelectors.ts` — filter by category/tags/project, version diff.
8. **Validation:** [N] zod; title ≤150; category enum; content bounded; `projectRef` must belong to `workspaceRef`.
9. **Permissions:** DDS §4.12 — reads=members; create/edit=editors; archive=editors.
10. **Analytics:** [C] doc freshness, category coverage; knowledge-linked-to-task coverage.
11. **Future AI hooks:** knowledge auto-linking, doc summaries, searchable embedding index (DDS §13.1).

### 2.12 Member [E]

1. **Database collection:** `workspaces.members` (embedded subdocs) — `userId`, `role`, `status`, `teams[]`, `joinedAt`, `currentFocusTask?`, `currentFocusTimeMs?`.
2. **Relationships:** member of Workspace; member of Teams; assignee/reviewer/follower of Tasks; referenced by Project.members.
3. **REST endpoints:** [E] workspace member routes (see 2.1). [N] none structural; project members resolved via `Project.members[]` + workspace membership.
4. **Frontend pages:** [E] `WorkspaceMembersPage`, `MemberProfilePage`. [N] `ProjectMembersPanel` in `ProjectLayout`.
5. **Components:** [E] member cards, role select, status dot.
6. **Zustand store:** [E] `useCollaborationStore.loadMembers/updateMemberRole/updateMemberStatus`.
7. **Selectors:** [E] member availability, team groupings.
8. **Validation:** [E] role/status enums; uniqueness per workspace.
9. **Permissions:** DDS §7.
10. **Analytics:** [E] member focus time, reviews pending. [C] member velocity per project.
11. **Future AI hooks:** availability for auto-assignment; workload balance.

### 2.13 Report [E → C]

1. **Database collection:** none — derived (DDS §4.13). `reportshares` [E] for tokens only.
2. **Relationships:** reads WorkLogs (user), Sessions (user), Tasks (project), Sprints (project), spine rollups.
3. **REST endpoints:** [E] `GET /api/reports/summary`, `GET /api/reports/day`, `POST /api/reports/share`, `POST /share/:token/revoke`, `GET /share/token/:token`, `GET /api/reports/leaderboard`. [N] `GET /api/reports/project/:projectId` (velocity/completion/module-phase rollups).
4. **Frontend pages:** [E] `ReportsPage` (personal), `ReportsAnalyticsPage` (project). [C] project report adds Roadmap rollups.
5. **Components:** [E] report cards, KPI walls, charts. [C] module/phase breakdown charts.
6. **Zustand stores:** [E] `useWorkLogStore` provides inputs; reports are selector-derived. [C] `useReportsStore` only if pagination/export needs state.
7. **Selectors:** [E] `lib/reportsSelectors.ts`, `lib/reportsAnalyticsSelectors.ts`. [C] roadmap rollup selectors.
8. **Validation:** [E] share-token zod; date ranges.
9. **Permissions:** personal=self; project=members; share=public-by-token.
10. **Analytics:** [C] velocity trend, completion rate, effort by module/phase/type, burndown.
11. **Future AI hooks:** narrative report summaries (DDS §13.1).

### 2.14 Insight [E → C]

1. **Database collection:** none — derived from WorkLogs/Sessions/Tasks/Habits.
2. **Relationships:** reads personal stack + (future) team data.
3. **REST endpoints:** [E] none dedicated (consumes worklog/task/session endpoints). [N] none required.
4. **Frontend pages:** [E] `InsightsPage`, `PersonalActivityPage`, Today/weekly surfaces.
5. **Components:** [E] insight cards, pattern charts. [C] team insights (member velocity, module health) — gated to Leader+.
6. **Zustand stores:** [E] `useStore`/`useWorkLogStore` inputs; insights are pure selector outputs (`lib/insightsSelectors.ts`).
7. **Selectors:** [E] `insightsSelectors` (daily/weekly/task/knowledge insights), `nowSelectors`, `memorySelectors`. [C] team insight selectors.
8. **Validation:** [E] n/a (derived).
9. **Permissions:** [C] team insights require member (developer+) or Leader+ for org rollups.
10. **Analytics:** [C] focus quality, consistency, workload balance, module health trends.
11. **Future AI hooks:** pattern language → narrative insights; prediction (DDS §13.1).

---

## 3. Project Structure

Preserves current conventions (no `controllers/`/`services/` churn); new folders added only where a real seam exists.

### 3.1 Server — `mainApp/server/`

```
server/
  index.js                 [E] route mounting point
  server.js                [E] bootstrap
  models/                  [E]
    Workspace.js Project.js Team.js Feature.js Sprint.js Task.js
    Milestone.js           [N]   Phase.js [N]   Module.js [N]
    KnowledgeDoc.js        [N]
    WorkLog.js Session.js Journal.js Habit.js Activity.js Notification.js ReportShare.js User.js  [E]
  routes/                  [E]  (one file per resource)
    workspaces.js projects.js teams.js features.js sprints.js tasks.js
    milestones.js [N]   phases.js [N]   modules.js [N]   knowledge.js [N]
    reports.js workLogs.js sessions.js journals.js habits.js search.js
    notifications.js profile.js auth.js admin.js
  middleware/              [E]
    auth.js workspace.js (gates + resolveProjectWorkspace) admin.js csrf.js
    rateLimit.js securityHeaders.js errorHandler.js health.js
  validators/              [N]  extracted zod schemas (currently inline per route);
                              move to shared modules only when reused across routes
  utils/                   [E]  validation.js patchSanitizer.js googleDrive.js worklogSync.js
                              dates.js logger.js ...  (+ services/ if Execution Engine needs
                              a long-lived process seam later — documented, not created)
  migrations/              [E]  core.js run.js migrations/NNNN_*.js
  jobs/                    [E]  reaper.js (future: sprint auto-complete job)
  __tests__/               [E]
```

### 3.2 Client — `mainApp/src/`

```
src/
  App.tsx                 [E] route tree (ProjectLayout added)
  pages/
    TodayPage Tasks TaskDetail FocusMode WorkLog Journal Knowledge Reports
    InsightsPage Habits Settings WorkspaceHub TeamProjects ...
    collaboration/
      ProjectLayout.tsx        [N]
      RoadmapPage.tsx          [N]   MilestoneDetailPage.tsx [N]
      PhaseDetailPage.tsx      [N]   ModuleDetailPage.tsx [N]
      ProjectInfoPage.tsx      [N]   ProjectMembersPanel (page or component) [N]
      ProjectSettingsPage.tsx  [N]
      TeamWorkspace SprintBoardPage BacklogPage FeaturesPage QADashboardPage
      ActivityFeedPage ReportsAnalyticsPage TeamKnowledgePage BlockersPage
      WorkspaceProjectsPage ProjectOverviewPage ProjectTimelinePage
      WorkspaceTeamsPage WorkspaceMembersPage MemberProfilePage
      WorkspaceSettingsPage
    admin/                  [E]
  components/
    ui/ layout/ auth/        [E] AppLayout AdminLayout WorkspaceLayout
    collaboration/          [E] CreateProjectModal + CreateSprint/Feature/Task modals
                            [N] CreateMilestoneModal CreatePhaseModal CreateModuleModal CreateKnowledgeDocModal
    now/ focus/ continuation/ worklog/ memory/ knowledge/ reports/ tasks/ timeline/  [E]
  hooks/                    [E] useActiveTimer useNotifications
  store/                    [E]
    useCollaborationStore.ts [C] + milestones/phases/modules/project-meta/knowledge
    useKnowledgeStore.ts    [N]
    useStore.ts useProjectStore.ts useWorkLogStore.ts useAuthStore.ts ...  [E]
  lib/  (pure selectors + kpis)   [E]
    roadmapSelectors.ts     [N]   moduleSelectors.ts [N]
    missionControlSelectors collaborationKpis projectOverviewSelectors
    projectTimelineSelectors todaySelectors continuationSelectors focusSelectors
    memorySelectors nowSelectors insightsSelectors reportsSelectors
    knowledgeSelectors collaborationActivity timelineSelectors dataMapper markdown
  types/                    [E] collaboration.ts [C] index.ts
  utils/                    [E] api.ts [C] navigation.ts
  __tests__/                [E]
```

---

## 4. Navigation & Shell

### 4.1 Navigation tree (top-down, per IA layer)

```
GLOBAL SHELL            Top bar: workspace switcher · search/Cmd+K · notifications · profile
                        Now strip: current task · session clock · subtasks x/y · branch/PR
L1 PERSONAL             Today · Tasks · Focus · Work Log · Journal · Knowledge · Reports | Habits · Settings
L2 PROJECT (per project)
  Overview · Roadmap · Sprints · Backlog · Features · Knowledge · Members · Reports · Settings
L3 WORKSPACE ADMIN      Workspace Home · Projects · Teams · Members · Settings · Audit
HUB / ORG               /hub switcher · /team TeamProjects · /workspace admin selector
```

### 4.2 Route tree

```
/                            Landing (auth)
/hub /team                   Workspace hub
/w/:workspaceId              WorkspaceLayout (L3 rails)
   /projects                 WorkspaceProjectsPage
   /projects/:projectId      ProjectLayout [N]  (L2 rails)
       (index)               ProjectInfoPage [N]
       roadmap               RoadmapPage [N]
       roadmap/:milestoneId  MilestoneDetailPage [N]
       phases/:phaseId       PhaseDetailPage [N]
       modules/:moduleId     ModuleDetailPage [N]
       sprints               SprintBoardPage
       backlog               BacklogPage
       features              FeaturesPage
       knowledge             TeamKnowledgePage (project-scoped) [C]
       members               ProjectMembersPage [N]
       reports               ReportsAnalyticsPage
       settings              ProjectSettingsPage [N]
   /teams /members /settings/activity /qa /blockers /calendar /reports   (existing workspace rails)
/dashboard /tasks/:id /worklog(/:id) /knowledge /journal /focus /reports /insights /habits /settings  (L1, existing)
/admin/*                      (existing)
```

### 4.3 Sidebar hierarchy

- **WorkspaceLayout sidebar (L2+L3):** group `Delivery` (Overview · Sprint · Backlog · Features · Reviews · Blockers · Activity) → group `Administration` (Projects · Teams · Members · Settings · Audit). Existing grouping pattern retained.
- **ProjectLayout sidebar (L2 project, [N]):** `Structure` (Overview · Roadmap) · `Delivery` (Sprints · Backlog · Features) · `Support` (Knowledge · Members) · `Reports` (Reports) · `Settings`. Role-aware: Roadmap/Settings visible per DDS §7.
- **AppLayout sidebar (L1):** Today · Tasks · Focus · Work Log · Journal · Knowledge · Reports | Habits · Settings.

### 4.4 Breadcrumb hierarchy

`Workspace › Project › Milestone › Phase › Module › Feature › Task › Session › Work Log`
Implemented by `ContextBreadcrumbs` [N] reading the active spine from the store; every segment clickable up. In ProjectLayout, breadcrumb starts at Project.

### 4.5 Modal hierarchy

| Modal | Opens from | Entity | Status |
|---|---|---|---|
| CreateWorkspace / CreateTeam / InviteMember | workspace rails | Workspace/Member | [E] |
| CreateProject | Workspace rails, hub | Project | [E] |
| CreateMilestone / CreatePhase / CreateModule | Roadmap detail pages | Spine | [N] |
| CreateFeature / CreateSprint / CreateTask | Features/Backlog/Sprint surfaces | Feature/Sprint/Task | [E] |
| CreateKnowledgeDoc | Knowledge page | KnowledgeDoc | [N] |
| ConfirmDelete | any spine entity | delete flow | [E] generalize |

Modal layering: quick actions are surface-scoped (IA §3) — never global.

### 4.6 Drawer hierarchy

- **Task detail drawer** [E pattern → C]: edit fields, subtasks, git context, assignee/reviewer — reusable across sprint board, backlog, roadmap, Today.
- **Work Log master/detail** [E] merged surface.
- **Filter drawer** [N] on Features/Backlog/Modules (status/type/owner/labels/module).
- **Knowledge version drawer** [N].

### 4.7 Command Palette actions

`GlobalCommandPalette` [E] extended:
- Navigate: any route in §4.2.
- Jump: workspace → project → milestone → phase → module → feature → task by id/title (search-backed).
- Quick actions: New Task/Feature/Sprint/Milestone/Phase/Module/Doc; Resume task; Start Focus.
- These mirror the per-surface quick actions — palette is the global duplicate, surfaces keep their own.

### 4.8 Search indexing strategy

- **Server (`routes/search.js`) [E]:** facets `project|team|member|task|worklog|workspace`. [C] add `feature|milestone|phase|module|sprint|knowledge` facets; scoped by `workspaceRef`; membership-gated.
- **Indexing:** text indexes on title/name fields; workspace-scoped query filters; keyset pagination. Knowledge docs indexed by title+content (content indexed only for member-gated queries).
- **Client palette index [E]:** in-memory index of loaded stores for instant jump; server search for full results page.
- **Consistency:** palette mirrors server facets; a facet is only added once its store is server-backed.

---

## 5. User Journeys

### 5.1 Developer
```
Today (resume) → Current Task → Subtasks → Focus (session) → Work Log (timeline/decisions)
   → Journal → Reports (personal) → Insights (patterns)
```
Relevant routes: `/dashboard`, `/tasks/:id`, `/focus`, `/worklog`, `/journal`, `/reports`, `/insights`. Stores: `useStore`, `useWorkLogStore`, `useActiveTimer`. Selectors: `todaySelectors`, `continuationSelectors`, `focusSelectors`, `nowSelectors`, `insightsSelectors`.

### 5.2 Team Lead
```
Sprint → Backlog → Features → Members → Reports
```
Routes: `/w/:id/sprints`, `/w/:id/backlog`, `/w/:id/features`, `/w/:id/projects/:projectId/members`, `/w/:id/reports`. Stores: `useCollaborationStore`. Selectors: `missionControlSelectors`, `collaborationKpis`.

### 5.3 Project Manager
```
Roadmap → Milestones → Phases → Modules → Sprint Planning → Reports
```
Routes: `/w/:id/projects/:projectId/roadmap`, `.../roadmap/:milestoneId`, `.../phases/:phaseId`, `.../modules/:moduleId`, `.../sprints`, `.../reports`. Stores: `useCollaborationStore` (spine), selectors: `roadmapSelectors`, `moduleSelectors`, sprint velocity.

### 5.4 Workspace Admin
```
Workspace → Projects → Members → Teams → Settings
```
Routes: `/w/:id/projects`, `/w/:id/members`, `/w/:id/teams`, `/w/:id/settings`. DDS §7 Owner/Admin gates.

### 5.5 System Admin
```
Platform → Users → Roles → Audit → System Health
```
Routes: `/admin/people`, `/admin/teams`, `/admin/audit`, `/admin/settings`, health metrics (`middleware/health.js`). Platform admin has no implicit workspace membership (DDS §4.1).

---

## 6. Dependency Analysis

### 6.1 Dependency graph
```
Foundation ─► Database (models+migrations) ─► Backend (routes+gates)
     │                     │                        │
     ▼                     ▼                        ▼
ProjectLayout shell ◄── Frontend (types/api/store) ◄─┘
     │
     ├──► Roadmap pages (Milestone→Phase→Module UI)
     ├──► Execution Engine (Sprint/Backlog/Task planning — reuse existing)
     ├──► Knowledge Base (independent workstream)
     └──► Reports ──► Insights ──► AI Companion (sequential, derived)
```

### 6.2 Implementation order (canonical sequence)
1. Foundation → 2. Database → 3. Backend → 4. Frontend shell+routes → 5. Execution Engine → 6. Personal Intelligence → 7. Reports → 8. Insights → 9. AI Companion. (Detailed per-phase acceptance in §7.)

### 6.3 High-risk modules
- **Spine migrations** (`0012/0013`): backfilling embedded `projects.milestones[]` → `milestones` collection; forward-only rollback.
- **Project Info persistence** (new `GET/PATCH /projects/:id`): currently a "no route" gap; must not regress `sync-drive`.
- **Same-project ref integrity** at 3 new levels (Milestone/Phase/Module) — validation must generalize `validateSprintForProject` correctly.
- **Permission gates on new routes** — a mis-gated route leaks another project's data.
- **Reports accuracy** — rollups must stay single-source (P12).

### 6.4 Reusable modules
- `middleware/workspace.js` gates (`requireWorkspace*`, `resolveProjectWorkspace`, `scopeToWorkspace`).
- `utils/validation.js` + zod patterns (`nullableRef`, `objectId`, `dateInput`).
- `useCollaborationStore` loader/action pattern + `runMutation` optimistic updates.
- `api.ts` typed-client pattern; `navigation.ts`; UI kit (`components/ui/*`); `WorkspaceLayout` sidebar pattern; pure-selector `lib/` conventions.

### 6.5 Independent modules (build in parallel)
- Knowledge Base (§2.11), Reports (§2.13), Insights (§2.14), AI hooks (§13), Search facets.

### 6.6 Blocking modules
- `ProjectLayout` shell blocks all L2 project routes.
- Milestone/Phase/Module backend blocks Roadmap UI.
- `GET/PATCH /projects/:id` blocks Project Info + Project Settings + project-member persistence.

### 6.7 Future extension points
From DDS §13 (E1–E8): Epics, Subtask-as-entity, Organization, soft archive, Project Settings growth, batch reorder, aggregate endpoint, KnowledgeDoc versioning. Each is additive and designed not to rewrite.

---

## 7. Implementation Phases

### Phase 1 — Foundation
- **Goal:** Establish the conventions, tooling, and gates the whole build runs on; zero product risk.
- **Deliverables:** Verified test/typecheck/build gates (`npx vitest run` server+client, `npx tsc --noEmit`, `npm run build`); route/component naming conventions pinned to this blueprint; `ProjectLayout` scaffolding decision recorded; role/gate vocabulary checklist.
- **Dependencies:** none.
- **Acceptance Criteria:** baseline suites green (server 430, client 684 at blueprint time); new-file template matches §3 layout; no behavior change.
- **Estimated complexity:** S.
- **Risk:** Low.

### Phase 2 — Database
- **Goal:** Materialize the spine and knowledge schema with zero-downtime additive migrations.
- **Deliverables:** `server/models/Milestone.js`, `Phase.js`, `Module.js`, `KnowledgeDoc.js`; `Feature.moduleRef` + index; `Project.settings`; migrations `0012` (collections+indexes), `0013` (embedded milestones → `milestones`), `0014` (moduleRef backfill guard), `0015` (knowledgedocs index); model tests.
- **Dependencies:** Phase 1.
- **Acceptance Criteria:** migrations idempotent (`--dry-run` then `--apply`); `0013` round-trips embedded milestone data (name/date/status/order preserved); legacy `projects.milestones` still readable; personal docs untouched.
- **Estimated complexity:** S.
- **Risk:** Medium (data backfill is forward-only).

### Phase 3 — Backend
- **Goal:** Expose the spine and close the Project Info gap through gated routes.
- **Deliverables:** `routes/milestones.js`, `phases.js`, `modules.js`; `features.js` `moduleId` support + `validateParentForProject`; `projects.js` `GET/:id` + `PATCH/:id`; `routes/knowledge.js`; mount in `server/index.js`; route + permission + invariant tests.
- **Dependencies:** Phase 2.
- **Acceptance Criteria:** all new endpoints pass member/editor/OwnerAdmin gates (DDS §7); same-project refs enforced at 3 levels; delete nulls child refs; `PATCH /projects/:id` persists meta and validates member/team refs; `sync-drive` unaffected.
- **Estimated complexity:** M.
- **Risk:** High (permissions + ref integrity surface).

### Phase 4 — Frontend
- **Goal:** Ship the project context shell and Roadmap drill-down on real APIs.
- **Deliverables:** `ProjectLayout` + route tree (§4.2); `types/collaboration.ts` additions; `api.ts` clients; `useCollaborationStore` spine loaders/actions; `roadmapSelectors.ts`, `moduleSelectors.ts`; `RoadmapPage`, `MilestoneDetailPage`, `PhaseDetailPage`, `ModuleDetailPage`, `ProjectInfoPage`, `ProjectMembersPage`, `ProjectSettingsPage`; `ContextBreadcrumbs`.
- **Dependencies:** Phase 3.
- **Acceptance Criteria:** routes render server data; breadcrumb spine clickable; role-aware sidebar; `PATCH` flows optimistic with rollback; existing pages keep URLs/deep links.
- **Estimated complexity:** L.
- **Risk:** Medium.

### Phase 5 — Execution Engine
- **Goal:** Make Sprint Planning and Backlog the daily delivery surface, wired to the spine.
- **Deliverables:** Sprint board/backlog wiring to `Feature.moduleRef`; feature module picker + `moveFeatureModule`; sprint burndown/capacity selectors; task board-status flow end-to-end (Backlog→Sprint→Done); `?moduleId=` task/feature filters if needed; execution-flow tests.
- **Dependencies:** Phase 4 (reuses existing sprint/task routes).
- **Acceptance Criteria:** assign/unassign sprint keeps feature ownership (DDS BR-1/BR-7); capacity vs Σ estimates; one active sprint per project advisory; no cross-project assignments.
- **Estimated complexity:** M.
- **Risk:** Medium.

### Phase 6 — Personal Intelligence
- **Goal:** Consolidate the developer's continuity loop (Today → Current Task → Focus → Work Log → Journal → Knowledge).
- **Deliverables:** personal `KnowledgePage` on the real Knowledge API; Now-strip consistency; continuation/memory selectors verified against real data; knowledge linking rules (DDS §4.12) UI (link Task/WorkLog ↔ doc).
- **Dependencies:** Phase 4 (Knowledge backend is Phase 3, independent).
- **Acceptance Criteria:** resume-from-Today path end-to-end; knowledge docs versioned and linkable; personal stack byte-identical semantics.
- **Estimated complexity:** M.
- **Risk:** Low.

### Phase 7 — Reports
- **Goal:** Single-source derived reporting across personal and project scopes.
- **Deliverables:** `GET /api/reports/project/:projectId`; module/phase/type rollups; ReportsAnalyticsPage additions; burndown + velocity trends; share-token reuse.
- **Dependencies:** Phases 4–5 (data sources), Phase 6 (personal reports).
- **Acceptance Criteria:** rollups match per-page KPIs exactly (P12); no stored aggregates; share tokens still gated.
- **Estimated complexity:** M.
- **Risk:** Medium (accuracy).

### Phase 8 — Insights
- **Goal:** Team + personal insight surfaces derived from the same source data.
- **Deliverables:** team insight selectors (member velocity, module health, workload balance); InsightsPage extension; role-gated org rollups (Leader+).
- **Dependencies:** Phase 7.
- **Acceptance Criteria:** insight values trace to underlying entities; permission-gated; performance acceptable on project-scale data.
- **Estimated complexity:** M.
- **Risk:** Low.

### Phase 9 — AI Companion
- **Goal:** Add the documented AI touchpoints on top of stable derived views (DDS §13.1).
- **Deliverables:** estimation suggestions; task decomposition drafts; roadmap auto-planning; sprint capacity suggestions; risk flags; knowledge auto-linking; narrative report summaries; palette ranking.
- **Dependencies:** Phases 7–8 (derived views + permission model).
- **Acceptance Criteria:** every AI read goes through member-gated views; outputs are suggestions (never auto-committed); measurable adoption on at least two touchpoints.
- **Estimated complexity:** L.
- **Risk:** High (scope + quality + privacy).

---

## 8. Phase-by-phase traceback (guardrail)

| Phase | Consumes | Produces for |
|---|---|---|
| 1 | — | 2,3,4 |
| 2 | 1 | 3 |
| 3 | 2 | 4,5,7 |
| 4 | 3 | 5,6,7 |
| 5 | 4 | 7,8 |
| 6 | 4 | 7 |
| 7 | 4,5,6 | 8 |
| 8 | 7 | 9 |
| 9 | 7,8 | — |

Every deliverable in §2 has an owning phase; every phase has a §2 deliverable. Nothing in the blueprint is unreachable, and nothing is blocked by an earlier phase's optional work.
