# FocusFlow — Comprehensive Engineering Audit & Production Hardening

**Date:** 2026-08-02
**Branch:** `feature/updates`
**Scope:** Entire codebase — `mainApp/src` (client, 105 files / ~22k LOC), `mainApp/server` (API, 29 files / ~5.6k LOC), configs, lockfiles, env handling, CI/CD, tests.
**Method:** Read-only analysis. Every finding references specific files/functions/line numbers, verified against source. No implementation was performed — this document is the audit + roadmap.

Source audit reports (four domains) underpin this document:
- `mainApp/src` frontend audit → **FE-audit** (32 findings: 5 Critical, 10 High, 11 Medium, 6 Low)
- `mainApp/server` backend/security audit → **BE-audit** (42 findings: 4 Critical, 8 High, 20 Medium, 10 Low)
- `mainApp/server` database/models audit → **DB-audit** (30 findings: 3 Critical, 7 High, 13 Medium, 7 Low)
- Config/Security/DX/Production audit → **CFG-audit** (27 findings: 2 Critical, 6 High, 11 Medium, 8 Low)
- Core business modules (timer, offline queue, report aggregation, session↔worklog sync) → **CM-audit** (synthesized here; primary findings CM-1…CM-12)

**Total: 143 findings (14 Critical, 31 High, 55 Medium, 31 Low).**

---

## Part 1 — Engineering Audit Report

### 1.1 Executive Summary

FocusFlow is a functional full-stack productivity tracker (React 18 + Zustand + Vite + Express 4 + Mongoose 8). It has a genuinely good foundation in places — a well-designed timer FSM with drift resync and cross-tab sync (`timerEngine.ts`), consistent per-user ownership scoping on most API routes, bcrypt cost-12 password hashing, and an allowlisted profile-update path.

However, **the product is not production-ready and is not safe to deploy as-is.** It ships with:

1. **Stored XSS** (CFG-1/FE-14) via a hand-rolled regex markdown renderer fed into `dangerouslySetInnerHTML` at 13 call sites — combined with the JWT living in `localStorage` (CFG-5), one crafted worklog entry can steal any viewer's session, including admins'.
2. **An unauthenticated IDOR report endpoint** (BE-1/CFG-2/CM-1): `GET /api/reports/share/:userId/:date` exposes any user's full daily report (task titles, focus time, work logs with `plan`/`designNotes`/`blockers`) to anyone who can guess an ObjectId + date.
3. **A placeholder JWT secret** (BE-2/CFG-3) in `server/.env` (`your_super_secret_jwt_key_change_this_in_production_min_32_chars`) that permits forging tokens for any user, including admins.
4. **Google OAuth tokens leaking to the browser** (BE-3/DB-2): `User.toJSON` strips only `passwordHash`, so long-lived Google `refreshToken`s are serialized across 11 response paths.
5. **A collaboration module that is a hardcoded client-side demo** (FE-1/FE-2/FE-24): workspaces, sprints, analytics ("62/85 points", "1.4 days", "94%") are fabricated literals in JSX; nothing persists.
6. **Real production credentials in plaintext** in `server/.env` (weak Mongo password `AJAY:AJAY`, live Google OAuth secret) — BE-4/CFG-4.
7. **Mass-assignment PATCH endpoints** (BE-5/6/7/DB-3) that let users transfer ownership or inflate time/points/streaks.
8. **Client-controlled session timestamps** (BE-8) permitting unlimited points/streak/leaderboard fraud.
9. **No CI, no lint, no typecheck script, no runnable tests, no security headers, no rate limiting, no graceful shutdown, no Docker** (CFG-6/8/11/14/16/17/18).
10. **Per-user collection scans** on hot report queries and **N+1 query storms** on `GET /api/worklogs` (BE-20/22, DB-4/5/6/11).

Strengths to preserve and build on: the timer engine's FSM/BroadcastChannel design, local-time-first `time.ts` helpers, real API usage patterns in the admin pages, `react-markdown` in Journal (the only safe markdown path), the ownership-scoped `protect` middleware, and the admin route gating.

### 1.2 Scorecard (0–10)

| Dimension | Score | Rationale | Anchor findings |
|---|---|---|---|
| **Architecture** | 5.5 | Good separation (pages/stores/hooks/lib/utils) and a solid timer engine, but a demo collaboration layer, three divergent timer implementations, duplicated date/sync logic across files, a layering inversion (`lib/docEngine` imports from `components/ui`), and the doc engine rebuilt instead of composed. | FE-1, FE-3, FE-13, FE-14, BE-18, BE-19 |
| **Frontend** | 4.0 | Strong visual token system and store discipline in places, but monoliths (WorkLog.tsx 1,553 lines), fabricated metrics, dead buttons, ghost routes from text-typo paths, stale closures, optimistic mutations with no rollback, and a 1,210-line dead `Admin.tsx`. | FE-1/2/5/7/8/9/11/15/17/20 |
| **Backend** | 5.0 | Ownership scoping on most CRUD, admin gating, bcrypt-12, allowlisted profile updates — undermined by mass assignment, weak validation, inconsistent response envelopes, duplicated logic, error-message leakage, and no rate limiting. | BE-5/6/7/14/16/17/18/19, CFG-6 |
| **Database** | 5.0 | Timestamps on all models, sensible enums and some compound indexes, task-delete cascade — but soft-delete is ignored at auth, googleTokens stored plaintext, missing compound indexes on every hot report path, eight unbounded embedded arrays on WorkLog (16 MB ceiling), no TTL anywhere. | DB-1/2/4/5/6/8/10/17/18 |
| **Security** | 2.0 | Critical: stored XSS, unauthenticated IDOR, forgeable JWTs, leaked Google tokens, real creds in `.env`. No helmet/CSP, no rate limiting, tokens in localStorage, JWT in OAuth `state` URL. | CFG-1/2/3/4/5/8/12, BE-1/2/3/4/10 |
| **Performance** | 3.5 | N+1 on the primary worklog list, unbounded per-user scans on reports, JS-side aggregation of all sessions/tasks in admin analytics, per-second re-render ticks, render-time timer formatting, "week" stats that are all-time. | BE-20/22/23, DB-4/11, FE-15/20/31 |
| **Accessibility** | 3.0 | No `name`/`autoComplete` on auth inputs (breaks password managers), blank-flash loading states, no error boundary, keyboard/contrast largely unchecked, 13 raw-HTML injection sites that also break screen-reader semantics. | FE-10/14/22, CFG-15 |
| **Maintainability** | 4.0 | No lint/typecheck/CI/test gates, status/mood config duplicated in 6+ places, `mapLog`/`mapDoc` duplicated, typo routes in `App.tsx`, dead files, fire-and-forget activity logging, no validation library. | CFG-17/18/24/25/26, FE-11/12/17/18/19 |
| **Scalability** | 3.0 | Linear scans, N+1, unbounded arrays, no pagination on admin lists, full-dataset in-memory aggregation, GET that performs writes, no indexing on `workEntries.date` multikey paths. | BE-20/21/23/30, DB-4/5/8/11/16/17 |

