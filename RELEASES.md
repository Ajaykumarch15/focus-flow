# Release Notes — Phase 2 (Sprint 9 close)

**Release:** Phase 2 — Collaboration on real APIs (Sprint 8 backend + Sprint 9 UI/polish)
**Branch:** `feature/updates` (working tree; not yet merged/committed)
**Gate:** Release Readiness Checklist (§8.4, IES.md) — production release pending

## What this release delivers

Phase 2 replaces the previously fabricated, client-only collaboration module (EAR FE-1/FE-2/FE-24/FE-25/FE-26) with a real, persisted, API-backed implementation end to end.

### Backend (Sprint 8 · IES-P2-01..06)

- **Workspaces & teams** (P2-01): real Mongo models + CRUD routes (`/workspaces`, `/teams`), invite/join/membership surface, role-aware responses.
- **Member validation & indexes** (P2-02): member id/role validation with proper indexes.
- **Roles & permissions** (P2-03): workspace role model + authorization middleware; permission matrix enforced.
- **Activity feed** (P2-04): real, workspace-scoped, cursor-paginated activity from persisted events (`/workspaces/:id/activity`).
- **Notifications** (P2-05): per-user, persisted notifications (invite / role change / removal) with read/read-all and unread count; client stale-interval bug fixed.
- **Search** (P2-06): global + workspace-scoped search over real data (`/search`).

### Frontend (Sprint 9 · IES-P2-07..12)

- **Collaboration store wired to real API** (P2-07): `useCollaborationStore` seed data removed entirely; loaders fetch from the API, mutations are optimistic with rollback (`runMutation`, IES-P0-29). Collab data now **persists across refresh** (verified by new e2e persistence suite — see Testing). 12-test store unit suite added.
- **Collaboration pages: real data** (P2-08): all fabricated metrics removed from TeamWorkspace, ReportsAnalytics, MemberProfile, QADashboard, TeamProjects; numbers are computed from the store/API; safe empty states instead of fallbacks.
- **Journal task-attach explicit** (P2-09): no silent auto-attach to the first active task; entries attach only when a task is selected.
- **Landing page truthful copy** (P2-10): removed fabricated claims (automatic pause detection, rich text editing, ambient sound) and fake testimonials/stats; copy now matches shipped behavior and the product value prop.
- **Collaboration page hygiene** (P2-11): unused `workspaceId` params/state removed; WorkspaceSelector duplicate stat fixed; empty catch replaced with surfaced error; breadcrumbs derive labels from route params via `matchRoutes` instead of an id-length heuristic.
- **Types hygiene** (P2-12): `@types/file-saver` (stale/mismatched) removed in favor of a small ambient declaration matching the shipped `file-saver@2.0.5` surface.

## Known limitations (explicitly out of this release)

- **Collaborative tasks/sprints/docs/blockers/calendar remain client-local** actions in the store (create/update do not hit a backend; no routes/models exist for them). Only workspaces, projects, teams, members, notifications, and activity are API-persisted. The e2e persistence suite documents and asserts only the API-backed entities; task/sprint persistence is a tracked follow-up, not a regression.

## Security

- **React Router RSC CSRF advisory (GHSA-qwww-vcr4-c8h2, 2× High in `npm audit --omit=dev`)** — resolved as **not applicable / already fixed**:
  - The advisory affects only the **unstable RSC data-router APIs**; this SPA uses declarative `BrowserRouter` + `Routes`/`Route` only (verified: no `createBrowserRouter`/`RouterProvider`/`useLoaderData`/`unstable_*` in `src/`).
  - The fix was **backported to `react-router@7.18.2`** (PR #15353), which is exactly what the lockfile installs; npm's advisory range (`>=7.12.0, <8.3.0`) is stale pending `github/advisory-database#8868`.
  - `npm audit fix --force` would only offer a breaking downgrade to `react-router-dom@7.11.0` (older, still on the affected line) and is therefore **not applied**.
  - `scripts/audit-gate.mjs` documents and allowlists this single GHSA; any *new* high/critical finding still blocks CI.

## Testing

- Frontend vitest: **136/136 passing** (22 files), including the new store suite and the new **e2e collab persistence-across-refresh** suite (`src/store/__tests__/collabPersistence.test.ts`, 5 tests).
- Server vitest: **398/398 passing** (38 files) — includes Phase-2 workspace/team/role/activity/notification/search suites.
- `tsc --noEmit` clean; `vite build` clean.
- Audit gate: see Security above.

## Rollback

- No migrations in this release (workspace/team/notification docs are additive and safe to retain on rollback); frontend ships as a static build — reverting the bundle restores the previous UI.
- Release readiness items (cookie auth + CSRF verification, secrets rotation, headers/rate-limiting, backup/restore, staging smoke) are tracked in IES §8.4 and must be completed before production promotion.
