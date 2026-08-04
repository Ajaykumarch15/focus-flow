# ARK → Engineering Companion — Phase 1 Foundation

Status: **Strategy only — no code.**  
Scope guardrails (locked):
- Do **NOT** redesign the backend.
- Do **NOT** add AI.
- Do **NOT** add new database models.
- Do **NOT** introduce new APIs.
- Maximize reuse of the existing FocusFlow / ARK architecture.
- This document establishes the Engineering Companion foundation; Phase 2 implementation follows a separate roadmap.

Companion thesis: instead of asking "What project are you managing?", ARK asks **"What are you working on right now?"** — and remembers everything needed to keep that answer continuous.

---

## 1. Engineering Companion Vision

ARK's job is no longer to organize work. It is to **preserve engineering continuity** — to act as a memory and a guide that sits alongside the developer all day, the way a good pair programmer does.

The companion commits to five behaviors:

1. **It remembers.** Active task, active session, where the timer stopped, the last work-log entry, the current sprint, the current feature, open blockers, recent decisions, the git branch and PR the developer was on.
2. **It never asks you to reconstruct context.** Logging in and seeing "what was I doing yesterday?" is a product failure. ARK surfaces it.
3. **It protects flow.** Sessions, timers, focus mode, and pause/resume are first-class; nothing interrupts deep work to nag about project administration.
4. **It captures knowledge implicitly.** Decisions, blockers, progress snapshots, and reflections already exist in Work Logs — ARK treats them as the engineering memory, not as paperwork.
5. **It prioritizes current work over administration.** Projects are context (the environment), never the homepage.

Design rule for every future screen: if a page is asking "which project?" before answering "what are you working on now?", it is backwards.

---

## 2. Existing Architecture Mapping

Ground truth from the codebase (server models → client stores/types → pages).

### 2.1 Personal workspace (the individual companion core)

| Module | Model / Source | What it holds today | Pages |
|---|---|---|---|
| Tasks | `Task` + embedded `Subtask` | title, description, priority, status (`todo/active/paused/completed`), category, deadline, reminders, subtasks, embedded `TimerSession[]`, `totalTime`, tags, color | `/tasks`, `/tasks/:id` |
| Sessions / Timer | `Session` (`pauseLog`, `activeTime`, `focusScore`, `isActive`, `lastHeartbeat`, `clientOpId`) | continuous work blocks with exact pause tracking; client-side `activeTimerState`, `currentSessionStart`, `currentPauseStart`; timer persistence util | `/focus`, TaskDetail timer |
| Work Logs | `WorkLog` | the richest object in the system: `problemFlow` (problem/investigation/rootCause/solution/lessonsLearned), `decisions[]`, `blockerList[]`, `progressSnapshots[]`, `completedItems[]`, `timelineEntries[]` (auto-captured timer events), `links[]`, `attachments[]`, `workEntries[]` (per-day time), `tomorrowPlan`, `reflection`, `moodMetrics`, `gitRef` (repo/branch/commits/PR/issue), status `planning|in-progress|reviewing|blocked|done` | `/worklog`, `/worklog/:id` |
| Journal | `Journal` | free-form notes + `mood` + `focusRating`, optionally linked to a task | `/journal` |
| Habits | `Habit` | daily habits / streaks | `/habits` |
| Reports & Analytics | `reports` routes (`summary`, `day`, `share/token`, `leaderboard`) | time reports, shared reports, leaderboard | `/reports`, `/analytics`, `/leaderboard`, `/reports/share/...` |
| Focus Mode | `FocusMode` page | full-screen session shell (timer, pauses, focus score) | `/focus` |
| Dashboard | `Dashboard` | personal landing | `/dashboard` |
| Search | `search` routes | cross-facet results (workspaces, projects, tasks, worklogs, members, teams) | `/search`, command palette |

### 2.2 Collaboration workspace (the team context)