**Overall readiness: 3.9 / 10.** The app is feature-complete but not production-safe. The roadmap (Part 4) closes this in six sprints.

---

## Part 2 — Technical Debt Report

Severity definitions:
- **Critical** — security breach / data exposure / account takeover / silent data loss. Fix first.
- **High** — integrity or availability risks, exploitable abuse, serious scalability ceilings.
- **Medium** — correctness drift, maintainability, moderate performance/debt.
- **Low** — hygiene, DX, cosmetic debt.

### 2.1 Critical (14)

| ID | Finding | Location | Impact |
|---|---|---|---|
| CFG-1 | Stored XSS via `renderMarkdown` (escapes only `&<>`; allows `javascript:` URLs and attribute breakout) rendered through `dangerouslySetInnerHTML` | `src/components/ui/proEditor.tsx:10-51`; 13 call sites: WorkLogDetail.tsx:380/392/404/416/428/533, Reports.tsx:403/409/429/435/441, Admin.tsx:934, AdminPeople.tsx:178; editor `innerHTML` sink proEditor.tsx:362 | Arbitrary script execution in any viewer (incl. admins); JWT stealable from localStorage → account takeover. Stored, cross-user. |
| BE-1 / CFG-2 / CM-1 | Unauthenticated IDOR report share: `GET /api/reports/share/:userId/:date` (no `protect`, no token, no expiry) returns any user's daily report | `server/routes/reports.js:313-336`; routed `src/App.tsx:95` | Any anonymous attacker enumerates ObjectIds+dates to read private reports (tasks, focus time, worklog content). |
| BE-2 / CFG-3 | Placeholder `JWT_SECRET` (`your_super_secret_jwt_key_change_this_in_production_min_32_chars`) | `server/.env:2`; signed auth.js:10-11, verified middleware/auth.js:16 | Forgeable tokens for any user (incl. admin) → full account takeover. |
| BE-3 / DB-2 | Google OAuth access/refresh tokens serialized to browser (toJSON strips only `passwordHash`) | `models/User.js:31-35,42-44`; 11 paths: auth.js:33/59/70/110, profile.js:9/22, admin.js:49/59/88/119/136 | Long-lived Google `refreshToken` exposed → permanent Drive impersonation; admin endpoints leak every user's tokens. |
| BE-4 / CFG-4 | Real production credentials in plaintext `server/.env` (Atlas `AJAY:AJAY`, live Google secret) | `server/.env:1,5,6` | DB + Google compromise if the file leaks/commits. |
| BE-5 / DB-3 | Mass assignment on `PATCH /api/tasks/:id` (`$set: req.body`) — can set `userId`, `totalTime`, `status` | `routes/tasks.js:56-72` (line 60) | Ownership transfer, time/points/leaderboard fraud. |
| BE-6 / DB-3 | Mass assignment on `PATCH /api/worklogs/:id` — can set `userId`, `googleDocId`, `workEntries` | `routes/workLogs.js:315-330` (line 319) | Ownership reassignment; server pushes content into attacker-chosen Google Docs. |
| BE-7 / DB-3 | Mass assignment on `PATCH /api/journals/:id` | `routes/journals.js:48-60` (line 52) | Journal ownership transfer; out-of-range mood persisted (no `runValidators`). |
| DB-1 / BE-12 | Soft-deleted users retain full API access (login + `protect` ignore `deletedAt`) | `models/User.js:36`; auth.js:49; middleware/auth.js:19; admin.js:107-124 | Deletion is cosmetic; blocked users keep working. |
| FE-1 | Collaboration module is a fully client-side demo with hardcoded 2026 seed data, zero persistence | `src/store/useCollaborationStore.ts` (seed 20-381, in-memory mutations 461-504) | Workspace/team/sprint feature is a mirage; user data silently vanishes. |
| FE-2 / FE-24 | Fabricated metrics hardcoded in collaboration analytics UI ("62/85 points", "1.4 days", "94%", "4h 12m", Sprint 24) | TeamWorkspace.tsx:220-221/537/541/545; ReportsAnalyticsPage.tsx:47-125; MemberProfilePage.tsx:120-126; QADashboardPage.tsx:99/112-113 | Users make decisions on false productivity data; erodes trust. |
| FE-3 | Three independent timer implementations never sync (engine vs TaskDetail LiveTimer vs FocusMode Pomodoro) | engine: useStore.ts timerEngine + useActiveTimer.ts:41; clones: TaskDetail.tsx:17-38, FocusMode.tsx:38; dead useTimer.ts:13-23 | Divergent recorded times; focus sessions lost; duplicates intervals. |
| FE-4 / DB-10 | UTC/local date mixing breaks "today" (habits, notifications) and task deadlines | useHabitStore.ts:73-77; useNotifications.ts:81; CreateTaskModal.tsx:34; useStore.ts:358 | Off-by-one-day habits/deadlines for non-UTC users. |
| FE-5 | Optimistic mutations without error handling or rollback | useStore.ts deleteTask:375-384, toggleSubtask:496-506; useHabitStore.ts deleteHabit:263-279, stopTimer:355-370; useWorkLogStore.ts updateField:547-557, updateEntry:589-608; AdminPeople.tsx handleDelete:223-229 | Silent data loss; unhandled rejections; UI desyncs from server. |

