# FocusFlow — API & Integration Specification (AIS)

**Product Name:** FocusFlow
**Document Type:** API & Integration Specification (AIS)
**Supersedes:** N/A — defines the communication contract for every client and service
**Source of Truth:** FocusFlow PRD (v1.0); FocusFlow WPS (v1.1); FocusFlow UXS (v1.1); FocusFlow DSS (v1.1); FocusFlow DTS (v1.1); FocusFlow DDD (v1.0); FocusFlow SAD (v1.0)
**Audience:** Backend Engineers, Frontend Engineers, Mobile Engineers, Desktop Engineers, DevOps Engineers, QA Engineers, Security Engineers, AI Engineers, Integration Engineers, Technical Leads, Product Architects
**Status:** Draft v1.0
**Scope:** This document defines **HOW CLIENTS COMMUNICATE WITH THE PLATFORM** — every API surface, protocol, request lifecycle, response model, event contract, synchronization model, authentication flow, realtime communication, integration architecture, and versioning strategy. It is the authoritative communication contract for the Web Client, Desktop Client, Mobile Client, Mission Control, AI Services, the Plugin System, and future third-party integrations.

This is **not** a coding document. It deliberately contains no Express/Fastify/NestJS/Node.js code, no React hooks, no Axios calls, no database schemas, and no OpenAPI YAML/Swagger JSON. It is the implementation-independent contract from which those artifacts are produced.