| Module | Model / Source | What it holds today | Pages |
|---|---|---|---|
| Workspaces | `Workspace` | identity, type, membersCount, projectsCount, settings (invites, review gate, timer sync, visibility) | Hub, workspace layout |
| Members / Teams | `WorkspaceMember`, `WorkspaceTeam` | roster, roles, presence/focus status, team membership | members, teams, admin |
| Projects | `Project` + `milestones[]` | name, key, repo URL, status, members, teams, milestones (title/dueDate/targetPoints) | `/w/:id/projects` |
| Sprints | `Sprint` | name, dates, goal, status (`future/active/completed`), capacityHours, targetVelocity | `/w/:id/sprints` |
| Features | `Feature` | type, labels, owner, estimatedHours, status (`backlog→done`), `order`; `sprintRef` null = Project Backlog | `/w/:id/features`, Project Backlog |
| Collaborative Tasks | `Task` (extended) | `sprintStatus`, priority, assignee/reviewer/follower, labels, dependencies, `gitContext` (branch/PR/review/merge/deploy), subtasks, hours | Sprint board, Mission Control |
| Blockers | `CentralBlocker` | severity, status, impact, owner/reporter | Blockers tab |
| Docs | `KnowledgeDoc` | title, category, markdown content, version, tags, author | Knowledge Base |
| Calendar | `TeamCalendarEvent` | sprints, releases, milestones, leave, focus blocks | Calendar |
| Activity | `Activity` | workspace-scoped, keyset-paginated feed | `/w/:id/activity`, Mission Control |
| Discussions | comments on tasks/docs | threaded comments, reactions, mentions, resolution | Discussions modal |
| Notifications | `Notification` | assigned/mention/blocker/review/sprint events | header bell |
| Reports & Analytics | workspace report routes | velocity (derived from done-task hours), feature completion, KPIs, export | `/w/:id/reports`, `/w/:id/analytics` |
| QA | task-level checks | QA dashboard over collaborative tasks | `/w/:id/qa` |

### 2.2.1 Data flow (existing, keep)

Client stores: `useStore` (personal), `useAuthStore`, `useCollaborationStore` (workspace graph via `loadCollabData`), all Zustand with optimistic `runMutation` + rollback. Workspace hierarchy is composed client-side from existing endpoints (workspaces → members/teams/projects → sprints/features/tasks). **Phase 2 composes these same endpoints; no new API.**

---

## 3. Product Pillars

Six pillars. Every module maps to exactly one primary pillar (secondary mappings noted in §5).

### 3.1 REMEMBER — "ARK knows where I am."
The companion stores and reconstructs engineering context: the active task, the running session, the last work log and its timeline, the current sprint + feature, open blockers, the git branch/PR, recent decisions, and lessons learned. **Context is the product's memory.**

### 3.2 RESUME — "ARK gets me back in one tap."
Continuity flows: log in → see today's work → resume yesterday's session → continue the active task → re-open the exact work log / branch / PR. Mission Control and the command palette are the resume surfaces.

### 3.3 FOCUS — "ARK protects deep work."
Timers, sessions, pause/resume, focus score, full-screen focus mode, and streak preservation. No administration interrupts flow; the companion is ambient until asked.

### 3.4 REFLECT — "ARK helps me close the loop."
Journal, daily reflection + mood metrics, progress snapshots, completed items, tomorrow plan, reports and analytics. Completing a task ends with a reflection and captured knowledge, never with silence.

### 3.5 COLLABORATE — "ARK helps my team continue too."
Sprints, features, collaborative tasks, blockers, reviews, discussions, activity, notifications. Team context is the environment in which individual continuity happens.

### 3.6 KNOWLEDGE — "ARK keeps what we learned."
Knowledge docs, technical decisions, lessons learned, links, git refs, calendar events, search. Knowledge is captured *during* work (work-log decisions) and made searchable, not written after the fact.

---

## 4. Companion Workflow

The ideal day, end-to-end (all steps composed from existing modules):

```
Morning
  Login
    → Companion Landing "Today": active task, running session, yesterday's stop point
    → "Resume session" (one tap) re-opens Task + Work Log + git context
    → Continue active task
Work loop (repeated)
  Focus / Pause / Resume (timer keeps continuity; flow protected)
  Blockers captured inline → surface in team Mission Control
  Decisions captured inline → become KNOWLEDGE
Complete
  Task → done
  → End-of-task reflection (journal / work-log reflection)
  → Completed item logged, tomorrow plan updated
End of day
  → Review, reflect, knowledge captured
  → Everything continuous; nothing reconstructed tomorrow
```

The single product invariant: **at any moment, ARK can answer "what am I doing, where did I stop, and what's next?" from data it already has.**

---

## 5. Current Feature Mapping

Legend: **Core** = pillar-critical companion surface · **Supporting** = enhances but non-critical · **Admin** = administrative · **Future** = roadmap, no current UI.