### 2.2 High (31)

| ID | Finding | Location |
|---|---|---|
| BE-8 | Client-controlled session timestamps (`startTime`/`endTime`/`pauseTime`) enable unlimited time/points/streak/leaderboard fraud | `routes/sessions.js:95-101,162-163,189-190,217-218,233-243,260-278` |
| BE-9 / CFG-6 | No rate limiting on `/api/auth/login` or `/api/auth/register` (brute force, enumeration, DoS) | `routes/auth.js:14-65`; `index.js:18-26` |
| BE-10 / CFG-12 | JWT placed in Google OAuth `state` URL param (token in browser history/referrer/logs) | `routes/auth.js:79-95,125` |
| BE-11 / CFG-8 | No security headers / CSP (no helmet) — no defense against the stored XSS | `index.js:20-26`; `index.html` |
| FE-6 | Brand accent theming half-wired — `.btn-primary`/`.input:focus` hardcode pink/blue, bypass CSS vars | `src/index.css:114-132,316-321` vs useStore.ts:55-91 |
| FE-7 | Settings full-page reloads (`window.location.reload()`) discard in-memory state | `Settings.tsx:342,428,436` |
| FE-8 | Stale closures in mount-only effects (WorkLogWidget, notifications interval) | `WorkLogWidget.tsx:12-14`; `useNotifications.ts` |
| FE-9 | Dead controls: global search, "Export Report", workspace settings Save, all AdminSettings | GlobalHeader.tsx:48-54; ReportsAnalyticsPage.tsx:37-39; WorkspaceSettingsPage.tsx:13-22; AdminSettings.tsx |
| FE-10 | Auth forms lack `name`/`autoComplete` (breaks password managers); inconsistent post-login routing | Login.tsx:65-89; Register.tsx:75-134 |
| FE-11 / CFG-25 | Ghost routes from text-typo strings in route table | `App.tsx:106,136,138,144-145,151` |
| FE-12 | Duplicated `mapLog`/`mapDoc` mapping + two debounce implementations | useWorkLogStore.ts:230-384; WorkLogDetail.tsx:77-106; proEditor.tsx AutoProEditor; WorkLog.tsx AutoInput:79 |
| FE-13 | Layering inversion: `lib/docEngine` imports `renderMarkdown` from React components | `src/lib/docEngine/templates/developerDoc.ts:1`; `export/docx.ts:9` |
| FE-14 | Custom regex markdown rendered via `dangerouslySetInnerHTML` at 13 sites (only Journal uses safe `react-markdown`) | see CFG-1 list |
| FE-15 | "Week" stats are all-time totals; "last week" is fabricated 85% ratio | useStore.ts:585-591; Dashboard.tsx:552-556 |
| DB-4 | Missing compound indexes on report paths (`{userId,startTime}`, `workEntries.date`) → collection scans | models/Session.js:12-13; WorkLog.js:178; reports.js:100-114; admin.js:229-241,314-316 |
| DB-5 | `WorkLog.taskRef` unindexed but on hot timer/delete paths | models/WorkLog.js:85-88; sessions.js:14-17,42-45; tasks.js:82-85 |
| DB-6 | Missing `{userId,isActive}` index on Session (orphan sweep + "active now" queries scan) | models/Session.js:12-13; sessions.js:103-113; teams.js:95; admin.js:171,316 |
| DB-7 | `Session.focusScore` no `min:0/max:100` despite documented 0–100 contract | models/Session.js:20 |
| DB-8 | WorkLog: 8 unbounded embedded arrays → 16 MB BSON ceiling, saves brick | models/WorkLog.js:128-135 |
| DB-9 | Task delete leaves dangling `workEntries[].sessionIds` + stale `totalActiveMs` | models/WorkLog.js:73; tasks.js:79-86; sessions.js:60-70 |
| DB-10 | Timezone/date-key inconsistency: streak uses UTC key but server-local midnight boundary; habits server-local; worklogs user-tz — three "today" answers | sessions.js:248-266; habits.js:8-21; workLogs.js:45-52; User.js:13 |
| BE-18 | Daily-report/timezone helpers duplicated across reports.js and workLogs.js; admin summary is a copy of reports summary | reports.js:12-69,162-232 vs workLogs.js:45-85; admin.js:244-268 |
| BE-19 / CM-7 | Double session↔worklog sync (`syncSessionToWorkLogs` vs `syncWorkEntries`) with different day-grouping → double-count/divergence | sessions.js:12-76; workLogs.js:20-43,101-145 |
| BE-20 / DB-11 | N+1: `GET /api/worklogs` runs a `Session.find` + `log.save()` per log; session sync saves per log | workLogs.js:154-160,105; sessions.js:19-28,51-72 |
| BE-21 | `GET /api/worklogs` performs DB writes (side-effecting read) | workLogs.js:143,160 |
| BE-22 | Missing indexes for date-range report queries (see DB-4/5/6) | reports.js:100-114; admin.js:228-242 |
| BE-23 | `/api/admin/system-analytics` loads ALL sessions/tasks/users into memory and aggregates in JS | admin.js:304-391 (314-317) |
| BE-30 | No pagination on admin lists (users, activity) | admin.js:45-63,394-410 |
| BE-31 | Concurrent Google token refresh races (last-write-wins on `req.user.save()`) | utils/googleDrive.js:15-62 |
| BE-32 | OAuth lacks PKCE; refresh token never rotated | auth.js:86-95,133-143 |
| CFG-7 | High-severity `brace-expansion` in server **production** tree (googleapis→gaxios→rimraf→glob) | server/package.json → googleapis; lockfile chain |
| CFG-5 | JWT in `localStorage` (`ff_token`) — XSS-readable, no httpOnly cookie, no rotation | useAuthStore.ts:33-81; utils/api.ts:12-23 |

### 2.3 Medium (55)

