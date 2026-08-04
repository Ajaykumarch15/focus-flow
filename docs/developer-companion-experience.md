# ARK — Developer Companion Experience (DCX)

Source of truth: [`docs/engineering-companion-phase1.md`](engineering-companion-phase1.md) — **approved; do not redesign the philosophy.**
Status: **UX blueprint — no code.**
Scope guardrails (locked):
- Do **NOT** redesign the backend, database, or existing models.
- Do **NOT** introduce new APIs.
- Do **NOT** generate implementation code.
- Every designed surface must compose existing stores, endpoints, and UI components.
- Reuse is the default; a redesign is only re-presentation of existing data.

This document defines exactly how a developer experiences ARK across a full workday, the surfaces that deliver it, the memory that powers it, and the Phase 2 priorities that build it — without rebuilding the engine.

---

## 1. Daily User Journey

The complete arc, 09:00 → 18:00. Each step names the existing module/surface it composes; nothing new is invented.

### 09:00 — Login → Companion Welcome
- ARK greets the developer with **"Today"** (composed from `Dashboard` + `Task`/`Session`/`WorkLog` state + `activeTaskId`/`activeTimerState`).
- It answers, before any click: **What was I doing? What should I continue? What needs attention?**
- Three zones, in order of prominence: **Continue** (yesterday's open task + its work log + branch/PR), **Today's focus** (due tasks, subtask remainder), **Attention** (open blockers, pending reviews, expiring deadlines).

### 09:15 — Resume Yesterday
- One tap on "Resume" (the active/paused session) reopens the exact continuity stack: **Task → Focus shell → Work Log → git branch/PR**.
- If yesterday's session was paused, the timer resumes from its existing session (reuse `Session` pause-log; `currentPauseStart`). If the task changed, ARK surfaces "You were on X — resume or pick up Y?" without blocking.

### 09:30 — Today's Focus
- "Today" shows the 1–3 tasks that matter (deadline, priority, remaining subtasks, sprint commitment).
- Developer taps one → enters **Current Task** context (reuse `TaskDetail`).

### 10:00–12:30 — Working
- **Current Task**: title, description, subtask checklist ("what remains"), session timer, git branch/PR badge, "where I stopped" line (last timeline entry), one-tap **Focus**.
- **Subtasks**: checkable; completion is recorded (reuse embedded `Subtask[]`).
- **Focus session**: full-screen shell (reuse `FocusMode`) — timer, pause/resume, task context, silent ambient UI.
- **Pause / Resume**: single keystroke / button; timer continuity preserved; a context capture prompt appears only on *intentional* pause, never during flow.

### 12:30 — Lunch (context switching)
- ARK detects/accepts a long pause → marks session as **paused**, not abandoned.
- On return, "Today" reads: "Before lunch you were on **Build completion UI** — 2h 10m tracked, 1 subtask left." One tap resumes.

### 13:30–17:30 — Working, with Context Capture
- **Blockers**: inline "I'm stuck" capture (reuse blocker item in Work Log + `CentralBlocker` for team visibility). Captured at the moment of the blocker, not at end of day.
- **Engineering decisions**: inline decision card (reuse `decisionSchema` in Work Log) — context/decision/alternatives/rationale. This is KNOWLEDGE at capture time.
- **Work Log**: the working document — timeline entries auto-captured from timer events (reuse `timelineEntries`), progress snapshots, links, completed items.
- **Knowledge**: decisions and lessons are searchable immediately (reuse `search` + command palette).

### 17:30 — Completion → Reflection
- Task → done. ARK asks one lightweight reflection (reuse `reflection` + `Journal`): what went well, what slowed you, what did you learn.
- Completed item is logged (reuse `completedItems`); knowledge is captured; the loop closes.

### 17:45 — Reports & Tomorrow Plan
- "Today at a glance" (reuse reports `summary`/`day`, personal `Analytics`): time by task, focus score, blockers resolved.
- **Tomorrow Plan** (reuse `tomorrowPlan`): top priority + unfinished items + attention required — ARK seeds it from today's unfinished work.

### 18:00 — Logout
- Nothing to save manually; state is continuous (timer persisted via `timerPersist`, sessions server-side, work log live).

---

## 2. Developer Workflow

The recurring loop ARK is built around — each arc is small and self-contained:

```
Choose → Focus → Pause → Capture → Resume → Complete → Reflect → (next)
```

- **Choose** — Today/Continue surfaces make the next task obvious.
- **Focus** — one tap; flow protected; ambient UI only.
- **Pause/Resume** — timer continuity; context preserved.
- **Capture** — blockers and decisions recorded at the moment (never after the fact).
- **Complete** — subtasks checked, task closed.
- **Reflect** — light reflection; knowledge + tomorrow plan updated.
- Loop repeats with zero context reconstruction.

The secondary workflow (team/context):

```
Mission Control (today + sprint + reviews + blockers + health)
    → Sprint board / Project Backlog / Features
    → Task → session → work log → reflection
```

Both loops compose the *same* task/session/worklog spine, so personal and team views stay consistent.

---

## 3. Companion Surfaces

Every surface's single responsibility. **Responsibilities only — not implemented here.**

| Surface | Purpose | Composes (existing) |
|---|---|---|
| **Today** (homepage) | Answers only: what should I do now, what should I continue, what needs attention | `Dashboard`, active task, session, deadlines, blockers, reviews |
| **Continue Working** | One-tap resume of the last continuity stack (task + session + work log + branch/PR) | `TaskDetail`, `FocusMode`, `WorkLog`, `gitRef` |
| **Current Task** | Everything about the task in progress: subtasks, timer, branch/PR, "where I stopped", decisions, discussions | `TaskDetail`, `Subtask[]`, `TimerSession[]`, `gitContext`, discussions |
| **Focus** | Full-screen deep-work shell; ambient; pause/resume; capture on intentional pause | `FocusMode`, session client |
| **Current Session** | The live clock + pause log + focus score; the continuity source | `Session`, `TimerSession`, focus score |
| **Work Log (Engineering Memory)** | The timeline of the day; where I stopped; decisions ledger; blockers; snapshots; lessons | `WorkLog` full schema, `timelineEntries`, `decisions`, `blockerList`, `progressSnapshots` |
| **Journal** | Free-form reflection and mood/focus rating per task | `Journal` |
| **Knowledge** | Searchable decisions, lessons, docs, links | Knowledge docs, decisions, `search`, `GlobalCommandPalette` |
| **Search** | Cross-context recall (task, work log, project, member, doc) | `search` routes, `SearchResultsPage` |
| **Notifications** | Quiet, batchable, non-interruptive; never during focus | `Notification` |
| **Mission Control** | The workspace companion landing: today, current sprint, reviews, blockers, health | `TeamWorkspace` Mission Control (already built) |
| **Sprint / Features / Backlog** | The context of *what team work* your task belongs to | Sprint board, `FeaturesPage`, `ProjectBacklog` |
| **Reports / Analytics** | Retrospective and planning; time, velocity, completion | `ReportsAnalyticsPage`, personal `Reports`/`Analytics` |

Rules for all surfaces:
- Project administration never appears above current work.
- No surface asks "which project?" before showing "what are you working on?"
- Every surface exposes a single **Resume** affordance when a continuation exists.

---

## 4. "Now" State Model

ARK derives a live **Now** answer at all times. It is a *derived view* over existing store state — no new model.

| Question | Answer (derived from) |
|---|---|
| What am I doing? | `activeTaskId`, `activeTimerState`, current work-log `status`/`currentWork` |
| What was I doing? | latest work-log `timelineEntries[-1]`, last session `endTime`, `progressSnapshots[-1]`, last completed item |
| What is next? | subtask remainder, `tomorrowPlan.topPriority`, sprint commitment, due tasks |
| What is blocking me? | `blockerList` open items, `CentralBlocker` open items, task `dependencies` |
| What changed? | activity feed (workspace), timeline entries, notifications diff since last visit |
| Where did I stop? | active/paused session state, work-log status, `gitRef.branch`/`prNumber`, last snapshot text |

**The Now strip.** A persistent, compact rail (always reachable from any surface) rendering:
`Current task · session clock (running/paused) · subtask x/y · branch/PR · last snapshot`. It is the answer to all six questions in one glance and is the anchor of the entire companion.

Rule: **Now is never manually maintained.** It is composed from state that already exists; the developer only ever acts on it.

---

## 5. Context Memory Model

What ARK remembers, and how it enters the system. Three tiers.

### 5.1 Automatically remembered (existing capture)
| Memory | Source |
|---|---|
| Current task / status | Task `status`, `activeTaskId` |
| Running timer / paused session | Session `isActive`, pause-log, `activeTimerState` |
| Session time (exact) | Session `activeTime`, `totalPauseDuration`, `pauseCount` |
| Work timeline | Work Log `timelineEntries` (auto from timer) |
| Where I stopped | Work Log `status`, `currentWork`, last `progressSnapshot` |
| Branch / PR / commits | Work Log `gitRef` + task `gitContext` |
| Focus score | Session `focusScore` |
| Time by day | Work Log `workEntries[]` |

### 5.2 User-entered (captured inline)
| Memory | Source |
|---|---|
| Blockers | Work Log `blockerList` (inline capture) + `CentralBlocker` for team |
| Engineering decisions | Work Log `decisions[]` (inline card) |
| Progress snapshots | Work Log `progressSnapshots[]` |
| Completed items | Work Log `completedItems[]` |
| Reflection + mood | Work Log `reflection`, `moodMetrics`, `Journal` |
| Tomorrow plan | Work Log `tomorrowPlan` |
| Links / attachments | Work Log `links[]`, `attachments[]` |

### 5.3 Future intelligent suggestions (Phase 4, documentation only)
- Predicted resume ("continue where you left off") from session + branch history.
- Suggested blockers from repeated stuck states.
- Auto-decisions from timeline + git commits.
- "What changed since last visit" digest.

Design rule: **everything auto-captured stays invisible until it answers a Now question; user-entered content is captured at the moment of the work, not at end of day.**

---

## 6. Resume Experience

Goal: the developer should *never* ask "where did I stop?" — ARK answers it first.

### 6.1 Resume entry points
1. **Today → Continue card** (primary): shows the last open task + session time + branch/PR + one-tap resume.
2. **Now strip → Resume** (always present when a continuation exists).
3. **Focus shell resume**: reopens the exact task + running/paused session.
4. **Command palette**: type `/` → "continue" → pick from recent open tasks/work logs.

### 6.2 Resume contract
- One tap restores **task + session + work log + git context** in the correct surface.
- If the session was paused, it resumes the *same* session (time preserved).
- If multiple continuations exist, ARK shows a short ranked list (active > paused > most recent), never a wall.
- If the context changed externally (new sprint, task reassigned), ARK says so in one line, then resumes anyway.

### 6.3 Anti-patterns (never)
- "Where were we?" prompts that require the developer to reconstruct context.
- Resume that dumps the developer into a generic dashboard.
- A session that silently dies and forces a fresh start.

---

## 7. Context Switching Strategy

ARK minimizes cognitive load across every switch.

| Event | ARK behavior |
|---|---|
| **Switch tasks** | Current session preserved as-is (paused or stopped on switch); "You were on X" mini-state; new task opens fresh but carries context (branch/PR if same feature). |
| **Change sprint** | Mission Control highlights the active sprint; tasks re-grouped; current feature/branch shown against the new sprint. No data moves silently. |
| **Move project** | Projects are context; switching project re-frames the sidebar/breadcrumb but Today/Continue stay identical (they follow the developer, not the project). |
| **Lunch / long pause** | Session marked **paused** (never abandoned); on return, Today reads the stop point explicitly. |
| **End of day** | Tomorrow Plan seeded from unfinished work; state continuous; nothing to reconstruct. |
| **Return after days** | "What changed" digest (activity, notifications, sprint status, PR updates); the last open task is front and center. |
| **Return after weeks** | Context collapses to *evidence*: last work log + decisions + knowledge + the project/sprint it belonged to. ARK shows where the thread ended and what progressed since. |

Rule: **context belongs to the developer, not the container.** Switching projects/sprints never destroys the thread; it re-frames it.

---

## 8. Timeline Experience

The core workflow, made visible:

```
Task
 ↓  (sessions attach)
Session            → pause-log, focus score, active time
 ↓  (events captured)
Timeline           → timer_start/pause/resume/stop, notes, snapshots
 ↓  (structured)
Work Log           → currentWork, blockers, decisions, completed items, links
 ↓  (closed loop)
Reflection         → went well / slowed / learned / rating + mood
 ↓  (knowledge + reporting)
Knowledge          → decisions, lessons, searchable
Reports            → time, focus, velocity, completion
```

### 8.1 Presentation
- **Work Log as the day's spine.** A timeline view (existing `WorkLog` entries) where each session is a block, each capture is a node, and "where I stopped" is the highlighted last node.
- **Task detail** shows its own sub-timeline (subtasks + sessions + captures) so a task tells its story.
- **Reports** aggregate the spines (personal `summary`/`day`; workspace velocity from done-task hours).

### 8.2 Continuity guarantee
Every node links both directions: session → its task → its work log → its reflection → its knowledge. Clicking any node moves along the spine without losing context.

---

## 9. Knowledge Capture Strategy

Knowledge is a **by-product of work**, captured in the moment, surfaced later.

### 9.1 Capture moments
| Moment | Capture | Reuse |
|---|---|---|
| Hitting a wall | Blocker card (inline) | `blockerList` / `CentralBlocker` |
| Making a call | Decision card (context/decision/alternatives/rationale) | `decisions[]` |
| Progress point | Snapshot | `progressSnapshots[]` |
| Finishing a chunk | Completed item | `completedItems[]` |
| Ending the day | Reflection + lessons learned | `reflection`, `Journal` |

### 9.2 Surfacing
- Decisions + lessons become **searchable knowledge** immediately (reuse `search` + `GlobalCommandPalette`).
- Knowledge docs remain the long-form layer; work-log captures are the implicit layer.
- Workspace: decisions on shared features surface in Mission Control / Features so teams inherit engineering context.

### 9.3 Design rule
Capture UI appears **at the moment of the work**, in context (Focus shell, Task detail, Work Log) — never as an end-of-day form.

---

## 10. Homepage Philosophy

The homepage is **Today**, and it answers exactly three questions, in exactly this order:

1. **What should I do now?** — the 1–3 tasks that matter (deadline, priority, sprint commitment, remaining subtasks).
2. **What should I continue?** — the last open thread with a one-tap resume (task + session + work log + branch/PR).
3. **What needs attention?** — open blockers, pending reviews, expiring deadlines, "what changed" digest.

**Explicitly excluded from Today:** project administration, workspace management, team roster management, metrics walls. Those live in their own sections (Mission Control, Settings, Teams), one step deeper.

Layout order (prominence = time-sensitivity):
`Continue` → `Do now` → `Attention` → (quietly) `Today's capture summary`.

---

## 11. UX Principles

| Principle | How it affects UI |
|---|---|
| **Calm** | Quiet surfaces; subdued colors; ambient data; no blinking metrics. One primary action per screen. |
| **Helpful before asked** | Now answers six questions before the developer asks; Resume affordance on every surface with a continuation. |
| **Reliable** | Time is never lost: sessions pause (not abandon), state is server-persisted, rollback is safe. Numbers are honest (show "—", never fabricate). |
| **Quiet** | No interrupts during focus; notifications batch; capture prompts appear only on intentional pauses. |
| **Always available** | Now strip + command palette reachable from every surface; resume survives refresh/logout. |
| **Never overwhelming** | Progressive disclosure: auto-captured context is invisible until it answers a question; at most 3 things in a "do now" list. |
| **Continuous** | Nothing requires reconstruction; every screen links to the task/session/worklog spine. |
| **Reuse-first** | New UI composes existing stores, models, endpoints, and components (per Phase 1). |

---

## 12. Information Hierarchy

Prominence tiers across the product (frequency/salience, not importance).

1. **Always present, one glance:** Now strip (current task, session clock, subtask x/y, branch/PR) — `TaskDetail`/Focus/header.
2. **Primary view:** Today (Continue / Do now / Attention) — the homepage.
3. **Work surfaces:** Current Task → Focus → Work Log → Journal.
4. **Team context:** Mission Control → Sprint board → Features/Backlog → Blockers → Reviews → Activity.
5. **Recall:** Knowledge → Search → Calendar.
6. **Retrospective:** Reports / Analytics.
7. **Administration (de-emphasized):** Workspace/Team/Member management, Settings, admin suite.

Rules:
- Tier 1–3 follow the **developer**; Tier 4–7 follow the **context**.
- No administration UI outranks current work on any screen.
- Mission Control and Today share the same "current work" spine so the personal and team views never disagree.

---

## 13. Future AI Opportunities (documentation only)

- **Predictive resume**: "continue where you left off" from session + branch + commit history.
- **Auto decision ledger**: extract decisions from timeline + git commits into `decisions[]`.
- **Stuck-state detection**: repeated patterns → suggested blocker + escalation to Mission Control.
- **"What changed" digest**: daily/weekly continuity summaries.
- **Team flow intelligence**: cycle-time, handoff, and review-pressure insights (extends `ReportsAnalyticsPage`).
- **Companion Q&A**: natural-language recall over the developer's own memory (tasks, sessions, work logs, knowledge).

All are **presentation/intelligence over existing data** — no new underlying data model required to start.

---

## 14. Phase 2 Implementation Priorities

Reuse-first, no backend/API/model changes. Each item independently testable and shippable; server test suite must stay green throughout.

| # | Priority | Deliverable | Composes (existing) | Pure work |
|---|---|---|---|---|
| 1 | P1 | **Today homepage** (Continue / Do now / Attention) | `Dashboard`, `Task`, `Session`, deadlines, `WorkLog`, blockers | `selectToday(store)` pure helpers + tests |
| 2 | P1 | **Now strip** (persistent context rail) | `activeTaskId`, `activeTimerState`, session, `gitRef`/`gitContext` | `deriveNow(state)` pure helper + tests |
| 3 | P1 | **One-tap Resume** (Today → task + session + work log + branch/PR) | `TaskDetail`, `FocusMode`, `WorkLog`, session client | resume intent resolver + tests |
| 4 | P2 | **Focus shell capture** (inline blocker/decision on intentional pause) | `FocusMode`, `blockerList`, `decisions[]`, `CentralBlocker` | capture intent helpers |
| 5 | P2 | **Work Log as Engineering Memory** ("where I stopped", decisions, lessons) | `WorkLog` schema, timeline view | memory selectors + tests |
| 6 | P2 | **Mission Control tune** (lead with Today + resume + running timer) | `TeamWorkspace` Mission Control (already built) | pure dashboard helpers |
| 7 | P2 | **Command-palette-first resume/navigate** | `GlobalCommandPalette`, `search` | recent-continuation index (client-side) |
| 8 | P3 | **Return-digest** (what changed after days/weeks) | activity, notifications, sprint/PR state | digest composition + tests |
| 9 | P3 | **Tomorrow Plan seeding** | `tomorrowPlan`, unfinished work | plan seeds + tests |

Ordering rationale: P1 establishes the companion core (Today + Now + Resume) on top of *existing* state with zero structural change; P2 deepens capture and memory; P3 handles multi-day continuity. Every step is a re-presentation of data the system already records.