| Feature / Module | Pillar | Tier | Phase 2 role |
|---|---|---|---|
| Active task + status | REMEMBER | Core | Continue surface, auto-resume |
| Timer / Sessions / pause-log | FOCUS | Core | Continuity clock; session resume |
| Work Log (timeline, decisions, blockers, snapshots, tomorrow plan, reflection, gitRef) | REMEMBER / KNOWLEDGE | Core | Engineering memory; "where I stopped" |
| Journal | REFLECT | Core | End-of-task reflection |
| Focus Mode | FOCUS | Core | Companion focus shell |
| Mission Control (TeamWorkspace) | RESUME / REMEMBER | Core | Workspace companion landing (already built) |
| Command palette + Search | RESUME | Core | Default companion interface |
| Blockers (personal + CentralBlocker) | COLLABORATE / REMEMBER | Core | Inline capture → team surface |
| Subtasks | REMEMBER | Core | "What remains" checklist |
| Collaborative Task gitContext (branch/PR) | REMEMBER | Core | Resume the exact code state |
| Current Sprint / Feature | REMEMBER / RESUME | Core | Context header + board |
| Projects (as context) | COLLABORATE | Supporting | Breadcrumb, not homepage |
| Knowledge Docs | KNOWLEDGE | Supporting | Searchable capture |
| Discussions | COLLABORATE | Supporting | Async continuation |
| Activity feed | REMEMBER | Supporting | Team continuity |
| Notifications | COLLABORATE | Supporting | Passive interrupts (must stay quiet) |
| Reports / Analytics (personal + workspace) | REFLECT | Supporting | Retrospective & planning |
| Habits / streaks / Leaderboard | FOCUS | Supporting | Motivation layer |
| Calendar | KNOWLEDGE | Supporting | Plan context |
| QA Dashboard | COLLABORATE | Supporting | Quality gate |
| Workspace / Team / Member management | — | Admin | Administration, not homepage |
| Workspace settings, personal settings, admin suite | — | Admin | Administration |
| Automatic decision capture → AI summaries | KNOWLEDGE | Future | Phase 4 |
| Predictive resume ("continue where you left off") | RESUME | Future | Phase 4 |
| Team flow intelligence / cycle-time AI | REFLECT | Future | Phase 4 |

---

## 6. UX Transformation Strategy

Principles (each mapped to existing surfaces):