| Domain | Count | Notable items |
|---|---|---|
| Backend (BE-13…BE-32) | 20 | `protect` masks DB errors as 401 (BE-13); raw `err.message` leaked to clients (BE-14/CFG-13); no JSON 404 handler (BE-15); weak/absent input validation (BE-16); inconsistent response envelope (BE-17); duplicate date helpers (BE-18); double sync (BE-19); N+1 (BE-20); side-effecting GET (BE-21); missing indexes (BE-22); unbounded admin analytics (BE-23); tokens/emails in request logs (BE-24); destructive `drop-worklog-index.js` committed (BE-25); streak timezone bug (BE-26); no graceful shutdown (BE-27/CFG-14); admin PATCH accepts arbitrary `settings` (BE-28); register TOCTOU + raw E11000 leak (BE-29); no pagination (BE-30); Google refresh race (BE-31); no PKCE/rotation (BE-32) |
| Database (DB-11…DB-23) | 13 | N+1 (DB-11); no `min:0` on Session durations (DB-12); `drop-worklog-index.js` raw migration (DB-13); `$push` routes bypass validators (DB-14); empty-string required fields, no length caps (DB-15); unbounded Habit.entries/Session.pauseLog (DB-16); no Activity TTL (DB-17); no ReportShare TTL (DB-18); soft-delete no cascade (DB-19); missing Task/Journal analytics indexes (DB-20); leaderboard unindexed + includes deleted users (DB-21); `totalActiveMs` denormalized drift (DB-22); concurrent stop races on `totalPoints`/`streak` (DB-23) |
| Frontend (FE-16…FE-26) | 11 | `todayLog` falls back to yesterday's log mislabeled "Today" (FE-16); dead 1,210-line Admin.tsx (FE-17); status/mood config duplicated 6× (FE-18); 13 `as any` (FE-19); dead per-second store tick (FE-20); toast timeout leak (FE-21); AdminRoute blank flash (FE-22); unused route params/state pass strict-mode-off (FE-23); MemberProfile fabricates identity/stats (FE-24); hardcoded collab defaults/dates (FE-25); Landing claims nonexistent features (FE-26) |
| Config (CFG-9…CFG-19) | 11 | Client vulns react-router-dom 6.30.3 + uuid 10.0.0 (CFG-9); server vulns express/qs/mongoose 8.23.1 proto-pollution/body-parser (CFG-10); no env validation (CFG-11); JWT in OAuth `state` (CFG-12); error-message leakage (CFG-13); no graceful shutdown (CFG-14); no error boundary (CFG-15); no containerization (CFG-16); no CI (CFG-17); tests not runnable — `localStorage` with no vitest env (CFG-18); `.gitignore` misses `.env.*` variants (CFG-19) |

**Core modules (CM) — merged into this report (synthesized from direct source verification):**
- **CM-2:** Offline queue drops failed ops permanently — after 3 failed attempts `shift()` discards the op (offlineQueue.ts:125-131), and `attempts > 5` also dequeues on failure (line 114) → **silent data loss** of timer events.
- **CM-3:** Offline replay is not idempotent and has no server reconciliation — if START succeeded but the response was lost, replay creates a duplicate active session; a STOP replay after server success errors or double-applies (offlineQueue.ts:86-112).
- **CM-4:** Replayed offline ops send client-supplied timestamps (`op.payload?.startTime || op.timestamp`, offlineQueue.ts:88/94/101/108) — amplifies BE-8 fraud.
- **CM-5:** `buildDayReport` `completedCount` counts `log.completedItems.length` across **all** fetched worklogs (reports.js:157) even when those items belong to other days (worklogs are fetched by `$or` on createdAt/updatedAt/workEntries.date, line 106-113) → inflated completed counts in day reports.
- **CM-6:** Report `totalMs` derives only from sessions (reports.js:119-147) while worklog `workEntries.activeMs` are synced separately (workLogs.js syncWorkEntries) → day report and worklog view can disagree (compounds BE-19).
- **CM-8:** Timer state relies on client clock only; `timerEngine` FSM is sound but drift resync assumes `Date.now()` trust — combined with BE-8 the server cannot validate any duration.
- **CM-9:** FocusMode Pomodoro countdown is entirely disconnected from work-log/session recording — focus sessions in FocusMode never appear in reports (FE-3 root cause).

### 2.4 Low (31)

| Domain | Count | Notable items |
|---|---|---|
| Backend (BE-33…BE-42) | 10 | JWT lacks iss/aud/jti (BE-33); user-controlled regex in project name check (BE-34); habit "today" server-local midnight (BE-35); weak password policy, no email verification (BE-36); journal PATCH no `runValidators` (BE-37); fire-and-forget Activity logging swallows errors (BE-38); verbose logging of user ids/titles (BE-39); share route ordering fragility (BE-40); no cache-control on public shares (BE-41); Google Drive errors degrade silently (BE-42) |
| Database (DB-24…DB-30) | 7 | Case-sensitive project unique index vs CI route dedupe (DB-24); epoch-ms vs Date drift (DB-25); unvalidated Team members (DB-26); email format + field bounds (DB-27); zombie active sessions (DB-28); redundant token index, past `expiresAt` (DB-29); naming drift taskId/taskRef/projectId/projectRef (DB-30) |
| Frontend (FE-27…FE-32) | 6 | Misplaced `src/.env` (FE-27); `@types/file-saver` unnecessary (FE-28); breadcrumb id-length heuristic (FE-29); WorkspaceSelector dup labels + empty catch (FE-30); render-time timer formatting (FE-31); featureCompletionRate = 100% when empty (FE-32) |
| Config (CFG-20…CFG-27) | 8 | Dead `src/.env` (CFG-20); no `.env.example` (CFG-21); ad-hoc console logging (CFG-22); shallow health endpoint (CFG-23); no validation library (CFG-24); typo routes (CFG-25); tsconfig relaxations, no typecheck script (CFG-26); orphan root `package-lock.json` stub (CFG-27) |

---

## Part 3 — Refactoring Report

Format per item: **Problem → Why it matters → Files → Solution → Effort (S/M/L) → Risk (Low/Med/High)**.

