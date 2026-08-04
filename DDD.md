# FocusFlow — Database Design Document (DDD)

**Product Name:** FocusFlow
**Document Type:** Database Design Document (DDD)
**Supersedes:** N/A — defines how FocusFlow data is organized
**Source of Truth:** FocusFlow PRD (v1.0); FocusFlow WPS (v1.1); FocusFlow UXS (v1.1); FocusFlow DSS (v1.1); FocusFlow DTS (v1.1)
**Audience:** Backend Engineers, Frontend Engineers, DevOps Engineers, Database Architects, QA Engineers, AI Engineers, Product Managers
**Status:** Draft v1.0
**Scope:** The complete data architecture of FocusFlow — every entity, relationship, ownership rule, lifecycle, index strategy, scalability consideration, audit strategy, and future evolution. The design is expressed using **Domain-Driven Design (DDD)** principles: bounded contexts, aggregate roots, aggregate boundaries, shared entities, and value objects. This document intentionally contains **no** database schemas, object models, query syntax, APIs, or backend code. It defines **how data is organized**, not how it is implemented.

---

## Table of Contents

1. [Database Philosophy](#1-database-philosophy)
2. [Data Architecture & Bounded Contexts](#2-data-architecture--bounded-contexts)
3. [Entity Catalogue](#3-entity-catalogue)
4. [Relationships](#4-relationships)
5. [Ownership Model](#5-ownership-model)
6. [Data Lifecycle](#6-data-lifecycle)
7. [Data Consistency](#7-data-consistency)
8. [Audit Strategy](#8-audit-strategy)
9. [Indexing Strategy](#9-indexing-strategy)
10. [Search Architecture](#10-search-architecture)
11. [Real-Time Data](#11-real-time-data)
12. [Offline Strategy](#12-offline-strategy)
13. [Security](#13-security)
14. [Scalability](#14-scalability)
15. [Future Evolution](#15-future-evolution)
16. [Glossary](#16-glossary)

---

## 1. Database Philosophy

The database is not a CRUD store behind the UI — it is the **record of intent and evidence** for engineering delivery. Every design decision below follows these principles.

### 1.1 Automation First

- Anything derivable is **derived**, never stored as user-entered truth. Progress, health, burndowns, velocity, and reports are computed from stored evidence (sessions, status transitions, assignments).
- Manual data is reserved for *intent* (what's next, what's learned) and *decision* (assignments, sign-offs).

### 1.2 Evidence Driven

- Every progress number traces back to a session, a status change, or a committed work item — never a remembered guess (PRD/WPS).
- Evidence must be immutable once recorded: sessions, activity events, and status transitions are append-only.

### 1.3 Ownership Model

- **Workspace** owns structure: projects, teams, sprints, features, KB, reports, calendar.
- **Developer** owns execution: tasks, sessions, work logs, journal — private by default.
- **System** owns generated truth: activity events, derived metrics, audit records.
- Ownership drives lifecycle, deletion, and privacy (Chapter 5).

### 1.4 Privacy

- The privacy boundary is structural, not procedural (WPS §2.4). Personal tasks, sessions, logs, and journal are **never readable by any other member** — including Admins — at the data layer. Only feature-linked time aggregates are exposed, and only to those with permission.
- The schema must make private data *non-queryable across users* by construction, not by filtering.

### 1.5 Scalability

- The design must tolerate millions of work logs/sessions, thousands of workspaces, large teams, long histories, and heavy analytics without redesign.
- High-volume derived data (activity, metrics, search) is treated as **read-model materialization**, separate from write aggregates.

### 1.6 Soft Delete

- Archive is the default state transition; permanent delete is the exception (Owner-only, confirmation-gated).
- History is preserved for audit, restore, and reporting.

### 1.7 Auditability

- Every mutation is attributed (actor + timestamp) and recorded as an activity event.
- Admins/Owner see the full audit trail; others see scoped activity (WPS §2.4).

### 1.8 Offline Ready

- Clients may hold local copies for offline use; the server is the source of truth.
- Offline writes must carry enough metadata to merge and resolve conflicts (Chapter 12).

### 1.9 Synchronization

- Synchronization is **event-driven and last-writer-wins-with-guardrails**: immutable facts never silently overwrite; mutable fields reconcile by timestamp with conflict notices where semantics are lost.

### 1.10 Future AI Ready

- Rules-based intelligence (UXS §15) consumes the same evidence the system already stores — no new data required.
- Future AI (WPS §18, Phase 4) reads the same write/read models; nothing is rearchitected.

---

## 2. Data Architecture & Bounded Contexts

FocusFlow is not one monolith of tables. It is a set of **bounded contexts**, each owning a slice of the domain with explicit boundaries. Data crosses boundaries by **reference (IDs) or event**, never by shared mutation.

### 2.1 Bounded Context Map

| # | Bounded Context | Responsibility | Aggregate Roots |
|---|---|---|---|
| 1 | **Identity & Access (IAM)** | Users, profiles, membership, roles, invitations, presence | User, WorkspaceMembership, Invitation |
| 2 | **Workspace** | The workspace container: teams, projects, settings, branding, templates, announcements, integrations | Workspace, Team, Project, WorkspaceTemplate |
| 3 | **Delivery** | The core of the product: sprints, features, milestones, releases, QA, dependencies | Sprint, Feature, Release, Milestone |
| 4 | **Focus & Time** | Private execution: tasks, sessions, work logs, journal | Task, Session, WorkLog |
| 5 | **Collaboration** | Comments, mentions, notifications | Notification, CommentThread |
| 6 | **Knowledge** | Knowledge base docs and tags | KbDoc |
| 7 | **Reporting & Analytics** | Reports, schedules, dashboards, metric snapshots | Report, DashboardLayout |
| 8 | **Calendar** | Time blocks: sprints, milestones, deadlines, focus blocks | CalendarEntry |
| 9 | **Intelligence** | Rules-based insights | Insight |
| 10 | **System Events & Audit** | Append-only activity/audit record | ActivityEvent |

### 2.2 Domain Boundaries

```
┌────────────────────────────────────────────────────────────────────┐
│                    WORKSPACE-FACING (collaborative)                │
│                                                                    │
│  Workspace ──── Team ──── Project ──── Sprint ──── Feature         │
│       └─────── Members/Roles (IAM) ── KB ── Reports ── Calendar    │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                    DEVELOPER-FACING (private)                      │
│                                                                    │
│  Developer ── Task ── Session ── WorkLog ── Journal                │
│                    │                                               │
│                    └── feature-linked reference (aggregate only)   │
├────────────────────────────────────────────────────────────────────┤
│                    SYSTEM-GENERATED (trusted)                      │
│                                                                    │
│  ActivityEvent ── Notification ── MetricSnapshot ── Insight        │
│                    └── Derived views: health, burndown, reports    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 Aggregate Boundaries & Invariants

Each aggregate root is the **consistency boundary** — invariants hold inside the aggregate, and cross-aggregate changes are coordinated via domain events.

| Aggregate Root | Owned Inside | Invariants Enforced |
|---|---|---|
| **Workspace** | Settings, branding, templates, announcements, integration connections | One active workspace owner; branding cannot alter semantic colors; delete is cascade-aware |
| **Team** | Team memberships, leader | Exactly one active leader; at least one member to activate |
| **Project** | Project configuration | Lifecycle gates (Backlog → Active → On Hold → Archived) |
| **Sprint** | Feature references, goal, dates | Scope changes mid-flight gated to Leader/PM; QA gate on close |
| **Feature** | Acceptance criteria, bug references, dependency edges, status history | No Done without QA Approved (Owner override audited); transition rules (§10.2 WPS) |
| **Release** | Included features, release notes, QA sign-off, deployment record | Only Done/Approved features; no Shipped without release-level sign-off |
| **Session** | Focus blocks, feature-link, discarded/completed state | Private by default; aggregate time only when feature-linked |
| **WorkLog** | Daily entries, linked sessions | Daily narrative + evidence; private |
| **Task** | Todo→In Progress→Done state | Private; optional feature-link |
| **Notification** | Recipient state, category, priority | Delivery guarantees per priority (§13.2 WPS) |
| **KbDoc** | Versions, tags, links | Draft → Published → Archived |
| **Report** | Schedule, shares, snapshot | Share = read-only; generated from evidence |

**Rule — minimize cross-aggregate transactions:** aggregates reference each other by identity. Multi-aggregate operations (e.g., moving a feature between sprints) are modeled as **domain events** processed within the owning context, never as one giant transaction across contexts.

### 2.4 Write Models & Read Models

- **Write models** are the aggregates above — they accept commands and enforce invariants.
- **Read models** are optimized projections materialized from write models (Chapter 7): dashboards, burndowns, health, search index, Universal Timeline, analytics snapshots, Mission Control.
- A read model may lag write consistency (eventual) for analytics; the aggregates remain strongly consistent.

### 2.5 Document Aggregates (data shape guidance)

- **Embedded (composition):** data that is only meaningful within its aggregate — acceptance criteria inside a feature, versions inside a KB doc, team memberships inside a team, settings/branding inside a workspace.
- **Referenced (aggregation):** data with independent lifecycle and cross-context use — features reference sprints, sessions reference features by ID, members are referenced by ID.

---

## 3. Entity Catalogue

Every entity is documented with: **Purpose · Owner · Visibility · Created/Updated/Archived by · Permissions · Relationships · Searchability · Archive · Deletion · Versioning · Audit · Future expansion.** Value objects are noted within their aggregate and are not standalone rows.

### 3.1 Identity & Access

#### User
- **Purpose:** A person who can authenticate and hold workspaces. The account identity across the platform (personal + workspaces).
- **Owner:** The user (self); account lifecycle owned by the user.
- **Visibility:** Self; workspace roster shows workspace-scoped profile data only.
- **Created/Updated/Archived by:** Self (sign-up); Admin for administrative actions; archive = deactivation.
- **Permissions:** Never exposes private execution data; profile visibility per WPS §7.
- **Relationships:** 1:N WorkspaceMembership; 1:1 UserProfile; 1:N Presence; 1:1 Personal Workspace.
- **Searchability:** Name, email (role-gated) in member search.
- **Archive:** Deactivation preserves records; no hard delete of delivered evidence.
- **Deletion:** Self-deletion (GDPR-style) with evidence-preserving policy (Chapter 13).
- **Versioning:** Profile changes versioned; identity immutable.
- **Audit:** Sign-in events, profile changes, membership changes.
- **Future:** SSO, external identities (GitHub login), cross-device identity.

#### UserProfile
- **Purpose:** Display identity: avatar, name, bio, timezone, preferences (theme, shortcuts, favorites/recents).
- **Owner:** User. **Visibility:** Role-gated (WPS §7).
- **Relationships:** 1:1 User; personal preferences (favorites, recents) live here (UXS §16.6/16.7).
- **Versioning:** Versioned; audit on role-gated fields.
- **Future:** Additional presence metadata, availability.

#### Presence
- **Purpose:** Live member state: Online / Focusing / Reviewing / Testing / In Meeting / Away (WPS §11.1).
- **Owner:** System (derived from heartbeat + session + calendar + feature status). **Visibility:** Members (scoped).
- **Relationships:** 1:N User; derived from Session, Feature, CalendarEntry.
- **Lifecycle:** Ephemeral; not archived or audited.
- **Future:** Mobile presence, DND states.

#### WorkspaceMembership
- **Purpose:** The link binding a User to a Workspace with exactly one role.
- **Owner:** Workspace (via Admin/Owner). **Visibility:** Roster (limited for Viewers).
- **Created/Updated/Archived by:** Admin/Owner; changes audited.
- **Permissions:** Role governs all workspace capability (§5 WPS).
- **Relationships:** User 1:N; Workspace 1:N; Role 1:1; Invitation 1:1 (source).
- **Searchability:** Member roster, role filters.
- **Archive:** Suspended state preserves membership history; **deletion** removes future access only (evidence remains).
- **Versioning:** Role history versioned (audit).
- **Audit:** Invite, role change, suspend, remove, transfer.
- **Future:** Multi-role, guest expiry, seat-based billing links.

#### Invitation
- **Purpose:** Pending membership offer (email/role/team).
- **Owner:** Workspace (Admin). **Visibility:** Admin only.
- **Relationships:** → WorkspaceMembership on acceptance; → User on acceptance.
- **Lifecycle:** Pending → Accepted / Expired / Revoked.
- **Deletion:** Revocable; cleanup of stale invites.
- **Audit:** Send, resend, revoke, accept.

#### Role
- **Purpose:** Static capability presets (Owner, Admin, PM, Leader, Developer, QA, Viewer).
- **Owner:** System (static in v1). **Visibility:** Reference data.
- **Relationships:** Referenced by WorkspaceMembership; capability matrix (§5.3 WPS).
- **Future:** Custom role builder (currently non-goal).

### 3.2 Workspace

#### Workspace
- **Purpose:** Top-level collaborative container (WPS §2.1).
- **Owner:** Workspace Owner. **Visibility:** Invited members only.
- **Created by:** Creator (becomes Owner). **Archived by:** Owner. **Deleted by:** Owner (confirmation-gated).
- **Permissions:** Members by role; isolation boundary (Chapter 13).
- **Relationships:** 1:N Memberships, Teams, Projects, KB, Reports, Calendar entries; 1:1 Settings, Branding; 1:N Templates, Announcements.
- **Searchability:** Hub, switcher, workspace search.
- **Lifecycle:** Active → Archived → Deleted.
- **Versioning:** Identity/description versioned; settings versioned.
- **Audit:** Full audit of workspace-scoped events.
- **Future:** Multi-workspace aggregation (currently non-goal).

#### WorkspaceSettings
- **Purpose:** Timezone, working days, office hours, contact, defaults (WPS §17.1).
- **Owner:** Workspace (Admin). **Relationships:** 1:1 Workspace (embedded).

#### WorkspaceBranding
- **Purpose:** Logo, banner, accent, icon, description (WPS §17.1).
- **Owner:** Workspace (Admin/Owner). **Visibility:** All members; share-links.
- **Relationships:** 1:1 Workspace (embedded); accent seed → derived variants (DTS §3.3).
- **Audit:** Branding changes logged.

#### WorkspaceTemplate
- **Purpose:** Pre-seeded workspace scaffolds (WPS §3.6).
- **Owner:** System + Admin-defined custom templates. **Visibility:** Admin-managed; picker at creation.
- **Relationships:** Seeds projects, teams, roles, dashboards, sprint cadence, KB docs.
- **Versioning:** Template versions.
- **Future:** Marketplace of templates.

#### Announcement
- **Purpose:** Workspace-level pinned communications (UXS §5.2).
- **Owner:** Admin/Owner. **Visibility:** Workspace (or scoped audience).
- **Relationships:** → Workspace; optional → members.
- **Lifecycle:** Draft → Published → Expired/Archived.
- **Audit:** Publish, pin, expire.

#### IntegrationConnection
- **Purpose:** Installed/configured integrations (WPS §15.3 marketplace).
- **Owner:** Workspace (Admin). **Visibility:** Admin.
- **Relationships:** → Workspace; → project/repo mappings; event toggles.
- **Security:** Credentials encrypted; scoped OAuth (Chapter 13).
- **Lifecycle:** Configured → Enabled → Disabled → Removed.
- **Audit:** Install, configure, re-auth, remove.
- **Future:** Full catalog activation (GitHub, Slack, CI/CD, AI).

#### Team
- **Purpose:** Assignment/permission unit (WPS §6).
- **Owner:** Workspace. **Created/Updated by:** Leader/Admin/Owner. **Archived by:** Admin/Owner.
- **Permissions:** Scoped projects/features; team membership management by Leader (scoped).
- **Relationships:** 1:N TeamMemberships; M:N Projects (scope); 1:1 Leader.
- **Lifecycle:** Active → Paused → Archived → Deleted.
- **Searchability:** Name, leader.
- **Deletion:** Confirmation-gated; open features reassigned first (WPS §6.2).
- **Audit:** Create, membership, leadership, archive.

#### TeamMembership
- **Purpose:** Member-in-team link with team-local role.
- **Owner:** Team (Leader/Admin). **Relationships:** Team 1:N; User 1:N; → Member Profile.

#### Project
- **Purpose:** Top-level delivery container (WPS §8).
- **Owner:** Workspace. **Created by:** Leader/PM/Admin. **Archived by:** Admin/Owner.
- **Permissions:** Team scope + role.
- **Relationships:** 1:N Sprints, Features (via sprints/backlog), Milestones, KB links, Reports; M:N Teams.
- **Lifecycle:** Idea → Backlog → Active → On Hold → Archived → Deleted.
- **Searchability:** Name, description, tags, team.
- **Deletion:** Owner-only, cascade-archives children (WPS §2.5).
- **Versioning:** Configuration versioned.
- **Audit:** Full project event log.
- **Future:** Repository links (GitHub/GitLab/Bitbucket), files.

#### ProjectTemplate
- **Purpose:** Type-seeded project scaffolds (WPS §8.5): Web App, Mobile, Backend, AI, Research, API, Infra, Portfolio.
- **Owner:** System + Admin customs. **Relationships:** Seeds features templates, milestones, KB docs.

### 3.3 Delivery

#### Sprint
- **Purpose:** Time-boxed delivery cycle (WPS §9).
- **Owner:** Project. **Created by:** Leader/PM/Admin.
- **Permissions:** Scope management by Leader/PM/Admin.
- **Relationships:** → Project; 1:N Features (references); 1:N Retrospectives; burndown derived.
- **Lifecycle:** Backlog → Planning → Active → Code Review → QA → Completed; Retrospective alongside.
- **Searchability:** Goal, name, dates, project.
- **Archive:** Completed sprints remain for history; never deleted.
- **Versioning:** Scope/goal history versioned.
- **Audit:** Start, complete, scope changes.
- **Future:** AI planning inputs.

#### Feature
- **Purpose:** The central engineering work item — bounded, testable, assigned to a developer (WPS §10).
- **Owner:** Sprint/Project (structure); assignee owns implementation.
- **Created/Updated by:** Leader/Developer (own)/QA (lanes). **Archived by:** Leader/Admin.
- **Permissions:** Status transitions gated (§10.3 WPS); QA gate enforced.
- **Relationships:** → Sprint/Project; 1:N Assignees (members); 1:N AcceptanceCriteria (embedded); 1:N BugReferences; M:N DependencyEdges; 1:N Comments; M:N KB docs; 1:N Attachments; 1:N FeatureLinks (from sessions — aggregate only).
- **Lifecycle:** Backlog → In Development → Code Review → In QA → Approved → Done; Rejected/Blocked paths.
- **Searchability:** Title, description, ID, tags, assignee, status, type.
- **Archive:** Archived features read-only, searchable, restorable.
- **Deletion:** Cascade-aware; linked evidence preserved.
- **Versioning:** Field history + activity; acceptance criteria versioned.
- **Audit:** Every transition, assignment, estimate change.
- **Future:** Repo links, CI status, AI health.

#### FeatureTemplate
- **Purpose:** Type-seeded feature scaffolds (WPS §10.4): Frontend, Backend, API, Bug Fix, Research, Infra, Security, Performance, Refactor, Docs.
- **Owner:** System + user customs (with edit permission). **Relationships:** Seeds acceptance criteria + docs.

#### FeatureDependency (edge)
- **Purpose:** Relationship between features: Depends On / Blocks / Related / Duplicate / Parent / Child (WPS §10.6).
- **Owner:** Feature aggregate (declared by editors).
- **Invariants:** Cycle detection blocked; health propagation.
- **Relationships:** Feature → Feature (directed); feature ↔ docs/milestones.
- **Versioning:** Edge history; **audit:** added/removed.

#### BugReference
- **Purpose:** Lightweight bug/issue pointer attached to a feature (WPS §10.1).
- **Owner:** QA/Developer. **Visibility:** Scoped members.
- **Relationships:** → Feature; → Reporter; lifecycle Open → Resolved/Verified.
- **Searchability:** Title, severity, status.

#### AcceptanceCriterion (value object)
- **Purpose:** Checklist item QA marks verified (WPS §10.1).
- **Owner:** Feature aggregate (embedded). **Relationships:** → Feature; verified-by QA.
- **Invariants:** Feature cannot reach Done with unverified criteria (unless override).

#### Milestone
- **Purpose:** Date-bound checkpoint on a project (WPS §2.1).
- **Owner:** Project. **Relationships:** → Project; CalendarEntry derivation.
- **Lifecycle:** Planned → Achieved → Missed.
- **Searchability:** Title, date.

#### Release
- **Purpose:** Group of features shipping together, with notes/sign-off/deploy record (WPS §8.6).
- **Owner:** Leader/PM. **Relationships:** → Project; 1:N included Features; 1:N ReleaseNotes; QA sign-off; deployment record.
- **Lifecycle:** Draft → Planned → Built → In QA → Ready → Shipped → Reviewed → (Rolled Back).
- **Invariants:** Shipped requires QA sign-off on every included feature (Owner override audited).
- **Searchability:** Name, notes, status.
- **Audit:** Scope changes, sign-off, deploy, rollback.
- **Future:** Live deploy/commit linkage.

#### ReleaseNote (value object)
- **Purpose:** Auto-drafted notes per release (WPS §8.6.2).
- **Owner:** Release aggregate (embedded).

#### Retrospective
- **Purpose:** Team lessons at sprint close (WPS §9.1).
- **Owner:** Sprint/Team. **Relationships:** → Sprint; → Team; velocity recorded.
- **Lifecycle:** Open → Closed.
- **Audit:** Edited history.

### 3.4 Focus & Time (private)

#### Task
- **Purpose:** Personal (or feature-linked) work item owned by a developer (WPS §2.1).
- **Owner:** Developer — **private by default**; feature-linked subset visible only as aggregate.
- **Permissions:** Read/write by owner only; Admins cannot read (WPS §2.4).
- **Relationships:** → Developer; optional → Feature (link, aggregate-only rollup).
- **Lifecycle:** Todo → In Progress → Done.
- **Archive:** Personal archive.
- **Deletion:** Owner can delete; feature-linked evidence (time) already aggregated is retained.
- **Versioning:** Personal history.
- **Future:** Import/export.

#### Session
- **Purpose:** Recorded focus block produced by the timer (WPS §2.1).
- **Owner:** Developer — **private by default**; time-summary rolls up only if feature-linked.
- **Relationships:** → Developer; optional FeatureLink (aggregate time only).
- **Lifecycle:** Active → Completed / Discarded.
- **Immutable once completed:** durations and links are evidence.
- **Scale:** The highest-volume entity (millions) — write/read separation required (Chapters 7, 14).
- **Audit:** Completion events only (no content).

#### WorkLog
- **Purpose:** Daily record of sessions + manual entries; report fuel (WPS §2.1).
- **Owner:** Developer — private; reportable.
- **Relationships:** → Developer; 1:N Sessions (referenced); DailySummary derived.
- **Lifecycle:** Daily entry → historical archive.

#### Journal
- **Purpose:** Private developer narrative/notes.
- **Owner:** Developer — private, never exposed.
- **Relationships:** → Developer; optional → Feature (private link).
- **Versioning:** Private version history.

### 3.5 Collaboration

#### Notification
- **Purpose:** Delivered, actionable signal derived from an Activity event (WPS §13).
- **Owner:** System (targeting). **Visibility:** Recipient only.
- **Relationships:** → ActivityEvent (source); → Recipient (User); → target entity.
- **Lifecycle:** Unread → Read → Dismissed.
- **Searchability:** Recipient's notification center.
- **Retention:** Configurable; digest; cleanup (Chapter 13).

#### NotificationPreference
- **Purpose:** Per-category toggles, per-entity mute, focus-mode DND, digest (WPS §13.3).
- **Owner:** User (personal). **Relationships:** → User; → muted entities.

#### CommentThread / Comment
- **Purpose:** Threaded discussion on features/docs/events (UXS §7.22).
- **Owner:** Entity (feature/doc/event) hosting the thread.
- **Relationships:** → Entity; → Author; mentions → User; replies.
- **Lifecycle:** Active → Resolved (thread).
- **Versioning:** Edit history; **audit:** authored, edited, mentioned.

### 3.6 Knowledge

#### KbDoc
- **Purpose:** Markdown documentation: ADRs, runbooks, onboarding, project docs (WPS §2.1).
- **Owner:** Workspace (by permission). **Created/Updated by:** Editors.
- **Permissions:** Draft → Published → Archived by editor permission.
- **Relationships:** → Workspace; M:N Tags; 1:N DocVersions; M:N linked features/projects; 1:N comments.
- **Searchability:** Title, body, tags, linked entities.
- **Archive:** Archived docs read-only, restorable.
- **Versioning:** Full version history (source of truth for audit).

#### DocVersion
- **Purpose:** Immutable snapshot of a KbDoc.
- **Owner:** KbDoc aggregate (embedded). **Relationships:** → KbDoc; → Author.

#### Tag
- **Purpose:** Shared classification across entities (WPS §14).
- **Owner:** Workspace (shared). **Relationships:** M:N Features, KbDocs, Projects, Reports.

### 3.7 Reporting & Analytics

#### Report
- **Purpose:** Auto-generated summary scoped to feature/sprint/project/team/workspace (WPS §2.1).
- **Owner:** Scope owner. **Created by:** Generation trigger (manual/scheduled).
- **Relationships:** → Scope entity; 1:N ReportShares; snapshot of source data.
- **Lifecycle:** Generated on demand / scheduled; regenerated on source change.
- **Searchability:** Title, scope, period.
- **Versioning:** Report versions (period snapshots).
- **Audit:** Generation, sharing, scheduling.

#### ReportSchedule
- **Purpose:** Recurring generation (daily/weekly).
- **Owner:** Scope owner. **Relationships:** → Report; → recipients.

#### ReportShare
- **Purpose:** Read-only external link / grant.
- **Owner:** Report owner. **Visibility:** Shared link, no login (viewer).
- **Audit:** Share, revoke.

#### DashboardLayout
- **Purpose:** Per-user, per-role dashboard configuration (UXS §16.10).
- **Owner:** User (personal customization); role default from template.
- **Relationships:** → Dashboard type; → Workspace; widgets config embedded.

#### MetricSnapshot
- **Purpose:** Materialized derived metrics (velocity, cycle time, health counts, KPI strip) for dashboards/analytics/Mission Control.
- **Owner:** System (derived). **Relationships:** → Workspace/Project/Team/Sprint scope; time buckets.
- **Lifecycle:** Append-only snapshots; recomputed on evidence change.
- **Scale:** High volume — write/read separation required (Chapter 14).

### 3.8 Calendar

#### CalendarEntry
- **Purpose:** Time-block context: sprints, milestones, deadlines, focus blocks (WPS §2.1).
- **Owner:** Scope owner (project sprints/milestones; developer focus blocks).
- **Relationships:** → Source entity (sprint/milestone/feature); → Owner (User for personal blocks).
- **Lifecycle:** Event → history; derived from sources or explicit.
- **Future:** External calendar sync (Google/Outlook).

### 3.9 Intelligence

#### Insight
- **Purpose:** A surfaced, explainable rule result (UXS §15).
- **Owner:** System (rule engine). **Visibility:** Role-aware surface.
- **Relationships:** → InsightRule; → subject entity (feature/sprint/release/member); → dismissing member.
- **Lifecycle:** Fired → Surfaced → Dismissed / Expired.
- **Searchability:** Not searchable (ephemeral); history for tuning.
- **Audit:** Firing, surfacing, dismissal (with reason).

#### InsightRule
- **Purpose:** Configurable rules: trigger, threshold, audience (UXS §15.5).
- **Owner:** Admin (configured); System (executed). **Relationships:** → Workspace; → rules library.
- **Versioning:** Rule versions; **audit:** enable/disable/threshold changes.

### 3.10 System Events & Audit

#### ActivityEvent
- **Purpose:** Immutable, timestamped record of what happened (WPS §2.1) — the Universal Timeline source.
- **Owner:** System. **Visibility:** By permission (full audit for Admins/Owner).
- **Created by:** System (on mutation). Never updated.
- **Relationships:** → Actor (User); → subject entity; → context (workspace/project).
- **Lifecycle:** Append-only; immutable.
- **Searchability:** Universal Timeline (UXS §16.3); filters, bookmarks, comments.
- **Retention:** Configurable; archive to cold storage.
- **Versioning:** N/A (immutable).
- **Audit:** It *is* the audit record.
- **Future:** Event-sourcing substrate.

#### AuditLog
- **Purpose:** Derived, exportable view of ActivityEvent for compliance (Admin).
- **Owner:** System. **Relationships:** → ActivityEvent (filtered projection).

#### Attachment / FileRef
- **Purpose:** Files, images, links attached to features/docs (WPS §10.1).
- **Owner:** Hosting entity. **Relationships:** → Feature/KbDoc; → uploader.
- **Security:** Encrypted storage; access checked per entity permission.
- **Searchability:** Filename, uploader, project.

#### SearchIndex
- **Purpose:** Derived, queryable index across entities (Chapter 10).
- **Owner:** System. **Relationships:** → indexed entities; ranking metadata.

#### UserPreferences (favorites & recents)
- **Purpose:** Personal favorites (projects, features, members, KB, reports, dashboards) and recents (UXS §16.6/16.7).
- **Owner:** User (private). **Relationships:** → User; → favorited/visited entities.
- **Lifecycle:** Personal; clearable.

---

## 4. Relationships

### 4.1 Relationship Semantics

| Type | Meaning | Example |
|---|---|---|
| **One-to-One (1:1)** | Aggregation by composition | User ↔ UserProfile; Workspace ↔ Branding |
| **One-to-Many (1:N)** | Aggregation by reference | Project → Sprints; Feature → BugReferences |
| **Many-to-Many (M:N)** | Shared membership/scope | Team ↔ Project (scope); Member ↔ Team |
| **Composition** | Child has no independent lifecycle | AcceptanceCriteria within Feature; DocVersions within KbDoc |
| **Aggregation** | Child has independent lifecycle, references parent | Session → Feature (link); Notification → ActivityEvent |
| **Ownership** | The owner controls lifecycle/deletion | Workspace owns Project; Developer owns Session |
| **Dependency** | Ordering constraint (not ownership) | Feature Depends On Feature (WPS §10.6) |
| **Inheritance** | Type/subtype where meaningful | FeatureTemplate types; InsightRule trigger families |

### 4.2 Entity Relationship Diagram (high level)

```
User ─── 1:1 ─── UserProfile
  │
  ├── 1:N ── WorkspaceMembership ── N:1 ── Workspace
  │                 │
  │                 ├── 1:1 ── WorkspaceSettings
  │                 ├── 1:1 ── WorkspaceBranding
  │                 ├── 1:N ── Team ── 1:N ── TeamMembership ── N:1 ── User
  │                 ├── 1:N ── Project ── M:N ── Team (scope)
  │                 ├── 1:N ── KbDoc ── 1:N ── DocVersion
  │                 ├── 1:N ── Report
  │                 ├── 1:N ── Announcement
  │                 └── 1:N ── IntegrationConnection
  │
  ├── 1:N ── Task ── * (private)      ─┐
  ├── 1:N ── Session ── optional ── FeatureLink ──┐ (aggregate only)
  ├── 1:N ── WorkLog ──┐               │          │
  └── 1:N ── Journal  ─┘               │          │
                                      ▼          ▼
Project ── 1:N ── Milestone          Feature ◄────┘
Project ── 1:N ── Sprint ── 1:N ── Feature
Feature ── 1:N ── BugReference / AcceptanceCriterion (embedded)
Feature ── M:N ── Feature  (dependency edges: DependsOn/Blocks/...)
Sprint ── 1:N ── Retrospective
Project ── 1:N ── Release ── 1:N ── ReleaseNote (embedded); M:N Feature

ActivityEvent ── 1:N ── Notification ── N:1 ── User
ActivityEvent ── derived ── AuditLog / Universal Timeline / MetricSnapshot / Insight
CalendarEntry ── derived ── Sprint / Milestone / FocusBlock
SearchIndex ── derived ── all searchable entities
```

### 4.3 Core Relationship Detail

| From | To | Type | Semantics |
|---|---|---|---|
| Workspace | WorkspaceMembership | 1:N | Member container; membership is the access record |
| WorkspaceMembership | User | N:1 | A user appears once per workspace (one role) |
| Team | TeamMembership | 1:N | Team roster |
| TeamMembership | User | N:1 | Cross-team membership allowed (many-to-many via role scope) |
| Project | Team | M:N | Team scope over a project |
| Project | Sprint | 1:N | Sprints belong to one project |
| Sprint | Feature | 1:N | Features reference their sprint; backlog features have none |
| Feature | Feature | M:N | Dependency edges (directed) with type + health propagation |
| Feature | BugReference | 1:N | QA/developer-raised pointers |
| Session | Feature | N:1 (optional link) | Feature-linked time aggregates to team visibility; content stays private |
| Session | WorkLog | 1:N (reference) | WorkLogs reference completed sessions |
| ActivityEvent | Notification | 1:N | Notifications derive from events |
| ActivityEvent | (all entities) | N:1 | Every mutation emits an event referencing its subject |
| KbDoc | Feature/Project | M:N | Docs link to work |
| Report | scope entity | N:1 | Reports scoped to feature/sprint/project/team/workspace |
| Insight | subject entity | N:1 | Insights reference the evidence they cite |
| CalendarEntry | source entity | N:1 | Calendar entries derive from sprints/milestones/blocks |

### 4.4 Aggregate Boundaries (borrowed references)

- **Delivery context** references Members by ID (IAM context) — never embeds private data.
- **Focus & Time context** references Features by ID (Delivery) — the link carries *aggregate duration only*.
- **Collaboration** references host entities by ID + type.
- **Reporting** snapshots data at generation time — it does not query live aggregates at render time (read model, Chapter 7).

---

## 5. Ownership Model

### 5.1 Who Owns What

| Object | Owner | Rationale |
|---|---|---|
| Workspace, Teams, Projects, Sprints, Features, KB, Reports, Calendar, Attachments, Announcements | **Workspace** | Structural objects; members hold delegated capability via roles |
| Tasks, Sessions, Work Logs, Journal | **Developer** | Private execution; the user's evidence of their own work |
| Activity events, Derived metrics, Notifications, Insights, Search index | **System** | Generated truth; trusted, immutable, or recomputable |
| Personal preferences, favorites, recents, layouts, presence metadata | **User** | Personal configuration; never workspace-owned |

### 5.2 Why the Workspace Owns Structure

- A **Workspace** is the boundary of trust, access, and billing (WPS §4.2). Owning structure lets the workspace enforce scoping and lifecycle consistently.
- **Delegated capability** (roles) means members act *within* workspace ownership — never against it.
- Archive/delete cascade flows from the owner downward, preserving history.

### 5.3 Why the Developer Owns Execution

- The privacy contract (PRD/WPS) is *structural*: what a developer does privately is not the workspace's data.
- Aggregation without exposure: the workspace sees *what* was contributed to a feature (aggregate time), never *how* every minute was spent.
- This ownership makes future AI/insights respect the same boundary (UXS §15).

### 5.4 Ownership Rules

- **Create:** the creator becomes owner of the object within the hierarchy (WPS §2.5).
- **Mutate:** edits are attributed and audited; owners may delegate edits via permission.
- **Archive:** owners may archive; archived = read-only, searchable, restorable.
- **Delete:** permanent deletion is Owner-only (workspace Owner for structure; developer for private data), confirmation-gated, cascade-aware.

---

## 6. Data Lifecycle

### 6.1 Core Lifecycle Model

```
Created ──▶ Active ──▶ Archived ──▶ (Restored) ──▶ (Deleted)
   │           │           │            │              │
   └──▶ (Deleted, developer-owned) ─────┘              │
                                                        ▼
                                         Retention/cold storage (audit evidence)
```

### 6.2 Per-Entity Lifecycle

| Entity | Lifecycle | Archive | Delete | Restore |
|---|---|---|---|---|
| Workspace | Active → Archived → Deleted | Read-only, searchable | Owner-only, type-to-confirm; cascade-archives children | Archived → Active |
| Project | Idea → Backlog → Active → On Hold → Archived | On Hold = read-mostly; Archived = read-only | Owner-only; children archived first | Yes |
| Sprint | Backlog → Planning → Active → Code Review → QA → Completed | Completed stays visible (history) | Never deleted | N/A |
| Feature | Backlog → In Dev → Code Review → QA → Approved → Done (+Rejected/Blocked) | Archived read-only | Cascade-aware; evidence preserved | Yes |
| Task / Session / WorkLog / Journal | Todo/Active → Done/Completed | Personal archive | Developer may delete; aggregated evidence retained | Personal |
| Report | Generated → Scheduled/snapshots | Period versions retained | Owner revoke/delete; shares invalidated | Yes (versions) |
| Notification | Unread → Read → Dismissed | Digest/retention policy | Retention cleanup | N/A |
| Attachment | Attached → Archived → Deleted | With host entity | With host; owner-gated | With host |
| KbDoc | Draft → Published → Archived | Read-only, restorable | Cascade-aware; versions preserved | Yes |
| ActivityEvent | Append-only | Cold storage after retention window | **Never deleted** (immutable) | N/A |

### 6.3 Lifecycle Rules

- **Archive over delete:** the default terminal state is archive; history remains searchable (WPS §2.5).
- **Cascade-aware delete:** deleting a parent archives its children first; nothing is silently destroyed.
- **Evidence preservation:** deleting a private record never removes aggregated evidence already contributed to team features (the aggregate stands independent).
- **Restore:** archived objects restore to their prior state without data loss.
- **Retention windows:** activity, notifications, sessions, and metrics have documented retention (Chapter 13); analytics history can be summarized before purge.

---

## 7. Data Consistency

### 7.1 Source of Truth

| Data | Source of Truth |
|---|---|
| Structure (workspace/team/project/sprint/feature/membership) | **Write aggregates** (owning context) |
| Private execution (tasks/sessions/logs/journal) | **Developer-owned aggregates** (owner-only) |
| Evidence (status transitions, sessions, sign-offs) | **Append-only event records** |
| Derived (health, burndown, velocity, reports, KPI, search, timeline) | **Read models** materialized from the above |

### 7.2 Derived Data

- Progress, health (UXS §15-derived rules), burndown, velocity, capacity, cycle time, reports, dashboards, Mission Control, insights, and the Universal Timeline are **derived views**.
- Derived views are recomputed on relevant events (projection) and stored as read models (MetricSnapshot, SearchIndex, report snapshots) for scale (Chapter 14).
- A derived view never becomes a user-editable source of truth.

### 7.3 Cached Data

- Read models act as caches of computation — they are invalidated/recomputed on source events.
- Session-level caches in clients are versioned; cache keys carry the entity version to avoid stale reads.
- Caches are safe to drop; they rebuild from source.

### 7.4 Temporary Data

- Drafts (unsaved markdown, dashboard customizations in progress) are ephemeral client state or short-TTL storage; never part of the durable aggregate until committed.
- Command Palette recents, typing state — ephemeral.

### 7.5 Synchronization

- Client writes carry: entity ID, field, new value, base version, timestamp.
- Server validates against aggregate invariants, then records an event.
- Clients sync via event streams / change feed; read models update downstream.

### 7.6 Conflict Resolution

- **Immutable evidence:** never merged — the first completion is final; later writes are rejected with a notice.
- **Mutable fields (title, description, estimates, dates):** last-writer-wins by server timestamp; both versions' provenance is retained in history (audit).
- **Semantic conflicts (two members change a feature status):** invariant-based — the aggregate rejects invalid transitions regardless of timing (QA gate, scope gates).
- **Offline merge:** per-field merge with clear conflict notices (Chapter 12).

### 7.7 Real-Time Updates

- Live surfaces (dashboards, board, timeline, Mission Control, presence) subscribe to **read-model change streams**, not raw writes.
- Optimistic UI reconciles against the same event stream (UXS §11).

---

## 8. Audit Strategy

### 8.1 Principles

- **Every mutation is an event.** Writes to aggregates emit an ActivityEvent: actor, action, subject, before/after (where relevant), timestamp.
- **Immutable and append-only.** Events are never edited or deleted; corrections are new events (superseding).
- **Attribution always.** Created by, updated by, archived by, and (for membership/role changes) the authorizer are recorded.

### 8.2 What Is Audited

| Category | Examples |
|---|---|
| Structure changes | Workspace/team/project/sprint/feature CRUD, archive, restore |
| Access changes | Invite, role change, membership add/remove, ownership transfer, permission change |
| Delivery changes | Feature transitions, estimate/scope changes, sign-offs, releases |
| QA events | Bug filed, rejected, approved, sign-off override |
| Security events | Login, logout, session, failed access, export of audit, share/revoke |
| Admin events | Settings, branding, templates, integrations, insight-rule changes |

### 8.3 History & Versioning

- **Entity history:** aggregates keep field-level change history (who changed what when).
- **KbDoc versions:** full document snapshots; the KB is a versioned store.
- **Report versions:** period snapshots preserved.
- **Feature/Sprint/Project history:** derived from ActivityEvents + aggregate version.

### 8.4 Timeline & Activity Feed

- The Universal Timeline (UXS §16.3) is a **read model over ActivityEvents** — filters, search, pins, bookmarks, comments, exports.
- It is the user-facing view of the same record the audit log uses.

### 8.5 Soft Delete & Restore

- Deletion is a state transition (soft delete), not physical removal; restore reverses it.
- Evidence (events, versions, aggregates) is never destroyed by soft delete.

### 8.6 Retention

- Activity/audit: retained per policy, then archived to cold storage — never truncated silently while under audit requirements.
- Notifications/sessions/metrics: retention windows with summarization before purge (Chapter 13).

### 8.7 Future Event Sourcing

- The ActivityEvent record is already append-only and replayable — it is a natural **event-sourcing substrate**.
- Future migration to full event-sourced aggregates (projecting aggregate state from events) requires **no schema change**: it is a processing model change on the same event record.

---

## 9. Indexing Strategy

Indexing is specified by **access pattern**, not by implementation syntax. Every index below maps to a documented query the product actually issues.

### 9.1 Search Fields

Indexed for text/prefix search: entity name/title, description/body, ID (F-42), tags, assignee name, author, filenames, comment bodies, doc body.

### 9.2 Sorting Fields

Indexed for order-by access: createdAt, updatedAt, dueDate/targetDate, status position, priority, name, estimate, sprint start/end.

### 9.3 Filtering Fields

Indexed for equality/range filters: workspaceId (always), projectId, teamId, sprintId, featureId, status, health, type, assigneeId, creatorId, tag, archived flag, period (date ranges).

### 9.4 Unique Fields

- Workspace: unique slug/name.
- Membership: unique (workspaceId + userId) — one role per member.
- Team membership: unique (teamId + userId).
- User: unique email/login.
- Invitation: unique (workspaceId + email).
- Feature: unique ID per workspace; unique (projectId + name) where meaningful.

### 9.5 Compound Index Candidates

- Workspace-scoped queries always lead with `workspaceId` (isolation by construction).
- (workspaceId, status, updatedAt) — feature lists/boards.
- (workspaceId, sprintId, status) — board lanes.
- (workspaceId, assigneeId, status) — developer dashboard / leader load.
- (userId, dateBucket) — sessions/worklogs (the highest-volume path).
- (workspaceId, projectId, milestoneDate) — milestones/calendar.
- (actorId, timestamp) — activity/timeline per member.
- (workspaceId, type, timestamp) — universal timeline filters.
- (insightSubjectType, subjectId) — intelligence per subject.

### 9.6 Text Search

- Dedicated inverted index over searchable fields (Chapter 10) — not collection scans.
- Analyzers: lowercase, tokenized; supports prefix and fuzzy; natural-language ranking metadata.

### 9.7 Future Vector Search

- Reserved: embedding vectors for KB docs, features, and descriptions (future AI search, WPS §18 Phase 4).
- Vector index stored as a **derived, separate index** over the same documents — no change to write models.

### 9.8 Index Governance

- Every index is justified by an access pattern; unused indexes are candidates for audit removal (aligns with DTS token-audit discipline).
- Indexes on read models (snapshots, search) are rebuilt from source events; they are disposable.

---

## 10. Search Architecture

### 10.1 Search Surfaces

| Surface | Scope | Entities |
|---|---|---|
| Global (Command Center) | User's access across all workspaces | Projects, Features, Members, Reports, KB, Comments, Sprints, Teams, Tags, Files |
| Workspace search | Within one workspace | All workspace entities |
| Feature search | Within project/sprint context | Features (+ linked docs) |
| Knowledge Base search | KB only | Docs (title, body, tags) |
| Reports search | Reports only | Report titles, scopes, periods |
| Members search | Roster | Name, role, team |
| Tags | Across entities | Tag-tagged items |

### 10.2 Indexed Content

- Projects: name, description, tags, team.
- Features: title, description, ID, tags, assignee, status.
- Members: name, role, team.
- Reports: title, scope, period.
- KB: title, body, tags, linked entities.
- Files: filename, uploader, project.
- Comments: body, author, entity.
- Sprints: goal, name, dates, project.
- Teams: name, description, leader.
- Branches (future): branch names from linked repos.

### 10.3 Ranking Philosophy

1. **Relevance** — term match strength (title > description > tags).
2. **Recency** — recency boost; recents rank above cold results.
3. **Access scope** — the user's permission boundary; private data is excluded *at index time*, not filtered at query time.
4. **Health/status lift** — active/at-risk items slightly boosted in workspace search.
5. **Personal signal** — favorites and recents (UXS §16.6/16.7) rank first for the user.

### 10.4 Search Index Lifecycle

- The SearchIndex is a **derived read model** rebuilt from write-model events (Chapter 7).
- Rebuild is safe and expected; index versioning ensures clients never read a half-built index.
- Natural-language queries resolve via the same index with synonym/entity-type hints (WPS §14.2).

---

## 11. Real-Time Data

### 11.1 What Is Real-Time

| Surface | Data | Latency Goal |
|---|---|---|
| Presence | Heartbeat-derived member state | < 5 s |
| Live progress | Session completion, status changes | Event-driven (< 1 s) |
| Sprint updates | Board lanes, burndown | Event-driven |
| Activity | Universal Timeline appends | Event-driven |
| Mission Control | Risk list, sprint health, QA queue | Event-driven |
| Notifications | High-priority delivery | < 1 s |

### 11.2 Architecture Shape

- **Write path:** command → aggregate (validates invariants) → emits ActivityEvent → read models update.
- **Read path:** clients subscribe to read-model change streams (dashboards, timeline, board).
- **Presence:** heartbeat service tracks online state; derived from client activity + session state (WPS §11.1).
- **Optimistic UI:** clients apply local changes immediately and reconcile against the event stream (UXS §11).

### 11.3 Synchronization & Conflict Handling

- Real-time delivery is **at-least-once**; clients deduplicate by event ID (idempotent event IDs).
- Out-of-order events reconcile by timestamp/sequence; aggregate state is authoritative.
- Conflicts follow §7.6: immutable evidence rejects, mutable fields LWW with history, semantic conflicts rejected by invariants.
- Read models are eventually consistent; dashboards tolerate sub-second lag; aggregates are strongly consistent.

---

## 12. Offline Strategy

### 12.1 Offline Editing

- Supported reads: cached read models the user has loaded (dashboards, features, board, docs).
- Supported writes: low-risk field edits (feature status, comments, checklists, personal tasks/sessions) queued with base-version + timestamp.
- Unsupported offline: admin operations, ownership transfers, deletions (require online confirmation).

### 12.2 Caching

- Client caches read models with version stamps; stale caches refresh on reconnect.
- Private data stays private on-device; encryption at rest required (Chapter 13).

### 12.3 Sync

- On reconnect: replay queued writes in order against server invariants; pull missed read-model versions.
- Sync progress surfaced (UXS §9.4 offline pill; §11.3 real-time).

### 12.4 Conflict Resolution

- Per-field merge by server timestamp (LWW) with provenance retained.
- Semantic conflicts (invalid transition, QA gate, duplicate) return a **conflict notice** — the user resolves, never silent overwrite.
- Immutable evidence conflicts are rejected outright.

### 12.5 Retry

- Idempotent retry with backoff; queued writes carry unique client IDs to prevent duplicates.
- Long-offline sessions get a reconciliation summary ("3 changes synced, 1 needs review").

### 12.6 Merge Strategy

- Merge at the aggregate level: a feature's status, description, and comment threads merge independently; cross-field invariants are re-validated on the server.

---

## 13. Security

### 13.1 Ownership & Permissions

- Permissions are role+scope-based (WPS §5.3 capability matrix) enforced at the **data-access boundary** — queries are workspace-scoped and role-filtered by construction.
- The capability matrix is the single source of truth for what a role may read/write.

### 13.2 Workspace Isolation

- All workspace data is scoped by workspaceId; cross-workspace access is structurally impossible (index-first isolation, §9).
- Each workspace is an isolated boundary (WPS §1.5 non-goal: no cross-workspace aggregation).

### 13.3 The Privacy Boundary (enforced in data)

- Private execution (tasks, sessions, logs, journal) is owned by the developer; **no query path allows another member — including Admins — to read it**.
- The only crossing is the feature-link aggregate (duration), and even that is permission-scoped.
- Personal preferences, favorites, recents, layouts: owner-only.

### 13.4 Encryption Requirements

- **At rest:** all data encrypted; attachments/files encrypted at rest; secrets (integration credentials, tokens) encrypted with access controlled by Admin.
- **In transit:** TLS everywhere; client–server and real-time channels.
- **On device:** offline caches encrypted; private data preferentially stored outside shared storage.

### 13.5 Audit Logs

- Security-relevant events (login, failed access, export, share, role change, integration auth) are always audited (Chapter 8).
- Audit log access is Admin/Owner-only; export is itself audited.

### 13.6 Data Retention

| Data | Retention |
|---|---|
| Activity/Audit | Policy-defined; archived to cold storage; never silently truncated while under audit |
| Notifications | Configurable window; digest summarization |
| Sessions/WorkLogs | Retained for reporting; summarize before purge |
| MetricSnapshots | Rolling summarization for long-history analytics |
| Attachments | Tied to host lifecycle |
| User private data | Retention on account deletion per privacy policy; aggregated evidence retained |

### 13.7 Privacy

- Privacy is a **data-layer guarantee**, not a UI filter (WPS §2.4, PRD).
- GDPR-style rights (export, deletion) preserve aggregate evidence while removing personal attribution where policy requires.
- Insights (UXS §15) operate only on data visible to the viewer.

---

## 14. Scalability

### 14.1 Scale Targets

| Dimension | Target |
|---|---|
| Work logs/sessions | Millions |
| Workspaces | Thousands |
| Team size | Large teams (100s) |
| Reports | Large, period-snapshotted |
| History | Long (years) |
| Analytics | Heavy, time-bucketed |
| AI (future) | Batch + online inference over derived data |

### 14.2 Write/Read Separation

- **Write aggregates** stay small and strongly consistent (per aggregate).
- **Read models** (MetricSnapshot, SearchIndex, report snapshots, timelines) scale independently and are disposable/rebuildable.
- High-volume private data (sessions, worklogs) is written once, read rarely, and summarized — a dedicated access path, not a shared query.

### 14.3 Sharding & Partitioning Guidance

- Natural partition keys: **workspaceId** for collaborative data; **userId + time bucket** for personal high-volume data.
- Cross-workspace queries are banned by design — partitioning aligns with the isolation boundary.

### 14.4 Analytics at Scale

- Long-horizon analytics reads **pre-aggregated snapshots**, not raw events.
- Snapshots are time-bucketed (hour/day/week) with rolling summarization; raw events age to cold storage.
- Mission Control and dashboards read from snapshots — never raw scans.

### 14.5 Hot Data Patterns

- Active sprints/boards: small hot sets per workspace; read models keep them fast.
- Presence: ephemeral store, not durable aggregate.
- Notifications: partitioned by recipient, retention-cleanable.

### 14.6 Future AI Scale

- AI reads the same derived data (snapshots, search index, event streams) — vector index is a derived artifact (§9.7); no write-model change.

---

## 15. Future Evolution

Every item below is **additive** — none requires redesigning the database.

| Future | Data Impact |
|---|---|
| GitHub/GitLab/Bitbucket | IntegrationConnection + repo mappings; branch/PR/commit events as ActivityEvents; feature↔PR links as references |
| Slack/Discord | Delivery channel on IntegrationConnection; notification mirroring (existing notification model) |
| Google Calendar/Outlook | CalendarEntry sync via IntegrationConnection (two-way mapping) |
| CI/CD | Pipeline status attached to Feature/Release (new derived field + events) |
| Desktop app | Same APIs/read models; local offline store per Chapter 12 |
| Mobile app | Same aggregates; touch-first read models; reduced dashboards |
| AI (standups, planning, insights, search) | Consumes snapshots, events, vector index; new InsightRule families (existing intelligence model) |
| Plugin system | Plugins read/write through public event + read-model surfaces; permission-gated |
| Event sourcing | ActivityEvent is already the substrate (§8.7); processing-model change only |
| Custom roles, SSO, billing | IAM extensions; seat/licensing references on WorkspaceMembership |

---

## 16. Glossary

| Term | Definition |
|---|---|
| **Aggregate** | A cluster of domain objects treated as one unit for invariants; consistency boundary |
| **Aggregate Root** | The single entry point of an aggregate (e.g., Feature, Sprint) |
| **Bounded Context** | A domain boundary with its own model/ubiquitous language |
| **Read model** | Derived projection optimized for queries (dashboards, search, snapshots) |
| **Write model** | Aggregates that accept commands and enforce invariants |
| **Value object** | Immutable concept without identity (AcceptanceCriterion, ReleaseNote) |
| **Feature-linked time** | Aggregate session time attached to a team feature — the only cross-boundary exposure |
| **Privacy boundary** | Structural rule: private execution is never readable by others |
| **Workspace** | Top-level collaborative container; ownership and isolation boundary |
| **Project** | Delivery container holding sprints, features, milestones, docs, reports |
| **Team** | Assignment/permission unit scoped to projects |
| **Sprint** | Time-boxed delivery cycle with goal, features, burndown |
| **Feature** | Central bounded, testable work item assigned to a developer |
| **QA gate** | Rule: no Done without QA Approved (Owner override audited) |
| **ActivityEvent** | Immutable, append-only record of a mutation; the audit + timeline source |
| **Derived view** | Computed surface (health, velocity, reports) — never user-editable |
| **Insight** | Explainable rule result surfaced by Workspace Intelligence |
| **Soft delete / Archive** | Default terminal state; read-only, searchable, restorable |
| **Last-writer-wins (LWW)** | Mutable-field conflict resolution by server timestamp with history retained |

---

## Appendix

### A. Entity Checklist

Every entity in this document carries: Purpose · Owner · Visibility · Created/Updated/Archived by · Permissions · Relationships · Searchability · Archive · Deletion · Versioning · Audit · Future expansion — per §3.

### B. Relationship to Other Documents

| Document | DDD Relationship |
|---|---|
| PRD (v1.0) | Product intent; DDD realizes it as data |
| WPS (v1.1) | Entity/ownership/lifecycle source of truth; DDD formalizes it |
| UXS (v1.1) | Surfaces and read models (timeline, dashboards, intelligence) |
| DSS/DTS (v1.1) | No data impact; referenced for consistency |
| API Spec (future) | Consumes these aggregates/read models |

### C. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | Draft | Product | Initial complete Database Design Document (DDD) |

---

*End of document — FocusFlow DDD v1.0*