1. **Context-first landing.** The default screen after login answers "what am I working on now?" — not "which project?" Personal Dashboard and workspace Mission Control both converge on: Today's work + Resume + Current sprint/feature/task/session + Blockers.
2. **Projects become breadcrumbs, not homes.** Project name renders as contextual metadata on the work surface (task/work-log/sprint). Administration stays one click deep.
3. **The command palette is the companion.** `/` or `Cmd+K` becomes the primary resume/continue interface: continue task, resume session, open work log, jump to PR, search knowledge.
4. **Continuity rails.** A persistent "Now" strip (active task + running session + branch/PR + stop point) available from every work surface.
5. **Capture is ambient.** Decisions/blockers/snapshots are already captured in Work Logs from timer events — surface them as knowledge instead of hiding them as data entry.
6. **Flow is sacred.** No interruptive administration in focus mode; notifications and metrics stay silent until asked.
7. **Mission Control as team continuation.** The already-built Mission Control dashboard becomes the workspace companion landing (today's tasks, running timer, blockers, reviews, sprint progress, health).
8. **Reflection closes every loop.** Completing a task always ends with an optional quick reflection + knowledge capture.

Navigation target IA (composed from existing routes, no new modules):

- Companion: Today (Resume) · Focus · Work Log (Memory) · Journal · Knowledge · Search
- Context: active Sprint · Features · Tasks · Blockers
- Team: Mission Control · Projects · Reports/Analytics · Activity · Calendar
- Administration: Settings (workspace & personal) · Members/Teams/QA — deeper, de-emphasized

---

## 7. Existing Components to Reuse

Identified in the codebase; Phase 2 uses these as-is or with pure-wrapper only.

**Design system**
- `ui/Card`, `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Spinner`, `ToastContainer`, `ErrorBoundary`, motion variants (150–250 ms), `MotionConfig reducedMotion`.

**Personal companion machinery**
- Timer engine: `activeTimerState` / `currentSessionStart` / `currentPauseStart`, `timerPersist` util, session client (start/pause/resume/stop), server session reaper, focus-score computation.
- Work Log engine: `WorkLog` full schema (timeline, decisions, blockers, snapshots, completed items, reflection, mood metrics, tomorrow plan, gitRef) + `worklogLimits` pruning.
- Report engine: `summary` / `day` / share-token / leaderboard routes and page components.
- Journal, Habits, Focus Mode shell, Task detail timer integration.

**Collaboration machinery**
- Mission Control dashboard (TeamWorkspace default tab) with pure helpers (`computeSprintVelocity`, `computeAssignedWork`, `computePendingReviews`, `computeUpcomingDeadlines`, `computeWorkspaceProgress`).
- Grouped sidebar `WorkspaceLayout` (identity block, grouped nav, Mission Control label), `AppLayout`.
- Sprint board (5-column kanban), `ProjectBacklog` (drag into sprints), `WorkItemTypeBadge`, `FeaturesPage`.
- Create modals: `CreateProjectModal`, `CreateSprintModal`, `CreateTaskModal`, `CreateFeatureModal`, `CreateBlockerModal`, `CreateDocModal`.
- Reports/Analytics page, activity feed (`activityActionLabel`/`activityDetail`), Discussions modal, Notifications, blocker board, calendar, docs.
- Command palette `GlobalCommandPalette`, `SearchResultsPage`, `SearchResultItem` normalization.
- Store patterns: Zustand + `runMutation` optimistic/rollback, `loadCollabData` composition, `useAuthStore`.

---

## 8. Components That Need Redesign

Redesign = re-presentation of existing data, **not** new models/APIs.

1. **Personal Dashboard → "Today / Continue" landing.** From metric cards to companion landing: active task, running session, resume-yesterday, upcoming deadlines, open blockers, reflection prompt.
2. **AppLayout navigation → companion-first IA** (Today, Focus, Work Log, Journal, Knowledge, then Reports/Habits/Settings).
3. **FocusMode → Companion focus shell.** Full-screen work surface: task + subtask progress + session timer + inline blocker/decision capture + end-of-session reflection prompt.
4. **TaskDetail → Continuation view.** Resume session, jump to the task's work log, show where work stopped (last timeline entry, branch/PR), subtask checklist.
5. **WorkLog → Engineering Memory.** Rebrand/reorder around "where I stopped" + decision ledger + lessons learned; keep the entire schema.
6. **Workspace Hub → Companion switcher.** "Where are we working?" not a project manager home.
7. **Command palette → default companion surface** for resume/continue/navigate/search (reuse existing component).
8. **Mission Control (minor)** — already built; tune to always lead with Today's work + resume + running timer, project admin de-emphasized.

---

## 9. Future Roadmap

- **Phase 2 — Continuity foundation (next).** Context-first landing, resume flows, Work Log as engineering memory, Mission Control as workspace companion landing. Pure client-side composition of existing endpoints. No backend changes.
- **Phase 3 — Collaboration continuity.** Cross-link personal sessions/work logs to sprint features and tasks; decisions surface in team knowledge; blocker flows; review queues surfaced in Mission Control; sprint progress wired to live work.
- **Phase 4 — Knowledge & intelligence.** Automatic decision/lesson capture surfaced as searchable knowledge; predictive resume ("continue where you left off"); team flow intelligence and cycle-time insights; eventual AI summarization (out of scope here).
- **Phase 5 — Ecosystem.** Deep git/PR integration, editor/IDE presence, mobile companion.

---

## 10. Implementation Strategy for Phase 2

Constraints: reuse-only, no backend redesign, no new models/APIs, code only where UI re-presentation requires it.

1. **Sequencing (small, testable steps):**
   - T1: Personal "Today / Continue" landing composed from existing store state (`activeTaskId`, running session, latest work log, today's entries) + pure helpers + unit tests.
   - T2: "Resume session" flow (one tap reopens task + work log + focus shell) reusing timer engine and existing pages.
   - T3: Work Log → Engineering Memory presentation (where I stopped, decisions, lessons) with pure selectors + tests.
   - T4: Focus shell enhancements (inline blocker/decision capture, reflection prompt on complete) reusing existing modals.
   - T5: Mission Control tune-up to lead with Today/resume/running timer; sidebar IA already grouped.
   - T6: Command-palette-first resume/navigate polish.
2. **Verification per task:** typecheck (`npm run typecheck`), frontend tests (`npm test`), server tests (`npx vitest run` in `mainApp/server`) — server suite must remain green because backend is untouched.
3. **Reuse contract:** any new UI must consume the existing Zustand stores, existing UI kit, and existing endpoints; pure computation extracted as exported helpers with tests (pattern: `computeSprintVelocity`, Mission Control helpers).
4. **Rollback posture:** each task independently shippable; no migration, no schema change, no new route.
5. **Out of scope reminders:** AI, new models, new APIs, backend redesign — all Phase 4+.