### R1. Replace the hand-rolled markdown renderer with a sanitized renderer
- **Problem:** `renderMarkdown` (regex, escapes only `&<>`) is injected via `dangerouslySetInnerHTML` at 13 sites (CFG-1).
- **Why:** Stored XSS → token theft → account takeover; single most severe issue.
- **Files:** `src/components/ui/proEditor.tsx`, `src/lib/docEngine/templates/developerDoc.ts`, `src/lib/docEngine/export/docx.ts`, and the 13 call sites (WorkLogDetail.tsx, Reports.tsx, Admin.tsx, AdminPeople.tsx). `react-markdown` already exists for Journal.
- **Solution:** Standardize on `react-markdown` + `rehype-sanitize` (or DOMPurify around the current renderer); move `renderMarkdown` into `src/lib` as a pure function so docEngine stops importing React components (fixes FE-13). Strip `dangerouslySetInnerHTML` entirely.
- **Effort:** M. **Risk:** Med (behavior of rich text rendering changes).

### R2. Delete the unauthenticated legacy report share route
- **Problem:** `GET /api/reports/share/:userId/:date` (reports.js:313) exposes any user's report (BE-1).
- **Why:** Data leak; combined with R1 forms a weaponized attack chain.
- **Files:** `server/routes/reports.js`, `src/App.tsx:95`, and the client that references the URL (Reports.tsx:130-132 advertises a pre-token share URL).
- **Solution:** Remove the route; keep only `/share/token/:token`; add `Cache-Control: no-store`; add rate limiting on the token route.
- **Effort:** S. **Risk:** Low.

### R3. Harden authentication & secrets
- **Problem:** Placeholder JWT secret (BE-2/CFG-3), tokens in localStorage (CFG-5), JWT in OAuth `state` (BE-10/CFG-12), no rate limiting (BE-9/CFG-6), no env validation (CFG-11).
- **Why:** Forgeable tokens, token leakage in URLs/history/logs, unbounded brute force, silent misconfig.
- **Files:** `server/.env`, `server/index.js`, `server/routes/auth.js`, `server/middleware/auth.js`, `src/store/useAuthStore.ts`, `src/utils/api.ts`, `mainApp/.env`.
- **Solution:** Random secret + boot-time fail-fast validator; migrate to httpOnly+Secure+SameSite cookie sessions (with CSRF token) or at minimum a server-side session/revocation layer; opaque single-use OAuth `state`; `express-rate-limit` on auth routes; add `.env.example`.
- **Effort:** L. **Risk:** Med (session migration is a breaking client change; do behind the roadmap sprint 4).

### R4. Stop leaking `googleTokens`
- **Problem:** `User.toJSON` strips only `passwordHash` (BE-3/DB-2).
- **Why:** Long-lived Google refresh tokens exposed to any XSS/browser extension; admin endpoints leak all users' tokens.
- **Files:** `server/models/User.js` (toJSON transform + schema), `server/middleware/auth.js` (projection), `server/routes/profile.js`, `server/routes/admin.js`.
- **Solution:** Delete `googleTokens` in `toJSON` and use `.select('-googleTokens')` on all response paths; never attach tokens in list/admin responses. Encrypt at rest (AES with env/KMS key).
- **Effort:** S. **Risk:** Low.

### R5. Whitelist PATCH fields and validate client timestamps
- **Problem:** Mass assignment on tasks/worklogs/journals (BE-5/6/7, DB-3); client-controlled session timestamps (BE-8); `$push` routes bypass validators (DB-14).
- **Why:** Ownership transfer, points/streak/leaderboard fraud, corrupt subdocuments.
- **Files:** `server/routes/tasks.js:56-72`, `workLogs.js:315-330`, `journals.js:48-60`, `sessions.js:95-101,162-163,189-190,217-218`, all `$push` handlers.
- **Solution:** Field allowlists per endpoint (like habits.js:57-61); strip `userId`/`_id`/`googleDocId`; ignore or clamp client timestamps server-side; add `runValidators: true` on all update operators; add `min/max` on schema numbers.
- **Effort:** M. **Risk:** Low-Med.

### R6. Enforce soft-delete at the auth layer
- **Problem:** `deletedAt` ignored by login and `protect` (DB-1/BE-12).
- **Why:** Deletion is cosmetic; blocked users keep full access.
- **Files:** `server/routes/auth.js:49`, `server/middleware/auth.js:19`, `server/routes/admin.js:107-124`.
- **Solution:** Filter `deletedAt: null` in login and `protect`; add per-user token version (`jti`) invalidated on delete/role change.
- **Effort:** S. **Risk:** Low.

### R7. Unify the session↔worklog sync and stop side-effecting GETs
- **Problem:** Two sync implementations with different day-grouping (BE-19); `GET /api/worklogs` writes to DB (BE-21); N+1 (BE-20/DB-11).
- **Why:** Flip-flopping time totals, write-bursts on reads, linear latency.
- **Files:** `server/routes/sessions.js` (syncSessionToWorkLogs/addTimelineEntryToWorkLogs), `server/routes/workLogs.js` (syncWorkEntries, GET handler), `server/utils/dates.js` (new shared date helpers).
- **Solution:** One idempotent, timezone-consistent `syncWorkEntries` used by both paths; compute effective totals at read time without saving; batch session loading with `$in`; add `{userId, taskId, startTime}` index.
- **Effort:** L. **Risk:** Med (data-migration/backfill of diverged totals).

### R8. Consolidate timer implementations onto the single engine
- **Problem:** Three timers (FE-3); dead `useTimer.ts`/`tick` (FE-20); render-time formatting (FE-31).
- **Why:** Lost sessions, duplicated intervals, misleading UI.
- **Files:** `src/pages/TaskDetail.tsx` (LiveTimer), `src/pages/FocusMode.tsx` (Pomodoro), `src/hooks/useTimer.ts` (delete), `src/store/useStore.ts` (timerEngine), `src/store/timerPersist.ts`.
- **Solution:** Delete `useTimer.ts` + `tick`; make FocusMode a mode over `timerEngine`; TaskDetail renders engine state via `useActiveTimer`; memoize formatted display.
- **Effort:** M. **Risk:** Med (FocusMode semantics).