**Consistency obligations.** The PRD, WPS, UXS, DSS, DTS, DDD, and SAD are authoritative. This document does not redesign the product, invent entities, alter workflows, change permissions, or replace the architecture. Where this document references product behavior, it does so by citing those documents. If a conflict appears, the referenced source-of-truth document wins and this document is corrected.

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [API Architecture](#2-api-architecture)
3. [API Categories](#3-api-categories)
4. [Endpoint Catalogue](#4-endpoint-catalogue)
5. [Authentication](#5-authentication)
6. [Authorization](#6-authorization)
7. [Standard API Conventions](#7-standard-api-conventions)
8. [Response Standards](#8-response-standards)
9. [Event Contracts](#9-event-contracts)
10. [Realtime APIs](#10-realtime-apis)
11. [Offline Synchronization](#11-offline-synchronization)
12. [Search APIs](#12-search-apis)
13. [File APIs](#13-file-apis)
14. [Notification APIs](#14-notification-apis)
15. [Plugin APIs](#15-plugin-apis)
16. [Integration APIs](#16-integration-apis)
17. [AI APIs](#17-ai-apis)
18. [Performance](#18-performance)
19. [Security](#19-security)
20. [Versioning Strategy](#20-versioning-strategy)
21. [API Governance](#21-api-governance)
22. [Future Evolution](#22-future-evolution)

---

## 1. Executive Overview

### 1.1 Purpose

The AIS is the **single contract** every client and service uses to communicate with FocusFlow. It defines:

- The **API surface** — every endpoint, its request/response model, validation, authorization, side effects, published events, affected read models, realtime updates, and audit entries.
- The **protocols** — HTTPS for commands and queries, WebSocket/SSE for realtime, a sync protocol for offline operation, webhooks/OAuth for integrations.
- The **contracts that keep clients consistent** — envelopes, pagination, errors, versioning, idempotency, and the event schema.

It exists so that five client surfaces (Web, Desktop, Mobile, Mission Control, AI Services) and an unbounded set of future third-party integrations speak to the platform through **one, stable, versioned contract** — not five bespoke interfaces.

### 1.2 Goals

| Goal | How the AIS achieves it |
|---|---|
| **One contract, many clients** | A single versioned API; every client is a peer (SAD §4.1, §8.3) |
| **Stable communication surface** | Versioned contracts, additive-only changes within a major version (SAD §8.3, Ch. 20) |
| **Strong writes, fast reads** | Command APIs enforce invariants via aggregates; read-model APIs serve projections (SAD Ch. 9) |
| **Realtime collaboration** | WS/SSE event fan-out with idempotent event IDs (DDD §11, SAD Ch. 14) |
| **Offline-first operation** | Durable client queue + sync protocol with temp/canonical IDs (DDD §12, SAD Ch. 15) |
| **Privacy by construction** | The privacy boundary is enforced at the data layer; private execution data is never queryable cross-member (DDD §13.3) |
| **Extensible to AI & plugins** | AI and plugin surfaces are first-class, guarded, additive (SAD Ch. 20–21) |
| **Integrable with external systems** | OAuth + webhooks + anti-corruption layers (SAD Ch. 18) |

### 1.3 API Philosophy

FocusFlow's API follows five beliefs:

1. **Resources over RPC.** Commands are operations on resources; queries return read models. All resources are workspace-scoped (or member-scoped for private data).
2. **Commands are idempotent.** Every write accepts an `Idempotency-Key` so retries never duplicate side effects (SAD §8.2, ADR 10).
3. **The server is authoritative.** Clients may optimistically render, but the server enforces invariants and returns authoritative truth (SAD §2.2).
4. **Read models are the UI's data.** UIs render read models, never write-store internals. This keeps clients fast and eventually-consistent by design (SAD Ch. 9).
5. **Consistency is explicit, not accidental.** The contract states exactly what is strong, what is eventual, and what is at-least-once — clients can rely on those promises.

### 1.4 Architectural Context

FocusFlow is an event-driven platform organized into ten bounded contexts (DDD §2). The API sits at the edge of that architecture:

```
Clients (Web / Desktop / Mobile / Mission Control / AI / Plugins / 3rd parties)
                        │
                        ▼
              ┌───────────────────┐
              │   API Gateway     │  Ch.2 · Ch.19
              └───────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  Command APIs (writes)          Read-model APIs (reads)
        │                               │
        ▼                               ▼
  Application Services ─────▶ Domain Aggregates (invariants)
        │                               ▲
        │  publish events               │ projections
        ▼                               │
  Event Spine (append-only) ────────────┘
        │
        ▼
  Realtime gateway · Search · Notifications · Analytics · Webhooks
```

- **Bounded contexts** (DDD §2): IAM, Workspace, Delivery, Focus & Time, Collaboration, Knowledge, Reporting & Analytics, Calendar, Intelligence, System Events & Audit.
- **Ownership model** (DDD §1.3, §5): workspace owns structure; developer owns execution (private); system owns generated truth; user owns personal configuration.
- **Consistency model** (DDD §7): write aggregates strongly consistent; read models eventually consistent; events append-only and immutable.

### 1.5 Communication Principles

| Principle | Rule |
|---|---|
| **Consistency** | All commands and queries share one contract, one envelope, one versioning scheme |
| **Idempotency** | Writes accept idempotency keys; event IDs are globally unique and dedupe-able |
| **Statelessness** | The API is stateless; sessions live in tokens, caches live client-side |
| **Versioning** | `/api/v1/...`; additive-only within a major version (Ch. 20) |
| **Pagination** | Cursor-based, shared across all list read models (SAD §8.2) |
| **Filtering & sorting** | Declarative query params on list read models (Ch. 7) |
| **Caching** | HTTP caching + client cache with stale-while-revalidate; realtime invalidation (Ch. 18) |
| **Error consistency** | One error envelope with stable codes (Ch. 8) |
| **Security** | AuthN at the edge, AuthZ at the edge and in the domain, privacy at the data layer (Ch. 19) |
| **Performance** | Budgets: read p95 < 300 ms, write ack p95 < 500 ms, realtime p95 < 1 s (SAD §17.3) |
| **Extensibility** | Additive fields, events, and endpoints only; AI/plugins/integrations are guarded surfaces |
| **Backward compatibility** | Deprecation + sunset policies; no breaking changes within a major version (Ch. 20) |

---

## 2. API Architecture

### 2.1 Layered API Model

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER                                                                │
│ Web · Desktop · Mobile · Mission Control · AI Services · Plugins · 3rd-party│
│ Optimistic cache · offline queue · realtime subscriptions · sync engine     │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ HTTPS (commands/queries) · WS/SSE (realtime)
┌───────────────────────────────▼────────────────────────────────────────────┐
│ GATEWAY LAYER  (Ch.2 §2.3)                                                  │
│ TLS · authN · rate limit · idempotency dedupe · routing · correlation       │
└───────────────────────────────┬────────────────────────────────────────────┘
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐      ┌──────────────────┐     ┌──────────────────┐
│ COMMAND APIS  │      │ READ-MODEL APIS  │     │ REALTIME APIs    │
│ (writes)      │      │ (reads)          │     │ WS/SSE topics    │
└───────┬───────┘      └────────┬─────────┘     └────────┬─────────┘
        ▼                       ▼                       │
┌──────────────────┐   ┌──────────────────┐             │
│ APPLICATION      │   │ Read-model       │             │
│ SERVICES (use    │   │ stores (cached,  │             │
│ cases, no rules) │   │ partitioned)     │             │
└───────┬──────────┘   └──────────────────┘             │
        ▼                                               │
┌──────────────────┐   ┌──────────────────┐             │
│ DOMAIN           │   │ Projectors (from │◀── events ──┤
│ AGGREGATES       │──▶│ event spine)     │             │
│ (invariants,     │   └──────────────────┘             │
│  events)         │                                   │
└───────┬──────────┘                                   │
        ▼                                               │
┌──────────────────┐   ┌──────────────────┐             │
│ WRITE STORE      │   │ EVENT SPINE      │─────────────┘
│ (aggregates)     │   │ (append-only)    │
└──────────────────┘   └──────────────────┘
```

### 2.2 Layer Responsibilities

| Layer | Responsibility | Constraints |
|---|---|---|
| **Client** | Render read models, issue commands, maintain optimistic cache + offline queue, subscribe to realtime | Never enforces business invariants; server is authoritative |
| **Gateway** | TLS, authentication, rate limiting, idempotency-key dedupe, workspace-partition checks, routing, correlation IDs (SAD §8.2, §10.1) | No business logic |
| **Command APIs** | Accept writes; validate shape; delegate to application services; return authoritative result | Thin; no domain rules |
| **Read-model APIs** | Serve projections from read-model stores | Never query the write store (SAD §9.2) |
| **Application services** | Orchestrate use cases; coordinate aggregates | No invariants; delegate to domain |
| **Domain aggregates** | Enforce business invariants; emit domain events (DDD §2.4) | No infrastructure dependencies |
| **Projectors** | Build read models, search index, KPIs from the event spine | Idempotent, replayable |
| **Event spine** | Append-only record of every mutation (DDD §8) | Immutable; corrections are new events |

### 2.3 Gateway Responsibilities (Detail)

The gateway is the single entry point (SAD §8.2):

1. **Terminate TLS** and validate tokens.
2. **Authenticate** the caller; attach identity + workspace memberships to the request context.
3. **Authorize at the edge**: role capability checks and workspace-membership checks before routing.
4. **Rate limit** per member/workspace/endpoint class (Ch. 18).
5. **Dedupe idempotent commands** by `Idempotency-Key` (return prior response).
6. **Partition-check** workspace-scoped requests so a request can never reach another workspace's store.
7. **Assign correlation** metadata; propagate to logs, traces, events, and external calls.
8. **Route** to the owning service; the client never addresses services directly.

### 2.4 Request & Response Lifecycle

```
REQUEST LIFECYCLE                         RESPONSE LIFECYCLE
──────────────                           ──────────────────
Client builds request ─────────────────┐
  + Idempotency-Key (writes)           │
  + If-None-Match (reads)              │
        │                              │
        ▼                              │
Gateway: TLS → authN → rate limit ─────┤
  dedupe (idempotent hit → cached      │
  response, skip service)              │
        │                              │
        ▼                              │
Authorization (edge capability +       │
  workspace partition)                 │
        │                              │
        ▼                              │
[Write path]                 [Read path]│
Application service ──▶        Read-model store query
Domain aggregate (invariants)          │
  persist + publish event              │
        │                              │
        ▼                              │
Event spine (append-only)              │
  → projectors → read models           │
  → realtime gateway                   │
  → search/notify/webhooks             │
        │                              │
        └─────────► Build envelope: data | error | meta
                        Response: status · ETag · Retry-After
                        → client reconciles optimistic state
                        → client updates cache, applies realtime patch
```

### 2.5 Command vs. Query Separation

| | Command APIs | Read-model APIs |
|---|---|---|
| Purpose | Change state | Fetch state |
| Path prefix | `/api/v1/...` (resource writes) | `/api/v1/...` (resource reads) + read-model bundles |
| Consistency | Strong (aggregate-scoped) | Eventually consistent (projection lag < 5 s) |
| Idempotency | `Idempotency-Key` required | GET/POST queries are idempotent by nature |
| Caching | Never cached by CDN | HTTP-cacheable where safe; client cache + stale-while-revalidate |
| Events | Every command may publish events | Never publishes events |
| Realtime | May trigger fan-out | Never triggers fan-out |
| Audit | Mutations write ActivityEvent | Reads never write ActivityEvent |

### 2.6 URL Shape & Base Path

- Base path: **`/api/v1`** (all endpoints in this document are relative to it; e.g., `POST /api/v1/workspaces/{workspaceId}/features`).
- Workspace-scoped resources are nested under `/workspaces/{workspaceId}`.
- Member-private resources live under `/me` (sessions, worklogs, journal, preferences, favorites, notifications).
- Realtime: `wss://.../api/v1/realtime` (WS) with `/api/v1/stream` (SSE fallback).
- Sync: `POST /api/v1/sync` (offline batch), `GET /api/v1/sync/pull` (read-model catch-up).

### 2.7 Backward-Compatibility Seam

The layering above guarantees that client and platform evolve independently: clients depend on **contracts**, not on service internals. Read models can be re-projected, stores can be swapped, and services can be split without changing a single client (SAD §8.3). This seam is what makes Phase 2–5 (Ch. 22) non-breaking.

---

## 3. API Categories

FocusFlow exposes twenty-one API categories, one per coherent surface. Each category maps to bounded contexts (DDD §2) and the surfaces defined in the WPS/UXS.

| # | Category | Bounded Context(s) | Primary Consumers | Example Resources |
|---|---|---|---|---|
| 3.1 | **Identity APIs** | IAM | Web, Desktop, Mobile | Auth, `/me`, profile, preferences, favorites, device sessions |
| 3.2 | **Workspace APIs** | Workspace, IAM | Web, Desktop, Mobile | Workspace, members, teams, templates, announcements, overview |
| 3.3 | **Project APIs** | Workspace, Delivery | All clients | Project, project board, milestones, project members |
| 3.4 | **Sprint APIs** | Delivery | All clients | Sprint lifecycle, sprint features, burndown |
| 3.5 | **Feature APIs** | Workspace, Delivery | All clients | Feature CRUD, transitions, assign, estimate, dependencies, QA |
| 3.6 | **Task APIs** | Focus & Time | Web, Desktop, Mobile | Personal + linked tasks |
| 3.7 | **Session APIs** | Focus & Time | Web, Desktop, Mobile | Focus sessions (private) |
| 3.8 | **WorkLog APIs** | Focus & Time | Web, Desktop, Mobile | Work logs (private) |
| 3.9 | **Journal APIs** | Focus & Time | Web, Desktop, Mobile | Journal entries (private) |
| 3.10 | **Knowledge Base APIs** | Knowledge | All clients | KB docs, versions |
| 3.11 | **Reports APIs** | Reporting | Web, Desktop, Mobile | Report generation, schedules, shares |
| 3.12 | **Analytics APIs** | Reporting, Intelligence | Web, Desktop, Mission Control | KPIs, velocity, burndown, health, load |
| 3.13 | **Calendar APIs** | Calendar | All clients | Calendar entries, availability |
| 3.14 | **Notification APIs** | Collaboration | All clients | Inbox, preferences, digest |
| 3.15 | **Search APIs** | Workspace, Knowledge, Reporting | All clients | Global/workspace/scoped search, suggestions |
| 3.16 | **File APIs** | Platform, Workspace | All clients | Uploads, downloads, attachments, exports, imports |
| 3.17 | **Admin APIs** | IAM, Platform | Admin surfaces | Audit log, feature flags, usage |
| 3.18 | **Settings APIs** | Workspace, Intelligence | Web, Desktop | Workspace settings, intelligence rules, branding, integrations |
| 3.19 | **Mission Control APIs** | Reporting, Collaboration, Intelligence | Mission Control | MC bundle, risk list, presence grid, QA queue |
| 3.20 | **Plugin APIs** | Platform | Plugin system, 3rd parties | Registration, lifecycle, permissions, marketplace |
| 3.21 | **AI APIs** | Intelligence | AI services, Web | Insights, summaries, standups, context |

### 3.1 Category Mapping to Product Surfaces

- **Web Client**: all categories.
- **Desktop Client**: all categories; global hotkeys and tray use Identity, Focus & Time, Notification APIs.
- **Mobile Client**: all categories; offline-first Session/WorkLog/Journal/Task capture is primary (PRD §14.2).
- **Mission Control**: read-model-heavy — Workspace, Delivery, Reporting, Analytics, Collaboration, Intelligence (WPS §11.5).
- **AI Services**: AI, Search, Reports, Analytics, Knowledge — guarded by the AI context boundary (SAD Ch. 21).
- **Plugin System**: Plugin, plus the event + webhook surfaces it is permitted to consume (SAD Ch. 20).
- **Third-party integrations**: Integration APIs (Ch. 16) — OAuth, webhooks, ACL adapters.

### 3.2 Resource Naming Canon (used in Ch. 4)

| Canonical resource | Backed by (DDD) | Notes |
|---|---|---|
| `workspace` | Workspace | `Workspace` |
| `member` | WorkspaceMembership | API calls it "member"; the aggregate is `WorkspaceMembership` |
| `team`, `project`, `sprint`, `feature`, `task`, `milestone`, `release` | per DDD §3 | Work-item structure |
| `session`, `worklog`, `journal` | Session, WorkLog, Journal | Developer-owned, private (DDD "Work Log" spelling canonicalized to `WorkLog`) |
| `kb-doc` | KbDoc | Knowledge base document |
| `report`, `dashboard`, `calendar-entry`, `notification`, `insight` | per DDD §3 | Derived/collaboration entities |
| `plugin` | Plugin Manager (SAD) | Extension system |

---

## 4. Endpoint Catalogue

### 4.1 How to Read Endpoint Cards

Every endpoint card defines the full contract. **Shared defaults (not repeated per card):**

- **Authentication:** access token required (Bearer) unless the card says "public". AuthN details: Ch. 5.
- **Authorization:** role capabilities per WPS §5.1 + permission matrix in Ch. 6 §6.4. Card lists the roles that may invoke the endpoint.
- **Errors:** all cards share the envelope (Ch. 8) and these universal codes: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found), `409` (conflict), `422` (semantic invariant violation), `429` (rate limited), `500` (server). Cards list only **notable/extended** codes.
- **Idempotency:** every mutating card accepts `Idempotency-Key` (Ch. 7 §7.9).
- **Versioning:** all endpoints are `/api/v1/...` unless noted.
- **Realtime updates:** triggered per card; delivery semantics per Ch. 10.
- **Audit:** every mutation writes an ActivityEvent (DDD §8); cards name the audit category.

Card field glossary: **Purpose** (what it does) · **HTTP/Resource** (method + path) · **AuthZ** (roles permitted) · **Request** (request model) · **Response** (success model + status) · **Validation** (shape/field rules) · **Errors** (notable codes beyond the universal set) · **Business rules** (invariants enforced, with citations) · **Side effects** (what else happens) · **Events** (published events) · **Read models** (projections invalidated/updated) · **Realtime** (subscription topics pushed) · **Audit** (category) · **Future** (additive extensions reserved).

---

### 4.2 Identity APIs

**4.2.1 Login**
| Field | Spec |
|---|---|
| Purpose | Authenticate a member and start a session |
| HTTP/Resource | `POST /api/v1/auth/login` (public) |
| AuthZ | None — public endpoint |
| Request | `{ "email": string(≤254, email), "password": string(8–256), "deviceLabel": string(≤120)?, "pushToken": string? }` |
| Response | `200` `{ "accessToken", "refreshToken", "expiresIn": 900, "user": { id, name, email, defaultWorkspaceId }, "workspaces": [ {id, slug, name, role} ] }` |
| Validation | Email format; password present; deviceLabel ≤120 |
| Errors | `401` invalid credentials; `423` suspended/disabled member |
| Business rules | Credentials verified by Auth Service (SAD §5.2, §10.2); login records a device session; member must be active (not suspended, WPS §1.5) |
| Side effects | New device session (rotating refresh token); login ActivityEvent; failed-login counter (lockout policy) |
| Events | `auth.login` (audit only, not projectable) |
| Read models | None (client bootstraps from `GET /api/v1/me`) |
| Realtime | None |
| Audit | `security` — access |
| Future | SSO/OAuth `idToken` grant; MFA challenge step (Ch. 5 §5.10) |

**4.2.2 Logout**
| Field | Spec |
|---|---|
| Purpose | End the current session |
| HTTP/Resource | `POST /api/v1/auth/logout` |
| AuthZ | Authenticated |
| Request | `{ "refreshToken": string? }` (optional; revokes current session if omitted) |
| Response | `204` |
| Validation | Token must belong to the caller |
| Business rules | Revokes refresh token; invalidates device session; realtime presence set offline |
| Side effects | Presence removal; session revocation |
| Events | `auth.logout` |
| Read models | Presence grid |
| Realtime | Presence update (member offline) |
| Audit | `security` |
| Future | Logout-everywhere (bulk revocation) |

**4.2.3 Refresh**
| Field | Spec |
|---|---|
| Purpose | Exchange a refresh token for a new access token (silent refresh) |
| HTTP/Resource | `POST /api/v1/auth/refresh` |
| AuthZ | Valid rotating refresh token (Ch. 5 §5.3) |
| Request | `{ "refreshToken": string }` |
| Response | `200` `{ "accessToken", "expiresIn": 900 }` (refresh token rotates: new value returned when rotation policy applies) |
| Errors | `401` expired/revoked/reused token (reuse → revoke family) |
| Business rules | Rotation + reuse detection (SAD §10.2); access token TTL ~15 min |
| Side effects | Token rotation recorded; reuse anomaly → family revocation + alert |
| Events | `auth.token.refreshed` (audit) |
| Read models | None |
| Realtime | None |
| Audit | `security` |
| Future | Refresh-token families for multi-device granularity |

**4.2.4 Password Reset (request)**
| Field | Spec |
|---|---|
| Purpose | Request a password-reset email |
| HTTP/Resource | `POST /api/v1/auth/password-reset/request` (public) |
| AuthZ | None — public; anti-abuse: always `202` regardless of existence |
| Request | `{ "email": string }` |
| Response | `202` (always accepted, never reveals account existence) |
| Validation | Email format |
| Business rules | Issues time-limited reset token; single active token per user (new request invalidates old) |
| Side effects | Email sent via Notification Service; reset token recorded |
| Events | `auth.password.reset.requested` (audit) |
| Read models | None |
| Realtime | None |
| Audit | `security` |
| Future | Rate-limited challenge (CAPTCHA) |

**4.2.5 Password Reset (confirm)**
| Field | Spec |
|---|---|
| Purpose | Set a new password with a valid reset token |
| HTTP/Resource | `POST /api/v1/auth/password-reset/confirm` (public) |
| AuthZ | Valid reset token (one-time) |
| Request | `{ "token": string, "newPassword": string(8–256) }` |
| Response | `204` |
| Errors | `400` weak password; `401` expired/used token |
| Business rules | Password policy (≥8, complexity per DSS content rules); on success: revoke all sessions; emit reset event |
| Side effects | Password updated; all refresh tokens revoked; notification email "password changed" |
| Events | `auth.password.changed` |
| Read models | None |
| Realtime | All devices forced to re-login |
| Audit | `security` |
| Future | Passkeys |

**4.2.6 Email Verification**
| Field | Spec |
|---|---|
| Purpose | Verify the member's email address (initial + changes) |
| HTTP/Resource | `POST /api/v1/auth/email/verify` |
| AuthZ | Authenticated (send) / valid verification token (confirm) |
| Request | `{ "token": string }` (confirm); `{}` (send) |
| Response | `204` |
| Business rules | Token one-time, time-limited; verified flag on User (DDD §3 IAM) |
| Side effects | Sends verification email; marks `emailVerified` |
| Events | `auth.email.verified` |
| Read models | Member profile |
| Realtime | None |
| Audit | `security` |
| Future | Resend throttling |

**4.2.7 Me (profile)**
| Field | Spec |
|---|---|
| Purpose | Fetch the calling member's identity, preferences summary, favorites, and memberships |
| HTTP/Resource | `GET /api/v1/me` |
| AuthZ | Authenticated |
| Response | `200` `{ user: {...}, preferences: {...}, favorites: [...], recents: [...], workspaces: [...] }` |
| Business rules | Personal data only (owner-only, DDD §5.4) |
| Side effects | None (read) |
| Events | None |
| Read models | None |
| Realtime | None |
| Audit | None |
| Future | Additive preference sections |

**4.2.8 Update Profile / Preferences**
| Field | Spec |
|---|---|
| Purpose | Update profile fields, personal preferences, favorites, recents |
| HTTP/Resource | `PATCH /api/v1/me/profile` · `PATCH /api/v1/me/preferences` · `PUT /api/v1/me/favorites/{type}/{id}` (toggle) · `DELETE /api/v1/me/recents` |
| AuthZ | Authenticated (owner-only) |
| Request | Profile: `{ name?, avatarId?, timezone?, locale? }`; Preferences: `{ theme?, notifications?, ... }` (DTS/UXS §16.6) |
| Response | `200` updated resource |
| Validation | Enum bounds per DSS/DTS; favorite `type ∈ {project,feature,member,kbDoc,report,dashboard}` (UXS §3.7) |
| Business rules | Favorites capacity limits (UXS §3.7); personal, private (DDD §5.4) |
| Side effects | Favorites/recents updated; profile change may re-project member cards |
| Events | `user.profile.updated`, `user.favorite.toggled` (personal) |
| Read models | Member cards, favorites section, command palette groups (UXS §3.7, §16.8) |
| Realtime | Same-member devices only |
| Audit | None (personal, non-admin) |
| Future | More preference buckets |

**4.2.9 Device Sessions**
| Field | Spec |
|---|---|
| Purpose | List / revoke the member's device sessions |
| HTTP/Resource | `GET /api/v1/me/sessions` · `DELETE /api/v1/me/sessions/{sessionId}` |
| AuthZ | Authenticated (owner-only) |
| Response | `200` `[{ id, deviceLabel, createdAt, lastActiveAt, current }]` |
| Business rules | Current session cannot be revoked via this endpoint (use logout) |
| Side effects | Revoked session invalidated; realtime disconnect |
| Events | `auth.session.revoked` |
| Read models | None |
| Realtime | Revoked device forced offline |
| Audit | `security` |
| Future | "Log out all other devices" bulk action |

---

### 4.3 Workspace APIs

**4.3.1 List My Workspaces**
| Field | Spec |
|---|---|
| Purpose | List workspaces the caller belongs to (Hub, UXS §4) |
| HTTP/Resource | `GET /api/v1/workspaces` |
| AuthZ | Authenticated |
| Response | `200` `[{ id, slug, name, role, memberCount, lastVisitedAt }]` |
| Sorting | `lastVisitedAt` desc (personal order from recents) |
| Business rules | Workspace list is membership-scoped; personal workspace always listed |
| Side effects | None |
| Events | None |
| Read models | None |
| Realtime | None |
| Audit | None |
| Future | Team/organization grouping |

**4.3.2 Create Workspace**
| Field | Spec |
|---|---|
| Purpose | Create a workspace (optionally from a template) |
| HTTP/Resource | `POST /api/v1/workspaces` |
| AuthZ | Authenticated |
| Request | `{ "name": string(1–60), "templateId": uuid?, "bootstrap": bool? }` |
| Response | `201` `{ id, slug, name, role: "Owner", ... }` |
| Validation | name required 1–60; templateId must exist if provided (WPS §3.6) |
| Business rules | Creator becomes **Owner** (WPS §5.1); template applies default roles/dashboards/sprints/KB (WPS §3.6.2); **Blank** default when no template |
| Side effects | Membership(Owner) created; default workspace settings + branding; if template: seeded projects/KB/dashboards; Overview-first landing (WPS §3.4.1) |
| Events | `workspace.created`, `workspace.member.added` (Owner) |
| Read models | WorkspaceOverview, Dashboard, Hub |
| Realtime | Hub refresh |
| Audit | `structure` |
| Future | Enterprise provisioning via SSO |

**4.3.3 Get / Update Workspace**
| Field | Spec |
|---|---|
| Purpose | Read or update workspace metadata, settings, branding |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}` · `PATCH /api/v1/workspaces/{workspaceId}` |
| AuthZ | GET: any member. PATCH: Owner/Admin (settings) per WPS §5.1 capability matrix |
| Request | PATCH: `{ name?, slug?, settings?: {...}, branding?: {...} }` |
| Response | `200` workspace object incl. `settings` and `branding` |
| Validation | slug unique, `^[a-z0-9-]{2,40}$`; branding per DTS token usage (WPS §17.1) |
| Business rules | Slug change redirects (301 to new slug); Owner-only for destructive settings (WPS §12.x) |
| Side effects | Branding re-projected to surfaces; slug change → timeline entry |
| Events | `workspace.updated`, `workspace.slug.changed` |
| Read models | Overview, Dashboards, Mission Control header |
| Realtime | Workspace topic broadcast (lightweight) |
| Audit | `structure` |
| Future | Additive settings buckets (intelligence §3.18, integrations §3.20) |

**4.3.4 Workspace Overview (read model bundle)**
| Field | Spec |
|---|---|
| Purpose | Serve the Overview-first landing page bundle (WPS §3.4.1, §12.9) |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/overview` |
| AuthZ | Any member |
| Response | `200` bundle: `{ workspace, identity, projectCards, members, teams, sprintHealth, announcements, activity, milestones, reports, statsRow, quickActions, insights, pinned, recents }` |
| Business rules | Assembled from read models; insights surface per UXS §15.4 (top strip 2–3); content role-scoped |
| Side effects | None |
| Events | None |
| Read models | All overview widgets |
| Realtime | Subscribes Overview topic (live append of activity) |
| Audit | None |
| Future | Additive widget sections |

**4.3.5 Members**
| Field | Spec |
|---|---|
| Purpose | Invite, list, update role, remove members |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/members/invite` · `GET .../members` · `PATCH .../members/{memberId}` · `DELETE .../members/{memberId}` |
| AuthZ | Invite/PATCH role/remove: Owner/Admin. List: any member |
| Request | invite: `{ "emails": [string], "role": enum, "teamIds"?: [uuid] }`; PATCH: `{ "role"?: enum }` |
| Response | `200`/`201` member objects; invite returns `{ "invitations": [{email, status}] }` |
| Validation | Role ∈ {Owner, Admin, PM, Leader, Developer, QA, Viewer} (WPS §5.1); emails valid; default invite role configurable (default Developer) |
| Business rules | Role changes audited; Owner can't demote self without successor; workspace capacity limits (WPS §1.5) |
| Side effects | Emails sent (invitation flow Ch. 5 §5.5); membership + team memberships created; role change re-projects permissions |
| Events | `workspace.member.invited`, `workspace.member.added`, `workspace.member.roleChanged`, `workspace.member.removed` |
| Read models | Member cards, presence grid, Overview members widget, permission cache |
| Realtime | Presence grid, member list updates |
| Audit | `access` — membership |
| Future | Team-based role inheritance, SCIM provisioning |

**4.3.6 Teams**
| Field | Spec |
|---|---|
| Purpose | Manage teams and team membership |
| HTTP/Resource | `GET/POST /api/v1/workspaces/{workspaceId}/teams` · `GET/PATCH/DELETE .../teams/{teamId}` · `POST .../teams/{teamId}/members` · `DELETE .../teams/{teamId}/members/{memberId}` |
| AuthZ | Owner/Admin manage; any member list |
| Request | `{ "name": string, "description"?: string, "leaderId"?: uuid, "memberIds"?: [uuid] }` |
| Response | `200` team object |
| Validation | Team name 1–60; leaderId must be a member |
| Business rules | Team membership drives filtering (projects/features/QA queues); leader capability per WPS §5.1 |
| Side effects | Team memberships; re-projections of team-scoped views |
| Events | `team.created`, `team.updated`, `team.member.added`, `team.member.removed` |
| Read models | Team cards, team filters, QA queue scoping |
| Realtime | Team-scoped subscribers |
| Audit | `structure` |
| Future | Nested teams |

**4.3.7 Templates & Announcements**
| Field | Spec |
|---|---|
| Purpose | Save/browse workspace templates; create/list announcements |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/templates/save` · `GET /api/v1/templates` · `POST /api/v1/workspaces/{workspaceId}/announcements` · `GET .../announcements` |
| AuthZ | Save/list templates: Owner/Admin (WPS §3.6.3). Announcements: Owner/Admin create; any member read |
| Request | template: `{ "name": string, "config"?: {...} }`; announcement: `{ "title": string, "body": string, "audience"?: enum, "publishAt"?: datetime }` |
| Response | `201` template/announcement |
| Business rules | "Save as template" reversible; announcement audience ∈ {All, Members, Admins} |
| Side effects | Template catalog updated; announcements broadcast (Ch. 14) |
| Events | `workspace.template.saved`, `announcement.created` |
| Read models | Template picker (Blank first, WPS §3.6), Overview announcements widget |
| Realtime | Announcement fan-out (high-priority notification) |
| Audit | `structure` |
| Future | Public template marketplace |

---

### 4.4 Project APIs

**4.4.1 List / Create Project**
| Field | Spec |
|---|---|
| Purpose | List workspace projects or create one |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/projects` · `POST /api/v1/workspaces/{workspaceId}/projects` |
| AuthZ | List: any member. Create: Owner/Admin/PM/Leader (WPS §5.1 capability matrix) |
| Request | `{ "name": string(1–60), "description"?: string(≤2000), "teamIds"?: [uuid], "templateId"?: uuid, "workflowConfig"?: {...}, "qaGateEnabled"?: bool }` |
| Response | `201` project object |
| Validation | name required; unique per workspace `(workspaceId, name)` (DDD §9.4); teamIds must belong to workspace; qaGate default from workspace template (WPS §3.6.2) |
| Business rules | Project owns structure: sprints, features, milestones (DDD §5.1); workflow config inherits template defaults; QA gate toggle (WPS §10.3) |
| Side effects | Default milestones seeded if configured; project added to overview/team scopes |
| Events | `project.created` |
| Read models | Project cards, Overview projects widget, team project lists, Search index |
| Realtime | Project list topic |
| Audit | `structure` |
| Future | Project archiving/restore, project templates (WPS §8.5) |

**4.4.2 Get / Update / Archive Project**
| Field | Spec |
|---|---|
| Purpose | Read, update, or archive a project |
| HTTP/Resource | `GET/PATCH/DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}` |
| AuthZ | GET: any member. PATCH/DELETE: Owner/Admin/PM (archive). DELETE requires Owner per WPS §1.5 |
| Request | PATCH: `{ name?, description?, teamIds?, workflowConfig?, qaGateEnabled? }` |
| Response | `200` project; DELETE → `202` (async archive) + `{ jobId }` |
| Validation | name unique per workspace; state transitions (active ↔ archived) |
| Business rules | Archive is soft (DSS archived state); archived projects excluded from default lists (`archived=false` filter, Ch. 7); restore role-gated |
| Side effects | Archive cascades in read models (not deletion); Work items preserved |
| Events | `project.updated`, `project.archived`, `project.restored` |
| Read models | Project cards, board views, dashboards, Search index (archived flag) |
| Realtime | Project topic; board removal on archive |
| Audit | `structure` |
| Future | Hard-delete with approval window |

**4.4.3 Project Board (read model)**
| Field | Spec |
|---|---|
| Purpose | Serve the Kanban/board view for a project |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/board` |
| AuthZ | Any member |
| Response | `200` `{ columns: [{ status, features: [{id, title, health, assignee, estimate}] }], totals }` |
| Business rules | Columns derived from feature lifecycle (Backlog → In Development → Code Review → In QA → Approved → Done, WPS §10.3); features read-only projection |
| Side effects | None |
| Events | None |
| Read models | Board |
| Realtime | Subscribes project topic (live card movement) |
| Audit | None |
| Future | Custom workflow columns (template-gated) |

**4.4.4 Project Milestones**
| Field | Spec |
|---|---|
| Purpose | Create/list/update milestones on a project |
| HTTP/Resource | `GET/POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones` · `PATCH .../milestones/{milestoneId}` |
| AuthZ | Manage: Owner/Admin/PM/Leader; list: any member |
| Request | `{ "title": string, "targetDate": date, "description"?: string }` |
| Response | `201` milestone |
| Validation | targetDate required; title 1–80 |
| Business rules | Lifecycle `Planned → Achieved → Missed` (WPS §8.x); milestones surface on Overview + Mission Control right rail (WPS §11.5) |
| Side effects | Milestone read-model updates; intelligence milestone-slip rule input (UXS §15.2) |
| Events | `milestone.created`, `milestone.updated`, `milestone.statusChanged` |
| Read models | Overview milestones widget, Mission Control, Dashboards |
| Realtime | Milestone widgets |
| Audit | `structure` |
| Future | Milestone auto-completion by release |

**4.4.5 Project Members / Health**
| Field | Spec |
|---|---|
| Purpose | Manage project team assignment; read project health |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/members` · `GET .../projects/{projectId}/health` |
| AuthZ | Members manage: Owner/Admin/PM; health: any member |
| Response | `200` `{ health: enum, metrics: {...}, trend: [...] }` |
| Business rules | Health derived (system-owned, DDD §5.3); never from private execution data raw (anonymized summaries only) |
| Side effects | Health recompute on schedule/event |
| Events | `project.health.changed` |
| Read models | Project cards health badge, Mission Control left rail (WPS §11.5) |
| Realtime | Health badge updates |
| Audit | None (derived) |
| Future | Health breakdown by team |

---

### 4.5 Sprint APIs

**4.5.1 List / Create Sprint**
| Field | Spec |
|---|---|
| Purpose | List sprints (filtered) or create one in a project |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/sprints?projectId=` · `POST /api/v1/workspaces/{workspaceId}/sprints` |
| AuthZ | List: any member. Create: Owner/Admin/PM/Leader |
| Request | `{ "projectId": uuid, "name"?: string, "startDate"?: date, "endDate"?: date, "goal"?: string, "durationDays"?: int(1–28) }` |
| Response | `201` sprint |
| Validation | projectId required + must exist; endDate ≥ startDate; name unique within project (DDD §9.4); duration defaults from workspace settings (WPS §3.6.2) |
| Business rules | Sprint belongs to exactly one project; lifecycle `Planned → Active → Completed` (start/complete endpoints below) |
| Side effects | Sprint added to project scope; timeline entry |
| Events | `sprint.created` |
| Read models | Sprint lists, board sprint filter, burndown |
| Realtime | Sprint topic |
| Audit | `structure` |
| Future | Sprint templates, cross-project sprints (roadmap only) |

**4.5.2 Start / Complete Sprint**
| Field | Spec |
|---|---|
| Purpose | Transition a sprint to Active or Completed |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/sprints/{sprintId}/start` · `POST .../sprints/{sprintId}/complete` |
| AuthZ | Owner/Admin/PM/Leader (start); Leader/PM (complete) |
| Request | complete: `{ "notes"?: string, "retrospective"?: {...} }` |
| Response | `200` sprint with new status |
| Validation | start requires Planned; complete requires Active; complete not allowed while features in-progress without override (audited) |
| Business rules | Sprint start sets `startDate=now` if unset; complete computes velocity (DDD §7, VelocityTracker); retrospective saved (DDD §3 Delivery) |
| Side effects | Burndown/velocity projections; QA gate rule inputs; timeline entry |
| Events | `sprint.started`, `sprint.completed` |
| Read models | Burndown, velocity chart, Overview sprint health, Mission Control |
| Realtime | Sprint topic, Mission Control, burndown |
| Audit | `delivery` |
| Future | Sprint extension/reopen (audited) |

**4.5.3 Sprint Burndown / Metrics (read models)**
| Field | Spec |
|---|---|
| Purpose | Serve burndown + sprint metrics |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/sprints/{sprintId}/burndown` · `GET .../sprints/{sprintId}/metrics` |
| AuthZ | Any member |
| Response | `200` `{ pointsRemaining: [...], idealLine: [...], completedPoints, scopeChanges, health }` |
| Business rules | Derived from feature-completion events; scope changes tracked (DDD §7) |
| Side effects | None |
| Events | None |
| Read models | Burndown, metrics |
| Realtime | Sprint topic live updates |
| Audit | None |
| Future | Team-split burndown |

**4.5.4 Sprint Features**
| Field | Spec |
|---|---|
| Purpose | Add/remove features to a sprint (planning) |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/sprints/{sprintId}/features` · `DELETE .../features/{featureId}` |
| AuthZ | Owner/Admin/PM/Leader (planning) |
| Request | `{ "featureIds": [uuid] }` |
| Response | `200` sprint feature list |
| Validation | Feature must belong to the sprint's project; feature not already in a completed sprint |
| Business rules | Scope changes recorded (DDD §7.3); adding to Active sprint = scope change (audited) |
| Side effects | Feature sprintId updated; burndown recalcs |
| Events | `feature.sprintChanged`, `sprint.scopeChanged` |
| Read models | Board, burndown, planning view |
| Realtime | Sprint topic |
| Audit | `delivery` |
| Future | Auto-scheduling suggestion (AI, Phase 4) |

---

### 4.6 Feature APIs

**4.6.1 List / Create Feature**
| Field | Spec |
|---|---|
| Purpose | List features (filtered) or create one in a project |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/features?projectId=&sprintId=&assigneeId=&status=&archived=` · `POST /api/v1/workspaces/{workspaceId}/features` |
| AuthZ | List: any member. Create: Owner/Admin/PM/Leader/Developer (per capability matrix, WPS §5.1) |
| Request | `{ "projectId": uuid, "title": string(1–200), "description"?: string(≤10000), "type": enum, "assigneeIds"?: [uuid], "estimate"?: int, "parentId"?: uuid, "tags"?: [string], "acceptanceCriteria"?: [string], "qaRequired"?: bool }` |
| Response | `201` feature |
| Validation | projectId + title required; title unique per workspace (DDD §9.4 feature unique ID); type ∈ {feature, bug, task, chore, spike}; estimate ≥ 0; parentId must be in same project |
| Business rules | Feature is the **central aggregate** (ADR 3, WPS §2); lifecycle `Backlog → In Development → Code Review → In QA → Approved → Done` (+Rejected/Blocked) (WPS §10.3); QA gate: **no Done without Approved QA (Owner override audited)** (WPS §5.4) |
| Side effects | Feature card projected to board; timeline entry; search index update |
| Events | `feature.created` |
| Read models | Board, feature list, Overview project cards, Timeline, Search index |
| Realtime | Project/sprint topics |
| Audit | `structure` |
| Future | Feature templates, subtask hierarchy expansion |

**4.6.2 Get / Update Feature**
| Field | Spec |
|---|---|
| Purpose | Read or update a feature |
| HTTP/Resource | `GET/PATCH /api/v1/workspaces/{workspaceId}/features/{featureId}` |
| AuthZ | GET: any member. PATCH: Owner/Admin/PM/Leader/Assignee (mutable-field scope per role) |
| Request | PATCH: `{ title?, description?, type?, tags?, acceptanceCriteria?, qaRequired? }` (assignee/estimate/sprint have dedicated endpoints) |
| Response | `200` feature |
| Validation | title unique per workspace; enum bounds |
| Business rules | Mutable fields LWW by server timestamp with provenance (DDD §7.2); immutable evidence fields never mutated by PATCH (status via transitions) |
| Side effects | Feature read-model refresh; dependency graph re-check if description/tags change |
| Events | `feature.updated` |
| Read models | Feature detail, board, Timeline, Search index |
| Realtime | Feature detail subscribers, project topic |
| Audit | `structure` |
| Future | Field-level history API |

**4.6.3 Feature Transition (status)**
| Field | Spec |
|---|---|
| Purpose | Move a feature through its lifecycle |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/features/{featureId}/transitions` |
| AuthZ | Role-dependent per transition (WPS §10.3): Dev claims/In Development; Dev→Code Review; QA: In QA→Approved / Rejected; Leader: Approved→Done; Owner override audited |
| Request | `{ "toStatus": enum, "comment"?: string }` |
| Response | `200` feature with new status |
| Validation | Valid transition edges only (WPS §10.3); Rejected requires reason |
| Business rules | **QA gate invariant** enforced in Delivery aggregate (WPS §5.4); Done requires Approved QA (or Owner override → audit); rejected → Back to In Development |
| Side effects | Health recalcs; burndown/velocity updates; QA queue; timeline entry; notifications (assignee, PM, QA) |
| Events | `feature.statusChanged`, `feature.qaApproved`, `feature.qaRejected`, `feature.completed` |
| Read models | Board, feature health, QA queue, burndown, Timeline, Mission Control |
| Realtime | Project/sprint topics, Mission Control, QA queue |
| Audit | `delivery` — QA events + overrides |
| Future | Automation rules on transitions (Phase 5) |

**4.6.4 Assign / Unassign**
| Field | Spec |
|---|---|
| Purpose | Set feature assignees |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/features/{featureId}/assignees` · `DELETE .../assignees/{memberId}` |
| AuthZ | Owner/Admin/PM/Leader |
| Request | `{ "assigneeIds": [uuid] }` |
| Response | `200` feature |
| Validation | assigneeIds must be workspace members |
| Business rules | Assignment triggers notifications (Ch. 14) + work-tracking signals |
| Side effects | Assignment read models; command palette learning; notifications |
| Events | `feature.assigned`, `feature.unassigned` |
| Read models | Board avatars, My Work, Member cards, Search index (assignee filter) |
| Realtime | Feature/project topics, presence grid workload |
| Audit | `delivery` |
| Future | Load-balanced auto-assign (Phase 5) |

**4.6.5 Estimate**
| Field | Spec |
|---|---|
| Purpose | Set / recalculate a feature estimate |
| HTTP/Resource | `PUT /api/v1/workspaces/{workspaceId}/features/{featureId}/estimate` |
| AuthZ | Owner/Admin/PM/Leader/Assignee (quick-estimate on cards, WPS §8.x) |
| Request | `{ "estimate": int(0–1000) }` |
| Response | `200` feature |
| Validation | estimate ≥ 0; re-estimation bounds |
| Business rules | Velocity = completed estimates per sprint, history-tracked, auto-calibrated (WPS §8.5); recalibration may adjust open estimates (DDD §7.1) |
| Side effects | Velocity/estimate drift inputs; intelligence `estimate.drift` rule (UXS §15.2) |
| Events | `feature.estimateChanged` |
| Read models | Board estimate, velocity, sprint metrics, Mission Control |
| Realtime | Sprint topic |
| Audit | `delivery` |
| Future | Auto-estimate (Phase 4 AI) |

**4.6.6 Dependencies**
| Field | Spec |
|---|---|
| Purpose | Manage the feature dependency graph |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/features/{featureId}/dependencies` · `POST .../dependencies` · `DELETE .../dependencies/{dependencyId}` |
| AuthZ | Manage: Owner/Admin/PM/Leader; read: any member |
| Request | `{ "targetFeatureId": uuid, "type": enum }` — type ∈ {Depends On, Blocks, Related, Duplicate, Parent, Child} (WPS §10.6) |
| Response | `200` dependency |
| Validation | No self-dependency; target in same project; no cycles (DependencyResolver, SAD §5.3) |
| Business rules | Dependency graph drives `DependencyResolver` transitive impact + block chains (WPS §10.6); blocked status surfaces |
| Side effects | Graph projection; health changes; intelligence `dependency.delay` + `blocked.aging` rules |
| Events | `feature.dependency.added`, `feature.dependency.removed` |
| Read models | Dependency graph, feature health, Mission Control risk list |
| Realtime | Graph subscribers, Mission Control |
| Audit | `delivery` |
| Future | Cross-project dependencies (roadmap) |

**4.6.7 Feature Detail Bundle (read model)**
| Field | Spec |
|---|---|
| Purpose | Serve the feature detail page bundle |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/features/{featureId}/detail` |
| AuthZ | Any member |
| Response | `200` `{ feature, activity, comments, dependencies, health, timelineSegment, linkedSessions: [{ duration }] }` |
| Business rules | `linkedSessions` are **permission-scoped duration aggregates only** (DDD §13.3 — the only crossing); never raw session data |
| Side effects | None |
| Events | None |
| Read models | All detail widgets |
| Realtime | Feature detail topic |
| Audit | None |
| Future | Subtasks, code references (Git ACL) |

**4.6.8 Task List / Create (workspace-linked tasks)**
| Field | Spec |
|---|---|
| Purpose | List/create tasks linked to work items (checklists, subtasks) |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/tasks?featureId=` · `POST /api/v1/workspaces/{workspaceId}/tasks` |
| AuthZ | Create: any member with role ≥ Developer; list: any member |
| Request | `{ "featureId"?: uuid, "title": string(1–200), "status"?: enum, "assigneeId"?: uuid }` |
| Response | `201` task |
| Validation | title required; featureId must exist in workspace |
| Business rules | Task belongs to Feature (DDD §3 Workspace) or is personal (unlinked → personal space) |
| Side effects | Task list projections; timeline entry |
| Events | `task.created` |
| Read models | Feature detail checklists, board card subtask counts |
| Realtime | Feature topic |
| Audit | `structure` |
| Future | Task dependencies |

---

### 4.7 Task APIs (Focus & Time — developer-owned)

> **Privacy note:** the following task/session/worklog/journal APIs operate on **developer-owned, private-by-default** data (DDD §1.3, §13.3). Access is restricted to the owner (and permission-scoped feature-link aggregates only). Admins **cannot** read these via any path.

**4.7.1 My Tasks**
| Field | Spec |
|---|---|
| Purpose | Manage the caller's personal tasks (My Work, UXS) |
| HTTP/Resource | `GET /api/v1/me/tasks?date=&status=` · `POST /api/v1/me/tasks` · `GET/PATCH/DELETE /api/v1/me/tasks/{taskId}` |
| AuthZ | Owner only (personal) |
| Request | `{ "title": string, "description"?: string, "dueDate"?: date, "priority"?: enum, "featureId"?: uuid }` |
| Response | `200`/`201` personal task |
| Validation | title required; featureId (optional link) must be in caller's workspace scope |
| Business rules | Personal tasks are private (never search-indexed beyond owner, DDD §10.3); offline-writable (low-risk field edits, DDD §12.2) |
| Side effects | My Work projections; optional feature-link duration aggregate |
| Events | `task.created`, `task.completed`, `task.updated` |
| Read models | My Work, personal dashboard, session link targets |
| Realtime | Same-member devices |
| Audit | None (personal, non-admin) — still ActivityEvent for the owner's own timeline |
| Future | Task templates |

**4.7.2 Task Complete / Claim**
| Field | Spec |
|---|---|
| Purpose | Complete a personal task or link it to a session |
| HTTP/Resource | `POST /api/v1/me/tasks/{taskId}/complete` · `POST /api/v1/me/tasks/{taskId}/claim` |
| AuthZ | Owner only |
| Request | claim: `{ "sessionId": uuid }` |
| Response | `200` |
| Business rules | Completion appends evidence (immutable, DDD §7.2); claim links task to a session for deep-work context |
| Side effects | Focus summary inputs; task list updates |
| Events | `task.completed` |
| Read models | My Work, session summary |
| Realtime | Same-member devices |
| Audit | None |
| Future | Session presets |

---

### 4.8 Session APIs (developer-owned, private)

**4.8.1 Start Session**
| Field | Spec |
|---|---|
| Purpose | Start a focus session (deep-work timer) |
| HTTP/Resource | `POST /api/v1/me/sessions/start` |
| AuthZ | Owner only |
| Request | `{ "taskId"?: uuid, "featureId"?: uuid, "mode"?: enum {focus, review, meeting, testing, away}, "plannedMinutes"?: int(1–480), "notes"?: string(≤2000) }` |
| Response | `201` `{ id, startedAt, status: "active", ... }` |
| Validation | featureId/taskId must be in caller's scope; one active session at a time (409 if exists) |
| Business rules | Active session is exclusive; presence reflects `mode` (WPS §11.1: Online/Focusing/Reviewing/Testing/In Meeting/Away) |
| Side effects | Presence state set; session-linked duration aggregate (feature) permission-scoped |
| Events | `session.started` |
| Read models | Presence grid (anonymized presence), feature duration aggregate, My Work |
| Realtime | Presence update; feature detail duration (permission-scoped) |
| Audit | None (personal) — presence is transient (DDD §3 Presence ephemeral) |
| Future | Deep-work suggestions (AI, Phase 4) |

**4.8.2 End / Pause / Resume Session**
| Field | Spec |
|---|---|
| Purpose | Control the active focus session |
| HTTP/Resource | `POST /api/v1/me/sessions/{sessionId}/end` · `.../pause` · `.../resume` |
| AuthZ | Owner only |
| Request | end: `{ "notes"?: string, "status"?: enum {completed, abandoned, interrupted} }` |
| Response | `200` session summary |
| Validation | Only the active session may be paused/ended; paused session resumes only within its window |
| Business rules | End appends **immutable evidence** (first completion final — DDD §7.2); duration computed server-side |
| Side effects | Duration aggregate for linked feature (permission-scoped); focus summary recomputed (HealthCalculator, SAD §5.3); presence back to Online |
| Events | `session.completed`, `session.paused`, `session.resumed` |
| Read models | Feature duration aggregate, focus summary, personal analytics |
| Realtime | Presence; feature duration (scoped) |
| Audit | None (personal) |
| Future | Interruption tagging, automatic end (timer expiry) |

**4.8.3 List / Get My Sessions**
| Field | Spec |
|---|---|
| Purpose | Query the caller's sessions (history, summaries) |
| HTTP/Resource | `GET /api/v1/me/sessions?from=&to=&status=` · `GET /api/v1/me/sessions/{sessionId}` |
| AuthZ | Owner only |
| Response | `200` `[{ id, startedAt, endedAt, durationMinutes, mode, status, featureId?, notes? }]` |
| Business rules | Private to owner; exportable by owner (Ch. 13) |
| Side effects | None |
| Events | None |
| Read models | Personal dashboard, focus reports |
| Realtime | None |
| Audit | None |
| Future | Session analytics aggregation (personal only) |

---

### 4.9 WorkLog APIs (developer-owned, private)

**4.9.1 List / Create WorkLog**
| Field | Spec |
|---|---|
| Purpose | Manage the caller's work logs |
| HTTP/Resource | `GET /api/v1/me/worklogs?date=&from=&to=` · `POST /api/v1/me/worklogs` |
| AuthZ | Owner only |
| Request | `{ "date": date, "durationMinutes"?: int, "description": string(≤2000), "featureId"?: uuid, "sessionId"?: uuid, "type"?: enum {development, review, meeting, documentation, qa, other} }` |
| Response | `201` worklog |
| Validation | date required; durationMinutes 1–1440; description required |
| Business rules | Private to owner; can be linked to feature (duration aggregate, permission-scoped); manual logs and auto-logs (from sessions) coexist |
| Side effects | Feature duration aggregate (if linked); reports inputs (anonymized summaries) |
| Events | `worklog.created` |
| Read models | Personal time reports, feature duration aggregate |
| Realtime | None |
| Audit | None (personal) |
| Future | Timesheet import |

**4.9.2 Get / Update / Delete WorkLog**
| Field | Spec |
|---|---|
| Purpose | Update or delete the caller's work logs |
| HTTP/Resource | `GET/PATCH/DELETE /api/v1/me/worklogs/{worklogId}` |
| AuthZ | Owner only |
| Request | PATCH: mutable fields (date, duration, description, type) |
| Response | `200`/`204` |
| Business rules | Manual logs are mutable; **session-derived logs are immutable** (evidence, DDD §7.2) — PATCH rejected with 422 for derived logs |
| Side effects | Duration aggregate refresh; report recompute |
| Events | `worklog.updated`, `worklog.deleted` |
| Read models | Personal time reports, feature duration aggregate |
| Realtime | None |
| Audit | None |
| Future | Bulk edit/import |

---

### 4.10 Journal APIs (developer-owned, private)

**4.10.1 Journal Entries**
| Field | Spec |
|---|---|
| Purpose | Manage the caller's private journal |
| HTTP/Resource | `GET /api/v1/me/journal?from=&to=` · `POST /api/v1/me/journal` · `GET/PATCH/DELETE /api/v1/me/journal/{entryId}` |
| AuthZ | Owner only |
| Request | `{ "date": date, "title"?: string(≤120), "body": string(≤20000), "mood"?: enum, "tags"?: [string] }` |
| Response | `201`/`200` entry |
| Validation | date required; body required |
| Business rules | Private to owner; never indexed in workspace search (DDD §10.3); offline-writable |
| Side effects | None (private) |
| Events | `journal.entryCreated` (owner-only visibility) |
| Read models | Personal journal view |
| Realtime | Same-member devices |
| Audit | None |
| Future | Journal export |

---

### 4.11 Knowledge Base APIs

**4.11.1 List / Create KB Doc**
| Field | Spec |
|---|---|
| Purpose | Browse or create knowledge base documents |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/kb?sectionId=&archived=` · `POST /api/v1/workspaces/{workspaceId}/kb` |
| AuthZ | List: any member. Create: Owner/Admin/PM/Leader (KB edit capability, WPS §5.1) |
| Request | `{ "title": string(1–200), "body": string, "parentId"?: uuid, "tags"?: [string], "featureIds"?: [uuid] }` |
| Response | `201` kb-doc |
| Validation | title required; parentId must be a KB doc (tree); featureIds in workspace |
| Business rules | KB is workspace-owned structure (DDD §5.1); docs versioned (DocVersion, DDD §3) |
| Side effects | Search index update; tree projection; timeline entry |
| Events | `kb.docCreated` |
| Read models | KB tree, doc list, Search index |
| Realtime | KB topic |
| Audit | `structure` |
| Future | Markdown import/export, cross-linking |

**4.11.2 Get / Update / Version / Publish KB Doc**
| Field | Spec |
|---|---|
| Purpose | Read, edit, version, publish a KB doc |
| HTTP/Resource | `GET/PATCH /api/v1/workspaces/{workspaceId}/kb/{kbDocId}` · `GET/POST .../kb/{kbDocId}/versions` · `POST .../kb/{kbDocId}/publish` |
| AuthZ | Read: any member. Edit/version/publish: Owner/Admin/PM/Leader |
| Request | PATCH: `{ title?, body?, tags? }`; publish: `{ "message"?: string }` |
| Response | `200` doc; publish → `200` + version ref |
| Validation | PATCH on published doc creates a draft version (no destructive inline edit) |
| Business rules | Versions immutable; publish snapshots a version; draft model (DSS progressive disclosure) |
| Side effects | Version history; search reindex; timeline entry on publish |
| Events | `kb.docUpdated`, `kb.docPublished` |
| Read models | Doc detail, versions, Search index |
| Realtime | KB topic; doc editors |
| Audit | `structure` — publish is audited (content change) |
| Future | Collaborative editing (Phase 2) |

---

### 4.12 Reports APIs

**4.12.1 List / Generate Report**
| Field | Spec |
|---|---|
| Purpose | List reports or generate one (async, automation-first per PRD) |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/reports` · `POST /api/v1/workspaces/{workspaceId}/reports` |
| AuthZ | List: any member. Generate: Owner/Admin/PM/Leader (report capability) |
| Request | `{ "type": enum, "scope": { "projectId"?, "sprintId"?, "teamId"?, "from"?, "to"? }, "format"?: enum {dashboard, pdf, csv}, "schedule"?: { "frequency", "hour", "channel" } }` |
| Response | `202` `{ reportId, status: "pending", jobId }` |
| Validation | type required ∈ {sprint, project, team, member, release, retrospective, export}; scope sanity (from ≤ to) |
| Business rules | Report compilation is async (ReportCompiler, SAD §5.3); result is a read model; schedules supported (ReportSchedule, DDD §3) |
| Side effects | Compilation job; schedule registered if provided; notification on completion (Ch. 14) |
| Events | `report.generated`, `report.schedule.created` |
| Read models | Reports list, report detail |
| Realtime | Report status → completed (realtime notification) |
| Audit | `reporting` |
| Future | Report templates, natural-language report (AI, Phase 3) |

**4.12.2 Get / Share / Schedule / Export Report**
| Field | Spec |
|---|---|
| Purpose | Fetch a report, share it, manage its schedule, or export |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/reports/{reportId}` · `POST .../reports/{reportId}/share` · `PUT/DELETE .../reports/{reportId}/schedule` · `POST .../reports/{reportId}/export` |
| AuthZ | Read: any member (if shared). Share/schedule/export: Owner/Admin/PM/Leader |
| Request | share: `{ "memberIds": [uuid], "role"?: enum }`; export: `{}` → `202 { fileId }` |
| Response | `200` report / `202` export job |
| Validation | share memberIds must be members; export requires completed report |
| Business rules | ReportShare is workspace-scoped (DDD §3); export flows through File APIs (Ch. 13) |
| Side effects | Share visibility updated; export produces file (File APIs) |
| Events | `report.shared`, `report.schedule.updated`, `report.exported` |
| Read models | Report detail, reports list |
| Realtime | Shared recipients receive notification |
| Audit | `reporting` — share + export (data leaving scope) |
| Future | Public share links (scoped) |

---

### 4.13 Analytics APIs

**4.13.1 KPIs**
| Field | Spec |
|---|---|
| Purpose | Serve dashboard KPI snapshot rows |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/analytics/kpis?period=` |
| AuthZ | Any member (role-scoped cards) |
| Response | `200` `{ kpis: [{ key, label, value, delta, sparkline, period }] }` |
| Business rules | KPI snapshots are derived (system-owned, DDD §5.3); computed on schedule + events; role-scoped surfacing per UXS §15.4 |
| Side effects | None |
| Events | None |
| Read models | Dashboard KPI strip, Mission Control, Stakeholder Dashboard |
| Realtime | KPI topic (movement) |
| Audit | None |
| Future | KPI definitions API (custom KPIs) |

**4.13.2 Velocity / Burndown / Health / Load Analytics**
| Field | Spec |
|---|---|
| Purpose | Serve trend analytics read models |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/analytics/velocity?teamId=&sprintCount=` · `.../burndown?sprintId=` · `.../health?projectId=` · `.../load?period=` |
| AuthZ | Any member (role-scoped) |
| Response | `200` chart-ready series (arrays of {date/label, value}) |
| Business rules | Velocity history-tracked + auto-calibrated (WPS §8.5); load analytics from anonymized summaries (never raw private data) |
| Side effects | None |
| Events | None |
| Read models | Charts, dashboards, Mission Control |
| Realtime | Topic updates on sprint/feature events |
| Audit | None |
| Future | Team breakdowns, forecasting (Phase 4) |

**4.13.3 My Analytics (personal)**
| Field | Spec |
|---|---|
| Purpose | Serve the caller's personal analytics (focus totals, health) |
| HTTP/Resource | `GET /api/v1/me/analytics?from=&to=` |
| AuthZ | Owner only |
| Response | `200` `{ totalFocusMinutes, sessions, tasksCompleted, healthTrend: [...], byDay: [...] }` |
| Business rules | Personal, private; derived from owner's sessions/worklogs (HealthCalculator) |
| Side effects | None |
| Events | None |
| Read models | Personal dashboard |
| Realtime | Same-member devices |
| Audit | None |
| Future | Export, insights on personal data (Phase 4) |

---

### 4.14 Calendar APIs

**4.14.1 Calendar Entries**
| Field | Spec |
|---|---|
| Purpose | Read/write calendar entries mapping work items to time |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/calendar?from=&to=` · `POST /api/v1/workspaces/{workspaceId}/calendar/entries` · `PATCH/DELETE .../entries/{entryId}` |
| AuthZ | Read: any member. Write: Owner/Admin/PM/Leader (schedule mapping) |
| Request | `{ "title": string, "start": datetime, "end": datetime, "kind"?: enum {meeting, deadline, availability, workBlock}, "featureId"?: uuid, "attendeeIds"?: [uuid] }` |
| Response | `201`/`200` entry |
| Validation | end > start; kind enum; featureId in workspace |
| Business rules | Calendar maps work items to time (Calendar context, DDD §2); never mutates Work items |
| Side effects | Calendar projections; availability recompute; presence hints (In Meeting) |
| Events | `calendar.entryCreated`, `calendar.entryUpdated`, `calendar.entryDeleted` |
| Read models | Calendar view, availability |
| Realtime | Calendar topic |
| Audit | `structure` |
| Future | External calendar sync (Google/Outlook, Phase 2) |

**4.14.2 My Availability**
| Field | Spec |
|---|---|
| Purpose | Serve the caller's availability windows |
| HTTP/Resource | `GET /api/v1/me/availability?from=&to=` |
| AuthZ | Owner only (own availability); teammates see coarse slots via workspace calendar |
| Response | `200` `[{ start, end, state: {busy, free, focusing} }]` |
| Business rules | Focus sessions mark "focusing" (anonymized presence, not raw data); used for meeting suggestion |
| Side effects | None |
| Events | None |
| Read models | Calendar, presence |
| Realtime | Presence topic |
| Audit | None |
| Future | Auto-scheduling (Phase 2) |

---

### 4.15 Notification APIs

**4.15.1 Inbox**
| Field | Spec |
|---|---|
| Purpose | Read/manage the caller's notification inbox |
| HTTP/Resource | `GET /api/v1/me/notifications?status=unread&category=&page=` · `PATCH /api/v1/me/notifications/{notificationId}` (read/dismiss) · `POST /api/v1/me/notifications/read-all` |
| AuthZ | Owner only |
| Request | PATCH: `{ "status": enum {unread, read, dismissed} }` |
| Response | `200` notification list / updated notification |
| Validation | status enum |
| Business rules | Priority-based (High persists; Medium/Low center-only/digest — DSS §7.26); every notification has deep-link target (UXS §16.3) |
| Side effects | Inbox projection; unseen count |
| Events | `notification.updated` (owner) |
| Read models | Inbox, unread badge |
| Realtime | Inbox topic (new notification push) |
| Audit | None |
| Future | Notification rules |

**4.15.2 Notification Preferences**
| Field | Spec |
|---|---|
| Purpose | Manage the caller's notification preferences + digest schedule |
| HTTP/Resource | `GET/PATCH /api/v1/me/notification-preferences` |
| AuthZ | Owner only |
| Request | `{ "categories": { mentions, assignments, qa, reports, announcements, insights, releases, ... }, "channels": { inApp, email, push }, "digest"?: { enabled, time, timezone } }` |
| Response | `200` preferences |
| Validation | category/channel enums |
| Business rules | Defaults from workspace settings; high-priority (security, invitations) not fully muteable (DSS §7.26) |
| Side effects | Routing table updated (Notification Service) |
| Events | `notification.preferencesUpdated` (owner) |
| Read models | Settings UI |
| Realtime | None |
| Audit | None |
| Future | Per-project overrides |

---

### 4.16 Search APIs

**4.16.1 Search (workspace-scoped)**
| Field | Spec |
|---|---|
| Purpose | Full-text + filtered search across the workspace |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/search?q=&entityType=&projectId=&sprintId=&status=&assigneeId=&tag=&archived=&sort=&cursor=&limit=` |
| AuthZ | Any member (results filtered to caller's visible scope) |
| Response | `200` `{ results: [{ entityType, id, title, snippet, rank, matchedOn }], cursor, total }` |
| Validation | q required unless filters present; entityType ∈ {project, feature, task, kbDoc, report, member, sprint, comment}; limit 1–100 |
| Business rules | Index partitions per workspace (DDD §9, §10); **private execution data excluded at index time** (never filtered at query — DDD §10.3); personal favorites/recents rank first (DDD §10.3) |
| Side effects | None |
| Events | None |
| Read models | Search results |
| Realtime | None (poll/on-query) |
| Audit | None |
| Future | Vector/semantic search (additive, Phase 3) |

**4.16.2 Suggestions / Autocomplete**
| Field | Spec |
|---|---|
| Purpose | Type-ahead suggestions for the command palette + search |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/search/suggest?q=&scope=` · `GET .../search/autocomplete?q=` |
| AuthZ | Any member |
| Response | `200` `{ suggestions: [{ label, sublabel, entityType, id, icon, action }], favorites: [...] }` |
| Business rules | Command palette groups: Favorites above search results (UXS §3.7); prefix grammar `>`/`@`/`#`/`/` (UXS §16.8) |
| Side effects | Learning signals (recently-used rank) recorded for owner |
| Events | None |
| Read models | None |
| Realtime | None |
| Audit | None |
| Future | Semantic suggestions (Phase 3) |

**4.16.3 Scoped Search**
| Field | Spec |
|---|---|
| Purpose | Search within a project, KB, or reports |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/search` · `.../kb/search` · `.../reports/search` |
| AuthZ | Any member |
| Response | `200` scoped results |
| Business rules | Same index, scoped partition + entity filter; no cross-workspace leakage |
| Side effects | None |
| Events | None |
| Read models | None |
| Realtime | None |
| Audit | None |
| Future | Full-text comment search expansion |

---

### 4.17 File APIs

**4.17.1 Upload**
| Field | Spec |
|---|---|
| Purpose | Upload a file (attachment, avatar, branding, report export) |
| HTTP/Resource | `POST /api/v1/files/upload?kind=attachment` |
| AuthZ | Authenticated; kind-specific role (avatar/branding: Owner/Admin for workspace branding) |
| Request | multipart/form-data: `{ "file": binary, "kind": enum {attachment, avatar, branding, export}, "workspaceId"?: uuid, "targetId"?: uuid }` |
| Response | `201` `{ fileId, url (signed, short-lived), size, mimeType, checksum }` |
| Validation | size/type allow-lists (Ch. 13); kind + target required; scan must pass |
| Business rules | Server validates + scans; then direct object-store upload via signed URL (no server proxy for large files, SAD §12.2); files private by default, workspace-scoped |
| Side effects | `file.uploaded` event; link to target entity via command (Ch. 13); search index (filename/uploader) |
| Events | `file.uploaded` |
| Read models | Attachment lists, avatar/branding surfaces |
| Realtime | Target entity topic |
| Audit | `files` — upload |
| Future | Chunked upload, resumable |

**4.17.2 Download / Delete**
| Field | Spec |
|---|---|
| Purpose | Download or delete a file |
| HTTP/Resource | `GET /api/v1/files/{fileId}/download` · `DELETE /api/v1/files/{fileId}` |
| AuthZ | Download: member with access to the target entity. Delete: uploader or Owner/Admin |
| Response | `200` stream (signed, short-lived) / `204` |
| Validation | Signed URL expiry; file must belong to caller's workspace |
| Business rules | Downloads are authorized per-request (no public files); retention policy applies (DDD §13.4); delete cascades per lifecycle |
| Side effects | Deletion → attachment list update; storage retention |
| Events | `file.deleted` |
| Read models | Attachment lists |
| Realtime | Target topic |
| Audit | `files` — delete |
| Future | Versioned files |

**4.17.3 Exports / Imports**
| Field | Spec |
|---|---|
| Purpose | Export workspace data or import (CSV) |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/exports` · `GET .../exports` · `POST .../imports` |
| AuthZ | Export: Admin/Owner (full audit export) or member (own scope). Import: Owner/Admin |
| Request | export: `{ "scope"?: enum {audit, projects, features, kb, all}, "format": enum {csv, pdf, json} }`; import: `{ "fileId": uuid, "kind": enum {features, tasks, projects} }` |
| Response | `202` `{ exportId, status: "pending" }` |
| Validation | scope/format enums; import file must have been uploaded + scanned |
| Business rules | Exports are async jobs (File Service); audit export is Admin-only (DDD §8 AuditLog); import validates against invariants, rejects rows with a report (Ch. 13) |
| Side effects | Export file produced (read-model of data); import applies validated rows + conflict report |
| Events | `export.completed`, `import.completed` |
| Read models | Export list, import report |
| Realtime | Export/import completion notifications |
| Audit | `files` — export/import (data leaving/entering scope) |
| Future | Scheduled exports, ZIP bundles |

---

### 4.18 Admin APIs

**4.18.1 Audit Log**
| Field | Spec |
|---|---|
| Purpose | Query the workspace audit log (ActivityEvent-derived) |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/admin/audit-log?actorId=&category=&from=&to=&cursor=` |
| AuthZ | Owner/Admin only |
| Response | `200` `{ entries: [{ eventId, actor, action, subject, before, after, timestamp, category }], cursor }` |
| Business rules | Append-only; corrections are new events (DDD §8.4); **never exposes private execution data** (DDD §13.3) |
| Side effects | None |
| Events | None |
| Read models | Audit log |
| Realtime | None |
| Audit | N/A (this IS the audit surface) |
| Future | Export to SIEM via webhook |

**4.18.2 Feature Flags / Workspace Usage**
| Field | Spec |
|---|---|
| Purpose | Manage workspace-scoped feature flags; view usage |
| HTTP/Resource | `GET/PATCH /api/v1/workspaces/{workspaceId}/admin/flags` · `GET .../admin/usage?period=` |
| AuthZ | Owner/Admin |
| Request | `{ "flags": { key: { enabled, rollout } } }` |
| Response | `200` flags / usage summary |
| Business rules | Feature flags gate new surfaces (DSS Appendix D lifecycle: Experimental/Beta gated); usage is anonymized/aggregated |
| Side effects | Flag change → client capability surface (realtime refresh) |
| Events | `admin.flagChanged` |
| Read models | Client capability config |
| Realtime | Capability refresh broadcast |
| Audit | `admin` — flag changes |
| Future | A/B experiments |

**4.18.3 Member Suspension**
| Field | Spec |
|---|---|
| Purpose | Suspend/restore a member |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/admin/members/{memberId}/suspend` · `.../restore` |
| AuthZ | Owner/Admin |
| Request | `{ "reason": string }` |
| Response | `200` member with status |
| Business rules | Suspended member cannot authenticate into the workspace (423 on login); cannot self-suspend |
| Side effects | Sessions revoked; presence removed; audit entry |
| Events | `workspace.member.suspended`, `workspace.member.restored` |
| Read models | Member list, presence |
| Realtime | Presence grid update |
| Audit | `access` — suspension |
| Future | Deactivation reason taxonomy |

---

### 4.19 Settings APIs

**4.19.1 Workspace Settings**
| Field | Spec |
|---|---|
| Purpose | Read/update workspace settings (roles, defaults, features) |
| HTTP/Resource | `GET/PATCH /api/v1/workspaces/{workspaceId}/settings` |
| AuthZ | GET: any member (own scope). PATCH: Owner/Admin |
| Request | `{ "defaults"?: {...}, "features"?: {...}, "workflowConfig"?: {...}, "privacy"?: {...} }` |
| Response | `200` settings |
| Validation | Enum bounds per WPS/DSS; privacy section Owner-only |
| Business rules | Settings drive defaults (roles, sprint duration, QA gate) (WPS §3.6.2, §5.1); privacy boundary cannot be weakened by settings |
| Side effects | Defaults re-projected; capability surface refresh |
| Events | `workspace.settings.updated` |
| Read models | Settings UI, defaults consumers |
| Realtime | Settings topic |
| Audit | `structure` — settings changes |
| Future | Additive settings sections (integrations, AI, plugins) |

**4.19.2 Intelligence Settings (Workspace Intelligence)**
| Field | Spec |
|---|---|
| Purpose | Configure insight rules (enable/disable, thresholds, audience) |
| HTTP/Resource | `GET/PATCH /api/v1/workspaces/{workspaceId}/settings/intelligence` |
| AuthZ | Owner/Admin (UXS §15.5) |
| Request | `{ "rules": { ruleKey: { enabled, thresholds, audience } } }` |
| Response | `200` rule config |
| Validation | ruleKey ∈ the 10-rule catalog (UXS §15.2); thresholds within bounds; volume caps per-surface |
| Business rules | Rules are rules-based, explainable, conservative, dismissible, privacy-respecting (UXS §15.1); threshold changes audited (UXS §15.5) |
| Side effects | Insight engine reconfig; surfaces update |
| Events | `insight.ruleConfigChanged` |
| Read models | Insight cards, Overview strip, Mission Control |
| Realtime | Insight surface refresh |
| Audit | `admin` — threshold changes |
| Future | Rule builder UI |

**4.19.3 Branding / Integrations Settings**
| Field | Spec |
|---|---|
| Purpose | Manage workspace branding and integration connections |
| HTTP/Resource | `GET/PATCH /api/v1/workspaces/{workspaceId}/settings/branding` · `GET .../settings/integrations` · `POST .../settings/integrations/{provider}/connect` · `DELETE .../integrations/{connectionId}` |
| AuthZ | Owner/Admin |
| Request | branding: `{ logoFileId?, accentTokens? }`; connect: `{ "oauthCode"?: string, "config"?: {...} }` |
| Response | `200` branding / `201` connection |
| Validation | Branding uses DTS tokens (WPS §17.1); provider ∈ {github, gitlab, bitbucket, slack, discord, googleCalendar, outlook, ciCd} |
| Business rules | Integration tokens encrypted, workspace-scoped, revocable (SAD §18.1); disconnect revokes OAuth |
| Side effects | Branding re-project; integration ACL activated; webhook registration |
| Events | `workspace.branding.updated`, `integration.connected`, `integration.disconnected` |
| Read models | Branded surfaces, integration list |
| Realtime | Branding refresh |
| Audit | `admin` — integration connect/disconnect |
| Future | Integration marketplace (Phase 3) |

---

### 4.20 Mission Control APIs

**4.20.1 Mission Control Bundle (read model)**
| Field | Spec |
|---|---|
| Purpose | Serve the Mission Control wall display (WPS §11.5) |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/mission-control` |
| AuthZ | Any member (role-adaptive content) |
| Response | `200` `{ topStrip: { clock, date, sprintDayCountdown, activeReleases }, leftRail: { projectSprintHealth: [...] }, center: { atRisk: [...], blocked: [...], qaQueueDepth, liveActivity }, rightRail: { presenceGrid, focusTotalsToday, upcomingMilestones }, footer: { heartbeat, lastSyncAt } }` |
| Business rules | Auto-refreshes on every workspace event (realtime); color-coded statuses (🟢🟡🔴); privacy identical to §2.4 — focus totals are **anonymized aggregates only** |
| Side effects | None |
| Events | None |
| Read models | All MC widgets |
| Realtime | MC topic (full live refresh) |
| Audit | None |
| Future | Wall-profile configurations |

**4.20.2 Risk List / QA Queue / Presence Grid**
| Field | Spec |
|---|---|
| Purpose | Serve individual Mission Control widgets |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/mission-control/risk-list` · `.../qa-queue` · `.../presence-grid` |
| AuthZ | Any member (role-adaptive) |
| Response | `200` widget payloads |
| Business rules | Risk list derives from intelligence rules + dependency resolver (UXS §15); QA queue depth from In-QA features; presence from heartbeat (ephemeral, DDD §3) |
| Side effects | None |
| Events | None |
| Read models | MC widgets |
| Realtime | Each widget subscribes its topic |
| Audit | None |
| Future | Wall profiles, custom widgets (plugins) |

---

### 4.21 Plugin APIs

**4.21.1 Register / Manage Plugin**
| Field | Spec |
|---|---|
| Purpose | Register a plugin, list plugins, enable/disable, delete |
| HTTP/Resource | `POST /api/v1/plugins` · `GET /api/v1/workspaces/{workspaceId}/plugins` · `PATCH /api/v1/plugins/{pluginId}` · `DELETE /api/v1/plugins/{pluginId}` |
| AuthZ | Register: workspace Owner/Admin. Enable/disable: Owner/Admin. List: any member |
| Request | `{ "manifest": { "id", "version", "name", "description", "entrypoint", "permissions": [...], "extensionPoints": [...], "scopes": [...] } }` |
| Response | `201` plugin with validated manifest + lifecycle state |
| Validation | Manifest schema; permission/scopes whitelist (SAD §20.2); entrypoint URL policy |
| Business rules | Lifecycle `Registered → Enabled (Experimental/Beta/Stable) → Disabled → Removed` (DSS App D); capabilities enforced at runtime = declared scope (SAD §20.3); plugins never bypass privacy boundary |
| Side effects | Sandbox provisioned; extension points registered; audit entry |
| Events | `plugin.registered`, `plugin.enabled`, `plugin.disabled`, `plugin.removed` |
| Read models | Plugin list, marketplace |
| Realtime | Plugin status topic |
| Audit | `admin` — plugin lifecycle |
| Future | Plugin version upgrades, auto-update |

**4.21.2 Plugin Events / Sandbox**
| Field | Spec |
|---|---|
| Purpose | Plugin event subscription + publishing via the platform bus |
| HTTP/Resource | `POST /api/v1/plugins/{pluginId}/events` (publish) · WS topic `/plugins/{pluginId}` (consume) |
| AuthZ | Enabled plugin (server-side token) |
| Request | `{ "type": string, "payload": {...} }` |
| Response | `202` accepted |
| Validation | Event type must be in declared extension points; payload ≤ 64 KB |
| Business rules | Plugin events are side-channel only — they never mutate core aggregates; webhooks outbound are idempotent |
| Side effects | Fanned to plugin subscribers; audit-logged |
| Events | `plugin.eventPublished` |
| Read models | None |
| Realtime | Plugin topic |
| Audit | `admin` |
| Future | Plugin data store (scoped) |

**4.21.3 Marketplace**
| Field | Spec |
|---|---|
| Purpose | Browse and install from the Integration/Plugin Marketplace (WPS §15.3) |
| HTTP/Resource | `GET /api/v1/plugins/marketplace` · `POST /api/v1/plugins/marketplace/{pluginId}/install` |
| AuthZ | Browse: any member. Install: Owner/Admin |
| Response | `200` catalog / `201` installed |
| Business rules | Catalog ships empty-state-friendly until items activate (Phase 3+, WPS §15.3); install = register + enable with consent to permissions |
| Side effects | Installation + permission grant; audit |
| Events | `plugin.installed` |
| Read models | Marketplace, plugin list |
| Realtime | None |
| Audit | `admin` |
| Future | Marketplace publishing flow |

---

### 4.22 AI APIs (guarded — see Ch. 17)

**4.22.1 Workspace Intelligence Insights**
| Field | Spec |
|---|---|
| Purpose | List active insight cards for a surface |
| HTTP/Resource | `GET /api/v1/workspaces/{workspaceId}/insights?surface=overview&dismissed=false` · `POST .../insights/{insightId}/dismiss` |
| AuthZ | Any member (role/audience-scoped per rule) |
| Response | `200` `[{ insightId, type, headline, why, evidence, action, surfacedAt }]` |
| Business rules | Rules-based, explainable, dismissible (UXS §15.1); evidence click-through; volume capped per surface/day (UXS §15.5); dismissals audited |
| Side effects | Dismissal recorded (audited, UXS §15.5) |
| Events | `insight.surfaced`, `insight.dismissed` |
| Read models | Overview strip, dashboards, Mission Control, detail banners |
| Realtime | Insight topic |
| Audit | `admin` — dismissals + threshold changes |
| Future | AI-generated insights consume the same rules substrate (Phase 4) |

**4.22.2 AI Knowledge Search**
| Field | Spec |
|---|---|
| Purpose | Natural-language / assisted knowledge search (guarded) |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/ai/knowledge-search` |
| AuthZ | Any member (workspace AI enabled) |
| Request | `{ "query": string, "scope"?: { projectId?, kbDocId? } }` |
| Response | `200` `{ answer?: string, citations: [{ entityType, id, snippet }], grounded: bool }` |
| Validation | query ≤ 2000 chars; AI flag enabled; per-member quota |
| Business rules | Context built from workspace read models + KB only (privacy filter, SAD §21.2); grounded citations; audit trail of AI interactions (SAD §21.3); never raw private data |
| Side effects | AI usage metrics (anonymized); audit |
| Events | `ai.queryPerformed` |
| Read models | None |
| Realtime | None |
| Audit | `ai` — queries |
| Future | Semantic/vector KB (Phase 3) |

**4.22.3 AI Summaries / Standups / Sprint Planning (Phase 3–5)**
| Field | Spec |
|---|---|
| Purpose | Generate summaries, standups, and sprint-planning proposals |
| HTTP/Resource | `POST /api/v1/workspaces/{workspaceId}/ai/summaries` · `.../ai/standups` · `.../ai/sprint-planning` |
| AuthZ | Any member (role-scoped; AI enabled) |
| Request | `{ "scope": { projectId?, sprintId?, memberId?, period? }, "format"?: enum }` |
| Response | `202` `{ jobId, status: "pending" }` → realtime `ai.jobCompleted` |
| Business rules | Proposals only — human-in-the-loop; AI never mutates aggregates (SAD §21.3); optionally posted as draft reports/docs for review |
| Side effects | Async generation; draft creation; notification |
| Events | `ai.summaryGenerated`, `ai.standupGenerated`, `ai.sprintPlanGenerated` |
| Read models | Draft docs/reports |
| Realtime | Completion notifications |
| Audit | `ai` |
| Future | Agentic assists (Phase 5) |

---

## 5. Authentication

### 5.1 Authentication Overview

```
 ┌──────────┐   credentials   ┌──────────────┐  issue tokens  ┌────────────┐
 │  Client  │ ───────────────▶│ Auth Service │ ─────────────▶ │  Client    │
 └──────────┘                 └──────────────┘                └────────────┘
      │                                                            │
      │ access token (short-lived ~15m) on every request           │
      │ refresh token (opaque, rotating, server-side)              │
      ▼                                                            ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ API Gateway: verify token → attach identity + memberships → authorize   │
 └─────────────────────────────────────────────────────────────────────────┘
```

Model (per SAD §10.2):
- **Access token**: short-lived (15 min), stateless, carries `{ sub, name, memberships: [{workspaceId, role}], defaultWorkspaceId }`.
- **Refresh token**: opaque, server-side, rotating (each refresh issues a new value), tied to a device session, revocable.
- **Email/password** for v1; **SSO/OAuth future** (Ch. 5 §5.10–5.11).

### 5.2 Login
- Endpoint: `POST /api/v1/auth/login` (card 4.2.1).
- Returns access + refresh tokens + user + memberships.
- On `423` (suspended) the client shows the contact-Admin path (DSS error states).

### 5.3 Refresh & Rotation
- Endpoint: `POST /api/v1/auth/refresh`.
- Every refresh rotates the refresh token (family semantics); **reuse detection** (an old token used again) revokes the whole family and alerts (SAD §10.2).
- Clients call refresh before access-token expiry (silent); on refresh failure → logout → login.

### 5.4 Logout & Device Sessions
- `POST /api/v1/auth/logout` ends the session; `DELETE /api/v1/me/sessions/{sessionId}` revokes a specific device (card 4.2.9).
- Logout clears presence; all devices of a member can be signed out individually.

### 5.5 Password Reset
- `POST .../auth/password-reset/request` (always `202`, no account enumeration).
- `POST .../auth/password-reset/confirm` (one-time token; revokes all sessions).

### 5.6 Email Verification
- `POST /api/v1/auth/email/verify` with a one-time token; required for first login + after email change.
- Unverified members may log in but receive verification reminders.

### 5.7 Invitation Flow

```
Admin invites ──▶ POST /workspaces/{id}/members/invite
   email(s) with invite token (expiry, role, teams)
        │
        ▼
Recipient: (a) has account → accept → membership activated
          (b) no account → sign-up with invite token → account + membership
        │
        ▼
workspace.member.added → role applied → onboarding (UXS FTUE §16.1)
```

- Invitations are single-use, time-limited, revocable by Owner/Admin.
- Role set at invite time (default Developer, configurable per workspace — WPS §5.1).

### 5.8 Workspace Switching
- Clients hold all memberships from login/refresh; switching is client-side context, not a new login.
- A workspace-scoped request always carries `workspaceId` in the path; the gateway verifies membership.
- `defaultWorkspaceId` from the login payload is used on first landing (Overview-first, WPS §3.4.1).

### 5.9 Session Management & Multi-device
- Each device = one refresh-token session; sessions listed under `GET /api/v1/me/sessions`.
- Password change / reset / suspension revokes all sessions.
- Multi-device is first-class: realtime presence reflects the active device; offline queues are per-device but sync to the same server truth.

### 5.10 Future: SSO
- Reserved grant type in the token model; enterprise SSO (SAML/OIDC) is **out of v1** (WPS §1.5, SAD ADR 9).
- Design: SSO identity links to the same `User` aggregate; membership + authorization unchanged.

### 5.11 Future: OAuth (for third-party apps)
- Reserved: authorization-code flow for third-party integrations against the **same** endpoints (Ch. 16), with scoped tokens (`workspace:read`, `workspace:write`, `delivery:write`, `focus:own`, etc.).
- Scopes map to the permission matrix (Ch. 6); OAuth tokens are long-lived with refresh; never grant access to private execution data.

---

## 6. Authorization

### 6.1 Model: Edge + Domain (SAD §10.3)

Authorization is **defense in depth**:

1. **Edge (gateway):** capability check by role + workspace membership — fast rejection.
2. **Domain (aggregates):** ownership + resource-level checks inside the aggregate — the last line of defense.
3. **Data layer:** workspace partitioning + privacy boundary (DDD §13.3) — even a bug in the checks cannot leak cross-workspace/private data.

```
 Request ─▶ Gateway: bearer token verified
               │
               ├─▶ membership check (workspaceId ∈ memberships)
               ├─▶ edge capability check (role × endpoint)
               ▼  pass
           Service → Domain aggregate
               ├─▶ resource-level check (own data? target in workspace?)
               └─▶ invariant enforcement (QA gate, scope, ownership)
               ▼  pass
           Write/Read stores (partitioned by workspaceId; privacy boundary)
```

### 6.2 Roles (WPS §5.1 — full catalog)

| Role | Short | Capability class |
|---|---|---|
| Workspace Owner | Owner | All + workspace lifecycle + Owner-only actions |
| Administrator | Admin | All management except Owner-only (successor, hard-delete) |
| Project Manager | PM | Project/sprint/feature/report management |
| Team Leader | Leader | Team orchestration, QA close, delivery actions |
| Developer | Dev | Feature/task work, own execution data |
| QA Engineer | QA | QA lanes + Done gate |
| Viewer | Viewer | Read-only |

### 6.3 Workspace Isolation
- Every resource query/command is scoped by `workspaceId` in the path; the gateway rejects mismatches.
- Read-model stores are partitioned by `workspaceId` (DDD §9.1) — a request cannot address another workspace's partition.
- **No cross-workspace aggregation** (WPS §1.5).

### 6.4 Permission Matrix (edge capabilities, WPS §5.1)

| Capability | Owner | Admin | PM | Leader | Dev | QA | Viewer |
|---|---|---|---|---|---|---|---|
| Manage workspace settings | ✓ | ✓ | – | – | – | – | – |
| Invite / manage members | ✓ | ✓ | – | – | – | – | – |
| Manage teams | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Create/manage projects | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Create/manage sprints | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Create features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Assign/estimate features | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| Advance dev transitions | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| QA transitions (In QA → Approved/Rejected) | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| Done gate (Approved → Done) | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| Owner override (QA gate) | ✓ | ✓ | – | – | – | – | – |
| KB edit/publish | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Reports generate/share/export | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Mission Control / dashboards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (read) |
| Audit log | ✓ | ✓ | – | – | – | – | – |
| Own execution data (sessions/worklogs/journal) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) |
| Read workspace content | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Plugin manage | ✓ | ✓ | – | – | – | – | – |
| Intelligence rule config | ✓ | ✓ | – | – | – | – | – |

### 6.5 Resource-Level Authorization
- **Owner data**: sessions/worklogs/journal/tasks — the calling member must be the owner. No other role, including Admin, can read it (DDD §13.3).
- **Feature-link duration aggregates**: permission-scoped — shown only as `{duration}` with no raw session data.
- **Archived entities**: read access preserved; mutations role-gated (DSS archived state).
- **Suspended members**: no authentication into the workspace (`423`).

### 6.6 Audit
- Every authorization-sensitive action (login, invite, role change, suspension, export, override, plugin/flag change, AI query) writes an ActivityEvent (DDD §8) in the relevant category (security/access/structure/delivery/admin/files/ai/reporting).
- Audit log is Admin-only and workspace-scoped; never contains private execution data.

---

## 7. Standard API Conventions

### 7.1 Naming
- **Resources:** lowercase, plural nouns (`/features`, `/members`); `kebab-case` for multi-word segments (`/knowledge-base` → resource `kb-doc`).
- **Fields:** `lowerCamelCase` (`assigneeIds`, `startedAt`); stable across clients.
- **Actions:** dedicated sub-resources for non-CRUD operations (`/transitions`, `/start`, `/complete`, `/publish`) rather than RPC verbs in the path (`/doTransition` is never used).
- **Query params:** `lowerCamelCase` (`entityType`, `projectId`, `includeArchived`).

### 7.2 URLs
- Base: `https://{host}/api/v1` (all endpoints relative to this).
- Workspace-scoped: `/workspaces/{workspaceId}/<resource>`.
- Member-private: `/me/<resource>` (sessions, worklogs, journal, tasks, notifications, preferences, favorites).
- Read-model bundles: named sub-resources (`/overview`, `/board`, `/mission-control`, `/detail`).
- All IDs are UUIDv4.

### 7.3 Versioning
- Path version: `/api/v1/...` (Ch. 20). All endpoints in this document are v1.
- Read-model JSON shapes are **published as a shared package** consumed by web/desktop/mobile (SAD §8.3).

### 7.4 Pagination
- **Cursor-based** for all list read models (SAD §8.2, ADR 8).
- Request: `?limit=50&cursor=<opaque>` (limit 1–100; default 50).
- Response envelope:
  ```
  { "data": { "items": [...], "nextCursor": "<opaque>" }, "meta": {...} }
  ```
- `nextCursor` null = last page. Cursors are opaque, workspace-scoped, and stable for the session window.
- Default order is `createdAt desc` unless the endpoint documents a sort.

### 7.5 Sorting
- Request: `?sort=updatedAt:desc,priority:asc` (comma-separated, field:direction).
- Allowed sort fields per resource are documented (DDD §9.2: createdAt, updatedAt, dueDate/targetDate, status position, priority, name, estimate, sprint start/end).
- Unknown sort fields → `400`.

### 7.6 Filtering
- Declarative params: `?status=&assigneeId=&projectId=&sprintId=&teamId=&tag=&archived=&period=&from=&to=`.
- `archived=false` is the default (DSS archived state); `includeArchived=true` to include.
- Multiple values for one field: comma-separated (`?status=active,planned`).
- Filter fields per resource are documented (DDD §9.3); unknown filters → `400`.

### 7.7 Searching
- Free-text via `?q=` on list endpoints that support it (Ch. 12 for dedicated Search APIs).
- Search is case-insensitive, tokenized, prefix+fuzzy (DDD §9.6).

### 7.8 Bulk Operations
- Batch create: `POST` with `{ items: [...] }` where the endpoint declares it (e.g., invite multiple emails).
- Batch read: list + filters (no batch-by-IDs endpoint in v1; use `?id=id1,id2` where declared).
- Bulk updates/deletes: reserved for Phase 2; never via unbounded `PATCH /items`.

### 7.9 Idempotency Keys
- Required on **all mutating** endpoints (POST/PATCH/PUT/DELETE that create side effects).
- Header: `Idempotency-Key: <uuid>`.
- Same key + same request body within the retention window → returns the original response (dedupe, SAD §8.2, ADR 10).
- New key for genuinely new operations; retries reuse the key.
- Gateway stores key→response for TTL (default 24 h); conflicts (`400`) if the same key is used with a different body.

### 7.10 Rate Limiting
- Per authenticated member + workspace + endpoint class (Ch. 18).
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- On exceed: `429` + `Retry-After` (Ch. 8).
- Clients back off with exponential retry (SAD §8.4).

### 7.11 Request IDs & Correlation IDs
- Every request gets a `requestId` (returned in `meta`); clients may supply `X-Request-ID`.
- `correlationId` propagates from client through gateway → services → events → external calls (SAD §8.2, Ch. 16).
- Clients include a `X-Correlation-ID` for offline-queue batches so a batch maps to one trace.

### 7.12 Localization
- `Accept-Language` header selects locale (`en`, `de`, `ja`, etc.); defaults to workspace default, then `en`.
- Error messages, insight headlines, notification text, report labels are localizable; **codes and keys are never localized**.
- Dates and numbers are formatted client-side from ISO-8601 / `number` payloads (never pre-formatted strings).

### 7.13 Timezones
- All timestamps are ISO-8601 UTC (`2026-08-01T09:30:00Z`).
- Client sends the user timezone (`X-Timezone: Europe/Berlin`) for **interpretation** (day buckets, availability), never for storage.
- Day-bucketed queries (`from`/`to`, `date`) are interpreted in the caller's timezone (or explicit `?tz=`).

### 7.14 Compression
- Clients send `Accept-Encoding: gzip, br`; API compresses responses (Ch. 18).
- Large list payloads are always compressed; ETags + conditional requests used for reads.

---

## 8. Response Standards

### 8.1 Envelope
Every response uses one consistent envelope:

```
{
  "data":   <resource | list | null>,     // success payload
  "error":  <null | error object>,        // error payload (Ch. 8.3)
  "meta":   {
    "requestId":   "uuid",
    "correlationId": "uuid",
    "timestamp":   "ISO-8601 UTC",
    "version":     "v1",
    "pagination":  { "nextCursor": null }  // on list reads
  }
}
```

- Success: `error: null`. Error: `data: null` (unless partial data is returned).
- All errors share the same envelope; clients parse `error.code` (stable) before any message.

### 8.2 Success Responses

| Status | Meaning | Notes |
|---|---|---|
| `200` | OK | GET/PATCH complete |
| `201` | Created | POST; `Location` header = resource URL |
| `202` | Accepted | Async job (reports, exports, AI) — `{ jobId, status: "pending" }` |
| `204` | No Content | DELETE/confirm endpoints |
| `304` | Not Modified | Conditional GET with valid ETag |

### 8.3 Error Responses

```
{
  "data": null,
  "error": {
    "code": "FEATURE_NOT_FOUND",     // stable, machine-readable, never localized
    "message": "Feature not found in this workspace.",  // localizable
    "details": [                     // validation field errors
      { "field": "title", "code": "REQUIRED", "message": "Title is required." }
    ],
    "retryable": false,              // true → safe to retry with backoff
    "retryAfterSeconds": 5            // present when retryable (429/5xx)
  },
  "meta": { "requestId": "...", ... }
}
```

### 8.4 Error Code Catalog

| HTTP | Code | Meaning | Retryable |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | Request shape/field invalid | No |
| `401` | `UNAUTHENTICATED` | Missing/expired/invalid token | No |
| `401` | `TOKEN_EXPIRED` | Access token expired (client should refresh) | No |
| `401` | `TOKEN_REVOKED` | Refresh token revoked/reused | No |
| `403` | `FORBIDDEN` | Authenticated but lacks capability | No |
| `403` | `WORKSPACE_NOT_ACCESSIBLE` | Not a member / suspended | No |
| `404` | `NOT_FOUND` | Resource absent in caller's scope | No |
| `409` | `CONFLICT` | Version conflict / duplicate / active-session | No |
| `422` | `INVARIANT_VIOLATION` | Domain invariant (e.g., QA gate) | No |
| `423` | `MEMBER_SUSPENDED` | Suspended member | No |
| `429` | `RATE_LIMITED` | Rate limit exceeded | Yes |
| `500` | `INTERNAL_ERROR` | Unexpected server error | Yes |
| `503` | `UNAVAILABLE` | Dependency unavailable | Yes |

### 8.5 Offline & Retry Semantics

- **Client offline:** requests fail locally; the client uses the offline queue (Ch. 11) — no error envelope is produced.
- **Server `429`/`5xx`/`503`:** `retryable: true` + `retryAfterSeconds`; clients retry with exponential backoff + jitter (SAD §8.4). Idempotency keys make retries safe.
- **`409` conflicts** from stale versions or offline replay: client surfaces the conflict per UXS conflict states (SAD §15.3) — never silently overwrites.
- **`422` invariant violations** (QA gate, scope): client shows the DSS error banner ("what happened + what to do") with the offending field.

### 8.6 Caching & Conditional Requests
- Read endpoints return `ETag` (content hash); clients send `If-None-Match` → `304` (no body).
- Read-model responses are cacheable at the client and (where safe) at the edge; writes invalidate via realtime (Ch. 10).
- `Cache-Control` on read models: `private, max-age=0, must-revalidate` (freshness comes from realtime, not long TTLs).

---

## 9. Event Contracts

### 9.1 Event Model

All events are first-class domain facts in the append-only event spine (SAD §7.1, DDD §8). Schema:

| Field | Type | Description |
|---|---|---|
| `eventId` | uuid | Globally unique; idempotency key for consumers |
| `type` | string | Dotted, e.g., `feature.created` |
| `aggregateType` | string | Owning aggregate |
| `aggregateId` | uuid | Aggregate instance |
| `version` | int | Aggregate version (ordering per aggregate) |
| `workspaceId` | uuid | Partitioning + privacy scope |
| `actorId` | uuid | Performing member |
| `timestamp` | ISO-8601 UTC | Monotonic per aggregate |
| `payload` | object | Event-specific data |
| `metadata` | object | correlationId, clientId, requestId |

### 9.2 Event Publishing

```
Aggregate mutation (command validated)
      │  atomic: write + event append (outbox, SAD ADR 10)
      ▼
Event spine (append-only) ──▶ Projectors → read models / search / KPI
      │
      ├──▶ Realtime gateway → subscribed clients (at-least-once + sequence)
      ├──▶ Notification service (deduped per recipient)
      ├──▶ Webhooks / integration ACL (idempotent outbound)
      └──▶ Audit log (ActivityEvent-derived, Admin view)
```

- **Atomicity:** a state change and its event commit together — no event without its write, no write without its event (ADR 10).
- **Ordering:** strictly ordered per aggregate by `version`; cross-aggregate ordering is best-effort by `timestamp`.
- **Immutability:** events are never updated/deleted; corrections are compensating events (DDD §8.4).
- **Delivery:** at-least-once; consumers dedupe by `eventId` (idempotent).

### 9.3 Event Catalogue

Required events (this chapter) plus the events published by cards in Ch. 4. Every event defines: **publisher, subscribers, payload, ordering, retry, idempotency, audit**.

**9.3.1 WorkspaceCreated**
| Field | Value |
|---|---|
| Type | `workspace.created` |
| Publisher | Workspace Service |
| Subscribers | Read-model projectors (Overview, Hub), Analytics |
| Payload | `{ workspaceId, slug, name, templateId?, actorId, timestamp }` |
| Ordering | Aggregate-scoped |
| Retry | At-least-once; DLQ after N attempts |
| Idempotency | `eventId` dedupe |
| Audit | `structure` |

**9.3.2 ProjectCreated**
| Type | `project.created` |
| Publisher | Workspace Service |
| Subscribers | Board/overview projectors, Search indexer, Timeline |
| Payload | `{ projectId, workspaceId, name, teamIds, qaGateEnabled, actorId }` |
| Retry/Idempotency/Audit | same as above / `structure` |

**9.3.3 SprintStarted**
| Type | `sprint.started` |
| Publisher | Delivery Service |
| Subscribers | Burndown/velocity projectors, Mission Control, Notification |
| Payload | `{ sprintId, projectId, workspaceId, startDate, endDate, goal, actorId }` |
| Audit | `delivery` |

**9.3.4 FeatureCreated**
| Type | `feature.created` |
| Publisher | Workspace Service |
| Subscribers | Board, feature list, Overview, Search, Timeline, realtime |
| Payload | `{ featureId, projectId, sprintId?, workspaceId, title, type, estimate?, assigneeIds, actorId }` |
| Audit | `structure` |

**9.3.5 FeatureAssigned**
| Type | `feature.assigned` |
| Publisher | Workspace Service |
| Subscribers | My Work, board avatars, Member cards, Notification (assignee) |
| Payload | `{ featureId, workspaceId, assigneeIds, actorId }` |
| Audit | `delivery` |

**9.3.6 FeatureCompleted**
| Type | `feature.completed` |
| Publisher | Delivery Service (via transition to Done) |
| Subscribers | Burndown, velocity, QA queue, Mission Control, Timeline, Notification |
| Payload | `{ featureId, workspaceId, sprintId?, completedAt, override?: { by, reason }, actorId }` |
| Audit | `delivery` — includes QA gate override |

**9.3.7 TaskCompleted**
| Type | `task.completed` |
| Publisher | Focus & Time / Workspace Service |
| Subscribers | My Work, personal dashboard, feature subtask counts |
| Payload | `{ taskId, featureId?, workspaceId?, actorId, completedAt }` |
| Audit | None (personal) / `structure` if workspace-linked |

**9.3.8 SessionStarted / SessionCompleted**
| Type | `session.started` / `session.completed` |
| Publisher | Focus Service |
| Subscribers | Presence, feature duration aggregate (permission-scoped), personal analytics, HealthCalculator |
| Payload | started: `{ sessionId, ownerId, mode, featureId?, taskId?, startedAt }`; completed: `{ + endedAt, durationMinutes, status }` |
| Ordering | Owner-scoped |
| Audit | None (personal) — privacy boundary: payload never fan-outs raw data cross-member |
| Idempotency | `eventId`; end is first-completion-final (immutable, DDD §7.2) |

**9.3.9 ReportGenerated**
| Type | `report.generated` |
| Publisher | Reporting Service |
| Subscribers | Reports list, Notification (requester), export pipeline |
| Payload | `{ reportId, workspaceId, type, scope, status, fileRef?, actorId }` |
| Audit | `reporting` |

**9.3.10 NotificationCreated**
| Type | `notification.created` |
| Publisher | Notification Service |
| Subscribers | Inbox read model, realtime gateway (recipient), push/email workers |
| Payload | `{ notificationId, recipientId, workspaceId, category, priority, title, deepLink, actorId? }` |
| Ordering | Per-recipient |
| Idempotency | Per-recipient dedupe (SAD §13.2) |
| Audit | None (derived) |

**9.3.11 ReleasePublished**
| Type | `release.published` |
| Publisher | Delivery Service |
| Subscribers | Release pipeline, Timeline, Mission Control, Notification, docs |
| Payload | `{ releaseId, workspaceId, projectId?, version, features: [ids], qaSignOff, deployment?, actorId }` |
| Audit | `delivery` |

**9.3.12 Additional events** (per Ch. 4 cards, same contract shape):
`workspace.updated` · `workspace.slug.changed` · `workspace.member.invited` · `workspace.member.added` · `workspace.member.roleChanged` · `workspace.member.removed` · `workspace.member.suspended` · `workspace.member.restored` · `team.*` · `project.updated` · `project.archived` · `project.restored` · `project.health.changed` · `sprint.completed` · `sprint.scopeChanged` · `feature.updated` · `feature.statusChanged` · `feature.qaApproved` · `feature.qaRejected` · `feature.sprintChanged` · `feature.unassigned` · `feature.estimateChanged` · `feature.dependency.added` · `feature.dependency.removed` · `task.created` · `task.updated` · `worklog.*` · `journal.entryCreated` · `kb.docCreated` · `kb.docUpdated` · `kb.docPublished` · `milestone.*` · `release.published` · `report.schedule.*` · `report.shared` · `report.exported` · `calendar.entry*` · `notification.updated` · `notification.preferencesUpdated` · `file.uploaded` · `file.deleted` · `export.completed` · `import.completed` · `insight.surfaced` · `insight.dismissed` · `insight.ruleConfigChanged` · `plugin.*` · `integration.connected` · `integration.disconnected` · `admin.flagChanged` · `ai.*` · `auth.*` (audit-only).

### 9.4 Consumer Contract
- **Projectors** must be idempotent and replayable (rebuild from spine, SAD §7.3).
- **Side-effect consumers** (notifications, webhooks) must be idempotent by `eventId` (SAD §7.3).
- **Clients** subscribe to topics (Ch. 10) and dedupe by `eventId`; they never subscribe to the spine directly.

---

## 10. Realtime APIs

### 10.1 Transport
- **WebSocket (primary):** `wss://{host}/api/v1/realtime?token=<accessToken>&workspaceId=<id>`
- **SSE fallback:** `GET /api/v1/stream?workspaceId=<id>` (with `Authorization` header / event-source polyfill).

### 10.2 Topic Model

| Topic | Scope | Consumers | Example events |
|---|---|---|---|
| `/ws/{workspaceId}/general` | workspace | All members | workspace.updated, announcements |
| `/ws/{workspaceId}/projects` | workspace | Members | project.*, board movement |
| `/ws/{workspaceId}/sprints` | workspace | Members | sprint.*, burndown, velocity |
| `/ws/{workspaceId}/features/{featureId}` | entity | Detail viewers | feature.updated, comments |
| `/ws/{workspaceId}/mission-control` | workspace | MC wall | risk list, presence, QA queue |
| `/ws/{workspaceId}/kb` | workspace | KB viewers | kb.doc* |
| `/ws/{workspaceId}/presence` | workspace | Members | presence changes |
| `/ws/{workspaceId}/notifications/{memberId}` | personal | Recipient | notification.created |
| `/ws/me/{memberId}` | personal | Owner's devices | personal analytics, session events |
| `/ws/{workspaceId}/insights` | workspace | Members | insight.surfaced/dismissed |
| `/plugins/{pluginId}` | plugin | Plugin sandbox | plugin.eventPublished |

### 10.3 Message Frame

```
{ "eventId": "uuid", "type": "feature.updated", "workspaceId": "...",
  "sequence": 1024, "timestamp": "...", "payload": {...} }
```

- **At-least-once** delivery with `eventId` dedupe + `sequence` for gap detection (DDD §11).
- Out-of-order events reconcile by `timestamp`/`sequence` (DDD §11).

### 10.4 Connection Lifecycle

```
Connect (token+workspace) ──▶ authenticated → subscribe topics
      │
      ├─▶ Heartbeat (ping every 30s; server pong; missed >90s → dead)
      ├─▶ Events pushed as they occur
      ├─▶ Reconnect (backoff): resubscribe → gap-fill via REST (since last sequence)
      └─▶ Disconnect: presence timeout (≤ 5s) marks offline (WPS §11.1)
```

- **Reconnection:** exponential backoff with jitter; after reconnect, request missed events since last `sequence` (`GET .../events?sinceSequence=`).
- **Heartbeat:** 30 s ping; server keeps presence fresh from heartbeat + session state (DDD §11).
- **Presence:** derived, ephemeral (DDD §3); states Online/Focusing/Reviewing/Testing/In Meeting/Away (WPS §11.1).

### 10.5 Realtime Flow Diagram

```
Domain event (validated write)
      │
      ▼
Event spine ──▶ Realtime gateway ──▶ topic fan-out
      │                                   │
      │                                   ▼
      │                            Subscribed clients
      │                            (dedupe by eventId,
      │                             reconcile cache patch)
      │
      └──▶ gap-fill REST for reconnected clients
```

### 10.6 What Is Not Realtime
- Private execution data is **never** on shared topics; only `{duration}` aggregates on feature detail (permission-scoped).
- Read-model heavy widgets may be poll/refresh (dashboards with sub-second tolerance) rather than event-driven (DDD §11).

---

## 11. Offline Synchronization

### 11.1 Offline Model (DDD §12, SAD §15)

- Clients keep a **durable queue** (IndexedDB on web; embedded store on desktop/mobile).
- Offline reads: already-cached read models. Offline writes: **low-risk field edits** — feature status, comments, personal tasks/sessions, checklists (DDD §12.2).
- **Not offline-writable:** admin operations, ownership transfers, deletions (require online confirmation).

### 11.2 Sync Protocol

```
Offline write ──▶ queue (durable, per-device)
      │
      ▼ (online)
POST /api/v1/sync        { batch: [ { idempotencyKey, tempId, command, baseVersion, payload } ] }
      │
      ▼
Gateway → domain write path (same invariants as online)
      │
      ▼
200 { results: [ { tempId → canonicalId, status: "applied" | "conflict" | "rejected", conflict? } ] }
      │
      ▼
Pull: GET /api/v1/sync/pull?sinceCursor=   → missed read-model updates
```

### 11.3 Temporary & Canonical IDs
- Client issues `tempId` (client-generated UUID) for new entities; server returns the mapping `tempId → canonicalId` on ack.
- References inside a queued batch may use temp IDs; the server resolves them in order.

### 11.4 Conflict Detection & Merge Strategy (DDD §7, SAD §15.3)

| Case | Strategy |
|---|---|
| No concurrent change | Applied silently; LWW by server timestamp |
| Concurrent edit, different fields | Per-field merge (safe) |
| Concurrent edit, same field | **Conflict notice** → user resolves (never silent overwrite) |
| Immutable evidence (session completion, first Done) | **Rejected outright** (first completion final) — 422 |
| Semantic conflict (QA gate, scope) | Rejected by invariant — 422 with reason |
| Deleted while offline | Tombstone → conflict notice; user re-creates or dismisses |
| Offline-only content | Syncs on reconnect; "pending" until ack |

### 11.5 Retry & Reconciliation
- **Idempotent retry with backoff**; queued writes carry unique client IDs (SAD §15.2).
- Long-offline sessions get a reconciliation summary: "3 changes synced, 1 needs review" (UXS §9.4 offline pill, §11.3).
- Cache version stamps: stale caches refresh on reconnect (pull).
- Privacy: offline queue/cache are scoped to the signed-in member's own data; private data encrypted at rest on device (SAD §15.4).

### 11.6 Offline Sync Diagram

```
 Device offline                          Device online
─────────────────                       ─────────────────
 read: cached read models      ┌────────▶ POST /sync (batch replay, temp IDs)
 write: queue (durable) ───────┘         │  server invariants enforced
 UI: offline pill (UXS §9.4)              ▼
 optimistic updates                    200: tempId→canonical mapping
                                          + conflicts (per-field/LWW)
                                         ▼
                                 GET /sync/pull (sinceCursor)
                                          ▼
                                 cache reconciled, realtime resumes
```

---

## 12. Search APIs

### 12.1 Search Model (DDD §9–10)

```
Write event ──▶ Search indexer (async) ──▶ partitioned index (per workspace)
                                                 │
Query (workspace-scoped) ──▶ Search Service ─────┘
   q + filters + entityType + sort
      │
      ▼
Ranked results (relevance → recency → access → health lift → personal signal)
```

- **Partitioned per workspace** (DDD §9.1); no cross-workspace query possible.
- **Private data excluded at index time** (DDD §10.3) — never filtered at query time.
- Eventually consistent (index lag target < 5 s); rebuildable full reindex (SAD §11.4).

### 12.2 Search Surfaces & Endpoints

| Surface | Endpoint | Scope |
|---|---|---|
| Global (command palette) | `GET /workspaces/{id}/search` | All visible entities |
| Workspace search | `GET /workspaces/{id}/search` | Workspace |
| Project search | `GET /workspaces/{id}/projects/{pid}/search` | Project |
| Feature search | `.../features/search` | Features |
| Knowledge search | `.../kb/search` | KB docs |
| Reports search | `.../reports/search` | Reports |
| Suggestions | `.../search/suggest` | Type-ahead |
| Autocomplete | `.../search/autocomplete` | Command palette |

### 12.3 Searchable Entities (DDD §10.2)

Projects (name, description, tags, team) · Features (title, description, ID, tags, assignee, status) · Members (name, role, team) · Reports (title, scope, period) · KB (title, body, tags, linked entities) · Files (filename, uploader, project) · Comments (body, author, entity) · Sprints (goal, name, dates, project) · Teams (name, description, leader). **Never indexed:** sessions, worklogs, journal, private tasks, presence.

### 12.4 Ranking (DDD §10.3)

1. Relevance (BM25-style, tokenized + prefix/fuzzy).
2. Recency.
3. Access scope (private already excluded at index).
4. Health/status lift.
5. Personal signal — favorites and recents rank first.

### 12.5 Query Parameters

`q` (free text) · `entityType` · `projectId` · `sprintId` · `featureId` · `status` · `assigneeId` · `teamId` · `tag` · `archived` · `from`/`to` (period) · `sort` · `cursor` · `limit` (1–100).

### 12.6 Response

```
{ "data": { "items": [ { "entityType", "id", "title", "snippet", "rank",
                         "matchedOn", "favorite": bool } ],
            "nextCursor": "..." }, "meta": {...} }
```

### 12.7 Command Palette Grammar (UXS §16.8)

| Prefix | Meaning |
|---|---|
| `plain text` | Global search |
| `>` | Commands (navigate, create, assign, generate, invite, switch) |
| `@` | Members |
| `#` | Projects |
| `/` | Scoped search (current context) |

Favorites group always renders above results (UXS §3.7); role-aware (hidden/disabled by role).

### 12.8 Future Semantic Search
- Vector embeddings for KB docs/features reserved (DDD §9.7, SAD §21); derived, separate index; additive — no contract change to existing Search APIs (Phase 3).

---

## 13. File APIs

### 13.1 File Model (SAD §12)

- **Private by default, workspace-scoped.** Signed short-lived URLs for every access; per-request authorization.
- Upload validated + scanned, then direct object-store upload via signed URL (no server proxying for large files).
- Kinds: `attachment`, `avatar`, `branding`, `export`.

### 13.2 File Upload Flow

```
Client ─▶ POST /files/upload (metadata, auth, kind, target)
      │   ← 201 { fileId, uploadUrl (signed, short-lived), fields }
      ▼
Client ─▶ PUT uploadUrl (direct object-store, no proxy)
      │
      ▼
Client ─▶ POST /files/{fileId}/confirm → file.uploaded event
      │  link to entity (feature/comment/KB) via domain command
      ▼
Attachment list / avatar / branding surfaces updated (realtime)
```

### 13.3 Endpoints

| Endpoint | Purpose | AuthZ |
|---|---|---|
| `POST /api/v1/files/upload` | Request upload (returns signed upload URL) | Authenticated; kind-specific role |
| `POST /api/v1/files/{fileId}/confirm` | Confirm completed upload | Uploader |
| `GET /api/v1/files/{fileId}/download` | Download (signed, authorized) | Member with target access |
| `DELETE /api/v1/files/{fileId}` | Delete | Uploader or Owner/Admin |
| `POST /api/v1/workspaces/{id}/exports` | Export workspace data (async) | Admin (audit) / member (own scope) |
| `POST /api/v1/workspaces/{id}/imports` | Import CSV (async, validated) | Owner/Admin |

### 13.4 Security & Validation
- Size/type allow-lists; malware scan at upload; checksum verified at confirm.
- Signed URLs expire (short-lived); downloads re-authorized per request (SAD §12.3).
- File content never served with private execution data; export bundles respect the privacy boundary (no raw private data in workspace exports).

### 13.5 Retention (DDD §13.4)
- Retention policy per kind; workspace deletion cascades file deletion; retention sweep is an idempotent background job (SAD §13.2).
- Audit exports follow audit retention (cold storage, never silently truncated under audit).

---

## 14. Notification APIs

### 14.1 Notification Model (DSS §7.26, WPS §13)

Anatomy: icon · one-line title · context line · time · action · dismiss. Priority: **High persists; Medium/Low center-only/digest**. Every notification click-throughs to exact context (deep-link target required).

### 14.2 Categories & Channels

| Category | Examples | Default channels |
|---|---|---|
| Mentions | `@member` in comments/docs | in-app, email, push |
| Assignments | feature assigned | in-app, push |
| QA | In QA → Approved/Rejected, Done gate | in-app, email |
| Reports | report generated/shared | in-app, email |
| Releases | release published | in-app, email |
| Milestones | milestone slip (intelligence) | in-app |
| Insights | high-signal intelligence | in-app |
| Announcements | workspace broadcast | in-app, email (high) |
| Security | password change, new device | in-app, email (high, not muteable) |

### 14.3 Delivery Pipeline

```
Domain event ──▶ Notification Service
      │  per-recipient dedupe + preference routing
      ├──▶ In-app: inbox read model + realtime push
      ├──▶ Email: templated, batched, digest-capable
      └──▶ Push (mobile/desktop): provider worker
      ▼
Recipient click-through → deep-link → exact context (UXS §16.3)
```

### 14.4 Endpoints

| Endpoint | Purpose | AuthZ |
|---|---|---|
| `GET /api/v1/me/notifications?status=&category=` | Inbox | Owner |
| `PATCH /api/v1/me/notifications/{id}` | read/dismiss | Owner |
| `POST /api/v1/me/notifications/read-all` | mark all read | Owner |
| `GET/PATCH /api/v1/me/notification-preferences` | preferences + digest | Owner |
| `GET /api/v1/me/notifications/digest` | digest schedule/state | Owner |

### 14.5 Digest
- Configurable time + timezone (Ch. 7 §7.13); Medium/Low items roll into digest.
- High-priority and security notifications bypass digest (DSS §7.26).

### 14.6 Mentions & Mentions-Only Events
- Mentions are linkable, comment-anchored, and create a `Mention` event → notification with deep link.
- Never send notification content that exposes private execution data (privacy boundary).

---

## 15. Plugin APIs

### 15.1 Plugin Model (SAD §20)

Plugins extend FocusFlow through **published extension points**; they never modify core domain behavior or bypass the privacy boundary. Lifecycle: `Registered → Enabled (Experimental/Beta/Stable) → Disabled → Removed` (DSS Appendix D).

### 15.2 Plugin Communication

```
Plugin (external service, sandboxed)
      │  manifest (id, version, permissions, extensionPoints, scopes)
      ▼
POST /api/v1/plugins  ──▶ Plugin Manager (validates manifest)
      │  provision sandbox + extension points + scoped token
      ▼
Runtime:
  consume events: WS topic /plugins/{pluginId} (declared events only)
  publish events: POST /api/v1/plugins/{pluginId}/events (side-channel only)
  extension UI:  declared UI surfaces (designated zones only)
      │
      ▼
Audit: every plugin action logged; capabilities enforced = declared scope
```

### 15.3 Extension Points (SAD §20.2)

| Extension point | Can | Cannot |
|---|---|---|
| Read-model extension | Custom fields/cards on views | Read private execution data |
| Command interceptor | React to domain events (consume) | Mutate other contexts directly |
| Integration adapter | Add a provider (ACL shape) | Bypass OAuth/ACL isolation |
| UI surface | Render in designated plugin zones | Override core screens |
| Notification channel | New delivery channel | Read raw Focus data |

### 15.4 Permissions & Scopes

- Manifest declares permissions + data scopes; runtime enforcement matches declarations (SAD §20.3).
- Permission catalog: `workspace.read`, `workspace.write`, `delivery.read`, `delivery.write`, `kb.read`, `reports.read`, `events.consume.<types>`, `events.publish.<types>`, `webhooks.outbound`.
- **Never granted:** private execution data access, cross-workspace access, aggregate mutation outside declared interceptor events.

### 15.5 Sandbox
- Isolated runtime; a plugin cannot crash core.
- Outbound calls rate-limited + scoped; secrets per-plugin, encrypted, revocable.
- Plugin data store (scoped) reserved for Phase 5.

### 15.6 Marketplace (WPS §15.3)
- `GET /api/v1/plugins/marketplace` — catalog; ships empty-state-friendly until items activate (Phase 3+).
- `POST .../marketplace/{pluginId}/install` — Owner/Admin consent to permissions → register + enable.
- Marketplace = catalog of versioned, reviewed extensions (SAD §20.3).

---

## 16. Integration APIs

### 16.1 Integration Model (SAD §18)

Every external system is wrapped in an **anti-corruption layer (ACL)** inside its consuming context. Integrations are additive; failure never degrades core (feature flags + isolation). Credentials = scoped OAuth tokens, encrypted, workspace-scoped, revocable.

### 16.2 Integration Architecture

```
 FocusFlow domain                                    External system
─────────────────                                    ────────────────
 Workspace/                                        GitHub · GitLab ·
 Delivery/Collab                                  Bitbucket · Slack ·
      │                                           Discord · Google ·
      │  outbound: domain event → ACL adapter     Outlook · CI/CD · AI
      │            → provider API (OAuth, idempotent)
      ▼
 Event spine
      │  inbound: webhook → ACL (validate signature,
      ▼            dedupe, rate-limit) → domain events
 Projectors → read models → realtime
```

### 16.3 Provider Integrations

| Provider | Phase (WPS §14.1, SAD §18.2) | ACL capabilities |
|---|---|---|
| GitHub | 1 | PR/commit/release sync, branch context, webhooks |
| GitLab | 1 | PR/commit/release sync, webhooks |
| Bitbucket | 1 | PR/commit sync, webhooks |
| Slack | 1 | Notifications outbound, slash commands inbound |
| Discord | 1 | Notifications outbound, commands inbound |
| Google Calendar | 2 | Availability + scheduling mapping |
| Outlook | 2 | Availability + scheduling mapping |
| CI/CD | 2 | Build/deploy status → release pipeline |
| AI providers | 3 | Guarded context/prompt service (Ch. 17) |

### 16.4 OAuth for Integrations

- Provider OAuth: `POST /api/v1/workspaces/{id}/settings/integrations/{provider}/connect` (card 4.19.3).
- Scoped tokens per provider (minimal scopes); refresh managed by Integration Manager; revocation cascade on disconnect.
- No client ever sees provider tokens.

### 16.5 Webhooks

- **Inbound:** provider → FocusFlow webhook endpoint; signature validation mandatory; replay dedupe via event idempotency; rate-limited (SAD §18.4).
- **Outbound:** FocusFlow → customer webhooks (Phase 3): signed payloads (`X-FocusFlow-Signature`), retries with exponential backoff + DLQ, idempotent delivery, event-type subscriptions.

### 16.6 ACL + Retry

- ACL translates external models to domain events (`git.push`, `pr.opened`) — external models never leak into domain (ADR 11).
- Retry: at-least-once + idempotent; per-external-id cursor for sync (SAD §13.2); DLQ + alerting on poison events.
- Integration failure isolation: feature-flagged; a failed provider never degrades core (SAD §18.1).

---

## 17. AI APIs

### 17.1 AI Model (SAD §21, UXS §15)

v1 Intelligence is **rules-based and explainable** — not free-form generative AI. AI APIs are architected now, guarded, and additive. Guardrails:

1. **Privacy boundary holds** — context from workspace read models + anonymized summaries only; never raw private execution data; never cross-workspace (DDD §13.3).
2. **Explainable + dismissible** — every proposal shows evidence; dismissals audited (UXS §15.1, §15.5).
3. **Human in the loop** — AI proposes; domain commands dispose; AI never mutates aggregates (SAD §21.3).
4. **Opt-in + auditable** — per-workspace enablement; every AI interaction audited; scoped tokens.
5. **Graceful degradation** — a failing AI provider never affects core (feature flag + isolation).

### 17.2 AI Context Flow

```
Read models + anonymized summaries
      │
      ▼
Context Builder (privacy filter)
   ├─ workspace read models (KB, features, reports, activity)
   ├─ anonymized aggregates (focus totals, velocity)
   └─ ✗ never: raw sessions/worklogs/journal/members' private data
      │
      ▼
AI Provider ACL (only pre-scoped, workspace-approved context)
      │
      ▼
Guardrail layer (intent allow-list, prompt/response policy)
      │
      ▼
Proposal (explainable, cited, dismissible) ──▶ human review ──▶ domain events
```

### 17.3 AI Endpoints

| Endpoint | Phase | Purpose |
|---|---|---|
| `GET/POST /workspaces/{id}/insights` + `/dismiss` | v1 (rules) | Workspace Intelligence cards (UXS §15) |
| `POST /workspaces/{id}/ai/knowledge-search` | 3 | Grounded NL knowledge search |
| `POST /workspaces/{id}/ai/summaries` | 3 | Summaries (docs, sprints, reports) |
| `POST /workspaces/{id}/ai/standups` | 3 | AI standups (PRD §14.1) |
| `POST /workspaces/{id}/ai/sprint-planning` | 3–4 | Sprint-planning proposals |
| `POST /workspaces/{id}/ai/engineering-insights` | 4 | AI engineering insights |
| `GET /workspaces/{id}/ai/status` | v1 | Enablement + quota + guardrail status |

### 17.4 Guardrail API Surface

- `GET /api/v1/workspaces/{id}/ai/status` → `{ enabled, features: [...], perMemberQuota, remaining, auditEnabled }`.
- Config at `.../settings/intelligence` (Owner/Admin) — rule enable/disable, thresholds, audience, volume caps (UXS §15.5).
- Prompt gateway is internal-only (not client-facing) in v1; reserved for Phase 3 agent support.

### 17.5 Future AI Agents (Phase 5)
- Agents act via the same command APIs (proposal → human approval → command). No new privileges; fully audited; privacy-scoped.

---

## 18. Performance

### 18.1 Latency Targets (SAD §17.3)

| Metric | Target |
|---|---|
| Read-model API p95 | < 300 ms |
| Write ack (online) p95 | < 500 ms |
| Realtime event → client p95 | < 1 s |
| Projection lag p95 | < 5 s |
| Search query p95 | < 500 ms |
| Initial route payload | < 200 KB gzipped |

### 18.2 Payload Size
- List endpoints default `limit=50`; max 100; heavy bundles (overview, mission-control) are assembled from cached read models.
- Bodies: request ≤ 1 MB (except file uploads via signed URL); event payloads ≤ 64 KB.
- Field truncation: long text fields are truncated in list views (`snippet`, title previews) — detail views return full content.

### 18.3 Caching
- **Client cache:** read models cached + stale-while-revalidate; realtime patches invalidate (Ch. 10).
- **Edge cache:** only for truly public/stable read models (safe list); never for member/workspace data.
- **HTTP:** ETag/304 conditional requests; `Cache-Control: private, max-age=0, must-revalidate` on read models.
- Cache keys are workspace-scoped (per-workspace cache isolation, SAD §17.2).

### 18.4 Compression
- `gzip`/`br` on all JSON responses; large lists always compressed.
- File downloads served with content-hash ETags; range requests supported.

### 18.5 Batch Requests
- Batch writes via the sync endpoint (`POST /api/v1/sync`) are the sanctioned bulk path (offline replay + bulk UI actions).
- No general HTTP batch multiplexing in v1; dedicated bulk endpoints where declared (Ch. 4).

### 18.6 Streaming
- Async jobs (`202`): status via realtime topic (`jobCompleted`) + polling fallback (`GET .../jobs/{jobId}`).
- Downloads streamed; large exports are async files (Ch. 13).
- AI responses: streamed tokens reserved for Phase 3 (contract additive).

### 18.7 Rate Limits

| Class | Default limit | Window | Notes |
|---|---|---|---|
| Auth endpoints | 10/min per IP | rolling | Login, reset |
| Command writes | 300/min per member | rolling | Per member |
| Read-model reads | 1200/min per member | rolling | Per member |
| Workspace search | 120/min per member | rolling | Query-heavy |
| AI endpoints | 20/min per member | rolling | Quota-gated (Ch. 17) |
| Webhook inbound | per integration | rolling | Signature + replay checks |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; `429` + `Retry-After`.

### 18.8 Concurrency
- Optimistic concurrency via aggregate `version` on writes (409 on stale).
- Realtime delivery is per-connection, ordered by sequence; dedupe by `eventId`.
- Heavy fan-out (Mission Control) uses topic partitioning (per-workspace isolation, SAD §17.2).

---

## 19. Security

### 19.1 Security Model

Defense in depth (SAD §10): **edge (gateway)** authN + capability + partition → **domain** ownership + invariants → **data layer** partitioning + privacy boundary.

### 19.2 Authentication
- Access tokens short-lived (~15 min); refresh tokens rotating, opaque, server-side, HttpOnly+Secure cookie or secure storage; reuse detection revokes family (SAD §10.2, Ch. 5).
- Passwords: memory-hard KDF; no plaintext storage; lockout after failures.

### 19.3 Authorization
- Edge RBAC (Ch. 6 permission matrix) + domain resource checks + data-layer partitioning.
- **Privacy boundary is structural** (DDD §13.3): private execution data is non-queryable across users by construction, not by filtering.

### 19.4 Encryption
- TLS 1.2+ in transit (all endpoints, WS/WSS, SSE, webhooks).
- At rest: credentials/tokens encrypted; private offline data encrypted on device; external integration tokens in an encrypted secret store.
- Secrets never in logs, images, or client payloads.

### 19.5 Secrets Management
- Server-side secret store; per-plugin, per-integration, per-workspace scoping; rotation + revocation; never exposed to clients.

### 19.6 CSRF
- Token-based auth means no cookies for API auth (Bearer headers); where cookies are used (refresh), SameSite + CSRF token required for state-changing requests.

### 19.7 CORS
- Strict allow-list of trusted origins (web app + plugin-approved origins); preflight handling; credentials policy per origin; deny-by-default.

### 19.8 Replay Protection
- Idempotency keys prevent command replay duplication (SAD §8.2).
- Webhook signatures + timestamp window prevent replay (SAD §18.4).
- Real-time dedupe by `eventId` prevents client-side replay effects.

### 19.9 Audit
- Append-only ActivityEvent for every auditable action (Ch. 6 §6.6, DDD §8); Admin-only, workspace-scoped view; corrections are new events.

### 19.10 API Abuse Protection
- Rate limiting (Ch. 18); payload validation at the gateway; malformed-body rejection with `400`;
- Auth endpoint anti-abuse (always `202`, CAPTCHA reserved);
- Abuse/velocity anomaly detection on auth, invite, and export endpoints; account suspension path (Ch. 6).

---

## 20. Versioning Strategy

### 20.1 URI Versioning
- Path version: `/api/v1/...`. Every endpoint in this document is v1.
- New versions `/v2/...` exist only when breaking changes are unavoidable (rare); old versions kept until sunset (20.5).

### 20.2 Backward Compatibility Rules
- **Additive only within a major version:** new fields (request/response), new endpoints, new event types, new enum values, new query params — never removing/renaming/retyping.
- Read-model JSON shapes are a published package (SAD §8.3); additive field additions are safe for strict clients that ignore unknown fields.
- Enum values: adding values is backward-compatible; removing is breaking.
- New event types: additive; consumers ignore unknown `type`s.

### 20.3 Deprecation Policy
| State | Meaning | Duration |
|---|---|---|
| Stable | Consumed by default | — |
| Deprecated | Still works; marked in docs + response header `Deprecation: true` | ≥ 6 months |
| Sunset | Removed; requests return `410 Gone` + migration notice | after deprecation window |

- Deprecations announced via changelog + `Deprecation` headers; no silent removal.

### 20.4 Sunset Policy
- A deprecated feature is removed only after the published window; `410` response includes the replacement endpoint/migration guide.
- Sunset dates communicated in the API changelog and `Sunset` header.

### 20.5 Migration Strategy
- `/v1` and `/v2` coexist during migration; clients migrate at their pace; shared contracts package lets web/desktop/mobile upgrade together.
- Feature flags (20.6) gate behavior changes even within a version.

### 20.6 Feature Flags
- Workspace + platform flags (`GET/PATCH .../admin/flags`, card 4.18.2) gate new surfaces (DSS Appendix D lifecycle: Experimental/Beta gated).
- Flags never change data contracts — they change availability; a gated surface is absent, not different.

---

## 21. API Governance

### 21.1 Naming Rules
- Resources lowercase plural; fields `lowerCamelCase`; actions as sub-resources (Ch. 7 §7.1).
- Stable error codes (Ch. 8 §8.4); never reuse a code for a different meaning.
- Versioned paths only via the documented scheme (Ch. 20); no ad-hoc `?v=`.

### 21.2 Review Process
- Any new/changed endpoint, event, or contract field goes through API review before implementation:
  1. Proposal (purpose, consumers, contract sketch) against this AIS.
  2. Consistency check vs. PRD/WPS/UXS/DSS/DTS/DDD/SAD (no new entities/architecture).
  3. Contract review (naming, envelope, errors, events, read models, realtime, audit).
  4. Approval by API owner + security review (privacy boundary, permissions).
  5. Contract-tests added; docs updated; changelog entry.

### 21.3 Documentation Standards
- Every endpoint has a card in this catalogue (Purpose, method, authZ, request/response, validation, errors, business rules, side effects, events, read models, realtime, audit, future).
- Every event has a contract entry (Ch. 9). The shared contracts package is the machine-readable mirror.

### 21.4 Breaking Changes
- Breaking = removal, rename, retype, or behavior flip of a documented contract.
- Breaking changes require: major version bump, deprecation window (Ch. 20), migration guide, and signed-off client readiness.

### 21.5 Approval Workflow

```
Proposal ─▶ Consistency check vs source-of-truth ─▶ Contract review
    │                                                  │
    └───────◀────────────── rejected: revise ◀─────────┘
                                │ approved
                                ▼
              Security review → contract tests → docs + changelog
                                ▼
                              Release (flag-gated if surface-changing)
```

### 21.6 Ownership
- API Owner owns the contract + review + deprecations.
- Each endpoint's owning service team owns behavior + tests.
- The shared contracts package has a single maintainer (breaking-change gate).

### 21.7 Testing Requirements
- **Contract tests** per endpoint (request/response/error against the shared package) — CI gate.
- **Privacy tests:** no query path can read another member's private execution data (DDD §13.3) — automated.
- **Idempotency tests:** replaying a command with the same key returns the original response.
- **Pagination/sort/filter tests** per list read model.
- **Realtime tests:** event → client delivery, dedupe, reconnection gap-fill.
- **Offline sync tests:** conflict matrix (Ch. 11 §11.4) end-to-end.
- **Security tests:** authN/authorization matrix, rate limits, CORS, webhook signature.

### 21.8 Quality Gates (CI)
Lint · contract tests · privacy tests · idempotency tests · performance budgets (Ch. 18) · security scan · backward-compat diff (no breaking change without major bump).

---

## 22. Future Evolution

### 22.1 Phase Model (WPS §18.1 — product phasing; SAD §25 — architecture phasing)

| Phase | Product (WPS §18.1) | API additions | Breaking? |
|---|---|---|---|
| **1 — Core Workspace** (0–6 mo) | Core workspace, delivery, focus, reports, KB | All `/v1` categories in this AIS (Ch. 3) | — |
| **2 — Advanced Team Management** (6–12 mo) | Teams, releases, milestones, calendar, desktop/mobile, integrations | Calendar sync, CI/CD ACL, batch bulk ops, desktop/mobile sync polish | No (additive) |
| **3 — Engineering Platform** (12–18 mo) | Git/CI integrations, webhooks, plugin/integration marketplace | Webhook API, marketplace publishing, AI summaries/standups/KB search | No (additive) |
| **4 — AI Workspace** (18–24 mo) | AI insights, sprint planning, engineering insights | Semantic search, AI prediction endpoints (same rules substrate) | No (additive) |
| **5 — Developer Operating System** (24+ mo) | Open API, agentic assists, automation workflows | Agent API (proposal → approval → command), plugin data store, embeddable widgets | No (additive) |

### 22.2 How APIs Evolve Without Breaking Clients

1. **Additive-only within `/v1`:** new fields, endpoints, events, enum values — never removals/renames (Ch. 20).
2. **Versioned coexist:** `/v2` only when breaking is unavoidable; `/v1` lives until sunset with `410` + migration.
3. **Shared contracts package:** web/desktop/mobile/plugins consume the same published shapes; additive fields don't break strict clients (ignore-unknown-fields contract).
4. **Events are additive:** new event types never break consumers (unknown `type` ignored).
5. **Feature flags gate surfaces:** availability changes, not contracts.
6. **AI is a new guarded surface,** never a change to existing endpoints.
7. **Realtime topics are namespaced:** new topics don't affect existing subscriptions.

### 22.3 Reserved Expansion Points
- OAuth for third-party apps (Ch. 5 §5.11) — scopes map to the existing permission matrix.
- Webhooks outbound (Phase 3) — signed, idempotent, event-type subscriptions.
- GraphQL layer (SAD ADR 8) — could be added **in front of** read models without changing the REST contract.
- Semantic/vector search — additive index + endpoint (Ch. 12 §12.8).

---

## Revision History

| Version | Date | Author | Notes |
|---|---|---|---|
| v1.0 | 2026 | FocusFlow Architecture Team | Initial AIS — complete API & Integration Specification (22 chapters, endpoint catalogue, event contracts, realtime/offline/sync, AI/plugin/integration surfaces) |

---

*This document contains no implementation code (no Express/Fastify/NestJS/Node.js/React/Axios), no database schemas, and no OpenAPI YAML/Swagger JSON. It is the definitive, implementation-independent communication contract for every client and service of FocusFlow, fully consistent with the PRD, WPS, UXS, DSS, DTS, DDD, and SAD.*
