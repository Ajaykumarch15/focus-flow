# FocusFlow — System Architecture Document (SAD)

**Product Name:** FocusFlow
**Document Type:** System Architecture Document (SAD)
**Supersedes:** N/A — defines how the FocusFlow software is built
**Source of Truth:** FocusFlow PRD (v1.0); FocusFlow WPS (v1.1); FocusFlow UXS (v1.1); FocusFlow DSS (v1.1); FocusFlow DTS (v1.1); FocusFlow DDD (v1.0)
**Audience:** Software Architects, Frontend Engineers, Backend Engineers, DevOps Engineers, QA Engineers, Security Engineers, AI Engineers, Technical Leads, Engineering Managers
**Status:** Draft v1.0
**Scope:** The complete software architecture of FocusFlow — every architectural layer, module, runtime interaction, deployment boundary, integration point, and scalability strategy. This is a **complete software architecture** covering frontend, backend, real-time synchronization, authentication, background jobs, search, AI, notifications, offline synchronization, plugins, and future mobile/desktop clients. This document intentionally contains **no** source code, schemas, API endpoints, container manifests, or pipeline definitions. It is the long-term technical blueprint for implementation.

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Bounded Context Architecture](#3-bounded-context-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Runtime Flow](#6-runtime-flow)
7. [Event-Driven Architecture](#7-event-driven-architecture)
8. [Communication Architecture](#8-communication-architecture)
9. [State Management](#9-state-management)
10. [Security Architecture](#10-security-architecture)
11. [Search Architecture](#11-search-architecture)
12. [File Architecture](#12-file-architecture)
13. [Background Processing](#13-background-processing)
14. [Real-Time Architecture](#14-real-time-architecture)
15. [Offline Architecture](#15-offline-architecture)
16. [Observability](#16-observability)
17. [Scalability](#17-scalability)
18. [Integration Architecture](#18-integration-architecture)
19. [Deployment Architecture](#19-deployment-architecture)
20. [Extension Architecture](#20-extension-architecture)
21. [AI Architecture](#21-ai-architecture)
22. [Engineering Standards](#22-engineering-standards)
23. [Architecture Decision Records (ADR)](#23-architecture-decision-records-adr)
24. [Risks & Technical Debt](#24-risks--technical-debt)
25. [Future Evolution](#25-future-evolution)

---

## 1. Executive Overview

### 1.1 Purpose

The SAD converts FocusFlow from a product specification into an engineering blueprint. It defines the layers, modules, boundaries, and runtime interactions that allow multiple engineering teams to build the platform independently while remaining consistent with the PRD, WPS, UXS, DSS, DTS, and DDD.

### 1.2 Goals

- Support Personal Workspace, Workspace, Mission Control, real-time collaboration, offline mode, AI, mobile, desktop, and a plugin system **without major architectural redesign**.
- Enforce the DDD boundaries and privacy contract (DDD §13.3) at the runtime level.
- Provide clear seams for independent team ownership and testability.
- Define observability, security, and scalability as first-class, not afterthoughts.

### 1.3 Architecture Vision

One sentence: **FocusFlow is an event-driven, offline-capable platform organized into bounded contexts, with strongly-consistent write aggregates, eventually-consistent read models, and a hard privacy boundary that private execution data never crosses.**

Three structural commitments:

1. **Domain first.** Aggregates enforce business invariants (QA gate, scope gates, ownership); the API layer is thin.
2. **Events as connective tissue.** Every mutation emits an event; read models, notifications, search, intelligence, and the Universal Timeline are projections over those events.
3. **Clients are peers.** Web, mobile, and desktop clients share the same commands, read models, and sync protocol — not bespoke integrations.

### 1.4 System Context

```
                 ┌───────────────────────────────────────────────┐
                 │                  FOCUSFLOW                     │
                 │                                               │
 Web Browser ───▶│   API Layer ─▶ Application ─▶ Domain          │
 Desktop App ──▶ │        │              │            │          │
 Mobile App ───▶ │        ▼              ▼            ▼          │
                 │   Real-time         Services    Aggregates    │
                 │   (WS/SSE)                     │              │
                 │        │                      ▼               │
                 │        │               Infrastructure         │
                 │        ▼                      │               │
                 │   Event Bus ◀── events ───────┘               │
                 │        │                                      │
                 │        ├──▶ Read models (dashboards, search,  │
                 │        │      metrics, timeline)              │
                 │        ├──▶ Background workers                │
                 │        └──▶ Notifications                     │
                 └───────┬──────────┬───────────────┬────────────┘
                         │          │               │
                   Git providers  Chat/Calendar  AI providers
                  (future: GH, GL, (future)       (future)
                   Bitbucket)
```

### 1.5 Constraints

- **Privacy boundary is structural** (DDD §13.3): no query path allows a member — including Admins — to read another member's private execution data.
- **Append-only evidence** (DDD §8): activity/audit events are immutable; corrections are new events.
- **No cross-workspace aggregation** in v1 (WPS §1.5).
- **No custom role builder / enterprise SSO / IP allow-lists** in v1 (WPS §1.5).
- **Write models strongly consistent; read models eventually consistent** (DDD §2.4).

### 1.6 Assumptions

- Node.js backend and React frontend (per existing `mainApp` direction). The SAD's rules are language-agnostic; these runtimes are assumed for deployment modeling.
- A document-oriented store (per project direction). The SAD and DDD deliberately avoid store-specific syntax and keep read/write separation portable.
- External integrations (Git, chat, calendar, AI) are incremental and additive (DDD §15).

---

## 2. High-Level Architecture

### 2.1 Layered Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER  (Web / Desktop / Mobile)                           │
│  UI components (DSS) · state · caching · offline queue · sync     │
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTPS · WS/SSE
┌──────────────────────────────▼────────────────────────────────────┐
│  API LAYER  (thin)                                                │
│  Authentication · Authorization · Validation · Rate limiting      │
│  Command/RPC translation · Real-time gateway                      │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│  APPLICATION LAYER  (use cases, orchestration)                    │
│  Auth · Workspace · Delivery · Focus · Collaboration · Knowledge  │
│  Reporting · Calendar · Intelligence · Notifications · Search     │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│  DOMAIN LAYER  (aggregates, invariants) — the heart               │
│  Aggregate roots per bounded context (DDD §3)                     │
│  Domain events published on every mutation                        │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                             │
│  Persistence adapters · Event bus · Message queue · Cache         │
│  File storage · Search engine · Scheduler · Email/SMS             │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│  PERSISTENCE LAYER                                                │
│  Write store (aggregates) · Event store · Read-model stores       │
│  Search index · File/object store · Cache store                   │
└──────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────▼────────────────────────────────────┐
│  EXTERNAL SERVICES  (integrated via anti-corruption layers)       │
│  Git providers · Chat · Calendar · CI/CD · AI providers · Email   │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

| Layer | Responsibility | Rules |
|---|---|---|
| **Client** | Render read models, accept commands, optimistically update, queue offline writes | Never enforces invariants; server is authoritative |
| **API** | Translate commands, enforce identity + authorization + validation + limits | Thin; no business rules |
| **Application** | Orchestrate use cases across aggregates; coordinate transactions | No invariants; delegates to domain |
| **Domain** | Enforce business invariants; emit domain events | No infrastructure dependencies |
| **Infrastructure** | Provide ports (persistence, events, messaging, cache, files, search, scheduling) | No business rules |
| **Persistence** | Physically store write models, events, read models, files, indexes | Store-agnostic behind adapters |
| **External** | Third-party systems | Only reachable through anti-corruption layers (Chapter 18) |

### 2.3 Dependency Rule (Clean Architecture)

- Dependencies point **inward**: Client → API → Application → Domain. Infrastructure implements interfaces *owned by* the domain (ports), never the reverse.
- The domain layer knows nothing about HTTP, databases, queues, or the UI.
- This keeps the QA gate, privacy boundary, and ownership rules testable without infrastructure.

---

## 3. Bounded Context Architecture

### 3.1 Overview

FocusFlow is decomposed into ten bounded contexts, defined in DDD §2. Each context owns its aggregates, invariants, events, and read models. Communication between contexts is **event-driven and command-mediated** — never direct data-structure sharing (DDD §2.4, §7).

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            BOUNDED CONTEXT MAP                             │
│                                                                            │
│  ┌──────────────┐   publishes/consumes   ┌─────────────────┐               │
│  │      IAM     │◀──────────────────────▶│   Workspace     │               │
│  └──────┬───────┘                        └───────┬─────────┘               │
│         │                                        │                        │
│         ▼                                        ▼                        │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐                │
│  │   Delivery   │◀─▶│ Focus & Time    │◀─▶│ Collaboration │                │
│  └──────┬───────┘   └────────┬────────┘   └──────┬───────┘                │
│         │                    │                   │                        │
│         ▼                    ▼                   ▼                        │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐                │
│  │  Knowledge   │◀─▶│  Reporting &     │◀─▶│  Calendar    │                │
│  │              │   │  Analytics       │   │              │                │
│  └──────┬───────┘   └────────┬────────┘   └──────┬───────┘                │
│         │                    │                   │                        │
│         ▼                    ▼                   ▼                        │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐                │
│  │ Intelligence │◀─▶│ System Events & │   │  (all events  │                │
│  │              │   │ Audit (spine)   │◀──│   flow here)  │                │
│  └──────────────┘   └─────────────────┘   └──────────────┘                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Context Responsibilities & Boundaries

| Bounded Context | Owned Aggregates (DDD §3) | Responsibilities | Boundary Rules |
|---|---|---|---|
| **IAM** | User, Invitation, Role, Permission | Identity, credentials, sessions, invitations, role/permission checks | Owns nothing outside identity; never reads member execution data |
| **Workspace** | Workspace, Member, Project, Sprint, Tag, Feature, Task, Dependency | Structure of work: projects, sprints, features, tasks, dependency graph, tags, membership | Owns the *shape* of work; not execution timing (Focus & Time) |
| **Delivery** | QA Gate, Review, Release, Milestone, Estimation | QA gate enforcement, reviews, releases, milestones, estimation | Owns quality gates and delivery milestones; consumes feature/task state from Workspace |
| **Focus & Time** | Session, Focus Block, Task Claim, Summary | Focus sessions, block claims, developer execution state, summaries | Private-by-default; emits *anonymized* summaries, never raw execution |
| **Collaboration** | Comment, Reaction, Mention, Activity Feed Item | Comments, reactions, mentions, activity feeds, the Universal Timeline projection | Owns social interaction; reads event spine, never mutates other contexts |
| **Knowledge** | Knowledge Base Entry, Document | Markdown-based knowledge base, document versioning | Owns content; no cross-context business rules |
| **Reporting & Analytics** | Report Definition, Dashboard, KPI Snapshot | Dashboards, KPI computations, report compilation | Read-only; derives exclusively from events and read models |
| **Calendar** | Calendar Event, Availability Window | Sprint/feature time mapping, availability, scheduling surfaces | Maps work items to calendar time; never mutates Work items |
| **Intelligence** | Insight Rule, Insight | Rule evaluation for Workspace Intelligence (DSS/UXS §15) | Rules-based, explainable, conservative, dismissible — no free-form AI in v1 |
| **System Events & Audit** | ActivityEvent, Audit Log | Append-only event spine, audit trail, traceability (DDD §8) | Append-only; immutable; the substrate for future event sourcing |

### 3.3 Inter-Context Communication Rules

1. **Commands in, events out.** Contexts expose commands (use cases) and publish events. A consuming context never reads another context's tables directly (DDD §7.4).
2. **No cross-context transactions.** Each aggregate is a consistency boundary (DDD §2.4); cross-context state is reconciled via the event spine and read models.
3. **Shared Kernel.** A minimal, stable set of shared value objects (IDs, timestamps, MemberRef, WorkspaceRef) shared via a published package; changed only through a review board.
4. **Anti-corruption layers (ACL).** Every external system (Git, chat, calendar, AI) is wrapped in an ACL inside the consuming context (Chapter 18).
5. **Privacy boundary.** Focus & Time aggregate data never crosses into any other context's read path; the Intelligence context only consumes anonymous, workspace-level summaries (DDD §13.3).

---

## 4. Frontend Architecture

### 4.1 Overview

The frontend is a modular React SPA. It consumes read models via an API and maintains a local cache + offline queue. It is structured so the same core can later be packaged as desktop (Electron/Tauri-style) and mobile (React Native/WebView) surfaces with minimal change (UXS §18, WPS §18).

### 4.2 Application Shell

- **Routing:** workspace-scoped routes (`/w/:workspaceSlug/...`) with lazy-loaded feature modules.
- **Layouts:** App shell (sidebar, command center, top bar) → feature layouts (Overview, Mission Control, Dashboards) → detail layouts (Feature Detail, Member Profile).
- **Module boundaries:** each feature area (Workspace, Delivery, Focus, Collaboration, Knowledge, Reporting, Calendar, Intelligence, Platform) is a vertically-sliced module owning its components, hooks, API access, and local state (WPS/UXS chapter mapping).

### 4.3 Feature Modules

| Module | Primary Surfaces (UXS) | Owned Read Models |
|---|---|---|
| Workspace | Overview, Projects, Sprints, Features, Tasks, Timeline | Project/Sprint/Feature/Task summaries, Dependency Graph |
| Delivery | QA Gate, Reviews, Releases, Milestones | QA gate status, Release pipeline, Milestone progress |
| Focus | My Work, Sessions, Summaries | Personal execution state, Focus block health |
| Collaboration | Activity Feed, Universal Timeline | Feed items, comments, reactions |
| Knowledge | KB Explorer, Documents | KB entries, document versions |
| Reporting | Dashboards, Reports | KPI snapshots, compiled reports |
| Calendar | Calendar view | Calendar events, availability |
| Intelligence | Mission Control, Insight cards | Rule results, at-risk lists |
| Platform | Settings, Admin, Members | Workspace settings, member list, audit view |

### 4.4 State Management

- **Server state** (read models) cached client-side with stale-while-revalidate; the cache is the single source of UI truth (Chapter 9).
- **Client state** (forms, filters, ephemeral UI) kept local to modules via hooks/context — never globalized.
- **Command dispatch:** UI issues commands; optimistic mutations update the cache; server reconciliation replaces the optimistic value (Chapter 9).

### 4.5 Data Fetching & Performance Budget

- Read-model requests are normalized by entity ID and shared across surfaces.
- Skeletons + progressive loading per DSS motion/perf guidelines; initial route payload < 200 KB gzipped (code-split per module).
- Real-time updates apply as cache patches (Chapter 14); no full re-fetch on a single event.

### 4.6 Authentication & Session (Client)

- Token-based auth (short-lived access + long-lived refresh, Chapter 10); silent refresh before expiry.
- On 401 → attempt refresh → retry once → redirect to login with return path.

### 4.7 Error Boundaries & Resilience

- Module-level error boundaries render the DSS error/empty state, never blank screens.
- Failed mutations land in the offline queue; UI shows optimistic + queued state per UXS offline guidance.
- Feature flags gate experimental surfaces (DSS Appendix D lifecycle: Experimental/Beta).

---

## 5. Backend Architecture

### 5.1 Overview

The backend is a set of domain-sliced services behind a thin API gateway. Services are horizontally scalable; writes funnel to the domain layer where aggregates enforce invariants; reads go to eventually-consistent read models (Chapter 9).

### 5.2 Service Catalog

| Service / Module | Bounded Context | Key Responsibilities |
|---|---|---|
| Auth Service | IAM | Login, refresh, invitations, session management |
| Authorization Service | IAM | Role/permission checks at request boundary (WPS §1.5) |
| Workspace Service | Workspace | Projects, sprints, features, tasks, tags, dependency graph, membership |
| Delivery Service | Delivery | QA gates, reviews, releases, milestones, estimates |
| Focus Service | Focus & Time | Sessions, blocks, claims, summaries (private boundary) |
| Collaboration Service | Collaboration | Comments, reactions, mentions, feed |
| Knowledge Service | Knowledge | KB entries, documents, versioning |
| Reporting Service | Reporting | KPI computation, dashboard read models, report compilation |
| Search Service | Workspace/Knowledge/Reporting | Indexing + query (Chapter 11) |
| Insight Service | Intelligence | Rule evaluation → insight cards (UXS §15) |
| Calendar Service | Calendar | Availability, schedule mapping |
| Notification Service | Platform | Email, in-app, push notifications (Chapter 14) |
| File Service | Platform | Upload/download, binary storage (Chapter 12) |
| Plugin Manager | Platform | Plugin registry, sandbox lifecycle (Chapter 20) |
| Integration Manager | Platform | External system ACLs, webhooks, OAuth (Chapter 18) |
| Job Scheduler | Platform | Background jobs (Chapter 13) |
| Realtime Gateway | Platform | WS/SSE fan-out (Chapter 14) |

### 5.3 Domain Services (stateless, cross-aggregate logic)

| Domain Service | Context | Purpose |
|---|---|---|
| HealthCalculator | Focus & Time | Compose execution health from sessions/blocks (no AI) |
| DependencyResolver | Workspace | Compute transitive dependency impact + block chains (WPS §10.6) |
| ReportCompiler | Reporting | Assemble event-sourced metrics into report read models |
| VelocityTracker | Reporting | Sprint velocity from delivered points |
| RuleEngine | Intelligence | Evaluate declarative rules against summaries (UXS §15.2) |

These services contain **no** infrastructure imports; they operate on domain models and are unit-testable in isolation.

### 5.4 Application Use-Case Layer

- Each use case (e.g., "Create Feature", "Advance QA Gate") is an application service: authenticate → authorize → validate → load aggregate(s) → invoke domain behavior → persist → publish events.
- Transactions are aggregate-scoped (DDD §2.4). Where a use case spans aggregates, the orchestration publishes events and read models reconcile asynchronously — no distributed transaction (Chapter 7).

### 5.5 Repository & Infrastructure Ports

- The domain defines **ports** (interfaces): `FeatureRepository`, `SessionRepository`, `EventStore`, `Clock`, `IdGenerator`, `BlobStore`, `SearchIndexer`.
- Infrastructure supplies **adapters** (implementations). The persistence layer (DDD §6) is swappable behind these ports — write store, event store, read stores, search index are distinct physical stores.

---

## 6. Runtime Flow

### 6.1 Runtime Request Flow (Create Feature)

```
User clicks "New Feature"
        │
        ▼
 [React Module: Workspace]  optimistic feature added to cache
        │  POST /api/workspaces/:id/features   (Command)
        ▼
 [API Gateway]  auth → authorize (role) → validate (name, project)
        │
        ▼
 [Workspace Service]  Application use case "CreateFeature"
        │  load Project aggregate (for sprint context, capacity)
        │  load Feature aggregate  → invoke domain logic
        │  enforce invariants (name non-empty, parent exists, permissions)
        │  persist Feature to write store   (single aggregate transaction)
        │  publish FeatureCreated event
        ▼
 [Event Bus]  ──▶ Event Store (append-only) ──▶ Background workers
        │
        ├──▶ Read-model projector: FeatureList, Dashboard, Timeline updated
        ├──▶ Search indexer: feature indexed
        ├──▶ Notification service: subscribers notified
        ├──▶ Realtime gateway: WS push to connected clients
        └──▶ Analytics: KPI snapshot refresh (async)
        │
        ▼
 [Client]  receives ack + realtime patch → reconciles optimistic value
```

### 6.2 Runtime Flow Types

| Flow | Path | Consistency |
|---|---|---|
| **Read** (view feature) | Client → gateway → read model store → cached to client | Eventually consistent (fresh target < 5s) |
| **Write** (create/update) | Client → gateway → domain → write store → events → projections | Strong on write, eventual on reads |
| **Realtime** | Event → realtime gateway → WS/SSE to clients | Near-real-time (< 1s target) |
| **Background** | Event → queue → worker → external side-effect | At-least-once, idempotent |
| **Offline write** | Client queue → sync endpoint → domain (same write path) | Resolved on reconnect (Chapter 15) |

### 6.3 Sequencing & Concurrency

- Aggregates enforce optimistic concurrency via version numbers; stale writes are rejected with a conflict the client reconciles (WPS/UXS conflict states).
- Read models are immutable snapshots rebuilt by idempotent projectors; projector runs are concurrency-safe (per aggregate version).
- Idempotency keys on command endpoints prevent duplicate side-effects on retries.

---

## 7. Event-Driven Architecture

### 7.1 Event Model

All events are first-class domain facts recorded in the append-only **event spine** (System Events & Audit context, DDD §8). Schema per event:

| Field | Description |
|---|---|
| `eventId` | Global unique (UUID) |
| `type` | e.g., `feature.created`, `qagate.approved`, `session.completed` |
| `aggregateType`, `aggregateId`, `version` | Source aggregate identity + version |
| `workspaceId` | Privacy-scoped partitioning key |
| `actorId` | Who performed the mutation |
| `timestamp` | Monotonic, ordered per aggregate |
| `payload` | Event-specific data (no PII beyond actor reference) |
| `metadata` | Correlation/trace ids, client info |

### 7.2 Event Publishing

- **Atomic with the write.** Aggregate persistence and event append commit atomically (write-then-events in one transaction, or outbox pattern). No event is ever emitted without its state change, and vice versa.
- **Ordering:** strictly ordered per aggregate (version sequence). Cross-aggregate ordering is best-effort via `timestamp`.
- **Retention:** events are never mutated or deleted; corrections are compensating events (DDD §8.4).

### 7.3 Event Consumers & Projections

| Consumer | Type | Rebuildable |
|---|---|---|
| Read-model projectors (FeatureList, Dashboard, Timeline, Mission Control) | Projection | Yes — replay from spine |
| Search indexer | Projection | Yes — full reindex |
| Notification service | Side-effect | No — transient |
| Analytics/KPI snapshots | Projection | Yes |
| Intelligence RuleEngine | Batch/scheduled | Yes |
| External webhooks (integrations) | Side-effect | No — must be idempotent |

### 7.4 Event Flow Diagram

```
Write path                         Read path
─────────                         ─────────
Aggregate mutation ─┐
                    ▼
              [Outbox/Event append]      Projector 1 → FeatureList store
                    │                    Projector 2 → Dashboard store
                    ▼                    Projector 3 → Timeline store
              [Event Store] ──────▶     Projector 4 → Search index
                 (spine)                Projector 5 → KPI snapshots
                    │
                    ▼
              [Event Bus] ──▶ Realtime gateway ─▶ clients
                    │
                    ▼
              [Queue] ──▶ Notification / Webhook / external workers
```

### 7.5 Event Sourcing Readiness

The spine is append-only and complete; moving aggregates to full event sourcing later (replay → state) requires **no** schema change and no consumer rewrites (DDD §8.6, §15).

---

## 8. Communication Architecture

### 8.1 Communication Modes

| Mode | Transport | Use |
|---|---|---|
| Command/RPC | HTTPS JSON (REST-style) | All writes + simple reads |
| Read-model queries | HTTPS JSON | Fetch read models (or GraphQL later; see 8.3) |
| Realtime updates | WebSocket (primary), SSE fallback | Event fan-out to live clients |
| Offline sync | HTTPS batch (sync endpoint) | Offline queue flush (Chapter 15) |
| Internal messaging | Queue (broker) | Event bus, background workers |
| External integrations | HTTPS outbound | Git, chat, calendar, AI providers (Chapter 18) |

### 8.2 API Gateway

- Single entry point: TLS termination, rate limiting, request correlation, auth enforcement, routing to services.
- Idempotency-key support on command endpoints (client generates, gateway dedupes).
- Pagination/cursor conventions shared across all list read models.

### 8.3 Contract Stability

- Read models and command contracts are versioned (`/v1/...`); additive changes only within a major version (WPS versioning policy).
- A schema-first contract (OpenAPI for REST; the read-model JSON shapes shared as a published package consumed by web/desktop/mobile) keeps all clients consistent.
- GraphQL adoption is deferred to when client-adaptive queries outweigh fixed read models (ADR 8).

### 8.4 Backpressure & Reliability

- Clients back off on 429/5xx with exponential retry; sync queues are durable in IndexedDB/SQLite on device.
- Queue consumers are at-least-once + idempotent; DLQ for poisoned events with alerting.

---

## 9. State Management

### 9.1 State Taxonomy

| State | Where | Source of Truth | Freshness |
|---|---|---|---|
| **Write state** (aggregates) | Backend write store | Domain aggregates | Strong (per aggregate) |
| **Read state** (projections) | Read-model stores | Event spine (projectors) | Eventually consistent |
| **Client cache** | Device | Read models + optimistic mutations | Reconciles to server |
| **Offline queue** | Device | Pending commands | Flushes on reconnect |
| **Transient UI state** | Component/hook | Client only | Ephemeral |

### 9.2 Read/Write Separation

```
  Writes                          Reads
─────────────────                ─────────────────
  Commands ──▶ Domain ──▶ Write store   Read-model store ──▶ Clients
                       │                    ▲
                       ▼                    │
                  Event spine ─── projectors ┘
```

- Writes always hit the domain + write store (strong consistency, invariant enforcement).
- Reads always hit read-model stores (fast, denormalized, workspace-scoped).
- A request must never read through the write store; the write store is not queried for UI.

### 9.3 Client Cache & Optimistic Updates

- Read models cached by entity key; TTL + invalidation via realtime patches.
- Mutations apply optimistically with a generated temp ID; server ack replaces temp with canonical ID; conflicts reconcile per UXS conflict states (WPS §3.4.x).
- Cache is the single source of UI truth; background refetch refreshes stale entries.

### 9.4 State Consistency Guarantees

| Guarantee | Mechanism |
|---|---|
| No lost updates | Optimistic concurrency (aggregate version) |
| No duplicate side effects | Idempotency keys |
| UI never blocks | Skeletons + optimistic cache + stale-while-revalidate |
| Read models eventually consistent | Idempotent projectors replayable from spine |

---

## 10. Security Architecture

### 10.1 Trust Boundary

The privacy boundary from DDD §13.3 is enforced **at the data layer, not just the API**. Privacy rules:

- Focus & Time aggregate data is inaccessible to every other context's query path, including Admin surfaces.
- Read-model stores are partitioned by `workspaceId`; a query without a matching workspace membership is rejected at the gateway before reaching a store.
- External integration tokens are stored encrypted and never exposed to clients.

### 10.2 Authentication

```
 Browser/App ──▶ Auth Service
      │  POST /auth/login (credentials or provider OAuth)
      ▼
 Issue short-lived access token (JWT, ~15m) + opaque refresh token (rotating)
 Access token carries: subject, workspace memberships, role claims
 Refresh token: HttpOnly + Secure cookie / secure storage, server-side rotation
 Silent refresh before expiry; on failure → login flow
```

- Passwords hashed with a memory-hard KDF; no plaintext ever stored.
- Sessions revocable; single-session or multi-session per workspace policy (WPS §12.x).

### 10.3 Authorization

- **RBAC at the edge**: role checks (Admin/Member/Viewer per WPS §1.5) enforced at the gateway for command/query entry.
- **Ownership at the domain**: resource-level checks (member owns session, feature belongs to workspace) enforced inside aggregates — the last line of defense.
- Defense in depth: edge checks are performance; domain checks are correctness.
- Enterprise SSO / IP allow-lists / custom roles are explicitly **out of v1** (WPS §1.5); the auth interface is designed to add them additively (ADR 9).

### 10.4 Data Protection

| Data Class | Protection |
|---|---|
| Credentials, tokens | KDF/encrypted at rest, TLS in transit |
| Workspace + member data | TLS; workspace-scoped partitioning |
| Private execution (Focus) | Data-layer privacy boundary; never projected cross-context |
| External integration tokens | Encrypted secret store; never logged |
| PII | Minimal collection; retention policy per WPS/DDD §13; export & delete flows |

### 10.5 Auditability

- Every security-relevant action (login, invite, role change, workspace export, permission grant) writes an Audit Log event (System Events & Audit context, DDD §8).
- Audit events are append-only and viewable by Admins within their own workspace only.

### 10.6 Threat Model Highlights

| Threat | Mitigation |
|---|---|
| Cross-workspace data access | Gateway partition checks + store-level partitioning + domain ownership checks |
| Privilege escalation | Edge RBAC + domain checks; role change audit trail |
| Token theft | Short-lived access, rotating refresh, revocation |
| Queue/worker abuse | At-least-once + idempotency; dead-letter + alerting |
| Integration abuse | Scoped OAuth, allow-list of scopes, ACL per provider (Chapter 18) |
| Replay / timing | Idempotency keys; constant-time comparisons; rate limits |

---

## 11. Search Architecture

### 11.1 Search Pipeline

```
Write path                                 Query path
─────────                                 ─────────
Domain event ──▶ Search indexer (async)    Query ──▶ API gateway
                      │                              │  (workspace-scoped,
                      ▼                              │   permission-filtered)
              [Search Index]  ◀── index update ──────┘
                   │
                   ▼
            Query: workspaceId AND (fuzzy text OR filters)
            → ranked results → read-model envelope
```

### 11.2 Indexing Strategy (aligns with DDD §12)

- Index partitions per `workspaceId` — a workspace's index is isolated from every other workspace.
- Entities indexed: Features, Tasks, Projects, Sprints, KB Entries, Documents, Members, Comments, Releases.
- **Private execution data is never indexed.** Focus sessions, blocks, and summaries do not appear in search (privacy boundary).
- Fields: title, description, tags, comments (text) + structured filters (status, owner, sprint, project, milestone).

### 11.3 Query Capabilities (v1)

| Capability | Behavior |
|---|---|
| Global search | Across all visible entities in current workspace |
| Scoped search | Within a project/sprint/KB section |
| Filters + faceted results | Status, assignee, type, tags, date range |
| Type-ahead | Prefix/fuzzy matching with ranked suggestions |
| Command center `>`-prefix grammar | Navigate/create/switch (UXS §16.8) |
| Empty-state fallback | Helpful zero-result guidance (DSS empty states) |

### 11.4 Search Consistency

- Eventually consistent (index updates async, target < 5s).
- Rebuildable: full reindex from the event spine (idempotent), e.g., for index upgrades or data recovery.

### 11.5 Future (out of v1)

- Cross-workspace search (blocked by WPS §1.5 no cross-workspace aggregation — revisit only if product direction changes).
- Semantic/vector search for KB — additive index, privacy-scoped (Chapter 21).

---

## 12. File Architecture

### 12.1 File Types & Lifecycle

| File Type | Storage Class | Example |
|---|---|---|
| Attachments (features/tasks/comments) | Object store (private) | Screenshots, logs, images |
| Document imports/exports | Object store (private) | CSVs, backups |
| Workspace exports | Object store (private, admin) | Data export bundles |
| Avatars/branding assets | CDN (public within workspace) | Workspace logo, member avatars |

### 12.2 Upload/Download Flow

```
Client ──▶ API gateway (auth, size/type validation, scan)
    │
    ▼
File Service: generate pre-signed upload URL (time-limited)
    │
    ▼
Direct upload to object store (no server proxying for large files)
    │
    ▼
FileService writes File aggregate → publishes file.uploaded event
    ▼
Link to entity (feature/comment/KB) via command → indexed, realtime-fanned
```

### 12.3 Enforcement

- **Private by default.** Every file is scoped to a workspace; access checks run at read time (gateway + object-store signed URLs with short expiry).
- Size/type allow-lists and malware scanning at upload.
- Referential integrity via domain commands (a file is only attachable to an entity the actor can access).
- Retention/deletion cascades from workspace deletion (DDD §13.4 retention) and per-file lifecycle rules.

---

## 13. Background Processing

### 13.1 Job Model

- **Event-driven workers** consume the event bus (at-least-once, idempotent, DLQ).
- **Scheduled jobs** run on a scheduler (cron-like) for time-based workloads (per-workspace tick).

### 13.2 Job Inventory

| Job | Trigger | What it does | Idempotency |
|---|---|---|---|
| Read-model projection | Domain event | Rebuild/update read models | Version-checked |
| Search indexing | Domain event | Update search index | Keyed by entity+version |
| Notification delivery | Domain event | Email/in-app/push fan-out | Per-recipient dedupe |
| Integration sync | Scheduled/event | Git/chat/calendar sync via ACL | Per-external-id cursor |
| KPI snapshot | Scheduled | Compute dashboard KPI rows | Recomputable |
| Intelligence rules | Scheduled | Evaluate rules → insights | Recomputed, de-duped |
| Estimation recalibration | Scheduled | Re-estimate open features (DDD/direction) | Version-checked |
| Workspace export/backup | Scheduled/admin | Package + store export | Job idempotent |
| Retention sweep | Scheduled | Enforce retention/deletion (DDD §13.4) | Idempotent scan |
| Health/availability compute | Scheduled | Summarize execution health (anonymized) | Recomputable |

### 13.3 Background Job Flow

```
Queue ──▶ Worker pool (scaled) ──▶ job handler (idempotent)
              │                        │
              │                 ┌──────┴──────┐
              │                 │ success     │ failure
              │                 ▼             ▼
              │            ack / mark     retry (exp backoff, max N)
              │            complete          │ then
              │                              ▼
              └─────────── log + metric ── dead-letter + alert
```

- Every job logs start/end/duration/result; failures alert via observability (Chapter 16).
- Poison jobs never block the queue (DLQ isolation).

---

## 14. Real-Time Architecture

### 14.1 Scope of Realtime (aligns with UXS live-collab surfaces)

- Universal Timeline / activity feed updates.
- Mission Control and dashboard KPI movement.
- Feature/task state changes, comments, mentions, QA gate transitions, dependency updates.
- Presence indicators (who's viewing a feature/sprint).
- Command-center quick actions results.

### 14.2 Mechanism

- **WebSocket** primary; **SSE** fallback for restricted networks.
- Server: event bus → realtime gateway → topic fan-out (`workspaceId`-scoped topics; per-entity topics for detail views).
- Client subscribes to workspace topic + entity topics currently on screen; unsubscribes on navigation (perf budget).
- Delivery: **at-least-once with sequence numbers**; client dedupes by eventId (idempotent cache patches).
- Reconnection: resubscribe + replay missed events since last seen sequence (gap fill via REST).

### 14.3 Presence

- Presence is ephemeral and workspace-scoped; heartbeats with TTL; never persisted to the event spine.
- Presence never exposes Focus & Time private data (only "viewing" indicators).

### 14.4 Notification Pipeline

```
Domain event ──▶ Notification service
      │
      ├─▶ In-app: realtime push + persisted inbox (read model)
      ├─▶ Email: templated, batched, digest-capable (out-of-session)
      └─▶ Push (mobile/desktop): provider via worker
      │
      Preference routing per member (notification settings, WPS/UXS)
```

- Notifications respect privacy: private execution events never generate member-visible notifications of raw data.

---

## 15. Offline Architecture

### 15.1 Offline-First Client

- Web: IndexedDB-backed cache + offline queue. Desktop/mobile: embedded local store (SQLite-style) with same semantics.
- The client is fully usable offline for: reading read models, editing drafts, capturing work, browsing KB, recording focus sessions (queued).

### 15.2 Sync Protocol

```
Offline write ──▶ durable queue (device)
      │
      ▼ (reconnect / online event)
  Batch sync endpoint ──▶ per-command idempotency keys
      │
      ├─▶ domain write path (same invariants as online)
      ├─▶ server ack with canonical IDs + conflict result
      ▼
  Client reconciles: apply ack, drop queued, re-apply on conflict
```

- Commands carry idempotency keys + client-issued temp IDs; server returns canonical mapping.
- Conflicts (stale version) → surfaced per UXS conflict states; user resolves, never silently lost.
- Pull sync: fetch missed read-model updates since cursor (workspace-scoped).

### 15.3 Conflict Handling

| Case | Resolution |
|---|---|
| Same field, no concurrent change | Server wins on version; client reconciles silently |
| Concurrent edits to different fields | Field-level merge where safe |
| Concurrent edits to same field | Version conflict → user resolution UI |
| Deleted while offline | Tombstone → conflict notice; user re-creates or dismisses |
| Offline-only content | Syncs on reconnect; marked "pending" until ack |

### 15.4 Consistency Guarantees (Offline)

- **No silent loss:** nothing is dropped; everything either commits or surfaces a conflict.
- **Durability before sync:** queued commands survive app reload/OS kill (device storage).
- **Privacy preserved:** offline queue and cache are scoped to the signed-in member's own workspace data; private execution data stays private even on device.

---

## 16. Observability

### 16.1 Pillars

| Pillar | Practice |
|---|---|
| **Logs** | Structured, correlation-id tagged; request, event, job, security logs; PII redacted at source (never log tokens/private data) |
| **Metrics** | RED (rate/errors/duration) per service + domain metrics (events/s, projections lag, queue depth, sync latency) |
| **Traces** | Distributed tracing across gateway → service → domain → store → worker → external ACL |
| **Audit** | Append-only audit log for security + compliance (System Events & Audit context) |

### 16.2 Key Metrics

| Metric | Purpose |
|---|---|
| API latency p50/p95/p99, error rate | Gateway health |
| Read-model projection lag | How stale reads are |
| Realtime delivery latency (p95) | Live-collab health |
| Queue depth + DLQ count | Background health |
| Sync/offline reconciliation latency | Offline UX health |
| Workspace-level performance isolation | Noise-detection for scaling (Chapter 17) |
| Search index lag | Search freshness |

### 16.3 Alerting & Dashboards

- Alerts: SLO-based (burn-rate) with severity tiers; DLQ and security events page immediately.
- Dashboards per audience: engineering (RED), product (adoption/mission-control usage), security (auth/audit anomalies).
- Privacy: observability never ingests Focus & Time raw execution data; only anonymized aggregates.

---

## 17. Scalability

### 17.1 Scaling Model

```
         Client tier               API tier               Data tier
   Web/Desktop/Mobile ─▶ Gateway ─▶ Services (stateless) ─▶ Write store
                                │       │       │       ─▶ Read-model stores
                                │       │       │       ─▶ Event spine (append-only)
                                │       │       │       ─▶ Search index
                                └───────┴───────┴───────▶ Object store
                                                        ─▶ Cache tier
   Horizontal: gateway, services, workers, realtime gateways
   Scale-out: read-model stores, search shards, cache
   Write store: scale by aggregate workload; keep strong consistency per aggregate
```

### 17.2 Scale Strategy by Layer

| Layer | Strategy |
|---|---|
| **API/services** | Stateless horizontal scaling behind LB; no server session state |
| **Read models** | Partitioned by workspace; hot workspaces scale independently (DDD §14) |
| **Event spine** | Append-only partitioning by workspaceId + time buckets; no locking |
| **Search** | Per-workspace shards; dedicated index cluster at scale |
| **Realtime** | Stateless gateway + topic partitioning; horizontal fan-out |
| **Workers** | Auto-scale queue consumers by depth |
| **Cache** | Per-workspace cache keys; LRU + TTL |

### 17.3 Performance Budgets (align with UXS/DSS perf guidelines)

| Metric | Budget |
|---|---|
| Read-model API p95 | < 300 ms |
| Write ack (online) p95 | < 500 ms |
| Realtime event → client p95 | < 1 s |
| Projection lag p95 | < 5 s |
| Initial route payload | < 200 KB gzipped |
| Search query p95 | < 500 ms |

### 17.4 Privacy-Safe Scaling

- **No cross-workspace fan-in.** Aggregates/queries are workspace-scoped; global analytics use anonymized snapshots only.
- Performance isolation prevents one large workspace from degrading another (per-workspace concurrency budgets).

---

## 18. Integration Architecture

### 18.1 Integration Principles

- Every external system is wrapped in an **anti-corruption layer (ACL)** inside its consuming bounded context — external models never leak into domain models (ADR 11).
- Integrations are **additive**; a failed integration never degrades core (feature flags + isolation).
- External credentials are scoped OAuth tokens, encrypted, workspace-scoped, revocable.

### 18.2 Integration Catalog (v1 & roadmap)

| Integration | Roadmap Phase | Consuming Context | ACL Shape |
|---|---|---|---|
| Git providers (GitHub/GitLab/Bitbucket) | Phase 1 | Workspace/Delivery | PR/commit/release sync → events; webhook inbound; OAuth |
| Chat (Slack/Discord) | Phase 1 | Collaboration | Notifications outbound; commands inbound |
| Calendar (Google/Microsoft) | Phase 2 | Calendar | Availability + scheduling mapping |
| CI/CD | Phase 2 | Delivery | Build/deploy status → release pipeline |
| AI providers | Phase 3 | Intelligence | Guarded prompt/context service (Chapter 21) |

### 18.3 Integration Flow

```
External system ──▶ Webhook → ACL (validate signature, dedupe, rate-limit)
      │
      ▼
   ACL translates to domain events (git.push, pr.opened)
      │
      ▼
   Event spine → projectors → read models → realtime fan-out
   ─────────────────────────────────────────────────────
   Outbound: domain event → ACL → provider API (OAuth, idempotent)
```

### 18.4 Webhook & OAuth Management

- Webhook secrets per integration per workspace; signature validation mandatory; replay dedupe via event idempotency.
- OAuth flows per provider with scoped tokens; refresh managed by the Integration Manager; revocation cascade on disconnect.
- Integration Marketplace (WPS §15.3) is a catalog of these ACL adapters, versioned and feature-flagged.

---

## 19. Deployment Architecture

### 19.1 Deployment Target (v1)

FocusFlow deploys as containers on a managed orchestration platform (assumed: Kubernetes; any equivalent works). All components are ephemeral; state lives in managed data services. This chapter intentionally describes topology, not YAML.

```
                            ┌──────────────────────────────┐
                            │      Edge / Ingress (TLS)    │
                            └──────────────┬───────────────┘
                                           ▼
                        ┌──────────────────────────────────┐
                        │     API Gateway / Realtime       │
                        └────────────────┬─────────────────┘
                                         │
          ┌──────────────┬───────────────┼──────────────┬─────────────────┐
          ▼              ▼               ▼              ▼                 ▼
   [Auth Svc]    [Domain Services]   [Read Services]  [Workers]    [Realtime GW]
   [Workspace]    [Delivery]         [Reporting]      (projectors,  (WS fan-out)
   [Focus]        [Collab]           [Search]          jobs, ACL)
   [Knowledge]    [Calendar]         [Insights]
   [Intelligence] [Platform]
          │              │               │              │                 │
          ▼              ▼               ▼              ▼                 ▼
   ┌─────────┐   ┌─────────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐
   │ Write   │   │ Event spine │  │ Read-     │  │ Search    │  │ Object   │
   │ store   │   │ (append-only)│  │ model     │  │ index     │  │ store    │
   │         │   │ + bus/queue │  │ stores    │  │           │  │ + CDN    │
   └─────────┘   └─────────────┘  └───────────┘  └───────────┘  └──────────┘
```

### 19.2 Environments

| Environment | Purpose | Data |
|---|---|---|
| dev | Local/PR previews | Seeded fixtures |
| staging | Full integration + migration rehearsal | Anonymized copy |
| production | Live | Real |

- Migrations are versioned and backward-compatible; additive-only; rehearsed on staging.
- Feature flags gate every new surface (DSS Appendix D lifecycle) — deploy code dark, enable by flag.

### 19.3 Deployment Principles

- **Zero-downtime** rolling deploys; health checks before traffic cutover.
- **Stateless apps, stateful managed data** — nothing in app containers is required for recovery.
- **Backups:** write store + event spine snapshots with RPO/RTO targets; read models rebuildable from spine (so not backup-critical).
- **Secrets** in a managed secret store, never in images or env logs.

---

## 20. Extension Architecture (Plugins)

### 20.1 Plugin Model (WPS §18 roadmap)

Plugins are first-class, versioned, feature-flagged extensions that integrate via **published extension points** — they never modify core domain behavior or bypass the privacy boundary.

### 20.2 Extension Points

| Extension Point | What a plugin can do | Cannot do |
|---|---|---|
| Read-model extension | Add custom fields/cards to views | Read private execution data |
| Command interceptor | React to domain events (consume) | Mutate other contexts directly |
| Integration adapter | Add a provider (ACL shape) | Bypass OAuth/ACL isolation |
| UI surface | Render within designated plugin zones | Override core screens |
| Notification channel | New delivery channel | Read raw Focus data |

### 20.3 Plugin Lifecycle & Sandbox

```
Register (manifest) ──▶ Validate (schema, version, permissions)
      │
      ▼
Enable (flag) ──▶ Runtime sandbox (isolated context)
      │
      ▼
Audit: plugin actions logged; capabilities revoked on disable
```

- Manifest declares capabilities + data scope; runtime enforcement matches the declared scope.
- Sandboxing isolates plugin code; core cannot be crashed by a plugin.
- Plugin Marketplace = catalog of versioned, reviewed extensions (WPS §15.3 Integration Marketplace alignment).

---

## 21. AI Architecture

### 21.1 AI in v1: Guarded, Rules-First

Per UXS §15 (Workspace Intelligence) and DDD, FocusFlow v1 AI is **rules-based and explainable**, not free-form generative AI. An AI layer is architected now so it can be added safely later (Phase 4/5 roadmap).

### 21.2 AI Context Flow (future, additive)

```
Read models + anonymized summaries ──▶ Context Builder (privacy filter)
      │
      ▼
  [AI Provider ACL]  ── only pre-scoped, workspace-approved context
      │
      ▼
  Guardrail layer (allow-list of intents, prompt/response policy)
      │
      ▼
  Insight/Action proposals ──▶ human review ──▶ domain events
```

### 21.3 AI Guardrails

- **Privacy boundary holds.** AI context is assembled exclusively from workspace read models and anonymized summaries — never raw Focus & Time execution data, never cross-workspace data (DDD §13.3).
- **Explainability:** every AI proposal shows its evidence and is dismissible (UXS §15.4 insight anatomy).
- **Human in the loop:** AI proposes; domain commands (executed by members) dispose. AI never mutates aggregates directly.
- **Opt-in and auditable:** per-workspace enablement; every AI interaction is audited; capability-scoped tokens.
- **Graceful degradation:** AI is optional; a failing provider never affects core functionality (feature flag + isolation).

### 21.4 AI Roadmap Slots (Chapter 25)

- Phase 3: summarization, natural-language reporting queries, KB Q&A (scoped).
- Phase 4: prediction (risk/velocity suggestions) built on the same rules substrate.
- Phase 5: agentic assists — still proposal-only, still privacy-scoped.

---

## 22. Engineering Standards

### 22.1 Principles Applied Across the Stack

Separation of Concerns · Domain-Driven Design · Clean Architecture · SOLID · Event-Driven · Modular · Automation First · Offline First · Security by Design · Observability · Scalability · Maintainability · Testability · Extensibility · Developer Experience.

### 22.2 Code Organization

- **Monorepo (assumed)** with clear package boundaries: `domain/*` (aggregates, ports), `application/*` (use cases), `infrastructure/*` (adapters), `services/*` (deployables), `clients/*` (web/desktop/mobile shared core), `contracts/*` (read-model + command schemas, shared kernel).
- Each bounded context is a package with an explicit public surface; cross-package access restricted (import rules enforced in CI).
- The shared kernel (IDs, MemberRef, timestamps) is versioned and published.

### 22.3 Testing Strategy (map)

| Layer | Test focus | Examples |
|---|---|---|
| Domain | Invariants, pure logic | QA gate rules, dependency impact, estimation |
| Application | Use-case orchestration | CreateFeature, AdvanceQA, StartSession |
| Infrastructure adapters | Store/queue/search behavior | Projector idempotency, outbox atomicity |
| API | Contract, authn/authz, validation | Edge RBAC, workspace partitioning |
| Frontend | Components, hooks, cache, offline queue | Optimistic reconcile, conflict UI |
| E2E | Critical journeys | Onboarding, QA gate, Mission Control |
| Performance | Budgets (Chapter 17.3) | Read latency, projection lag, payload size |
| Security | Auth/authorization/audit | Privacy boundary tests (no cross-member reads) |

### 22.4 Quality Gates (CI)

Lint · typecheck · unit tests · contract tests · bundle-size budget · security scan (deps + secrets) · migration dry-run. A PR cannot merge if any gate fails.

---

## 23. Architecture Decision Records (ADR)

### ADR 1 — Why DDD?

- **Context:** Complex domain with many entities, invariants, and cross-cutting privacy rules.
- **Decision:** Model the system as bounded contexts with aggregate roots (DDD §2–§3).
- **Alternatives:** Transaction-script CRUD; anemic data layer.
- **Consequences:** Steeper initial modeling; long-term integrity, team seams, and privacy enforcement.
- **Status:** Adopted.

### ADR 2 — Why Event-Driven?

- **Context:** Read models, realtime, notifications, search, analytics all need the same state changes.
- **Decision:** Every mutation publishes events to an append-only spine; all consumers are projections.
- **Alternatives:** Direct read-store updates from the write path; DB triggers.
- **Consequences:** Eventual consistency everywhere reads happen; asynchronous reconciliation complexity.
- **Status:** Adopted.

### ADR 3 — Why Feature-Centric Workspace?

- **Context:** WPS/UXS define workspace structure as projects → sprints → features → tasks with a dependency graph (WPS §10.6).
- **Decision:** Feature is the central aggregate; tasks/dependencies/QA gate orbit it.
- **Alternatives:** Task-centric models.
- **Consequences:** Matches PM + engineering mental models; enables mission control and velocity analytics.
- **Status:** Adopted.

### ADR 4 — Why Developer-Owned Execution?

- **Context:** Focus & Time data is private and developer-driven (WPS §3.4.x, DDD §5.3).
- **Decision:** Developers own their execution data; the system never fabricates it; system only composes anonymized summaries.
- **Alternatives:** Manager- or admin-input execution data.
- **Consequences:** Trust + accuracy; requires summaries to be genuinely anonymous.
- **Status:** Adopted.

### ADR 5 — Why Read/Write Separation?

- **Context:** Strong write consistency needed per aggregate; fast, denormalized reads at scale.
- **Decision:** Writes → domain → write store; reads → projections → read-model stores (Chapter 9).
- **Alternatives:** Single store, CQRS-lite.
- **Consequences:** Eventual-consistency UX (mitigated by < 5s projection targets and realtime patching).
- **Status:** Adopted.

### ADR 6 — Why Append-Only Events?

- **Context:** Auditability, replayability, future event sourcing (DDD §8, §15).
- **Decision:** Events are immutable; corrections are compensating events.
- **Alternatives:** Update-in-place audit logs.
- **Consequences:** Storage growth (managed by retention/policy); strong compliance story.
- **Status:** Adopted.

### ADR 7 — Why Rules-Based Intelligence in v1 (no free-form AI)?

- **Context:** UXS §15 requires explainable, calm, conservative insights.
- **Decision:** Rule engine over anonymized summaries; AI deferred behind the same read/context boundary (Chapter 21).
- **Alternatives:** LLM-first insights.
- **Consequences:** Slower "wow", far stronger trust/privacy/compliance posture.
- **Status:** Adopted.

### ADR 8 — Why REST + Fixed Read Models (not GraphQL) for v1?

- **Context:** Multiple clients need predictable contracts.
- **Decision:** Versioned REST commands + fixed read models; GraphQL deferred.
- **Alternatives:** GraphQL from day one.
- **Consequences:** Some over/under-fetching; contract simplicity + caching + offline replay benefits.
- **Status:** Adopted for v1; revisit at scale (ADR status: open).

### ADR 9 — Why Standard RBAC + Workspace Isolation in v1?

- **Context:** WPS §1.5 excludes enterprise SSO/custom roles/IP allow-lists in v1.
- **Decision:** Fixed roles (Admin/Member/Viewer) enforced at edge + domain.
- **Alternatives:** Full ABAC/custom roles now.
- **Consequences:** Ship speed; enterprise additions are additive at the auth interface.
- **Status:** Adopted.

### ADR 10 — Why Outbox/Atomic Event Append?

- **Context:** Events must never be lost or emitted without their state change.
- **Decision:** Aggregate write + event append in one atomic unit (outbox pattern).
- **Alternatives:** Dual-write without transaction.
- **Consequences:** No duplicate/missing events; slightly higher write cost.
- **Status:** Adopted.

### ADR 11 — Why Anti-Corruption Layers for Every Integration?

- **Context:** External models (Git PRs, chat threads) must not pollute domain model.
- **Decision:** Every external system wrapped in an ACL (Chapter 18).
- **Alternatives:** Direct external-model usage in domain.
- **Consequences:** More adapter code; clean, testable, replaceable integrations.
- **Status:** Adopted.

---

## 24. Risks & Technical Debt

| # | Risk / Debt | Severity | Mitigation |
|---|---|---|---|
| R1 | Eventual consistency surprises in dashboards | Medium | Projection-lag SLOs + realtime patching; document freshness UX |
| R2 | Event spine volume growth | Medium | Retention policy (DDD §13.4) + partition by time bucket; archive to cold store |
| R3 | Cross-team bounded-context drift | Medium | Shared kernel review board + import rules in CI |
| R4 | Offline conflict complexity | Medium | Conflict UI as first-class UX (UXS §7.x) + rigorous E2E tests |
| R5 | Write-store strong consistency hotspot (one hot workspace) | Medium | Per-workspace isolation + aggregate-scoped concurrency; revisit partitioning at scale |
| R6 | Realtime infrastructure cost at scale | Medium | Topic partitioning, per-entity subscriptions, SSE fallback |
| R7 | AI additions could threaten privacy boundary | High | Guardrail layer + audited AI context builder (Chapter 21); AI is additive only |
| R8 | Monorepo build/test time | Low | Fine-grained caching + CI parallelism |
| R9 | Search index lag → stale results | Low | Per-workspace shards + freshness SLO |
| R10 | Migration to event sourcing later | Low | Spine is already complete; replay proven by rebuildable projectors |

---

## 25. Future Evolution

### Phase 1 — Core Platform
Web app live: onboarding, workspace, delivery (features/tasks/sprints), QA gate, focus sessions, read models, realtime, notifications, search, audit. (Assumed existing direction; this SAD's base.)

### Phase 2 — Collaboration & Engineering Platform
Comments/mentions/timeline full live-collab; integrations (Git, chat, CI/CD); desktop + mobile clients via shared core; calendar mapping; plugin system extension points.

### Phase 3 — AI Platform
Guarded AI (summarization, natural-language reporting, KB Q&A) through the AI context boundary (Chapter 21); semantic search additive.

### Phase 4 — AI Insights & Prediction
Predictive risk/velocity built on the rules substrate; agentic assist — proposals only, human-in-the-loop, privacy-scoped.

### Phase 5 — Developer Operating System
Mission Control as the everyday command surface; deeper automation (releases, estimates) with the same audit and privacy guarantees.

Every phase is additive to this SAD: same bounded contexts, same event spine, same read/write separation, same privacy boundary. No phase requires architectural rework of the base.

---

## Revision History

| Version | Date | Author | Notes |
|---|---|---|---|
| v1.0 | 2026 | FocusFlow Architecture Team | Initial SAD — complete software architecture (25 chapters) |

---

*This document contains no implementation code, schemas, API endpoints, or deployment manifests. It is the engineering blueprint; implementation artifacts are produced in the Engineering Layer (API Specification, Frontend/Backend Architecture Guides, Testing Strategy, DevOps & Deployment Guide, Implementation Roadmap).*