### R9. Make offline queue reliable and tamper-resistant
- **Problem:** Ops dropped after 3/5 attempts (CM-2); no idempotency/reconciliation (CM-3); client timestamps replayed (CM-4).
- **Why:** Silent loss of timer events; duplicate sessions; fraud.
- **Files:** `src/utils/offlineQueue.ts`, `server/routes/sessions.js`.
- **Solution:** Never discard on failure (persist with backoff); add a client-generated `clientOpId` that the server dedupes/idempotently applies; don't send client timestamps (server records when the op lands, or validates ranges).
- **Effort:** M. **Risk:** Med.

### R10. Unify timezone/date handling
- **Problem:** UTC vs local vs server-local day boundaries across streaks, habits, worklogs, reports, deadlines (FE-4/DB-10/BE-26/BE-35).
- **Why:** Wrong streaks/habit days/deadlines for non-UTC users; reports disagree.
- **Files:** `src/utils/time.ts` (single `dayKey`), `src/store/useHabitStore.ts`, `src/hooks/useNotifications.ts`, `src/components/tasks/CreateTaskModal.tsx`, `server/routes/sessions.js`, `habits.js`, shared `server/utils/dates.js`.
- **Solution:** One canonical `YYYY-MM-DD` day-key from user `settings.timezone`; reuse across client and server; store deadlines as local dates.
- **Effort:** M. **Risk:** Med (historical data reinterpretation).

### R11. Add the missing indexes and cap unbounded arrays
- **Problem:** Per-user scans + 16 MB ceiling (DB-4/5/6/8/16/20/21).
- **Why:** Latency grows linearly; long-lived worklogs brick saves.
- **Files:** `server/models/Session.js`, `WorkLog.js`, `Task.js`, `Journal.js`, `User.js`, `Habit.js`, `ReportShare.js`, `Activity.js`.
- **Solution:** Compound indexes per DB-4/5/6/20/21; cap WorkLog arrays (prune timeline to newest N, move workEntries/completedItems to child collections); TTL on Activity + ReportShare.expiresAt; `min/max` on numbers.
- **Effort:** L. **Risk:** Med (migration + backfill).

### R12. Introduce quality gates and runnable tests
- **Problem:** No CI/lint/typecheck; tests not runnable (CFG-17/18/26).
- **Why:** Security findings merged to `main` unnoticed; false sense of safety.
- **Files:** `.github/workflows/*`, `mainApp/package.json`, `mainApp/server/package.json`, `mainApp/vite.config.ts` (vitest env), `mainApp/tsconfig.json`.
- **Solution:** GitHub Actions (install → typecheck → lint → test → build → `npm audit` for both trees); add `vitest.config.ts` with `happy-dom`; enable `noUnusedLocals`/`noUnusedParameters`; add a `typecheck` script; add targeted tests (auth middleware, report access control, markdown sanitizer, offline queue, timer engine).
- **Effort:** M. **Risk:** Low.

### R13. Decommission the demo collaboration layer or wire it to real APIs
- **Problem:** Hardcoded seed data + fabricated metrics (FE-1/FE-2/FE-24/FE-25).
- **Why:** Users create data that vanishes; false analytics.
- **Files:** `src/store/useCollaborationStore.ts`, `src/pages/collaboration/*`, server has **no** collaboration routes (teams.js exists but is minimal).
- **Solution:** Either implement real server-backed collaboration (models + routes + store actions mirroring useAuthStore patterns) or gate all collaboration pages behind an explicit "demo mode" banner and remove fabricated metrics. Given scope, recommend: hide/gate the pages first, implement a real MVP after the security sprints.
- **Effort:** L (real) / S (gate + banner). **Risk:** Med (product decision needed).

### R14. Remove dead code and duplicate config
- **Problem:** Orphaned 1,210-line `Admin.tsx` (FE-17); typo routes (FE-11/CFG-25); status/mood config duplicated 6× (FE-18); `mapLog`/`mapDoc` duplication (FE-12); `src/.env` dead file (FE-27/CFG-20); orphan root lockfile (CFG-27).
- **Why:** Maintenance cost, drift, confusion.
- **Files:** `src/pages/Admin.tsx` (delete after confirming coverage), `src/App.tsx`, `src/lib/statusConfig.ts`/`colors.ts`/`src/lib/config.ts` (new), `src/lib/dataMapper.ts` (unify map), `src/.env`, root `package-lock.json`.
- **Effort:** S. **Risk:** Low.

### R15. Harden deployment and operations
- **Problem:** No Docker/PM2/nginx (CFG-16), no graceful shutdown (BE-27/CFG-14), shallow health check (CFG-23), raw `drop-worklog-index.js` in repo root (BE-25/DB-13), `.gitignore` misses `.env.*` (CFG-19), secrets in plaintext `.env` (BE-4).
- **Why:** Non-reproducible deploys, dropped requests, no observability, migration hazard.
- **Files:** repo root (Dockerfile, docker-compose.yml, nginx.conf, `.gitignore`), `server/index.js`, `server/migrations/`, `.env.example`.
- **Solution:** Multi-stage Dockerfile (build client + node server); graceful shutdown handlers; health → readiness (mongoose.readyState) + `/metrics`; move migration to versioned `server/migrations/`; rotate and externalize secrets.
- **Effort:** L. **Risk:** Low-Med.

### R16. UX/accessibility polish
- **Problem:** Dead controls (FE-9), settings reloads (FE-7), auth autofill (FE-10), blank-flash loading (FE-22), no error boundary (CFG-15), fabricated Landing claims (FE-26), `todayLog` fallback mislabel (FE-16), "week" fabricated stats (FE-15).
- **Why:** User trust, real feature promises, accessibility.
- **Files:** GlobalHeader.tsx, ReportsAnalyticsPage.tsx, WorkspaceSettingsPage.tsx, AdminSettings.tsx, Settings.tsx, Login.tsx, Register.tsx, ProtectedRoute.tsx, main.tsx, Landing.tsx, useWorkLogStore.ts, useStore.ts, Dashboard.tsx.
- **Solution:** Wire or remove dead controls; store-driven settings; add `name`/`autoComplete`; skeleton loading; top-level ErrorBoundary + Suspense error fallback; truthful copy; return `undefined` when no today log; compute week totals from `timerPersist` day caches.
- **Effort:** M. **Risk:** Low.

