# FocusFlow — Workspace Product Specification (WPS)

**Product Name:** FocusFlow
**Document Type:** Workspace Product Specification (WPS)
**Supersedes:** N/A — expands §6, §7, §9, §10, §11 of the FocusFlow PRD (v1.0)
**Source of Truth:** FocusFlow Product Requirements Document (PRD v1.0)
**Audience:** Product Managers, Founders, Designers, Software Architects, Frontend/Backend Engineers, QA Engineers, Investors
**Status:** Draft v1.1
**Scope:** Complete product specification of the collaborative **Workspace** environment only. This document intentionally contains **no** React code, APIs, database schemas, MongoDB models, or backend architecture.

---

## Table of Contents

1. [Workspace Vision](#1-workspace-vision)
2. [Workspace Information Architecture](#2-workspace-information-architecture)
3. [Workspace Navigation](#3-workspace-navigation)
   - 3.6 [Workspace Templates](#36-workspace-templates)
4. [Workspace Hierarchy](#4-workspace-hierarchy)
5. [Roles & Permissions](#5-roles--permissions)
6. [Team Management](#6-team-management)
7. [Member Management](#7-member-management)
8. [Project Management](#8-project-management)
   - 8.5 [Project Templates](#85-project-templates)
   - 8.6 [Releases](#86-releases)
9. [Sprint Management](#9-sprint-management)
10. [Feature Management](#10-feature-management)
    - 10.4 [Feature Templates](#104-feature-templates)
    - 10.5 [Feature Health](#105-feature-health)
    - 10.6 [Feature Dependency Graph](#106-feature-dependency-graph)
11. [Live Collaboration](#11-live-collaboration)
    - 11.5 [Mission Control](#115-mission-control)
12. [Dashboards](#12-dashboards)
    - 12.8 [Stakeholder Dashboard](#128-stakeholder-dashboard)
    - 12.9 [Workspace Overview](#129-workspace-overview)
13. [Notifications](#13-notifications)
14. [Search](#14-search)
15. [Future Integrations](#15-future-integrations)
    - 15.3 [Integration Marketplace](#153-integration-marketplace)
16. [User Journeys](#16-user-journeys)
17. [UX Principles](#17-ux-principles)
    - 17.1 [Workspace Branding](#171-workspace-branding)
18. [Future Evolution](#18-future-evolution)
    - 18.1 [Evolution Roadmap](#181-evolution-roadmap)

---

## 1. Workspace Vision

### 1.1 Mission

The Workspace is the collaborative heart of FocusFlow. Its mission is to let engineering teams plan, execute, review, and report on software delivery **without friction** — while every developer retains a fully private Personal Workspace for their own tasks, sessions, logs, and journal.

The Workspace exists to answer three questions without a single status meeting:

1. **Managers:** *What has actually been delivered, and what is at risk?*
2. **Developers:** *What should I work on next, and what does my work contribute to?*
3. **QA:** *What is ready to test, and is the release ready to ship?*

### 1.2 Goals

| Goal | Description |
|---|---|
| **Plan with evidence** | Sprint and feature planning informed by real session-derived history, not guesswork. |
| **Collaborate without status updates** | Progress, blockers, and activity surfaces automatically from work the team already does. |
| **Protect developer privacy** | Personal tasks, sessions, logs, and journals stay private; only feature-linked work rolls up into team visibility. |
| **Make QA first-class** | QA is a visible stage in the delivery pipeline with its own queue, dashboard, and sign-off authority. |
| **Documentation next to work** | Knowledge Base, feature docs, and project docs live where the work lives. |
| **Zero-report reporting** | Reports, standups, burndowns, and progress summaries generate themselves. |

### 1.3 Principles

1. **Evidence over self-report.** Every progress number traces back to a session, a status change, or a committed work item — never to a remembered guess.
2. **Structure is workspace-owned; work is developer-owned.** The Workspace owns projects, teams, sprints, features, docs, and reports. Developers own their tasks, sessions, logs, and journals.
3. **Automation first.** Timelines, reports, activity feeds, and progress are generated. Manual input is reserved for *intent* (what's next, what's learned).
4. **Aggregation without exposure.** The Workspace sees *what* a developer contributed to a feature — never *how* they personally spent every minute outside it.
5. **Reduce meetings.** Every workflow is designed to remove a status meeting, not add a report field.
6. **Velocity of use.** Fewer clicks than the alternatives. The tool must be faster than opening a chat and asking "how's it going?"
7. **Stay anti-Jira.** No process theater: no mandatory fields, no drag-and-drop ceremonies, no multi-hour sprint admin.

### 1.4 Success Metrics

| Metric | Definition | Target |
|---|---|---|
| Team activation | % of workspace members active weekly | ≥ 60% |
| Automation rate | % of work-log/report entries auto-generated | ≥ 70% |
| Manual status updates | Avg. status touch-points per developer per week | ≤ 2 |
| Report generation | Team reports generated per workspace per week | ≥ 1 |
| Velocity accuracy | ±% of estimate vs. actual across completed features | ≤ 20% |
| Feature cycle time | Median time from feature creation to Done | Trending down |
| QA turnaround | Median time in QA per feature | Trending down |
| Notification relevance | % of notifications acted on (click-through) | ≥ 40% |
| Time-to-first-sprint | New workspace to first active sprint | ≤ 1 day |
| Performance | p95 interaction / full dashboard load | < 150 ms / < 1.5 s |

### 1.5 Non-goals (v1)

- No chat/messaging threads (Notifications only; discussions happen in comments on features/docs).
- No code hosting, PR review pipeline, or CI/CD execution (designed-for via future integrations only).
- No replacement for design tools, spreadsheets, or a full bug tracker (inline bug *references* only).
- No custom role builder, IP allow-lists, or enterprise SSO in v1.
- No cross-workspace aggregation (each Workspace is an isolated boundary).
- No Kanban-as-a-service generic board; the Sprint Board is sprint-oriented in v1.

### 1.6 How Workspace Differs from Traditional PM Tools

| Dimension | Jira / ClickUp / Asana | FocusFlow Workspace |
|---|---|---|
| Source of progress | Developer updates fields | Real sessions + status changes |
| Reporting | Manual report builder | Auto-generated from evidence |
| Standups | Separate ritual | Read the dashboard |
| Developer UX | Form-heavy, ceremony | Keyboard-first, minimal clicks |
| Privacy | Everything visible by default | Private personal layer, aggregated team layer |
| Docs | Wiki bolted on | Markdown KB beside the work |
| QA | Custom status field | First-class lane with sign-off authority |
| Velocity | Requires disciplined estimation | History-derived estimates, auto-calibrated |

---

## 2. Workspace Information Architecture

### 2.1 Entity Catalog

Every entity in the Workspace, its purpose, ownership, visibility, and lifecycle.

| Entity | Definition | Owned By | Visible To | Lifecycle |
|---|---|---|---|---|
| **Workspace** | Top-level collaborative container (a team environment like "Startup," "Internship," "Company"). | Workspace Owner | Invited members only | Active → Archived → Deleted |
| **Member** | A user who belongs to the Workspace with exactly one role. | Workspace Owner / Admins | Members (roster); limited for Viewers | Invited → Active → Suspended → Removed |
| **Role** | Capability set bound to a Member within the Workspace (Owner, Admin, PM, Leader, Developer, QA, Viewer). | Workspace Owner | Members (their own role) | Static preset in v1 |
| **Team** | An assignment/permission unit grouping members, scoped to projects and features. | Workspace | Scoped members | Active → Archived → Deleted |
| **Project** | The top-level delivery container; holds sprints, features, docs, milestones, and reports. | Workspace | Members with project scope | Backlog → Active → On Hold → Archived |
| **Sprint** | A time-boxed delivery cycle inside a project, containing features and a goal. | Project | Scoped members | Backlog → Planning → Active → Review → Retrospective → Completed |
| **Feature** | The central unit of engineering work — a bounded, testable slice assigned to a developer. | Sprint / Project | Scoped members | Backlog → In Development → In QA → Approved → Done (with rejected path) |
| **Task** | A personal (or feature-linked) work item owned by a developer. | Developer | Private (feature-linked subset visible) | Todo → In Progress → Done |
| **Session** | A recorded block of focus work produced by the timer. | Developer | Private; only time-summary rolls up if feature-linked | Active → Completed / Discarded |
| **Work Log** | Daily record of sessions + manual entries; report fuel. | Developer | Private; reportable | Daily entry → historical archive |
| **Report** | Auto-generated summary scoped to feature/sprint/project/team/personal. | Scope owner | Owner-controlled sharing (read-only links) | Generated on demand / scheduled |
| **Knowledge Base doc** | Markdown documentation (ADRs, runbooks, onboarding, project docs). | Workspace | By permission | Draft → Published → Archived |
| **Calendar entry** | Time-block context: sprints, deadlines, milestones, focus blocks. | Scope owner | Scoped members | Event → history |
| **Milestone** | A notable date-bound checkpoint on a project. | Project | Scoped members | Planned → Achieved → Missed |
| **Bug reference** | A lightweight pointer to a bug/issue attached to a feature. | QA / Developer | Scoped members | Open → Resolved / Verified |
| **Activity event** | An immutable, timestamped record of what happened in the Workspace. | System | By permission (full audit for Admins/Owner) | Immutable |
| **Notification** | A delivered, actionable signal derived from an Activity event. | System | Target member | Unread → Read → Dismissed |

### 2.2 Relationships

```
Workspace
  ├── has many Members ── has one Role each
  ├── owns many Teams ── Teams contain Members (many-to-many)
  ├── owns many Projects
  │     ├── Projects contain Sprints
  │     │     └── Sprints contain Features
  │     │           ├── Features link to Members (assignees)
  │     │           ├── Features link to Tasks (developer-side)
  │     │           ├── Features link to Sessions (feature-linked)
  │     │           ├── Features link to Bug references
  │     │           └── Features link to KB docs
  │     ├── Projects link to Teams (scope)
  │     ├── Projects contain Milestones
  │     ├── Projects link to KB docs (documentation)
  │     └── Projects produce Reports
  ├── owns Knowledge Base (docs + hierarchy)
  ├── has a Calendar (sprints, milestones, focus blocks)
  ├── emits Activity (all mutations)
  └── derives Reports, Analytics, Notifications from Activity
```

### 2.3 Object Ownership

| Object | Owned By | Notes |
|---|---|---|
| Workspace, Projects, Teams, Sprints, Features, KB, Reports, Calendar | **Workspace** | Structural objects; members hold delegated capability via roles |
| Tasks, Sessions, Work Logs, Journal | **Developer** | Private by default; feature-linked time rolls up as aggregate only |
| Activity events, Derived metrics | **System** | Generated; immutable |

### 2.4 Visibility Rules

1. **Workspace-scoped:** Everything is visible to members within the Workspace boundary, filtered by project/team scope and role.
2. **Privacy boundary:** Personal tasks, private sessions, logs, and journal are never visible to any member — including Admins — unless the developer explicitly links a session to a team feature.
3. **Viewer boundary:** Viewers see designated read-only reports/projects, not the member directory or private data.
4. **Audit boundary:** Admins and Owner see the full activity/audit trail; other roles see activity scoped to what they can access.

### 2.5 Lifecycle Rules

- **Create:** Creator becomes owner of the object within the Workspace hierarchy.
- **Mutate:** Edits logged as Activity events with actor + timestamp.
- **Archive:** Objects move to archived state (read-only, searchable, restorable) rather than deletion, preserving history.
- **Delete:** Permanent deletion is Owner-only, always confirmation-gated, and cascade-aware (children are archived first).

---

## 3. Workspace Navigation

### 3.1 Global Shell (contextual chrome)

Every Workspace page shares:

- **Top bar:** Workspace switcher (opens Hub), command palette (`Ctrl/Cmd + K`), global search, notifications bell (badge count), live timer ticker, member avatar → profile/settings/logout.
- **Sidebar:** Workspace-scoped primary navigation; collapse to icons; keyboard-navigable; role-aware (Admin/PM items only for those roles).
- **Breadcrumb:** `Workspace → Project → Sprint → Feature` on deep pages.

### 3.2 Sidebar Navigation Map

```
Workspace (Team)
├── Overview
├── Dashboard
├── Projects
│   └── Project Detail
│       ├── Overview
│       ├── Sprints
│       ├── Features
│       ├── Milestones
│       ├── Knowledge Base
│       ├── Reports
│       └── Settings (role-gated)
├── Sprint Board
├── Features
│   └── Feature Detail
│       ├── Overview
│       ├── Docs
│       ├── Tasks
│       ├── QA
│       ├── Reports
│       └── Activity
├── Knowledge Base
├── Calendar
├── Teams
│   └── Team Detail
│       ├── Overview
│       ├── Members
│       ├── Sprints
│       ├── Reports
│       └── Analytics
├── Members
├── Reports
├── Analytics
└── Activity
```

### 3.3 Admin Navigation (role-gated)

```
Admin
├── Overview
├── Members
├── Teams
├── Permissions & Roles
├── Workspace Settings
├── Integrations (future)
├── Billing (future)
└── Audit Log
```

### 3.4 Page Specifications

For every primary page: **Purpose · Target User · Entry Points · Primary Actions · Navigation Flow · Exit Flow.**

#### 3.4.1 Workspace Overview

- **Purpose:** The first screen after entering a workspace — identity, orientation, and what to do next.
- **Target User:** All members (content adapts by role).
- **Entry Points:** Default landing after workspace selection; top-bar logo; sidebar "Overview."
- **Primary Actions:** Open Dashboard, jump to a project/sprint, read announcements, view milestones, generate a report, quick-start a session.
- **Navigation Flow:** Overview cards → Project/Sprint/Team detail; Dashboard for today's operational health.
- **Exit Flow:** Sidebar; workspace switcher to another workspace.
- **Full spec:** see §12.9.

#### 3.4.2 Workspace Dashboard

- **Purpose:** Live health of all ongoing delivery across projects, sprints, and teams — today's operational view.
- **Target User:** All members (content adapts by role).
- **Entry Points:** Sidebar "Dashboard"; Overview "Open Dashboard" action.
- **Primary Actions:** Open sprint board, jump to at-risk feature, assign/unblock, generate report, invite members, start a session against a feature.
- **Navigation Flow:** Drill into Project → Sprint → Feature; jump to Member profile; open report.
- **Exit Flow:** Sidebar to any module; breadcrumb to project; workspace switcher to another workspace.
- **Full spec:** see §12.1.

#### 3.4.3 Projects (list + detail)

- **Purpose:** Portfolio overview and per-project container.
- **Target User:** Leaders, PMs, Admins; Developers/QA read their scoped projects.
- **Entry Points:** Sidebar "Projects"; dashboard project cards.
- **Primary Actions:** Create project, open project, archive, edit settings, generate project report.
- **Navigation Flow:** Project list → Project Detail (Overview/Sprints/Features/Milestones/KB/Reports).
- **Exit Flow:** Breadcrumb to Workspace; back to project list.

#### 3.4.4 Sprint Board

- **Purpose:** The delivery control surface: backlog, planning, active work, review, QA, done.
- **Target User:** Leaders, Developers, QA, PMs.
- **Entry Points:** Sidebar "Sprint Board"; project → Sprints; dashboard sprint progress.
- **Primary Actions:** Create/start/complete sprint; drag features between lanes; assign; re-estimate; view burndown; open retrospective.
- **Navigation Flow:** Board lane → Feature detail; board header → sprint analytics/report.
- **Exit Flow:** Sidebar; breadcrumb to project; back to dashboard.

#### 3.4.5 Features (list + detail)

- **Purpose:** Browse and manage all features across sprints; the central object surface.
- **Target User:** All members.
- **Entry Points:** Sidebar "Features"; board; project → Features; notifications.
- **Primary Actions:** Create feature, filter/sort, open feature detail, link docs, assign.
- **Navigation Flow:** Feature list → Feature Detail (Overview/Docs/Tasks/QA/Reports/Activity).
- **Exit Flow:** Sidebar; breadcrumb; back to board/project.

#### 3.4.6 Knowledge Base

- **Purpose:** Living engineering documentation.
- **Target User:** All members (edit by permission).
- **Entry Points:** Sidebar "Knowledge Base"; feature/project → Docs tabs.
- **Primary Actions:** Create/Edit/Archive doc, organize folders, tag, search, comment, link to features/projects.
- **Navigation Flow:** KB tree → doc detail → linked feature/project.
- **Exit Flow:** Sidebar; breadcrumb to workspace.

#### 3.4.7 Calendar

- **Purpose:** Time context: sprints, milestones, deadlines, focus blocks.
- **Target User:** Developers, Leaders, PMs.
- **Entry Points:** Sidebar "Calendar"; dashboard upcoming-deadline strip.
- **Primary Actions:** Week/month toggle, create focus block, jump to sprint/milestone, view per-day work.
- **Navigation Flow:** Day → sprint/feature detail; day → personal daily report.
- **Exit Flow:** Sidebar.

#### 3.4.8 Teams

- **Purpose:** Manage team groups, leaders, members, and scoped delivery.
- **Target User:** Admins, Leaders; all members read their teams.
- **Entry Points:** Sidebar "Teams"; Admin panel; member profile.
- **Primary Actions:** Create/archive/delete team, assign/remove members, assign leader, view team dashboard/reports/analytics.
- **Navigation Flow:** Team list → Team Detail (Overview/Members/Sprints/Reports/Analytics).
- **Exit Flow:** Sidebar.

#### 3.4.9 Members

- **Purpose:** Workspace roster and member management.
- **Target User:** Admins/Owner manage; others read scoped rosters.
- **Entry Points:** Sidebar "Members"; Admin panel; avatar presence hover.
- **Primary Actions:** Invite, change role, suspend/remove, open member profile, transfer ownership (Owner).
- **Navigation Flow:** Member list → Member Profile.
- **Exit Flow:** Sidebar.

#### 3.4.10 Reports

- **Purpose:** One-stop for every auto-generated report.
- **Target User:** Leaders, PMs, QA, Developers (scoped), Viewers (shared links).
- **Entry Points:** Sidebar "Reports"; dashboard shortcuts; feature/sprint/project report tabs.
- **Primary Actions:** Pick scope + period, generate, share read-only link, export, schedule.
- **Navigation Flow:** Report list → Report detail → drill into data points.
- **Exit Flow:** Sidebar.

#### 3.4.11 Analytics

- **Purpose:** Workspace/team/project-level insight over time.
- **Target User:** Leaders, PMs, Admins; Developers see scoped aggregates.
- **Entry Points:** Sidebar "Analytics"; report detail; team/project tabs.
- **Primary Actions:** Filter by time/team/project, switch chart types, export, open insights.
- **Navigation Flow:** Analytics → drill into member/feature breakdown.
- **Exit Flow:** Sidebar.

#### 3.4.12 Activity

- **Purpose:** Chronological, filterable audit of everything that happened.
- **Target User:** Leaders, PMs, Admins; members see scoped feed.
- **Entry Points:** Sidebar "Activity"; dashboard feed.
- **Primary Actions:** Filter by member/entity/type, jump to entity, export (Admin).
- **Navigation Flow:** Activity → affected entity.
- **Exit Flow:** Sidebar.

#### 3.4.13 Workspace Settings / Admin

- **Purpose:** Configure workspace identity, permissions, integrations, and audit.
- **Target User:** Admins, Owner.
- **Entry Points:** Sidebar "Settings"; profile menu.
- **Primary Actions:** Edit branding, manage roles, configure default role, view audit log, integrations/billing (future).
- **Exit Flow:** Sidebar; back to dashboard.

### 3.5 Navigation Rules

- **Role-aware rendering:** Navigation items appear only when the member's role permits the page.
- **Context preservation:** Workspace switching preserves the user's conceptual place — landing on the target workspace's dashboard.
- **Keyboard-first:** Every nav item has a shortcut; `Ctrl/Cmd + K` reaches anything; visible focus rings.
- **Progressive disclosure:** Power surfaces (Admin, Audit) are hidden until role-eligible; never clutter the default surface.
- **Dead-end prevention:** Every page has a clear breadcrumb and at least one forward action.

### 3.6 Workspace Templates

A **Workspace Template** pre-seeds a new workspace so teams start with structure instead of an empty shell. Templates set the default project layout, team scaffold, sprint cadence, roles, and workflow without locking teams into them — every seeded item is editable.

#### 3.6.1 Template Catalog

| Template | For | Seeded Content |
|---|---|---|
| **Startup** | Small teams shipping a product fast | One "Product" project, one core team, a 2-week sprint cadence, a starter backlog of feature templates, PM + Developer + QA roles preconfigured, default dashboards (Workspace, Stakeholder). |
| **College / Internship** | Student teams, capstone, or internship program | One "Capstone" project, one team, weekly sprints, mentor (Leader) + members, a Research + Docs template set, milestone-driven timeline, Stakeholder dashboard for faculty. |
| **Open Source** | Maintainers coordinating contributors | Projects mirroring repos, contributor-friendly roles (Viewer default for outside contributors), no sprint cadence enforced (flow-based backlog), KB seeded with CONTRIBUTING + ADR templates, Releases wired to future repo integrations. |
| **Freelance / Agency** | Solo or small agency managing client work | Per-client projects, per-client teams, project-level roles, invoice-friendly Reports, milestone billing checkpoints, Viewer role for client access to read-only reports. |
| **Company** | Larger orgs with multiple teams and compliance needs | Multiple teams with leaders, admin-gated settings, role matrix pre-filled from defaults, quarterly planning project + milestone templates, audit-friendly Activity retention, scheduled reports. |

#### 3.6.2 What a Template Pre-configures

- **Default roles & permissions:** the role catalog (§5) with sensible defaults per template (e.g., Open Source defaults invited members to Viewer).
- **Default dashboards:** Workspace Overview, Dashboard, and Stakeholder Dashboard enabled; template-specific widget layout.
- **Default sprint settings:** duration, planning/retro ritual flags, velocity baseline (empty until first sprint).
- **Default workflows:** feature lifecycle, QA gate on/off (off for Open Source until a QA person joins), status lane set.
- **Seed knowledge base:** template docs (e.g., "How we work," ADR template, bug-reference guide).
- **Milestones:** template-relevant checkpoints (e.g., "Alpha," "Beta," "Launch" for Startup).

#### 3.6.3 Template Rules

- Choosing a template is **one-time and reversible** — nothing is forced; templates only create.
- Template creation, modification, and deprecation are **Admin/Owner** capabilities (Workspace Settings → Templates).
- Members can save a **custom workspace template** from any current workspace ("Save as template").
- Template picker appears on workspace creation; a **Blank workspace** option is always first.

---

## 4. Workspace Hierarchy

### 4.1 The Hierarchy

```
Workspace
  ↓ owns
Projects
  ↓ contain
Sprints
  ↓ contain
Features
  ↓ assigned to
Developers
  ↓ execute via
Personal Tasks
  ↓ produce
Focus Sessions
  ↓ seed
Work Logs
  ↓ generate
Reports
```

### 4.2 Why This Hierarchy Exists

1. **Workspace** is the boundary of trust, access, and billing. Everything lives inside it so that collaboration is always scoped and privacy is enforceable.
2. **Projects** separate streams of delivery (e.g., "Core App," "Mobile App," "Infrastructure") so teams can work in parallel without noise.
3. **Sprints** impose time-boxing so progress is comparable against a plan and velocity becomes measurable.
4. **Features** are the atomic unit of *engineering intent* — bounded, testable, and owned by a developer. Everything above features is structure; everything below is execution.
5. **Developers** are the bridge: they translate a Feature into personal Tasks and focus Sessions, keeping their private execution invisible to the structure above.
6. **Work Logs → Reports** close the loop: evidence from sessions and status history becomes the report — no manual transcription anywhere in the chain.

### 4.3 Ownership at Every Level

| Level | Owned By | Meaning |
|---|---|---|
| Workspace | Owner | Final authority; boundary of everything below |
| Projects | Workspace | Structure; assignable scope to teams |
| Sprints | Project | Time-boxed structure; created by Leaders/PMs |
| Features | Sprint/Project | Assigned to developers; developers own implementation |
| Personal Tasks | Developer | Private decomposition of work |
| Sessions | Developer | Private evidence of work |
| Work Logs | Developer | Private narrative + evidence |
| Reports | Scope owner | Derived; shareable by owner |

### 4.4 Visibility Through the Hierarchy

- **Top-down:** Managers see structure (projects/sprints/features) and *aggregated* progress (feature-linked session time, status history) — never private tasks/sessions/logs/journal.
- **Bottom-up:** Developers see the full picture of their features, their teams, and workspace-level context they are scoped to.
- **Lateral:** Members see only teams/projects to which they are scoped (default: their team + workspace-level dashboards/reports).

---

## 5. Roles & Permissions

### 5.1 Role Catalog

| Role | Level | Summary |
|---|---|---|
| **Workspace Owner** | Workspace | Owns the workspace lifecycle, final authority, ownership transfer, billing (future). |
| **Administrator** | Workspace | Configures workspace, manages members & roles, audit, settings. |
| **Project Manager** | Workspace | Portfolio oversight, prioritization, reporting; no code-level editing of features. |
| **Team Leader** | Team | Plans sprints, assigns features, unblocks, reports within scoped teams. |
| **Developer** | Member | Implements features, runs sessions, owns execution. |
| **QA Engineer** | Member | Verifies features, files bugs, signs off release readiness. |
| **Viewer** | Read-only | Consumes read-only reports/projects; cannot edit or access private data. |

### 5.2 Responsibilities, Permissions, Restrictions

| Role | Responsibilities | Permissions | Restrictions |
|---|---|---|---|
| **Workspace Owner** | Lifecycle, delegation, final authority | Everything incl. delete workspace, transfer ownership, promote/demote admins | Cannot be removed by others; sole owner transfer flow |
| **Administrator** | Members, roles, settings, audit | All member/team/permission/settings/admin capabilities | Cannot delete workspace or transfer ownership |
| **Project Manager** | Roadmap, prioritization, stakeholder reports | View all, create/edit projects, create sprints, generate/share reports, comment | No feature status moves, no direct assignments to developers, no role management |
| **Team Leader** | Sprint planning, assignment, unblocking, scoped reporting | Create/edit sprints & features, assign developers, manage scoped team membership, generate team reports | Scoped to assigned teams; cannot manage roles/workspace settings |
| **Developer** | Implementation, sessions, feature progress | Create/edit features, run sessions, move *own* feature status, comment, manage KB, share reports | Cannot create sprints, cannot reassign others' work, cannot access private data of others |
| **QA Engineer** | Verification, bugs, sign-off | QA lanes (In QA → Approved / Rejected→In Dev), file bug references, run QA sessions, manage KB | Cannot move features to Done (bypasses QA); cannot manage roles/sprints |
| **Viewer** | Read-only consumption | Open shared links, read-only project views, read reports/analytics (designated) | No edits, no sessions, no member directory, no private data |

### 5.3 Capability Matrix (complete)

| Capability | Owner | Admin | PM | Leader | Dev | QA | Viewer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View workspace dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View projects/features | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Read-only |
| Create/edit projects | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Create/edit teams | ✅ | ✅ | — | ✅ | — | — | — |
| Manage members (invite/remove) | ✅ | ✅ | — | Scoped | — | — | — |
| Assign roles | ✅ | ✅ | — | — | — | — | — |
| Create/edit sprints | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Create/edit features | ✅ | ✅ | — | ✅ | ✅ | — | — |
| Assign developers | ✅ | ✅ | — | ✅ | — | — | — |
| Move feature status | ✅ | ✅ | — | ✅ | Own | QA lanes | — |
| File bug references | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Run sessions / log work | ✅ | ✅ | — | ✅ | ✅ | ✅ | — |
| Manage Knowledge Base | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Generate team reports | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Share read-only reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| View analytics | ✅ | ✅ | ✅ | ✅ | Scoped | Scoped | Read-only |
| Workspace settings | ✅ | ✅ | — | — | — | — | — |
| Audit log | ✅ | ✅ | — | — | — | — | — |
| Delete/transfer workspace | ✅ | — | — | — | — | — | — |
| Billing (future) | ✅ | — | — | — | — | — | — |

### 5.4 Role Rules

- **Scoped permissions** apply within the member's assigned teams/projects.
- **QA gate:** No feature reaches *Done* without an *Approved* QA transition (or an explicit Owner override logged to audit).
- **Role change** requires Admin/Owner; every change is audited with actor + timestamp.
- **Default invitation role** is configurable (default: Developer).
- **Visibility explainer:** Any restricted action shows *why* it's restricted (e.g., "Viewers cannot edit — contact an Admin").

---

## 6. Team Management

### 6.1 Purpose

Teams are the assignment and permission unit. A Leader plans and assigns within their team; a developer's scope is their team's projects and features. Teams keep the Workspace organized without forcing every member to see everything.

### 6.2 Team Lifecycle & Operations

| Operation | Who | Flow | Rules |
|---|---|---|---|
| **Create Team** | Leader/Admin/Owner | Teams → New Team → name, description, project scope → assign Leader (defaults to creator) | One active Leader per team; at least one member required to activate |
| **Assign Leader** | On create | Pick member from workspace roster | Leader role granted; audited |
| **Promote Leader** | Admin/Owner | Team detail → Leader → Promote | Current Leader demotes to Developer; promoted member gains Leader scope |
| **Remove Leader** | Admin/Owner | Team detail → Leader → Remove | Team must still have an acting Leader assigned or be paused |
| **Add Members** | Admin / Leader (scoped) | Team → Add member → pick from roster or invite | Role on the team is always *Developer* unless explicitly elevated |
| **Remove Members** | Admin / Leader (scoped) | Team → Member → Remove | Open features must be reassigned or marked unassigned first |
| **Transfer Members** | Admin / Leader | Team → Member → Transfer to another team | Preserves member's workspace role; team scopes change |
| **Assign Projects** | Admin / Leader | Team → Projects → Add project | Team gains scope over that project's sprints/features |
| **Assign Features** | Leader | Board/Feature → Assign → Team or developer | Team-level assignment auto-distributes to team developers |
| **Archive Team** | Admin/Owner | Team → Settings → Archive | Read-only state; history preserved; restore allowed |
| **Delete Team** | Admin/Owner | Team → Settings → Delete | Confirmation-gated; features archived first; audited |

### 6.3 Team Dashboard

- **Purpose:** At-a-glance health of one team's delivery.
- **Widgets:** Active sprint progress, open features by status, member capacity, QA queue, recent activity, at-risk flags, velocity trend.
- **Actions:** Open sprint, assign, add/remove members, generate team report, view team analytics.
- **KPIs:** Sprint completion %, open/closed features, capacity used, QA turnaround, velocity.

### 6.4 Team Reports & Analytics

- **Team Report:** Auto-generated sprint/project summary (features done, time logged, blockers, velocity) — shareable read-only.
- **Team Analytics:** Trend views over time — velocity, cycle time, member contribution (feature-linked aggregates only), QA health.

---

## 7. Member Management

### 7.1 Member Profile

Every member has a Workspace profile visible to members with permission.

| Section | Content | Visibility |
|---|---|---|
| **Identity** | Avatar, name, role badge, email (role-gated) | Members |
| **Current Status** | Presence: Online / Focusing / Reviewing / Testing / In Meeting / Away | Members (live) |
| **Current Feature** | The feature the developer is actively working on (live) | Members |
| **Current Sprint** | Active sprint(s) the member belongs to | Members |
| **Assigned Work** | Open features/tasks assigned to the member | Members (aggregated) |
| **Focus Time** | Feature-linked focus time this week/sprint (aggregate only) | Managers; aggregate only |
| **Reports** | Available personal + feature/sprint reports the member can share | Shareable on demand |
| **Recent Activity** | Recent scoped activity events | Members (scoped) |
| **Performance Trends** | Derived trends: velocity contribution, cycle time, focus consistency (aggregate) | Managers/Admin only |
| **Availability** | Calendar-based availability + capacity within the sprint | Members (scoped) |
| **Presence** | Live indicator; derived from client activity and session state | Members |

### 7.2 Management Rules

- **Managers view** profiles (Leader/PM/Admin) for scoped members.
- **Only Owners/Admins edit** profile identity fields and role assignments.
- **Personal data boundary:** Profile never shows private tasks, private session breakdowns, or journal content — only feature-linked aggregates.
- **Status is derived**, not self-reported: *Focusing* = active session; *Reviewing* = status in Code Review lane; *Testing* = QA session; *In Meeting* = linked calendar event.

---

## 8. Project Management

### 8.1 Project Lifecycle

```
Idea → Backlog (planned) → Active → On Hold → Archived → (Deleted)
```

- **Backlog:** Project exists as a container; sprints not yet started.
- **Active:** Current delivery; sprints running.
- **On Hold:** Paused; sprints frozen; read-mostly.
- **Archived:** Read-only historical state; searchable; restorable.
- **Deleted:** Owner-only, confirmation-gated, cascade-archives children.

### 8.2 Project Pages

| Page | Purpose | Key Elements |
|---|---|---|
| **Overview** | Project at a glance | Progress summary, active sprint, milestones, links, team scope, description |
| **Sprints** | Sprint list + board entry | Past/active/planned sprints, per-sprint health |
| **Features** | Feature list scoped to project | Filters by status/assignee/sprint |
| **Milestones** | Date-bound checkpoints | Planned/achieved/missed states |
| **Repositories (future)** | Linked code repos | Repo list, connection status, PR/commit stats (future) |
| **Files** | Uploaded/embedded files | Attachments, links, versioned assets |
| **Documentation** | Project-scoped KB docs | Markdown docs linked to project |
| **Reports** | Auto-generated project reports | Period, scope, export/share |
| **Settings** | Project configuration | Name/icon/color, team scope, archiving, delete |

### 8.3 Project Dashboard

- **Purpose:** Live delivery health of a single project.
- **Widgets:** Active sprint progress, milestone timeline, feature distribution by status, QA queue, team capacity, at-risk flags, recent activity, reports shortcut.
- **Actions:** Start sprint, create feature, assign, archive project, generate project report.
- **KPIs:** % of sprint complete, milestones hit, open vs. closed features, cycle time, blockers.

### 8.4 Project Reports & Analytics

- **Project Report:** Sprint-averaged or period report — features shipped, time aggregated by feature, velocity, risks.
- **Project Analytics:** Long-horizon trends — feature throughput, cycle time distribution, team load, milestone health.

### 8.5 Project Templates

A **Project Template** pre-seeds a new project with the structure a team actually needs for a given type of work. Choosing a template is optional, never enforced, and every seeded element is editable.

| Template | For | Seeded Content |
|---|---|---|
| **Web App** | Browser-based products | Sprint-enabled project, frontend + backend feature templates, milestone skeleton (Alpha → Beta → Launch), KB docs (architecture, design system, env setup). |
| **Mobile** | iOS/Android apps | Store-considerate milestones (TestFlight/Play testing), QA-heavy workflow (QA gate on), device/browser test checklist doc, release-notes template. |
| **Backend** | Services, APIs, data layers | API + Infra feature templates, ADR template, performance checklist, deployment milestone skeleton. |
| **AI** | ML models, agents, LLM features | Research → Experiment → Evaluate feature flow, dataset/model docs, evaluation criteria checklist, experiment-log template. |
| **Research** | Investigation without hard dates | Flow-based (no forced sprints), Research + Docs feature templates, findings-report template, milestone optional. |
| **API** | Public/internal API delivery | Endpoint feature template (contract, versioning, docs), OpenAPI doc seed, versioning + deprecation policy KB note, release association. |
| **Infrastructure** | Infra/platform work | Infra + Security + Performance feature templates, change-window milestones, runbook template, on-call doc. |
| **Portfolio Website** | Marketing/personal sites | Content-style features, deploy milestone skeleton, SEO/analytics checklist, publish-flow documentation. |

**Project Template Rules**

- Templates are chosen at project creation; **Blank** is always first.
- Admins/Owner can create **custom project templates** (Project → Settings → Save as template).
- Templates seed structure only — no features, sprints, or dates are auto-created beyond milestone placeholders.

### 8.6 Releases

A **Release** groups the features that ship together, tracks its journey to production, and becomes the durable record of *what went out, when, and how it went.*

#### 8.6.1 Release Lifecycle

```
Draft → Planned → Built → In QA → Ready → Shipped → Reviewed → (Rolled Back)
```

| Stage | Description | Who Drives |
|---|---|---|
| **Draft** | Release container created; notes being written. | Leader/PM |
| **Planned** | Target date + feature set locked; scope is negotiable until Built. | PM/Leader |
| **Built** | All features developed; awaiting verification. | Developers |
| **In QA** | Features verified against release acceptance; bugs filed. | QA |
| **Ready** | QA sign-off complete; deploy scheduled. | QA/Leader |
| **Shipped** | Deployed; release notes published to workspace. | Leader |
| **Reviewed** | Post-release review recorded (what worked, what broke). | Leader/Team |
| **Rolled Back** | Deploy reverted; reason + re-plan logged. | Leader |

#### 8.6.2 Release Contents

- **Release Notes:** Auto-drafted from included features (title, summary, links); edited by Leader/PM; marks the source for the Stakeholder Dashboard.
- **Features:** The shipped feature set with status, links, and per-feature QA sign-off.
- **QA Sign-off:** Per-feature verification results plus a release-level sign-off gate — a release cannot reach *Shipped* without QA sign-off on every feature (Owner override logged to audit).
- **Deployment:** Deploy metadata — date, environment, deployer, external pipeline/commit links (future integrations), rollback pointer.
- **Post-Release Review:** Retrospective-lite — shipped vs. planned, incidents, lessons; feeds velocity calibration.

#### 8.6.3 Release Rules

- A release can only include **Done/Approved** features; attempting to include others prompts a warning.
- Release scope changes after *Built* require Leader/PM and are audited.
- Releases are visible on the Project and Stakeholder dashboards; release reports are shareable read-only.

---

## 9. Sprint Management

### 9.1 Sprint Lifecycle

```
Backlog → Planning → Active → Code Review → QA → Completed
                     │                                  │
                     └──────── Retrospective ◄──────────┘
```

| Stage | Description | Who Drives |
|---|---|---|
| **Backlog** | Features exist in the project backlog, unscheduled. | Everyone |
| **Planning** | Leader selects features, assigns developers, sets estimates/goal/dates. | Leader/PM |
| **Active** | Sprint is live; features move through development; burndown runs. | Developers |
| **Code Review** | Features (or their changes) under review. | Leader/Developers |
| **QA** | Features verified; bugs filed; sign-off. | QA |
| **Completed** | All features done/approved; sprint closes. | Leader |
| **Retrospective** | Team notes lessons; velocity recorded. | Leader/Team |

### 9.2 Sprint Board

- **Lanes:** Backlog | In Development | Code Review | In QA | Done (with a *Rejected/Blocked* side-column).
- **Cards:** Features with assignee avatar, estimate, progress, at-risk badge, linked session activity.
- **Interactions:** Drag-and-drop (mouse + keyboard), quick-assign, quick-estimate, inline comments, drill into feature.
- **Rules:** QA gate enforced; only Leader/PM/Admin can change sprint scope mid-flight (else audited).

### 9.3 Sprint Analytics

| Metric | Definition |
|---|---|
| **Burndown** | Remaining estimate vs. time remaining; auto-computed from status changes. |
| **Velocity** | Completed estimates per sprint; history-tracked. |
| **Capacity** | Sum of member availability (feature-linked) for the sprint period. |
| **Cycle time** | Median time from feature start to Done. |
| **Throughput** | Features completed per sprint. |

### 9.4 Sprint Dashboard & Reports

- **Sprint Dashboard:** live burndown, lane counts, at-risk list, QA queue, per-developer load.
- **Sprint Report:** auto-generated at close — goal, features (done/incomplete), velocity, blockers, retrospective notes; shareable read-only.

---

## 10. Feature Management

Features are the **central Workspace object** — the unit of engineering intent that links structure (sprints) to evidence (sessions) and knowledge (docs).

### 10.1 Feature Contents

| Section | Contents |
|---|---|
| **Overview** | Title, description (markdown), estimate, priority, status, assignee(s), sprint, project |
| **Developers** | Assignee list; per-assignee feature-linked time |
| **Timeline** | Auto-generated: created → status transitions → done; with timestamps |
| **Progress** | Auto-derived % (weighted by status + feature-linked session time) |
| **Documentation** | Linked KB docs + inline design notes |
| **Reports** | Feature-scoped report (time, activity, outcome) |
| **Activity** | All events touching this feature |
| **QA** | QA status, acceptance criteria, bug references, QA session history, sign-off |
| **Releases** | Release/version association (future: linked deploys) |
| **Dependencies** | Features/docs this feature depends on or blocks (future-capable) |
| **Acceptance Criteria** | Checklist; QA marks each verified |
| **Comments** | Threaded discussion (notifications-triggering) |
| **Attachments** | Files, images, links |
| **History** | Version history of the feature record + activity |

### 10.2 Feature Lifecycle & Status Transitions

```
Backlog → In Development → Code Review → In QA → Approved → Done
                    │            │            │
                    └──── Rejected/Blocked ◄──┘
                         (back to In Development)
```

| Transition | Trigger | Who |
|---|---|---|
| Backlog → In Development | Start work / session linked | Developer (own), Leader |
| In Development → Code Review | Change ready for review | Developer |
| Code Review → In Development | Changes requested | Leader/Reviewer |
| Code Review → In QA | Review passed | Leader |
| In QA → Approved | Acceptance verified | QA |
| In QA → In Development (Rejected) | Fails acceptance | QA (with bug reference) |
| Approved → Done | QA sign-off + Leader close | QA/Leader |
| Any → Blocked | Explicit block with reason | Anyone with edit |

### 10.3 Ownership & Rules

- **Assignee owns** implementation; status moves in *own* lanes require the assignee.
- **QA owns** the QA lanes and the Done gate.
- **Leader owns** estimates, assignment changes, and sprint scope.
- **Every transition** emits an Activity event and, where relevant, a Notification (assignee, watchers, QA queue).

### 10.4 Feature Templates

A **Feature Template** pre-fills a new feature with the structure appropriate to its type — reducing blank-page friction while leaving everything editable.

| Template | Seeded Description | Pre-filled Fields & Docs |
|---|---|---|
| **Frontend** | "As a user, I can … so that …" | Acceptance criteria (behavior on desktop/tablet/mobile), UI note link, a11y checklist item, design-system doc link. |
| **Backend** | "Provide <capability> to <consumer> …" | Acceptance criteria (behavior + edge cases), data/error-handling note, perf consideration flag. |
| **API** | "Expose <endpoint> with <contract> …" | Request/response contract placeholder, versioning note, docs link, auth/permission note. |
| **Bug Fix** | "Fix <symptom> on <surface> …" | Repro steps, expected vs. actual, regression checklist, linked bug reference. |
| **Research** | "Investigate <question> …" | Deliverable (findings doc), decision to be made, sources placeholder. |
| **Infrastructure** | "Provision/improve <component> …" | Change-window note, rollback plan, runbook link, affected-areas list. |
| **Security** | "Harden <surface> against <threat> …" | Threat scenario, test/validation steps, compliance note. |
| **Performance** | "Improve <metric> from X to Y …" | Baseline + target, measurement method, perf checklist. |
| **Refactor** | "Improve <area> without behavior change …" | Behavior-invariant checklist, test coverage requirement, risk note. |
| **Docs** | "Document <topic> …" | Audience, doc outline, linked KB doc. |

**Feature Template Rules**

- Applied on creation via template picker; **Blank** is always first.
- Custom templates are saved from any feature ("Save as template") by users with feature-edit permission.
- Templates never block creation — a feature can be created with zero fields filled (see §17.2).

### 10.5 Feature Health

Every feature resolves to a single **Health state** that appears as a color badge on boards, lists, and dashboards. Health is **derived, never self-reported** — it combines the signals the system already knows.

| Health | Badge | Derived From |
|---|---|---|
| **Healthy** | 🟢 | On-track progress, no blockers, within estimate/date, QA not overdue. |
| **At Risk** | 🟡 | Progress behind estimate OR likely to miss date OR QA requested but not started on time OR dependency delayed. |
| **Blocked** | 🔴 | Explicitly blocked with a reason (see §10.2) OR blocker severity is high. |
| **Waiting** | 🔵 | Waiting on an external input: dependency not done, missing decision, awaiting reviewer/QA handoff. |
| **Planned** | ⚪ | In backlog/planning; no work started, no risk signals yet. |

**Derivation signals**

- **Progress:** feature-linked session time + status stage vs. estimate curve.
- **Blocker severity:** reason, age of block, and which roles are needed to resolve.
- **Overdue:** past estimate/date threshold with work remaining.
- **QA status:** in QA beyond expected turnaround, or acceptance criteria incomplete.
- **Dependency delays:** an upstream dependency (see §10.6) is Blocked/At Risk.

**Rules**

- Health is recalculated on every relevant event; no manual health field exists.
- Health is **explainable** — hovering a badge shows the top contributing signals ("behind estimate by 2d; QA opened 3d ago").
- A member can **dismiss a signal** for a specific reason (logged to Activity), but cannot silently change health.
- Health aggregates to sprint/project/workspace dashboards as counts per state.

### 10.6 Feature Dependency Graph

Features declare **relationships** to other features (or docs/milestones) that are visualized as an interactive graph and honored by scheduling and health.

| Relationship | Meaning | Example |
|---|---|---|
| **Depends On** | This feature cannot complete until the target does. | "Auth flow" Depends On "User model." |
| **Blocks** | This feature must complete before the target can finish (inverse of Depends On). | "User model" Blocks "Auth flow." |
| **Related** | Shares context or changes; no hard ordering. | "Dark mode" Related to "Theme tokens." |
| **Duplicate** | Same intent as target; one should be closed. | "Fix login" Duplicate of "Fix auth redirect." |
| **Parent** | Container feature containing sub-features. | "Billing" Parent of "Invoice page," "Payment method." |
| **Child** | Sub-feature of a Parent. | Inverse of Parent. |

**Rules & Behaviors**

- Dependencies are declared on the Feature → Dependencies section (existing capability, §10.1); cycles are detected and blocked.
- A feature with a **Blocked/At Risk** dependency automatically surfaces that dependency delay in its Health (§10.5) and the leader-facing at-risk list.
- Graph view: `Feature → Dependencies` renders an interactive, draggable graph (directional edges, color by Health) with list view fallback.
- Moving a feature out of a sprint prompts a warning if it blocks in-sprint work; dependency-aware sprint planning is a future AI capability (§18, Phase 4).

---

## 11. Live Collaboration

### 11.1 Live Presence

| Signal | Derived From | Shown As |
|---|---|---|
| Who's online | Client heartbeat | Presence dot on avatars |
| Who's coding | Active session linked to feature | "Focusing on X" on member card |
| Who's reviewing | Feature in Code Review lane + member reviewer activity | "Reviewing" badge |
| Who's testing | QA session linked to feature | "Testing" badge |
| Who's blocked | Feature flagged Blocked + member authored block | "Blocked" badge + reason |
| Who's in meeting | Linked calendar event | "In Meeting" badge + remaining time |

### 11.2 Developer Cards

Compact member cards on dashboards/boards showing: avatar, name, role, live status, current feature, today's feature-linked focus time (aggregate), and quick actions (message via notification, open profile, reassign work — role-gated).

### 11.3 Live Progress

- **Progress indicators** update in real time as sessions complete and statuses change (WebSocket-style live updates in the product experience).
- **Live sprint progress:** burndown, lane counts, and at-risk lists refresh without manual reload.
- **Optimistic UI:** user actions appear instantly; corrections reconcile from the system event log.

### 11.4 Workspace Activity Feed

- Live-updating chronological feed on the Dashboard and Activity page.
- Every entry is actionable: click → affected entity.
- Automatic updates: no member ever manually "posts" a status — the system does.

### 11.5 Mission Control

**Mission Control** is a fullscreen, wall-mounted operational display for team rooms, war rooms, and network operation centers (NOCs). It turns the workspace into a large-screen, glanceable status board with zero interaction required.

- **Launch:** Sidebar or `M` shortcut; always available; role-adaptive (leaders see everything, developers see scoped projects, Viewers see only what they're allowed).
- **Layout (16:9 / 21:9):** 
  - **Top strip:** live clock, date, sprint day countdown, active releases.
  - **Left rail:** per-project sprint health (progress bars + burndown sparkline).
  - **Center:** at-risk and blocked features (auto-scrolling if the list exceeds the viewport), QA queue depth, recent live activity feed.
  - **Right rail:** member presence grid, today's feature-linked focus totals (aggregate), upcoming milestones.
  - **Footer:** heartbeat status (last data sync), ambient theme.
- **Display rules:** Auto-refreshes on every workspace event (live, no manual reload); reads as "mission clock" — statuses are color-coded (🟢🟡🔴🔵) and legible from across a room (large type, high contrast).
- **Privacy:** identical to workspace visibility rules (§2.4) — never exposes private tasks/sessions; aggregate focus totals only.
- **Exit:** `Esc` or click-away returns to the previous screen without state loss.
- **Idle behavior:** dims after a configurable period, wakes on any workspace event or interaction.

---

## 12. Dashboards

For each dashboard: **Purpose · Widgets · Actions · KPIs · Information Hierarchy.**

### 12.1 Workspace Dashboard

- **Purpose:** Live health of all ongoing delivery across the workspace.
- **Target User:** All members (role-adapted).
- **Widgets:** Active sprints progress bars, feature burn vs. plan, at-risk flag list, activity feed, member presence strip, upcoming deadlines, open features, velocity snapshot, report shortcuts.
- **Actions:** Open sprint board, jump to at-risk feature, assign/unblock, generate report, invite members, start a session against a feature.
- **KPIs:** Sprint completion %, features in QA, velocity trend, open vs. closed features, days to sprint end.
- **Hierarchy:** Sprint health (top) → risk list → activity → member presence → reports.

### 12.2 Leader Dashboard

- **Purpose:** Delivery and risk focus across the leader's teams.
- **Target User:** Team Leader.
- **Widgets:** Per-team sprint health, per-developer feature-linked progress, blocked items, QA queue depth, burndown, review dates, recent team activity.
- **Actions:** Reassign features, adjust estimates, move sprint dates, generate reports, notify member.
- **KPIs:** Capacity used vs. available, avg lead time, open blockers, QA turnaround.
- **Hierarchy:** Team sprint health → at-risk → QA queue → per-developer load.

### 12.3 Developer Dashboard

- **Purpose:** "What's mine today" — the developer's workspace view.
- **Target User:** Developer.
- **Widgets:** My features by status, my today's feature queue, my feature-linked time, assigned sprint, live status card, notifications, my focus session card.
- **Actions:** Start session against a feature, move own feature status, open feature, log QA request, view my reports.
- **KPIs:** Features I own open/done, time spent vs. estimate on active feature.
- **Hierarchy:** My features → my session → my sprint → workspace context.

### 12.4 QA Dashboard

- **Purpose:** The verification pipeline.
- **Target User:** QA Engineer.
- **Widgets:** Features in QA (by urgency), "ready for QA" signals, my current QA session, bugs opened, approval rate, handoff backlog.
- **Actions:** Open feature for review, start QA session, file bug, approve/return feature, update acceptance notes.
- **KPIs:** Features verified/week, approval turnaround, re-opened rate, time in QA.
- **Hierarchy:** QA queue → ready signals → my session → bug throughput.

### 12.5 Project Dashboard

- **Purpose:** Single-project delivery health.
- **Target User:** Leader, PM, scoped members.
- **Widgets:** Active sprint progress, milestone timeline, feature status distribution, QA queue, team load, at-risk flags, activity, reports shortcut.
- **Actions:** Start sprint, create feature, assign, archive, generate project report.
- **KPIs:** Sprint %, milestones hit, open/closed features, cycle time, blockers.
- **Hierarchy:** Sprint progress → milestones → feature distribution → activity.

### 12.6 Feature Dashboard (Feature Overview)

- **Purpose:** The single live view of one feature's health.
- **Target User:** Assignees, QA, Leader.
- **Widgets:** Status stepper, progress %, feature-linked time vs. estimate, assignee cards, acceptance checklist, bug references, timeline, activity, docs links.
- **Actions:** Move status, start session, edit estimate, file bug, add doc link, comment, share feature report.
- **KPIs:** Time vs. estimate, % acceptance verified, cycle stage duration.
- **Hierarchy:** Status/progress → scope → evidence → QA → docs/activity.

### 12.7 Admin Dashboard

- **Purpose:** Operational control.
- **Target User:** Admin, Owner.
- **Widgets:** Member count & active rate, pending invites, role distribution, teams overview, storage/usage, recent audit events, permission-change log, workspace health.
- **Actions:** Invite members, adjust roles, manage teams, edit settings, review audit trail, open billing (future).
- **KPIs:** Active members/28d, invite acceptance, admin-action counts, growth.
- **Hierarchy:** Roster health → teams → audit → settings.

### 12.8 Stakeholder Dashboard

- **Purpose:** The executive answer to "how is delivery really going?" — business-facing, evidence-backed, zero engineering jargon.
- **Target User:** Stakeholders, clients, faculty, leadership — including Viewers and external share-links.
- **Widgets:** Roadmap view (milestones vs. today), sprint progress (done vs. committed), releases (shipped/planned with release notes), completed features over time, delivery health summary (🟢🟡🔴 per project), report shortcuts, milestone timeline.
- **Actions:** Open release notes, drill into a milestone, generate/share the stakeholder report, open full Reports/Releases pages (role-gated).
- **KPIs:** Milestones hit vs. slipped, features shipped per period, releases shipped, sprint completion %, open risk count.
- **Hierarchy:** Roadmap → releases → sprint progress → feature throughput → risk summary.
- **No engineering detail:** estimates, story points, QA internals, session data, and team internals are **deliberately absent** — this surface answers *what shipped and what's next*, not *how*.
- **Access:** Workspace Admins designate who can view it; shared read-only links work for external stakeholders with no login.

### 12.9 Workspace Overview

- **Purpose:** The **first screen** after entering a workspace — an orientation hub that answers "what is this workspace, who's here, and what's happening?"
- **Target User:** All members (role-adapted).
- **Widgets:**
  - **Identity:** workspace name, description, branding, member count, membership status.
  - **Projects:** project cards with per-project health and active-sprint progress.
  - **Members & Teams:** roster preview with presence, team list with leaders.
  - **Sprint health:** live summary across active sprints (on-track/at-risk/blocked counts).
  - **Announcements:** workspace-level announcements (Admin-posted, pinned).
  - **Activity:** recent workspace activity feed (same events as §11.4).
  - **Milestones:** upcoming milestone dates.
  - **Reports:** recently generated / scheduled reports.
  - **Stats:** member count, teams, open features, this-week feature-linked focus aggregate (aggregate only).
  - **Quick actions:** New project, invite members, start session, open Mission Control, generate report.
- **Actions:** Open Dashboard (today's operational view), drill into project/team/member, create project, invite, read announcement, open milestone.
- **KPIs:** Weekly-active members, sprint completion %, open features, upcoming milestones.
- **Hierarchy:** Identity & orientation → active delivery health → people → milestones/reports → quick actions.
- **Relationship to Dashboard:** Overview **orients**, Dashboard **operates**. Entering a workspace lands on Overview; one click reaches Dashboard. Overview stays stable and calm; Dashboard is the live operational surface.

---

## 13. Notifications

### 13.1 Categories

| Category | Examples | Priority |
|---|---|---|
| **Assignments** | "You were assigned Feature F-42" | High |
| **Sprint events** | Sprint started/ending, scope change | High |
| **Status changes** | Feature moved to In QA, Approved, Blocked | Medium |
| **Review** | "Code review requested / changes requested" | Medium |
| **QA** | "Rejected: bug B-7 attached", "QA sign-off complete" | High |
| **Mentions & comments** | @mention, reply on your feature/doc | Medium |
| **Reports** | Scheduled report ready, shared with you | Low |
| **Workspace announcements** | Invite accepted, team archived, role change | Low |
| **At-risk / blockers** | Feature flagged at-risk, blocked with reason | High |
| **Membership** | Invitation, removal, transfer | High |

### 13.2 Priority & Delivery

| Priority | Behavior |
|---|---|
| **High** | In-app toast/banner + bell badge; optional email push (future); never silently dropped |
| **Medium** | Bell badge + notification center entry; consolidated into digest option |
| **Low** | Notification center entry only; no toast by default |

### 13.3 Filtering & Preferences

- **Per-category toggles** (on/off, high-only).
- **Per-entity mute:** mute a feature, sprint, project, or team.
- **Focus mode:** automatic "Do Not Disturb" while a focus session is running (high priority still delivers).
- **Digest option:** one consolidated daily/weekly digest.
- **Click-through:** every notification opens the exact context.

---

## 14. Search

### 14.1 Search Surface (Command Palette + dedicated search)

Searchable entities:

| Entity | Indexed Fields |
|---|---|
| Projects | Name, description, tags, team |
| Features | Title, description, ID, tags, assignee, status |
| Members | Name, role, team |
| Reports | Title, scope, period |
| Knowledge Base | Title, body, tags, linked entities |
| Files | Filename, uploaded-by, project |
| Comments | Body, author, entity |
| Sprints | Goal, name, dates, project |
| Teams | Name, description, leader |
| Tags | Across all entities |
| Branches (future) | Branch names from linked repos |

### 14.2 Search Behaviors

- **Global `Ctrl/Cmd + K`** reaches every entity type from anywhere.
- **Scoped search** within a project/sprint/feature context narrows automatically.
- **Filters:** entity type, status, assignee, date, tag.
- **Natural-language friendly:** "features by Aria in QA this sprint" resolves.
- **Ranking:** relevance + recency + user's access scope; private data excluded for non-owners.
- **Deep links:** every result opens the entity with the matching term highlighted.

---

## 15. Future Integrations

The Workspace is architected (conceptually) so these integrate **without redesign** — via an abstraction layer over external systems that emits the same Activity events the Workspace already understands.

### 15.1 Integration Targets

| System | Integration Surface |
|---|---|
| **GitHub / GitLab / Bitbucket** | Repos per project; PR/branch/commit events; auto-close features on merge; branch context for sessions |
| **Slack / Discord** | Standup digests, notification mirror, `/focus` slash command, report posting |
| **Google Calendar / Outlook** | Two-way sprint/milestone/focus-block sync; availability |
| **CI/CD** | Pipeline status per feature/release; deploy events link to Releases |
| **AI Standups** | Auto-drafted daily standup from sessions + status changes; deliver in-app or to chat |
| **AI Sprint Planning** | History-based estimation, backlog-to-sprint proposals, overcommitment warnings |
| **AI Engineering Insights** | Bottleneck detection, estimate-quality scoring, context-switch cost, deep-work windows |

### 15.2 Integration Principles

- **Events in, activity out:** all integrations feed the existing Activity/Notification pipeline — no bespoke UIs per integration.
- **Feature linkage is stable:** features remain the anchor; external IDs attach without changing feature semantics.
- **Read-only by default:** v1 integrations observe and enrich; write-backs (e.g., moving GitHub issues) are opt-in.
- **Auth is managed centrally** in Workspace Settings → Integrations (Admin/Owner scope).

### 15.3 Integration Marketplace

The **Integration Marketplace** is the single place where Admins/Owners discover, install, configure, and monitor workspace integrations. It is the storefront of the integration abstraction layer (§15 intro) — every item installs into the same Activity/Notification pipeline, so no integration changes the core experience.

**Catalog (v1.1 intent):**

| Category | Integrations |
|---|---|
| **Code hosting** | GitHub, GitLab, Bitbucket |
| **Communication** | Slack, Discord |
| **Calendar** | Google Calendar, Outlook |
| **CI/CD** | Jenkins, Azure DevOps |
| **Containers/Cloud** | Docker |
| **Deployment** | Vercel, Netlify |
| **AI assistants** | OpenAI, Claude, Gemini |
| **Custom** | Generic webhooks (outbound + inbound) |

**Marketplace behaviors:**

- **Browse:** category-filtered cards with description, capability surface (§15.1), and install status (Not installed / Installed / Needs re-auth / Disabled).
- **Install:** OAuth or token entry with scope explanation; connection test; permission summary before install.
- **Configure:** per-workspace mapping (which projects/repos feed in); event toggles (which events emit into Activity); write-back opt-in (read-only default, §15.2).
- **Manage:** re-auth, disable/enable, view recent sync health, remove (with what-stops-working explainer).
- **Privacy boundary:** integrations inherit workspace visibility rules — external sync never exposes private tasks/sessions; only feature-linked aggregate data leaves the workspace.
- **Audit:** every install/config/removal is logged to Activity and the Admin audit log.
- **Availability:** Phased per §18.1 (Phase 3+); the marketplace UI ships as an empty-state-friendly surface until catalog items activate.

---

## 16. User Journeys

### 16.1 Workspace Owner

- **Daily:** Scan Admin dashboard for health, approve nothing routine, trust delegation.
- **Weekly:** Review workspace growth (members, teams, activity), confirm no ownership/role drift in audit.
- **Sprint:** Attend sprint reviews via generated reports; sign off releases when required.
- **Release:** Approve release via feature set + QA sign-off; share stakeholder report.
- **Occasional:** Transfer ownership, archive unused teams, handle billing.

### 16.2 Administrator

- **Daily:** Invite/remove members, triage role-change requests, check audit for anomalies.
- **Weekly:** Review team structures, adjust permissions, enforce QA gate exceptions (if any), clean stale invites.
- **Sprint:** Monitor at-risk flags across teams; ensure capacity is visible.
- **Release:** Verify sign-offs; prepare audit-ready evidence for leadership.

### 16.3 Team Leader

- **Daily:** Open Leader Dashboard → review sprint health → unblock at-risk features → answer review requests.
- **Weekly:** Plan next sprint (pick features, estimate, assign), hold data-backed standup, generate team report.
- **Sprint:** Run planning, monitor burndown, run retrospective, close sprint, record velocity.
- **Release:** Present sprint report; coordinate QA sign-off with the PM.

### 16.4 Developer

- **Daily:** Developer Dashboard → today's features → start focus session → update own feature status → end day (logs auto-generate).
- **Weekly:** Review my reports, reflect on velocity contribution, plan next feature queue.
- **Sprint:** Pick assigned features, move through In Development → Code Review, respond to QA rejections.
- **Release:** Verify my features' acceptance criteria with QA; no manual reporting.

### 16.5 QA Engineer

- **Daily:** QA Dashboard → QA queue → test feature → file bug references → approve/return.
- **Weekly:** Track approval rate and turnaround; update acceptance criteria docs in KB.
- **Sprint:** Verify features as they arrive; block Done-gate on incomplete acceptance.
- **Release:** Final regression pass across feature set; sign-off record for release.

### 16.6 Project Manager

- **Daily:** Workspace Dashboard → portfolio view → drill into slipping sprints → align with leaders.
- **Weekly:** Prioritize backlog with leaders, generate stakeholder report, track milestones.
- **Sprint:** Review sprint reports, adjust priorities, communicate status upward (using auto-reports).
- **Release:** Consolidate feature + QA evidence into release brief; share read-only link.

### 16.7 Viewer

- **On-demand:** Open shared report/project link → read-only live view → no login required for shared links; invited viewers see designated dashboards only.

---

## 17. UX Principles

1. **Developer-first UX.** Markdown everywhere, git-native vocabulary, copy-to-clipboard, minimal chrome, no marketing in-app.
2. **Minimal clicks.** Every primary action reachable in ≤ 2 clicks; defaults are smart; zero-required-field creation.
3. **Automation-first.** Anything derivable is derived. The UI surfaces *decisions*, not *data entry*.
4. **Keyboard-first.** Full keyboard navigation; visible focus; shortcuts for every nav item and common action.
5. **Command Palette.** `Ctrl/Cmd + K` is the universal entry to pages, entities, actions, and workspace switching.
6. **Responsive.** Full experience on desktop; graceful read-and-track on tablet/mobile; never a broken stretch.
7. **Accessibility.** WCAG 2.1 AA minimum: contrast, focus management, screen-reader labels, non-color status cues.
8. **Dark Mode.** Dark first (developer default), light first-class, instant switch, system-follow.
9. **Real-time updates.** Live presence, live progress, optimistic UI; the page reflects today's work without refresh.
10. **Performance.** Perceived performance first: skeleton loaders, cached stores, optimistic updates; p95 interactions < 150 ms; dashboard load < 1.5 s.

### 17.1 Workspace Branding

Workspace branding personalizes the shared surface (Overview, dashboards, invitations, reports, Mission Control) without affecting product usability or the privacy boundary.

| Setting | Description |
|---|---|
| **Logo** | Square mark shown in the sidebar, top bar, invitations, and report headers. |
| **Banner** | Wide image used on the Overview header and workspace landing. |
| **Accent color** | One accent applied to links, active nav, and primary actions (contrast-checked; still distinct from health colors 🟢🟡🔴). |
| **Icon** | Small monochrome glyph for the workspace switcher. |
| **Description** | One-line + long-form summary shown on Overview and invites. |
| **Repositories** | Links to code repos (name + URL) surfaced on Overview and project pages (future: live integration). |
| **Documentation links** | External docs/wiki links surfaced alongside the KB. |
| **Contact** | Workspace contact member/email shown on invites and Overview. |
| **Timezone** | Default workspace timezone for dates, deadlines, and calendar. |
| **Working days** | Which days count as working days for sprint math and deadlines. |
| **Office hours** | Preferred collaboration window (e.g., 9:00–17:00), used for availability and presence suggestions. |

**Branding rules**

- **Admin/Owner only** can edit branding (Workspace Settings → Branding).
- Accent color is **user-respectful**: personal preference for the workspace can be overridden, but health/semantic colors are never replaced.
- Branding is optional — a fresh workspace ships with defaults and an empty logo slot.
- Branding applies to all surfaces consistently, including exported/share-link reports.

---

## 18. Future Evolution

### 18.1 Evolution Roadmap

The workspace evolves in five phases. Each phase is independently shippable, backward-compatible, and gated by the evidence and adoption of the previous phase.

#### Phase 1 — Core Workspace (0–6 months)

Projects, Teams, Members, Roles, Sprints, Features, Sprint Board, basic Reports, Dashboard. QA lanes in a minimal form. Foundation of Activity/Notifications.

#### Phase 2 — Advanced Team Management (6–12 months)

Team dashboards/reports/analytics, member profiles with presence, capacity & availability, milestones, project analytics, richer QA (bug references, acceptance checklists), scheduled reports, search across all entities.

#### Phase 3 — Engineering Platform (12–18 months)

Repository integrations (GitHub/GitLab/Bitbucket), branch/PR/commit linkage, release tracking, CI/CD status on features, files & attachments, team-level permission refinements, full audit tooling.

#### Phase 4 — AI Workspace (18–24 months)

AI Standups, AI Sprint Planning, AI Engineering Insights, AI report narratives, natural-language search, AI-chat surface inside the Workspace, backlog auto-prioritization.

#### Phase 5 — Developer Operating System (24+ months)

The Workspace becomes the connective tissue of the entire developer lifecycle: intent (features) ↔ evidence (sessions + commits) ↔ knowledge (docs + reports) ↔ delivery (releases), with desktop/mobile presence, an open API, and an integration marketplace — still respecting the privacy boundary that made developers trust it.

---

## Appendix

### A. Glossary (Workspace-specific)

| Term | Definition |
|---|---|
| **Workspace** | Top-level collaborative container with its own members, roles, projects, and permissions. |
| **Project** | Top-level delivery container holding sprints, features, milestones, and docs. |
| **Team** | Assignment/permission unit grouping members, scoped to projects. |
| **Sprint** | Time-boxed delivery cycle with a goal, features, and a burndown. |
| **Feature** | Bounded, testable engineering work item assigned to a developer — the central Workspace object. |
| **QA lane** | The verification stage between development and Done, gated by QA sign-off. |
| **Burndown** | Remaining estimate vs. remaining time, auto-computed. |
| **Velocity** | Completed estimates per sprint, history-tracked. |
| **Feature-linked time** | Session time a developer explicitly attaches to a feature — the only time that rolls up to team visibility. |
| **Bug reference** | A lightweight pointer to a bug attached to a feature. |
| **Milestone** | A date-bound checkpoint on a project. |

### B. Relationship to the PRD

This WPS expands and fully specifies the Workspace portions of the PRD:

| PRD Section | Expanded By |
|---|---|
| §6.4 Workspace Dashboard; §11.2 | WPS §12 |
| §6.12–6.22 (Projects, Teams, Members, Sprints, Features, KB, Calendar, Activity, Notifications, Permissions) | WPS §2–§10, §13 |
| §7.3 Workspace Navigation | WPS §3 (incl. §3.6 Workspace Templates) |
| §9 Collaboration Model; §10 Roles & Permissions | WPS §4, §5 |
| §12 Information Architecture | WPS §2 |
| §13 UX Principles | WPS §17 (incl. §17.1 Workspace Branding) |
| §14 Future Vision | WPS §15, §18 (incl. §15.3 Marketplace, §18.1 Roadmap) |
| Workspace & project & feature templates | WPS §3.6, §8.5, §10.4 |
| Releases & delivery evidence | WPS §8.6 |
| Feature health & dependencies | WPS §10.5, §10.6 |
| Operations display & stakeholder reporting | WPS §11.5, §12.8, §12.9 |

### C. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | Draft | Product | Initial complete Workspace specification |
| v1.1 | Draft | Product | Added Workspace/Project/Feature Templates (§3.6, §8.5, §10.4), Releases (§8.6), Feature Health & Dependency Graph (§10.5, §10.6), Mission Control (§11.5), Stakeholder Dashboard & Workspace Overview (§12.8, §12.9), Integration Marketplace (§15.3), Workspace Branding (§17.1), Evolution Roadmap restructure (§18.1); Overview-first landing; TOC updated. |

---

*End of document — FocusFlow WPS v1.1*