---

## Part 4 — Implementation Roadmap

Six two-week sprints. Order = impact first: **Critical security/data-integrity → Refactoring foundations → Performance → Defense-in-depth → UX → Production readiness**. Each item lists its task IDs (tied to Part 2/3 IDs), effort, and acceptance criteria. No new product features.

### Sprint 1 — Critical fixes (security + data integrity)

| # | Task | Refs | Effort | Acceptance criteria |
|---|---|---|---|---|
| S1-1 | Sanitize all user-content rendering; remove `dangerouslySetInnerHTML` (13 sites); move renderer to `src/lib` | CFG-1, FE-13, FE-14, R1 | M | No `dangerouslySetInnerHTML`/`innerHTML` left in the app; markdown fuzz tests pass; docEngine no longer imports React components |
| S1-2 | Delete `/share/:userId/:date`; harden `/share/token/:token` (no-store, rate limit) | BE-1, CFG-2, CM-1, R2 | S | Route unreachable; auth-required or token-gated share only |
| S1-3 | Replace JWT secret + boot-time fail-fast env validator | BE-2, CFG-3, CFG-11, R3 | S | `index.js` refuses to boot on placeholder/missing secret; `.env.example` added |
| S1-4 | Strip `googleTokens` from all User serialization; `-googleTokens` projections | BE-3, DB-2, R4 | S | No `googleTokens` in any API response (verified by curl) |
| S1-5 | Rotate Atlas password + Google secret; move to env injection | BE-4, CFG-4, R15 | S | Old creds revoked; new creds in deployment env only |
| S1-6 | Field allowlists for tasks/worklogs/journals PATCH; `runValidators` on `$push` | BE-5/6/7, DB-3, DB-14, R5 | M | `userId`/`googleDocId` immutable via PATCH; invalid subdocs rejected |
| S1-7 | Server-side session timestamps (ignore client `startTime`/`endTime`), clamp ranges | BE-8, CM-4, R5 | M | Fraudulent past-timestamp sessions impossible; existing data noted for backfill |
| S1-8 | Enforce soft-delete in login + `protect`; token version on delete/role change | DB-1, BE-12, R6 | S | Deleted users get 401 immediately; cannot re-login |
| S1-9 | Remove `drop-worklog-index.js` from repo root (move to migrations/) | BE-25, DB-13, R15 | S | File gone from root; migration documented |
| S1-10 | Fix `todayLog` fallback; return `undefined` when no log for today | FE-16 | S | UI shows empty state instead of yesterday's log |

**Gate 0 exit:** no Critical findings remain reachable; `npm audit --audit-level=high` clean for both trees is a hard requirement (CFG-7/9/10 fixes may land here if time permits).

### Sprint 2 — Refactoring foundations

| # | Task | Refs | Effort | Acceptance criteria |
|---|---|---|---|---|
| S2-1 | Unify session↔worklog sync; stop side-effecting GET; batch session load | BE-19/20/21, DB-11, R7 | L | Worklog totals stable across GET and session-stop; no writes on GET; N+1 removed |
| S2-2 | Extract shared `server/utils/dates.js`; consolidate day/timezone helpers | BE-18, R10 | M | No duplicated `dayKey`/`getOffsetMs`/`localDateToUtc`; single timezone source |
| S2-3 | Unify `mapLog`/`mapDoc` + single autosave debounce component | FE-12 | M | One mapping lib + one editor component |
| S2-4 | Consolidate status/mood config into `src/lib/config.ts` | FE-18 | S | One source of truth imported everywhere |
| S2-5 | Remove dead `Admin.tsx`, typo routes, `src/.env`, orphan lockfile | FE-17, FE-11, CFG-20/25/27, R14 | S | Dead files deleted; route table clean |
| S2-6 | Consolidate timer implementations onto `timerEngine`; delete `useTimer.ts`/`tick`; memoize display | FE-3, FE-20, FE-31, R8 | M | One timer code path; FocusMode records sessions; no per-second store ticks |
| S2-7 | Gate collaboration module behind demo banner; remove fabricated metrics from visible UI | FE-1, FE-2, FE-24, FE-25, R13 | S | No literal fake numbers rendered outside a labeled demo; decision on real backend deferred |
| S2-8 | Fix optimistic mutation rollback via shared `runMutation` helper | FE-5 | M | Failed mutations roll back + toast; no unhandled rejections |

### Sprint 3 — Performance & data model

| # | Task | Refs | Effort | Acceptance criteria |
|---|---|---|---|---|
| S3-1 | Add compound indexes (sessions `{userId,startTime,isActive}`, `{userId,isActive,startTime}`; worklogs `{userId,taskRef}`, `workEntries.date` multikey; tasks/journals analytics indexes; leaderboard partial index) | DB-4/5/6/20/21, BE-22, R11 | M | `explain()` on all hot queries shows index scans, no COLLSCAN |
| S3-2 | Cap/prune WorkLog embedded arrays; move `workEntries`/`completedItems` to child collections | DB-8, R11 | L | No unbounded arrays; 16 MB ceiling no longer reachable |
| S3-3 | TTL index on Activity and ReportShare.expiresAt | DB-17/18 | S | Collections stop growing unboundedly |
| S3-4 | Push admin analytics into MongoDB aggregation pipeline; paginate admin lists | BE-23, BE-30 | M | No full-dataset loads into JS; paginated responses |
| S3-5 | `min/max` bounds on Session/Task/User numbers (focusScore, durations, dailyGoal, points) | DB-7, DB-12, DB-27 | S | Schema rejects out-of-range values |
| S3-6 | Validate required strings (`minlength`, `maxlength`) | DB-15 | S | Empty titles/names rejected at schema level |
| S3-7 | Fix `totalActiveMs` drift — derive from `workEntries` or recompute transactionally | DB-22, DB-23 | M | Single source of truth for time totals; atomic `$inc` on points/streak |
| S3-8 | Optimize week stats: compute from `timerPersist` day caches; remove fabricated 85% | FE-15 | M | Week chart shows real current-week data |
| S3-9 | Batch-load sessions in worklog list (part of S2-1 follow-up) | DB-11, BE-20 | S | 1 extra query total, not N |

### Sprint 4 — Security hardening

| # | Task | Refs | Effort | Acceptance criteria |
|---|---|---|---|---|
| S4-1 | `express-rate-limit` on auth + API; account lockout | BE-9, CFG-6 | S | Brute force throttled; load test shows 429s |
| S4-2 | helmet + strict CSP + Referrer-Policy | BE-11, CFG-8 | S | Security headers present; CSP blocks inline scripts |
| S4-3 | OAuth: opaque single-use `state`; PKCE; refresh-token rotation; keep JWT out of URLs | BE-10, BE-32, CFG-12 | M | No token in URL; PKCE enforced |
| S4-4 | Move session token to httpOnly+Secure+SameSite cookie (or add server-side session revocation) | CFG-5 | L | Token not readable from JS; logout invalidates server-side |
| S4-5 | Fix error-message leakage (generic 5xx, structured 4xx) | BE-14, CFG-13 | S | No `err.message` in client responses |
| S4-6 | Sanitize/redact request logs; structured logging (pino) with request IDs | BE-24, BE-39, CFG-22 | M | No tokens/emails/titles in logs; JSON logs |
| S4-7 | Dependency upgrades + npm overrides; re-run audit | CFG-7/9/10 | S | `npm audit --omit=dev` clean (0 high, 0 moderate where fixable) |
| S4-8 | `.gitignore` `.env.*` + exceptions; secret-scan guard | CFG-19 | S | `.env.production` cannot be committed silently |
| S4-9 | Serialize Google token refresh per user (single-flight); treat Drive 401 as refresh-and-retry | BE-31, BE-42 | M | No concurrent refresh races; Drive errors surfaced |

### Sprint 5 — UX polish & correctness

| # | Task | Refs | Effort | Acceptance criteria |
|---|---|---|---|---|
| S5-1 | Wire or remove dead controls (search, Export Report, workspace settings, AdminSettings) | FE-9 | M | Every visible control does something |
| S5-2 | Replace Settings reloads with store updates + `applyThemeToDOM` | FE-7 | M | No `window.location.reload()` in Settings |
| S5-3 | Auth forms: `name` + `autoComplete`; consistent post-login destination | FE-10 | S | Password managers work; one landing route |
| S5-4 | Error boundary + Suspense error fallback + skeleton loading states | CFG-15, FE-22 | S | No blank-page on runtime errors |
| S5-5 | Fix theme CSS vars (`.btn-primary`, `.input:focus`) | FE-6 | S | Accent color recolors all primary UI |
| S5-6 | Stale closures in WorkLogWidget + notifications interval | FE-8 | S | Data refreshes after store changes |
| S5-7 | Truthful Landing copy; mark testimonials illustrative or remove | FE-26 | S | No claims of nonexistent features |
| S5-8 | Toast timeout cleanup; `as any` reduction | FE-21, FE-19 | M | No leaked timers; typed API layer |
| S5-9 | Validate email format; stronger password policy (12+); basic reset flow | BE-36 | M | Registration rejects malformed emails |

### Sprint 6 — Production readiness & quality gates

| # | Task | Refs | Effort | Acceptance criteria |
|---|---|---|---|---|
| S6-1 | GitHub Actions: install → typecheck → lint → test → build → `npm audit` (both trees) | CFG-17 | M | Green CI on every PR; blocks high-sev vulns |
| S6-2 | Make tests runnable (`vitest.config.ts` + happy-dom); add server tests (auth, report access, markdown, offline queue, timer) | CFG-18 | M | `npm test` passes in client and server |
| S6-3 | Add typecheck script + `strict` on tsconfig.node; enable unused checks | CFG-26 | S | `npm run typecheck` passes clean |
| S6-4 | Dockerfile (multi-stage) + docker-compose + nginx (SPA + /api proxy, TLS) | CFG-16, R15 | M | `docker compose up` serves the app end-to-end |
| S6-5 | Graceful shutdown (SIGINT/SIGTERM → server.close + mongoose.disconnect) + retry on boot | BE-27, CFG-14 | S | Drains in-flight requests on restart |
| S6-6 | Health → readiness (mongoose.readyState) + `/metrics` | CFG-23 | S | Orchestrators detect half-dead service |
| S6-7 | Versioned migrations folder + migration runner; document in PLAN.md | DB-13, BE-25 | M | All schema changes via migrations |
| S6-8 | Root workspaces (real root `package.json`) or clean repo layout; `.env.example` for both trees | CFG-27, CFG-21 | S | Repo structure documented |
| S6-9 | Offline queue reliability: never drop ops, idempotent `clientOpId`, no client timestamps | CM-2, CM-3, CM-4, R9 | M | Replay-safe; no duplicates; no silent loss |
| S6-10 | Final audit pass: re-run scorecard; update MPEP/SEB success criteria with measured results | — | S | Scorecard ≥ 7 in Security, ≥ 6 overall; documented |

**Gate 1 exit:** production-safe deploy (secrets managed, headers/rate-limit on, CI green, tests running, no Critical/High findings, docs aligned with MPEP/SEB).

---

## Appendix — Cross-cutting priorities

1. **Fix order matters.** The stored XSS (CFG-1) + IDOR (BE-1) + forged-JWT (BE-2) + token leaks (BE-3) form an attack chain; they are all in Sprint 1 and must land together with a secret rotation.
2. **Data migration risk is real.** R7 (sync unification), R10 (timezone), R11 (array caps), S3-7 (totalActiveMs) all reinterpret historical data — sequence them behind backups and add a versioned migration for each.
3. **Product decision required.** The collaboration module (FE-1/FE-2) is either a real backend feature or a labeled demo. Recommend gating (S2-7) first, real implementation after Gate 1.
4. **Keep the strengths.** Preserve the timer engine FSM, `time.ts`, admin-page API patterns, `react-markdown`-in-Journal, and the ownership-scoped `protect` as the reference implementations for new code.

*End of audit.*
