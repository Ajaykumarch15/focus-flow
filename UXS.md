# FocusFlow — Workspace UX Specification (UXS)

**Product Name:** FocusFlow
**Document Type:** Workspace UX Specification (UXS)
**Supersedes:** N/A — specifies the UX of the Workspace Product Specification (WPS v1.1)
**Source of Truth:** FocusFlow PRD (v1.0); FocusFlow WPS (v1.1)
**Audience:** Product Managers, Designers, Frontend Engineers, QA Engineers, Accessibility specialists
**Status:** Draft v1.1
**Scope:** Complete user-experience specification of the FocusFlow **Workspace** — every screen, form, state, responsive behavior, design-language token, and micro-interaction. This document intentionally contains **no** React code, CSS/Tailwind, APIs, database schemas, or backend architecture.
**Versioning policy:** Existing chapters are frozen once approved. New capabilities are added as a **Version Addendum** (§16) or a new chapter (§15) — existing sections are never rewritten except to fix errors.

---

## Table of Contents

1. [UX Vision & Principles](#1-ux-vision--principles)
2. [Design Language](#2-design-language)
3. [Layout & Global Shell](#3-layout--global-shell)
4. [Workspace Hub](#4-workspace-hub)
5. [Workspace Overview](#5-workspace-overview)
6. [Dashboards](#6-dashboards)
7. [Workspace Screens](#7-workspace-screens)
8. [Forms](#8-forms)
9. [States](#9-states)
10. [Responsive Behavior](#10-responsive-behavior)
11. [Micro-Interactions](#11-micro-interactions)
12. [Accessibility](#12-accessibility)
13. [Motion & Performance](#13-motion--performance)
14. [Design Reviews & Governance](#14-design-reviews--governance)
15. [Workspace Intelligence](#15-workspace-intelligence)
16. [Version 1.1 Addendum](#16-version-11-addendum)

---

## 1. UX Vision & Principles

### 1.1 Vision

The Workspace should feel like a **sharp, quiet cockpit** — every screen answers a question without ceremony, and everything that can be derived from evidence is already on screen. No form-filling rituals, no "how's it going" meetings, no blank-page paralysis.

### 1.2 Principles

1. **Developer-first.** Git-native vocabulary, markdown everywhere, minimal chrome, copy-to-clipboard, zero marketing in-app.
2. **Minimal clicks.** Every primary action in ≤ 2 clicks; smart defaults; zero-required-field creation.
3. **Evidence surfaces, decisions live here.** The UI shows what is *derived* (progress, health, reports) and asks only for *intent*.
4. **Keyboard-first.** Every nav item and common action has a shortcut; visible focus; full keyboard reachability.
5. **Command palette is the universal entry.** `Ctrl/Cmd + K` reaches pages, entities, actions, and workspace switching.
6. **Calm under load.** High data density, low noise. Statuses are colors first, words second.
7. **Respect privacy visibly.** Team views show aggregates; private data is never hinted at.
8. **Fast by feel.** Skeleton loaders, cached stores, optimistic updates, sub-150 ms interactions.
9. **One mental model.** The same card, badge, and state vocabulary repeats on every surface — learn once, use everywhere.
10. **Anti-Jira.** No mandatory fields, no drag-and-drop ceremonies, no multi-hour sprint admin.

---

## 2. Design Language

### 2.1 Visual Tone

Dark-first (developer default), crisp, high-contrast, with one accent color per workspace (§17.1 of WPS — branding). Density is "information-rich but organized": generous whitespace around grouped blocks, tight spacing within data rows.

### 2.2 Grid & Spacing Scale

| Token | Value | Use |
|---|---|---|
| Space 1 | 4 px | Inset icons, label-to-field gap |
| Space 2 | 8 px | Card inner padding, list row gaps |
| Space 3 | 12 px | Between grouped controls |
| Space 4 | 16 px | Card padding, section gaps |
| Space 5 | 24 px | Between widgets/cards on a page |
| Space 6 | 32 px | Between page sections |
| Space 7 | 48 px | Page-level margins, modal gutters |

Layout grid: 12-column fluid grid on desktop, collapsing to 8 (tablet) and 4 (mobile). Cards span 1–4 columns; dashboards use a 4-column master grid. Max content width ≈ 1600 px, centered; full-bleed only for Mission Control.

### 2.3 Typography

| Element | Size / Weight | Notes |
|---|---|---|
| Display / page title | 24–28 / 700 | Page-level identity |
| Section title | 16–18 / 600 | Groups widgets |
| Card title | 14–15 / 600 | Repeats on every card |
| Body | 13–14 / 400 | Default reading size |
| Data / table cell | 13 / 400 | Monospace for IDs, time, code |
| Meta / labels | 11–12 / 500 | Tags, badges, timestamps |
| Mission Control | 28–64 / 700 | Legible across a room |

Line-height 1.4–1.5; type scale ratio ≈ 1.25. Fonts: a system-ui stack with a bundled monospace for code/IDs. All text must clear 4.5:1 contrast in both themes (AA).

### 2.4 Color Semantics (never overridden by branding)

| Token | Dark | Light | Meaning |
|---|---|---|---|
| Health Healthy | 🟢 green | green | On track |
| Health At Risk | 🟡 amber | amber | Behind / risky |
| Health Blocked | 🔴 red | red | Blocked |
| Health Waiting | 🔵 blue | blue | Awaiting input |
| Health Planned | ⚪ neutral | neutral | Not started |
| Accent | workspace-branded | workspace-branded | Links, active nav, primary actions |
| Success / Done | green | green | Verified, shipped |
| Danger / destructive | red | red | Delete, remove, reject |
| Info | blue | blue | Announcements, tips |

Status is **color + shape + label** (dot + word) — never color alone (a11y).

### 2.5 Cards

- **Anatomy:** header row (title + optional meta/actions) → body → optional footer (avatars, progress, badges, timestamps).
- **Hover:** lift 1 px + border accent + focus ring (for interactive cards only).
- **Interactive affordance:** cards that open something show a chevron or "open" affordance; static info cards do not.

### 2.6 Buttons

| Variant | Use |
|---|---|
| **Primary** | The single most important action on a screen |
| **Secondary** | Equally valid alternatives |
| **Ghost** | Low-emphasis actions inside dense areas |
| **Destructive** | Delete/remove/reject; confirmation-gated |
| **Icon-only** | Repeated utilities (edit, copy, more); tooltip + aria-label |
| **Link-button** | Inline actions in text |

Rules: one primary per view (except dashboards' multiple widget actions). Primary and destructive never share a row without separation. All buttons ≥ 32 px hit target; mobile ≥ 44 px.

### 2.7 Forms & Inputs (patterns)

| Control | Pattern |
|---|---|
| Text / textarea | Label above, placeholder as example, helper text, live validation on blur |
| Select / combobox | Searchable for > 8 options; keyboard navigable |
| Date / time | Native picker + typed input accepted |
| Toggle | Used for settings, never for form submission |
| Checkbox / radio | Clear labels, visible states |
| Chips / tag input | Enter to commit, backspace to remove |
| Markdown editor | Side-by-side write/preview; toolbar; `/` shortcut menu |
| Autocomplete | Name/member pickers search as you type |

Every form element has a visible label, focus state, error state with message, and helper/placeholder distinction (placeholder ≠ label).

### 2.8 Tables

- Sticky header; sortable columns (click header, arrow indicator); optional row selection with bulk actions bar.
- Row hover highlight; click anywhere on a data row (not just links) opens the entity.
- Numeric/date columns right-aligned or tabular-numeric (avoid jitter).
- Column overflow → horizontal scroll on tablet/mobile, never squish.
- Empty and no-results states per §9.

### 2.9 Charts

Chart family shared across dashboards/analytics/reports:

| Chart | Use |
|---|---|
| **Progress bar** | Single measure vs. target (sprint %, feature %) |
| **Burndown line** | Remaining estimate over time vs. ideal line |
| **Sparkline** | Mini trend in cards/rows |
| **Bar / stacked bar** | Distribution (features by status, member load) |
| **Donut** | Share of totals (status mix) |
| **Timeline / gantt** | Milestones, releases, sprint windows |
| **Dependency graph** | Feature relationships (§10.6 WPS) |

Rules: direct labels where possible, tooltips on hover/focus, all data available in a table/export for accessibility, consistent color semantics (§2.4).

### 2.10 Progress Bars

- Always show numeric value (% or count) beside the bar — never a bare bar.
- Animated fill on load/recalc (300 ms ease-out).
- Health colors apply only when the measure is health-derived (feature/sprint progress); plain progress stays accent.

### 2.11 Badges & Tags

- **Status badge:** pill with dot + label (e.g., `● In QA`), health-colored.
- **Role badge:** neutral pill with role name.
- **Tag/chip:** workspace/project tags, neutral or accent, removable in inputs.
- Max-width with truncation; tooltip on overflow.

### 2.12 Icons

- One consistent icon set (single-weight stroke), 16 px default, 20 px in nav.
- Decorative icons hidden from screen readers; meaningful icons get aria-labels.
- No text-replaced-by-icon alone for primary actions.

### 2.13 Empty States

Every empty surface (list, board lane, chart, search) shows a **composed empty state**: illustration/glyph, one-line "why it's empty," the next action (primary button), and (when relevant) a template suggestion (§3.6/§8.5/§10.4 WPS). Never a bare "No items."

### 2.14 Skeletons

- Load: skeletons in the same layout as final content (bars shaped like cards/text/avatars).
- Skeleton shimmer subtle (not distracting); replace in ≤ 1.5 s typical, ≤ 3 s max before a slow-state pattern takes over (§9.3).
- Never show a spinner for content that has a known shape — always skeleton.

### 2.15 Dark Mode & Light Mode

- **Dark** is the default and primary theme (developer-first); **light** is first-class.
- Instant toggle (`T` shortcut), persists per user, system-follow option.
- Both themes pass AA contrast; health colors remain distinguishable in both.
- Workload: dark and light share the same structure; only surfaces/shadows/text colors differ (token-driven).

---

## 3. Layout & Global Shell

### 3.1 App Frame

```
┌──────────────┬───────────────────────────────────────────────┐
│  Sidebar     │  Top bar  [Workspace name] [⌘K] [search] [🔔] [timer] [👤] │
│  (collapsible)│                                               │
│              │  Breadcrumb  (contextual)                      │
│  Overview    │  ───────────────────────────────────────────  │
│  Dashboard   │                                               │
│  Projects    │             Page content                      │
│  Sprint Board│          (grid / list / detail)               │
│  Features    │                                               │
│  KB          │                                               │
│  Calendar    │                                               │
│  Teams       │                                               │
│  Members     │                                               │
│  Reports     │                                               │
│  Analytics   │                                               │
│  Activity    │                                               │
│  Admin (role)│                                               │
└──────────────┴───────────────────────────────────────────────┘
```

### 3.2 Sidebar

- Workspace-scoped primary nav (WPS §3.2), **Overview first**, then Dashboard, then modules.
- Collapsible to icon rail (`Ctrl/Cmd + \`); remembers state per user.
- Role-aware: Admin/PM items appear only for eligible roles (WPS §3.5).
- Active item: accent indicator + background; hover states; keyboard navigable.
- Bottom: workspace switcher entry, user avatar → profile/settings/logout.

### 3.3 Top Bar

- **Left:** workspace name/branding (click → Overview), back affordance when deep in a project.
- **Center:** global search trigger (`⌘K`), command palette.
- **Right:** notifications bell (badge count, unread dot), live timer ticker (session state), presence dot on own avatar, avatar menu.

### 3.4 Breadcrumb

`Workspace → Project → Sprint → Feature` on deep pages. Each level clickable; collapsed to ellipsis when long. Renders as text links (not a drop-down) by default.

### 3.5 Command Palette (`Ctrl/Cmd + K`)

- Opens centered, wide, instantly focusable; modal with backdrop.
- Two sections: **Actions** (create project/feature/sprint, generate report, invite, start session, open Mission Control) and **Search** (entities, WPS §14).
- Fuzzy match, ranking by relevance + access scope; keyboard-first (arrows + Enter, Esc closes).
- `>` prefix = actions-only; results show entity type + path (e.g., `F-42 · Auth flow · Mobile App`).
- Personal private entities never appear unless owned by the user.

### 3.6 Toasts / Notifications Center

- Toasts: top-right stack, auto-dismiss (high-priority persist until acted on), actions inside the toast (e.g., "Open feature," "Undo").
- Bell opens a panel: unread first, grouped by priority, filter by category (WPS §13), "mark all read."
- Every item click-throughs to exact context.

---

## 4. Workspace Hub

The **Hub** is the pre-workspace screen — the switcher and launcher between the Personal Workspace and every team Workspace.

### 4.1 Screens & Behaviors

- **Hub layout:** Left rail = accounts/sections; main area = "Your workspaces" grid of cards.
- **Workspace card:** branding (logo/banner), name, description, member count, your role badge, last-active indicator, unread/at-risk badge count.
- **Primary actions:** Open workspace (click card), Create workspace (template picker — WPS §3.6), search/filter workspaces, pin frequently used.
- **Personal card** always present and distinguished ("Personal — private by design").
- **Empty state:** no workspaces yet → "Create your first workspace" + template quick-picks.
- **Responsive:** grid → list rows on mobile; cards remain tappable ≥ 44 px.

### 4.2 Switching Rules

- Opening a workspace lands on its **Overview** (§5).
- Workspace switching preserves conceptual place; state of prior workspace is not lost.
- Recent workspaces appear at top with recency sort.

---

## 5. Workspace Overview

The first screen after entering a workspace (WPS §12.9). Calm orientation hub — **orients**, never operates.

### 5.1 Layout (desktop)

```
┌ Banner (branding) ─────────────────────────────────────────┐
│ Workspace name · description · members · contact           │
│ [Open Dashboard] [Invite] [New Project] [Generate report]  │
├─────────────┬──────────────────────────────────────────────┤
│ Announcements│  Active sprints (health strip 🟢🟡🔴🔵)      │
│ (pinned,     │  Project cards (health + active sprint bar) │
│  Admin-posted)│  Milestones (upcoming dates)                │
├─────────────┴──────────────────────────────────────────────┤
│ Members & presence strip · Teams list · Recent activity     │
│ Stats row: members · teams · open features · focus time/week│
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Widgets

| Widget | Content | Click-through |
|---|---|---|
| Announcements | Latest pinned workspace announcement(s) | Announcement detail |
| Sprint health strip | Per-active-sprint health badges + progress | Sprint |
| Project cards | Name, health, active sprint %, open features | Project Detail |
| Milestones | Next 3 upcoming, date + days-until | Milestone / calendar |
| Member strip | Avatars with presence dots, count | Members |
| Team list | Teams + leaders | Team Detail |
| Recent activity | Latest 8 events | Activity |
| Stats row | Members, teams, open features, weekly focus aggregate | Respective list pages |

### 5.3 Behaviors

- **Not interactive by default** — it's a read surface; primary interactions are the explicit action buttons (Open Dashboard, Invite, New Project).
- Cards that drill down are clearly interactive (hover lift + chevron).
- New members see the same layout with an extra "Getting started" card (invite members, create project, start a sprint) that dismisses after completion.
- No engineering detail: estimates, story points, and QA internals are absent by design (§12.8 WPS).

---

## 6. Dashboards

Each dashboard: **Purpose · Layout · Widgets · Actions · KPI strip · Empty state.** All dashboards share: a top **KPI strip**, a main widget grid (4-column master), and live updates (§11.3 WPS).

### 6.1 Workspace Dashboard (§12.1 WPS)

- **Purpose:** today's operational health across the workspace.
- **KPI strip:** sprint completion %, features in QA, velocity trend, open vs. closed, days to sprint end.
- **Layout:** sprint progress widgets (top) → at-risk/blocked list → activity feed → member presence → report shortcuts.
- **Widgets:** per-active-sprint progress bars with burndown sparkline, at-risk flag list (click → feature), feature distribution by status, QA queue depth, live activity feed, upcoming deadlines.
- **Actions:** Open sprint board, jump to at-risk feature, assign/unblock, generate report, invite, start a session.
- **Empty state:** no active sprints → "Start a sprint" + "Create a project."

### 6.2 Leader Dashboard (§12.2 WPS)

- **KPI strip:** capacity used, avg lead time, open blockers, QA turnaround.
- **Widgets:** per-team sprint health, per-developer progress, blocked items, QA queue depth, burndown, review dates, team activity.
- **Actions:** reassign, adjust estimate, move sprint dates, generate report, notify member.
- **Empty state:** no teams → create team; no sprint → plan first sprint.

### 6.3 Developer Dashboard (§12.3 WPS)

- **KPI strip:** my open/done features, time vs. estimate (active feature), today's feature-linked focus.
- **Widgets:** My features by status, my today's queue, my focus session card (start/stop), assigned sprint, notifications, my reports.
- **Actions:** Start session against a feature, move own status, open feature, log QA request.
- **Empty state:** "No features yet — ask your leader or create one." + Start a session card.

### 6.4 QA Dashboard (§12.4 WPS)

- **KPI strip:** features verified/week, approval turnaround, re-opened rate, time in QA.
- **Widgets:** Features in QA by urgency, "ready for QA" signals, my current QA session, bugs opened, approval rate, handoff backlog.
- **Actions:** Open feature for review, start QA session, file bug, approve/return, update acceptance notes.
- **Empty state:** "QA queue empty 🎉" + link to Done features.

### 6.5 Project Dashboard (§12.5 WPS)

- **KPI strip:** sprint %, milestones hit, open/closed, cycle time, blockers.
- **Widgets:** active sprint progress, milestone timeline, feature status distribution, QA queue, team load, at-risk flags, activity, reports shortcut.
- **Actions:** start sprint, create feature, assign, archive, generate project report.
- **Empty state:** per §5.3-style guidance: "Set up your project — add a team, start a sprint."

### 6.6 Feature Dashboard / Feature Overview (§12.6 WPS)

- **KPI strip:** time vs. estimate, % acceptance verified, cycle-stage duration.
- **Widgets:** status stepper, progress %, feature-linked time vs. estimate, assignee cards, acceptance checklist, bug references, timeline, activity, docs links.
- **Actions:** move status, start session, edit estimate, file bug, add doc link, comment, share report.
- **Empty state:** n/a (feature exists); content sections individually empty-state per §9.

### 6.7 Admin Dashboard (§12.7 WPS)

- **KPI strip:** active members/28d, invite acceptance, admin-action counts, growth.
- **Widgets:** member count & active rate, pending invites, role distribution, teams overview, storage/usage, recent audit events, permission-change log.
- **Actions:** invite, adjust roles, manage teams, edit settings, audit trail, billing (future).
- **Empty state:** first-run checklist (invite members, create team, set default role, review branding).

### 6.8 Stakeholder Dashboard (§12.8 WPS)

- **Purpose:** business-facing answer to "how is delivery going?" — no engineering detail.
- **KPI strip:** milestones hit vs. slipped, features shipped/period, releases shipped, sprint completion %, open risks.
- **Widgets:** roadmap timeline, sprint progress (done vs. committed), releases (shipped/planned with notes), completed features over time, per-project health summary, milestone timeline, report shortcuts.
- **Actions:** open release notes, drill into milestone, share stakeholder report.
- **Access:** Admin-designated viewers + read-only external links (no login).
- **Empty state:** "No releases yet — they'll appear when a project ships."

### 6.9 Mission Control (§11.5 WPS)

- **Purpose:** fullscreen, wall-mounted, glanceable ops display (war room / NOC).
- **Layout:** top strip (clock, date, sprint countdown, releases) → left rail (per-project sprint health + burndown sparklines) → center (at-risk/blocked auto-scroll, QA queue, live activity) → right rail (member presence grid, focus aggregates, milestones) → footer (sync heartbeat).
- **Typography:** 28–64 px; statuses legible across a room.
- **Behaviors:** auto-refresh on every event; dims when idle; `Esc` exits to prior screen; role-adaptive.
- **No interaction required** — zero-click read surface (touch/pointer optional for navigation).

---

## 7. Workspace Screens

For each screen: **Purpose · Layout · Key elements · Primary actions · States · Responsive notes.** Details apply unless overridden.

### 7.1 Projects (list)

- **Purpose:** portfolio overview of all projects.
- **Layout:** toolbar (search, filter by status/health, sort, "New project") → card grid (default) with list-view toggle.
- **Card:** name, icon/color, health badge, active sprint %, open features, team scope, members avatars, archived flag.
- **Actions:** create (template picker §8.5 WPS), open, archive/restore, edit settings, generate report.
- **States:** empty (§2.13 with template quick-picks), loading (skeleton cards), archived filter, permission-denied (no access message).
- **Responsive:** grid → list on mobile (cards → compact rows with primary tap target).

### 7.2 Project Detail

- **Purpose:** single-project container (WPS §8.2).
- **Layout:** header (name, branding, health, actions) → tab bar → tab content.
- **Tabs:** Overview | Sprints | Features | Milestones | KB | Reports | Settings (role-gated). Repositories/Files (future) reserved.
- **Overview tab:** progress summary, active sprint, milestones, description, team scope, links, quick actions (start sprint, create feature).
- **States:** on-hold (read-mostly banner), archived (read-only banner + restore), no-team warning, loading.
- **Responsive:** tabs scroll horizontally on mobile; Overview stacks single-column.

### 7.3 Sprint Board

- **Purpose:** delivery control surface (WPS §9.2).
- **Layout:** sprint header (name, goal, dates, burndown toggle, actions) → lane board.
- **Lanes:** Backlog | In Development | Code Review | In QA | Done, plus a Rejected/Blocked side column. Lane header shows count + sum estimate.
- **Cards:** title, ID, assignee avatar, estimate, progress, health badge, session dot (live), linked bug icon.
- **Interactions:** drag-and-drop between lanes (mouse + keyboard: Alt+arrows or space-to-pick), quick-assign (avatar picker), quick-estimate (inline), inline comment, click → Feature Detail.
- **Burndown:** toggle overlay chart (remaining vs. ideal), not a separate page.
- **States:** no sprint (empty → "Plan a sprint"), empty lanes (drop-target hint), read-only during Review, drag-invalid feedback.
- **Responsive:** lanes become vertically stacked lists on mobile with horizontal scroll; DnD falls back to move-actions (menu).

### 7.4 Sprint Detail

- **Purpose:** one sprint's full picture (goal, scope, health, review).
- **Layout:** header (goal, dates, health, progress) → sections: Features (table), Burndown/Analytics (charts, §9.3 WPS), Members & capacity, Retrospective notes, Report.
- **Actions:** edit goal/dates, add/remove features, start/complete sprint, run retrospective, generate sprint report.
- **States:** planning (pre-active banner), review stage, completed (velocity recorded, read-mostly), retrospective open/closed.

### 7.5 Features (list)

- **Purpose:** browse all features across the workspace (WPS §3.4.5).
- **Layout:** toolbar (search, filters: status/health/assignee/sprint/project/type, sort, "New feature") → table (default) with board toggle.
- **Columns:** ID, title, type, health, status, assignee, sprint, estimate, progress, updated.
- **Actions:** create (template §10.4 WPS), open, bulk-assign, link dependency, archive.
- **States:** empty (template picker), no-results (suggest clearing filters), permission-scoped subset notice.
- **Responsive:** table → cards on mobile (ID, title, health, assignee).

### 7.6 Feature Detail

- **Purpose:** the central object view (WPS §10.1, §12.6).
- **Layout:** header (ID, title, type, health badge, status stepper, quick actions) → tab bar.
- **Tabs:** Overview | Docs | Tasks | QA | Reports | Activity | Dependencies.
  - **Overview:** description (markdown), estimate, priority, assignees (per-assignee time), progress, timeline, acceptance criteria, comments.
  - **QA:** acceptance checklist, bug references, QA session history, sign-off status.
  - **Dependencies:** interactive graph + list (§10.6 WPS).
  - **Activity:** all events touching this feature.
- **Actions:** move status (stepper), start session, edit, file bug, add doc link, comment (threaded, mention-capable), share report, link dependency.
- **States:** blocked banner (reason + who to unblock), rejected banner (bug reference), QA-required gate notice, archived read-only.
- **Responsive:** tab bar scrolls; Dependencies graph collapses to list.

### 7.7 Teams (list + Team Detail)

- **List:** toolbar (search, filter, "New team") → cards (name, leader, members, scoped projects, active sprint health).
- **Team Detail:** header (name, leader, actions) → tabs: Overview | Members | Sprints | Reports | Analytics.
  - **Overview:** active sprint progress, member capacity, QA queue, at-risk flags, activity.
  - **Members:** roster with roles, add/remove/transfer (WPS §6.2).
  - **Analytics:** velocity, cycle time, member contribution (feature-linked aggregates).
- **Actions:** create/archive/delete team, assign leader, add members, assign projects, generate report.
- **States:** paused team banner, archived, no-members warning, permission-denied for unassigned.

### 7.8 Members (roster) & Member Profile

- **Roster:** toolbar (search, role filter, presence filter, "Invite") → table (avatar, name, role, team(s), presence, current feature, active). Click row → Profile.
- **Member Profile:** identity + role badge + presence → current feature/sprint → assigned work → focus time (aggregate only) → availability → recent activity → reports (shareable).
- **Privacy:** never shows private tasks/sessions/journal; aggregate-only focus time visible to managers (§7 WPS).
- **Actions (role-gated):** change role, suspend/remove, transfer ownership (Owner), notify.
- **States:** suspended banner, no-access notice, invited-pending badge.

### 7.9 Knowledge Base

- **Purpose:** living documentation (WPS §3.4.6).
- **Layout:** left tree (folders, collapsible) + doc list/detail; toolbar (search, tags, "New doc").
- **Doc editor:** markdown with live preview, `/` menu, tags, links to features/projects, comment thread, version history.
- **Doc states:** Draft → Published → Archived; published by default per permission.
- **Actions:** create/edit/archive, organize, tag, comment, link entity, copy link.
- **Responsive:** tree becomes a drawer on mobile.

### 7.10 Calendar

- **Purpose:** time context — sprints, milestones, deadlines, focus blocks (WPS §3.4.7).
- **Layout:** week/month toggle; entries color-coded by type (sprint, milestone, deadline, focus block); "today" column highlighted.
- **Actions:** create focus block, jump to sprint/milestone, view per-day work, toggle personal vs. team layer.
- **States:** empty month, permission-scoped visibility, offline read-only.
- **Responsive:** week view → day view on mobile (agenda list).

### 7.11 Reports

- **Purpose:** one-stop for every auto-generated report (WPS §3.4.10).
- **Layout:** toolbar (scope: personal/feature/sprint/project/team/workspace; period; "Generate") → report list → report detail.
- **Report detail:** summary header (period, scope, share status) → charts + data tables → share/export/schedule controls.
- **Actions:** generate, share read-only link, export (PDF/CSV), schedule (daily/weekly), open full Analytics.
- **States:** generating (skeleton + progress), no data in period, shared-link view (no login), permission-denied.

### 7.12 Analytics

- **Purpose:** insight over time (WPS §3.4.11).
- **Layout:** filter bar (time, team/project, entity) → chart stack (throughput, cycle time, velocity, load, QA health) → drill-down table.
- **Interactions:** chart type switch, time-range scrub, click-through into member/feature breakdown, export.
- **States:** not-enough-data (needs ≥ 2 sprints), empty, scoped view notice.

### 7.13 Activity

- **Purpose:** chronological, filterable audit (WPS §3.4.12).
- **Layout:** filter bar (member, entity type, action type, date) → infinite timeline grouped by day → each item links to its entity.
- **Admin view:** full audit with actor + timestamp; export.
- **States:** empty (no events in filter), permission-scoped subset.

### 7.14 Notifications (full page)

- **Layout:** grouped by priority → by date; unread marked with dot; category filter; "mark all read."
- **Item anatomy:** icon (type), title, context line, time, click-through target.
- **Preferences:** per-category toggles, per-entity mute, focus-mode DND, digest option (WPS §13.3).

### 7.15 Search

- **Purpose:** global discovery (WPS §14).
- **Layout:** big query field, entity-type filters, result groups (Projects / Features / Members / Docs / Reports / Comments / Sprints / Teams).
- **Result row:** entity type chip, title, snippet with matched term highlighted, path, health badge.
- **Behaviors:** fuzzy, natural-language friendly, ranked by relevance + access; private entities excluded.
- **States:** no-results (spelling suggestion + "search docs instead"), too-many-results (facets refine), permission-filtered notice.

### 7.16 Workspace Settings / Admin Console

- **Layout:** left settings nav (role-gated): General | Branding | Members | Roles & Permissions | Templates | Integrations (future) | Announcements | Audit Log | Danger Zone.
- **General:** name, description, timezone, working days, office hours, contact, repo/doc links.
- **Branding:** logo, banner, accent, icon (WPS §17.1) with live preview.
- **Roles & Permissions:** role list, default invite role, capability matrix read view, QA gate toggle.
- **Templates:** workspace/project/feature template management (save, edit, deprecate).
- **Announcements:** compose, pin, schedule, audience (all/scoped).
- **Audit Log:** filterable, exportable.
- **Danger Zone:** archive workspace, transfer ownership, delete (Owner-only, confirmation-gated — type workspace name to confirm).
- **States:** each section has save-state feedback (saved/error), unsaved-changes guard on leave.

### 7.17 Mission Control

Full spec in §6.9 (kept with dashboards).

---

## 8. Forms

### 8.1 Form Principles

- **Zero-required-field creation** (WPS §17.2): a feature/project can be created with only a title; everything else is progressive.
- **Smart defaults** from templates (§3.6/§8.5/§10.4 WPS) and prior actions.
- **Live validation** on blur; errors inline, next to the field, with recovery suggestion; no blocking on empty optional fields.
- **Command-enter to submit; Esc to cancel** on dialogs; Tab order logical; focus lands on first field.

### 8.2 Form Inventory (create/edit)

| Form | Fields (all optional unless noted) | Notes |
|---|---|---|
| Create Workspace | Template picker → name, description | Template pre-fills rest |
| Create Project | Template picker → name, icon/color, team scope | |
| Create Sprint | Name, goal, dates, project | Defaults from cadence |
| Create Feature | Template picker → title, description, type, project/sprint | Only title required |
| Invite Members | Emails (bulk), role, team | Pending-invite state |
| Edit Role / Permissions | Role select per member | Audited |
| Create Team | Name, leader, project scope, members | |
| Milestone | Title, date, project | |
| Announcement | Title, body (markdown), pin, audience | |
| Report | Scope, period, format | One-click defaults |
| Branding | §17.1 WPS fields | Live preview panel |
| Integration (future) | Auth + mapping + event toggles | §15.3 WPS |
| Bug Reference | Title, severity, linked feature, repro | |
| Retrospective | What went well / what went wrong / actions | Template-driven |

### 8.3 Form Patterns

- **Member/assignee pickers:** combobox with avatar + role, recent-first.
- **Date ranges:** inline presets (This week, This sprint, Last 2 sprints, Custom).
- **Tag input:** chips; enter commits; suggestions below.
- **Markdown editor:** write/preview split; toolbar (B/I/`code`/link/list); `/` menu for templates (table, checklist, callout, code block).
- **Unsaved changes:** leaving a dirty form prompts confirm; autosave draft marker for long-form docs.
- **Optimistic create:** entity appears immediately; server errors surface as non-destructive toast with retry (never lose typed input).

---

## 9. States

Every screen must define these states explicitly.

### 9.1 Loading

- Skeleton layout mirroring final content (§2.14); nav/actions disabled until ready; no full-screen spinners for content.
- Secondary loads (inline refresh) use small inline indicators; never re-skeleton a visible region.

### 9.2 Empty

- Composed empty state (§2.13): glyph, why-empty line, primary next action, template suggestion when applicable.
- "Done/Completed" empty states are celebratory but calm (e.g., QA queue empty), never animated confetti in-product.

### 9.3 Error / Slow

- **Error:** contextual banner/card with clear message, "what happened + what to do," retry button; persistent errors (auth) get dedicated screen with contact Admin path.
- **Slow (> 3 s):** keep skeleton, add "Still loading…" subtle notice with cancel/retry; never freeze input.
- **Partial failure (live updates):** stale content keeps showing with "Offline — showing saved data" pill; reconnect toast on recovery; optimistic actions get retry affordances.

### 9.4 Offline

- Detectable offline pill (top bar), cached/read-only mode, offline queue indicator; writes disabled with "You're offline — changes will appear when you reconnect."
- Reconnect restores live mode and reconciles optimistic state silently.

### 9.5 Permission Denied

- Two tiers: **hidden** (nav item/page absent — WPS §3.5) and **explained** (page reached via link → friendly screen: "Viewers can't edit projects — contact an Admin").
- Restricted actions show a short explanation + "request access" affordance where supported; never a silent dead button.

### 9.6 Archived / Suspended

- Archived entities render read-only with an amber "Archived" banner + restore action (role-gated); suspended members show status badge and restricted contact options.
- Archived items remain searchable; filters offer "include archived" toggle (off by default).

### 9.7 No Results

- Search/filter no-results: "No <entity> match your filters" + clear-filters button + suggested alternatives (broaden scope, search docs).
- Never imply a bug — always a recovery path.

### 9.8 Not Enough Data

- Analytics/reports needing history show "Connect more sprints to see trends" instead of fabricated empty charts.

---

## 10. Responsive Behavior

### 10.1 Breakpoints (conceptual)

| Class | Width | Behavior |
|---|---|---|
| Desktop | ≥ 1280 | Full 12-col; full sidebar; multi-widget dashboards |
| Laptop | 1024–1279 | 12-col, slightly condensed spacing; sidebar default collapsed |
| Tablet | 640–1023 | 8-col; sidebar → drawer (hamburger); dashboards → 2-col; tables → scroll |
| Mobile | < 640 | 4-col; single-column stacks; drawers/modals become full-screen sheets; touch-first |

### 10.2 Element Adaptations

| Element | Desktop | Mobile |
|---|---|---|
| Sidebar | Persistent / icon rail | Slide-in drawer + scrim |
| Tables | Full grid, sortable | Card list or horizontal scroll; primary action per row |
| Cards | Multi-column grid | Single column |
| Modal | Centered dialog | Full-height bottom sheet |
| Command palette | Centered | Full-screen sheet |
| Sprint board | Horizontal lanes | Stacked lanes, vertical; DnD → menu actions |
| Mission Control | Fullscreen (best on large) | Not available / dimmed access notice |
| KB tree | Persistent rail | Drawer |
| Calendar | Week grid | Day/agenda |
| Dashboard KPI strip | 4–6 across | Horizontal scroll snap |
| Charts | Full width | Simplified (line → sparkline+value) |

### 10.3 Mobile Rules

- Touch targets ≥ 44 px; thumb-reachable primary actions (bottom placement for single action).
- Swipe gestures only as **enhancements** (never the only path); pull-to-refresh where sensible.
- Read-and-track emphasis (WPS §17.6): full reads, quick status taps, no heavy authoring workflows.
- DnD on touch: long-press → lift → drop with haptic; fallback menu move.

---

## 11. Micro-Interactions

### 11.1 Motion Rules

- Transitions 150–250 ms, ease-out; no bouncy physics; reduce-motion respected (disable all non-essential motion).
- One motion per interaction; never animate opacity+transform+color simultaneously unless meaningful.

### 11.2 Interaction Catalog

| Interaction | Behavior |
|---|---|
| Hover (cards/rows) | 1 px lift + border accent + focus ring within 150 ms |
| Button press | 50 ms scale-down (0.98), instant visual response |
| Status stepper | Segmented progress; step fills sequentially (200 ms) |
| Animated counters | KPI numbers count up on load (300 ms) then settle; honors reduce-motion |
| Progress bar fill | 300 ms ease-out fill; live-updating without jitter |
| Drag-and-drop | Card lifts (scale 1.03 + shadow); drop-target lanes highlight; invalid drop springs back with toast |
| Toast | Slide-in 200 ms, auto-dismiss; high-priority persists with action button |
| Context menu | Opens at pointer; Esc/clicks-away close; keyboard reachable (Shift+F10) |
| Inline edit | Click pencil/field → inline input; Enter commits, Esc cancels, edit state highlighted |
| Optimistic updates | UI updates instantly; reconcile silently on server events; conflict shows inline notice |
| Keyboard nav | Full arrow/tab traversal; visible focus; `?` opens shortcuts cheatsheet |
| Command palette | 150 ms open; type-ahead highlights matches live |
| Notifications | Badge count animates; toast slides in; bell dot clears on open |
| Presence | Dots fade in/out (no pop); "Focusing on X" card updates live |
| Mission Control | Data refreshes in place (no blink); auto-scroll for long risk lists |
| Collapse (sidebar/sections) | 200 ms ease-out width/height |

### 11.3 Keyboard Shortcuts (core set)

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Command palette |
| `T` | Toggle theme |
| `Ctrl/Cmd + \` | Toggle sidebar |
| `M` | Mission Control |
| `G D` | Go to Dashboard |
| `G O` | Go to Overview |
| `C` | New feature (context) |
| `N` | New in current context (project/sprint/doc) |
| `?` | Shortcuts cheatsheet |
| `/` | Focus search |

---

## 12. Accessibility

1. **WCAG 2.1 AA minimum** everywhere; AAA where practical (contrast, focus).
2. **Semantics & landmarks:** header, nav, main, complementary, contentinfo; correct heading hierarchy.
3. **Focus:** visible, ordered, never trapped (except dialogs with focus trap + Esc); skip-link to content.
4. **Keyboard:** every interaction keyboard-reachable; drag-and-drop has keyboard alternatives (menu move).
5. **Screen readers:** labels on all controls; decorative icons hidden; status changes announced via live regions; DnD announces drop success.
6. **Color not sole channel:** every health color has shape/label (§2.4); charts have data tables/tooltips.
7. **Motion:** `prefers-reduced-motion` disables animations, counters, auto-scroll, and toast slide.
8. **Touch:** targets ≥ 44 px; no hover-only affordances; touch enhancements optional.
9. **Contrast:** AA in both themes; focus rings ≥ 2 px distinct.
10. **Error communication:** inline + summarized (form summary at top); never color-only errors.
11. **Archived/read-only:** announced via `aria-readonly`/banner roles; status conveyed beyond color.

---

## 13. Motion & Performance

### 13.1 Perceived Performance

- Skeleton-first rendering (§2.14); dashboard load < 1.5 s (perceived), p95 interactions < 150 ms (WPS §1.4).
- Cached stores make repeat navigation instant; optimistic updates make writes feel synchronous.
- Live updates reconcile without layout shift (reserve space, no reflow jumps).

### 13.2 Motion Budget

- Total in-out per interaction ≤ 250 ms; no motion for pure data changes (only state changes).
- Page transitions: subtle fade/slide 150 ms; no splash screens, no intro animations.
- Loading progress never indeterminate for known-shape content.

---

## 14. Design Reviews & Governance

- **Component inventory:** every surface uses the shared vocabulary (§2); new patterns require design review against this document.
- **State completeness gate:** no screen ships without its §9 states defined.
- **Responsive gate:** no screen ships without desktop + tablet + mobile treatment (§10).
- **A11y gate:** no screen ships without §12 checks.
- **Versioning:** this document is the UX source of truth; changes flow through it before implementation.

---

## 15. Workspace Intelligence

Workspace Intelligence is **rules-based, not AI**. It turns signals the system already holds (status, activity, velocity, health, dependencies) into **proactive, explainable insights**. No machine learning, no black boxes, no new data collection — future AI layers build on these rules, never replace them.

### 15.1 Principles

1. **Explainable.** Every insight states *why* it fired and cites the exact evidence (feature, dates, signals).
2. **Actionable.** Every insight leads to a next step — open, assign, unblock, generate, review.
3. **Calm.** Insights are surfaced where they belong (Overview, dashboards, notifications), never as interrupting pop-ups.
4. **Conservative.** Rules fire only on clear, verified signals; false positives are tuned down, not papered over.
5. **Dismissible.** A member can dismiss an insight for a reason; the reason is logged to Activity.
6. **Privacy-respecting.** Rules operate only on evidence visible to the viewer — never on private tasks/sessions/journal (§2.4 WPS).

### 15.2 Insight Rule Catalog (v1)

| Trigger | Signal | Insight |
|---|---|---|
| **Stalled feature** | Auth feature, no activity in 3 days | Mark **At Risk**; notify assignee + Leader. |
| **QA queue stagnation** | Feature waiting for developer review past threshold | **Highlight** in QA dashboard + leader view. |
| **Velocity dip** | Sprint velocity below workspace average | **Suggest review** of scope/estimates at sprint review. |
| **Idle developer** | Developer has no active feature assigned | **Suggest assignment** to Leader (aggregate only — never exposes private data). |
| **Estimate drift** | Feature-linked time exceeding estimate by threshold | Flag estimate risk on the feature dashboard. |
| **Blocked aging** | Blocked feature not unblocked within threshold | Escalate with blocker reason to Leader. |
| **QA gate nearing** | Release approaching with unverified features | Surface "n features unverified before release date." |
| **Milestone slip** | Milestone date within threshold with open work | Surface to PM/Stakeholder dashboard as risk. |
| **Dependency delay** | Blocked/At-Risk upstream dependency | Surface dependency delay to dependent features (§10.6 WPS). |
| **Off-plan load** | Sprint scope changed mid-flight repeatedly | Suggest a scope-freeze review. |

### 15.3 Insight Anatomy

Every surfaced insight has:

```
[Type icon] [Headline]                     [Dismiss ⋮] [Action →]
Why: <plain-language reason + cited signals>
Evidence: Feature F-42 · no status change since <date> · 3 days
```

- **Headline:** imperative, one line ("Feature F-42 may be stalled").
- **Why:** one sentence explaining the rule that fired.
- **Evidence:** the exact signals; click-through to the entity.
- **Action:** the recommended next step (role-aware).
- **Dismiss:** with reason ("Already known," "Not relevant," "Too noisy") — feeds tuning.

### 15.4 Surfacing Surfaces

| Surface | What Shows | Frequency |
|---|---|---|
| Workspace Overview | Top insight strip (2–3 active) | On load, live |
| Dashboards (Leader/QA/PM) | Role-scoped insight cards | Live |
| Notifications | High-signal insights only (per §13 WPS priority) | Push |
| Mission Control | Critical insights in risk list | Live |
| Feature/Project detail | Context-specific insight banners | On view |

### 15.5 Governance & Evolution

- Rules are **Admin-configurable**: enable/disable, thresholds, audience (Workspace Settings → Intelligence).
- Every dismissal and threshold change is audited.
- Insight volume is capped (per-surface, per-day) to avoid noise fatigue.
- **Future AI** (§18 WPS, Phase 4) consumes the same rule results to learn thresholds and propose new rules — the rules stay the substrate.

---

## 16. Version 1.1 Addendum

This chapter contains all v1.1 additions. Each addition is labeled with the existing section it extends or the new section it introduces. **No v1.0 chapter was modified.**

### 16.1 → §4.3 First-Time Workspace Experience (FTUE)

The first impression should never be an empty dashboard. New workspace owners are guided through a **seven-step onboarding flow** that leaves behind a seeded, usable workspace — not a blank shell.

```
Welcome
  ↓
Choose Workspace Template
  ↓
Invite Members
  ↓
Create First Project
  ↓
Create Sprint
  ↓
Create First Feature
  ↓
Explore Workspace
  ↓
Workspace Ready
```

**Behaviors**

- **Why-first:** each step explains *why* the user is doing it (e.g., "Projects separate streams of work so teams can run in parallel without noise").
- **Skip anytime:** "Skip for now" on every step; skipped steps become a persistent "Getting started" checklist on the Overview.
- **Resume later:** progress is saved; re-entering the workspace re-opens onboarding at the next incomplete step (or via the checklist).
- **Contextual progress:** "Step 3 of 7" with a stepper; step icons reflect completion; completing a step is celebrated with a subtle success state (not confetti).
- **Templates do the heavy lifting:** the Choose Workspace Template step (§3.6 WPS) pre-seeds projects/teams/dashboards, so later steps are confirm-and-go.
- **Permission-aware:** only the Owner/Admin is walked through setup; other members land on a "Getting started for new members" variant (read docs, view projects, see their role).
- **Completion:** "Workspace Ready" screen summarizes what was created, links to next actions (invite more, start a session, view Mission Control), and offers "Don't show this again" (recoverable from Overview).

### 16.2 → §5.4 Workspace Quick Actions

The Overview gains a dedicated **Quick Actions** panel — a persistent, one-click launchpad for the actions a member does most, adapting to their role.

```
+ New Project        + New Feature
+ Start Sprint       + Invite Members
+ Generate Report    + Open Mission Control
+ View Activity      + Workspace Settings
```

**Role adaptation**

| Role | Focus | Action Set |
|---|---|---|
| Developer | Implementation | New Feature, Start Session, My Reports, Open Sprint Board, My Features |
| QA Engineer | Verification | New Feature, QA Dashboard, File Bug, QA Queue |
| Team Leader | Planning | New Sprint, Assign Features, Generate Report, Unblock List, Team Dashboard |
| Project Manager | Portfolio | New Project, Stakeholder Report, Roadmap/Milestones, Releases |
| Admin / Owner | Administration | New Project, Invite Members, Workspace Settings, Templates, Audit Log, Mission Control |
| Viewer | Read-only | Open Stakeholder Dashboard, View Reports, Open Projects |

**Behaviors**

- Panel sits prominently on the Overview (below identity/banner, above activity).
- Actions are icons + labels; primary action (highest-value per role) is emphasized.
- Click-through is instant; creating from a quick action opens the creation surface pre-contextualized (e.g., "+ New Feature" opens with the active project pre-selected).
- Customizable: members pin their most-used actions (pinning rules §16.6).

### 16.3 → §7.13 Universal Timeline

The Activity screen (v1.0 §7.13) **evolves into the Universal Timeline** — the chronological record of all major engineering events, unified across entities.

```
Sprint Started
  ↓
Feature Created
  ↓
Developer Started Work
  ↓
QA Started Testing
  ↓
Review Requested
  ↓
Release Published
  ↓
Deployment Completed
```

**Capabilities**

- **Unified events:** sprints, features, sessions (feature-linked only), reviews, QA, releases, deployments, milestones, member changes, and docs all emit into one timeline.
- **Filters:** by entity type, member, project, sprint, event type, health, and date range (WPS §13/§14 style).
- **Search:** free-text over event titles, entities, and metadata; results highlight the match.
- **Pinned events:** pin important events (e.g., a release) to the top of the timeline.
- **Bookmarks:** save events to a personal bookmarks list for later reference.
- **Comments:** attach context to any event; comments are themselves timeline events (threaded, mention-capable).
- **Exports:** export the filtered timeline (PDF/CSV) — Admins export full audit; others export their visible scope.

**Behaviors**

- Timeline is grouped by day; groups collapse; "today" pinned open.
- Live: new events append in place without reload (§11.3 WPS).
- Every event is actionable (click-through) and shows its health/status badge at a glance.
- Privacy boundary unchanged: private tasks/sessions/journal never appear (§2.4 WPS).

### 16.4 → §9 Smart Empty States (expansion)

Empty states are **educational by default**. Instead of a dead end, each empty state offers a decision with explanation, next action, shortcut, and related docs.

**Before → After ("No Projects"):**

| Before | After |
|---|---|
| `No Projects` | `Create Web Application` |
| | `Create Mobile Application` |
| | `Import Existing Repository` |
| | `Duplicate Existing Project` |
| | `Browse Templates` |

**Every empty state provides:**

1. **Explanation** — why this surface is empty ("Projects appear here once you create or join one.").
2. **Recommended next action** — the single best action, as a primary button.
3. **Shortcut** — the command-palette/keyboard route ("Or press `⌘K` → 'New Project'").
4. **Related documentation** — a link to the relevant KB doc or template.

**Pattern library:** template pickers (Web App / Mobile / Backend / AI / Research / API / Infra / Portfolio — §8.5 WPS), Import, Duplicate, Browse Templates, plus doc links. Applies to projects, features, sprints, teams, KB, reports, analytics (not-enough-data variant), and search (no-results variant).

### 16.5 → §7.18 Progressive Disclosure

Large pages reveal complexity **gradually**. A calm initial view covers the essentials; an **Advanced Mode** reveals power surface on demand.

**Example — Feature page:**

| Initial (default) | Advanced Mode |
|---|---|
| Overview | Dependencies |
| Progress | Release Notes |
| Assignees | Analytics |
| Status | QA Metrics |
| | History |
| | Linked Reports |

**Rules**

- The initial view always contains everything needed for the target user's daily task (no "just expand this" traps).
- **Advanced Mode** is a persistent toggle (per-entity, remembered per user): "Show advanced" / "Hide advanced."
- Advanced sections are also reachable via tabs/breadcrumbs — disclosure adds, never hides existing navigation.
- Newer/lower-frequency capabilities (dependencies, release notes, analytics) default to Advanced; core capabilities (status, assignees, progress) never hide.
- Disclosure is never used to hide required actions or accessibility-relevant content.

### 16.6 → §3.7 Favorites & Pinned Items

Users can **favorite** entities across the workspace and surface them everywhere navigation happens.

**Favoritable:** Projects, Features, Members, Knowledge Base pages, Reports, Dashboards.

**Where pinned items appear:**

| Surface | Behavior |
|---|---|
| **Sidebar** | "Favorites" section at top: pinned projects/features/KB/reports/dashboards with quick access; drag to reorder. |
| **Command Palette** | "Favorites" group above search results; `F` action set; pinned items rank first. |
| **Workspace Overview** | "Pinned" widget: the user's favorite projects/reports/dashboards. |

**Behaviors**

- Favorite action: star on the entity's header (and card hover); `⌘+⇧+S` toggles favorite on the current entity.
- Sidebar favorites are per-user and personal; workspace Overview "Pinned" widget is also personal.
- A member can pin a *workspace-level* dashboard (Stakeholder, Mission Control) that then appears in their sidebar.
- Capacity limits prevent clutter (e.g., sidebar shows up to a configurable count; overflow folds into a "More" popover).

### 16.7 → §3.8 Recently Visited

FocusFlow automatically maintains a **recency trail** so members jump back instead of navigating.

**Tracked:** Recent Projects, Recent Features, Recent Reports, Recent Documents, Recent Searches.

**Capabilities**

- **Jump Back:** one-click return to the last N visited entities (from Command Palette, Overview "Recent" widget, and sidebar overflow).
- **Pin:** promote a recent item to Favorites (§16.6) directly from the recents list.
- **Clear History:** per-item remove and "Clear all" (personal data, never workspace-visible).
- Recent items are **private per user** — never shared, never surfaced in audit, never used by Insights (§15).

**Behaviors**

- Recency = last visit time; ties broken by frequency; stale items age out.
- Command Palette: "Recent" section (⌘R to jump into); keyboard shortcuts for top items.
- Overview: "Recently visited" widget (compact, 4–6 items).

### 16.8 → §3.5 Command Palette → Workspace Command Center

The navigation-first palette becomes a true **Workspace command center** — *Raycast for FocusFlow*.

**Command domains**

| Domain | Example commands |
|---|---|
| **Navigate** | Go to Overview/Dashboard/Projects/Activity/Mission Control |
| **Create** | New Project, New Feature, New Sprint, New Team, New KB Doc |
| **Assign** | Assign feature, reassign to member, change role |
| **Generate** | Generate report (scope picker), schedule report |
| **Invite** | Invite members, resend invite |
| **Search** | Entities (§7.15), with type filters |
| **Switch Workspace** | Jump to another workspace / Personal |
| **Switch Project** | Project quick-switch |
| **Start Session** | Start/stop focus session against a feature |
| **Open Mission Control** | Fullscreen ops display |
| **Run Reports** | Generate + open report |
| **Open Documentation** | KB pages, help, shortcuts cheatsheet |
| **Recent Items** | §16.7 jump-back |

**Behaviors**

- **Prefix grammar:** plain text = search; `>` = commands; `@` = members; `#` = projects; `/` = scoped (current context) search.
- **Context-aware:** the palette knows the current workspace/project/feature and scopes commands accordingly.
- **Role-aware:** commands hidden/disabled by role (same rules as §3.2 sidebar).
- **Async actions:** start session, generate report run from the palette with in-place progress and a completion toast with click-through.
- **Learning:** recently used commands rank up (personal, per user).
- Keyboard model unchanged: `⌘K` opens, arrows select, Enter runs, Esc closes, `?` lists actions.

### 16.9 → §7.19 Split View Mode

Power users can work in **side-by-side layouts**, removing needless navigation.

**Supported combinations**

| Pair | Use |
|---|---|
| Feature + Documentation | Read specs while working |
| Feature + Activity | See history while editing |
| Sprint + Burndown | Plan and watch progress together |
| Reports + Analytics | Generate and interrogate together |
| Timeline + Comments | Follow context while discussing |

**Behaviors**

- Invocation: "Split view" action on entity headers, or `⌘\` (split) on the focused entity.
- Layout: fixed left (primary) + right (context) splitter; draggable divider (min/max widths enforced); second pane opens with a context picker.
- Split pairs are **remembered per user** and appear as a recent-pair shortcut.
- Both panes are independently navigable and keyboard-accessible; each pane has its own breadcrumb/back affordance.
- Not available (falls back to stacked layout): Mission Control, full-screen surfaces, mobile (§10 — split is desktop/laptop only).
- Closing a split restores the primary pane without state loss.

### 16.10 → §6 Dashboard Customization (expansion)

Every dashboard becomes **personalizable** without weakening the default layouts or the Stakeholder/Mission Control guarantees.

**Capabilities**

- **Widget drag-and-drop:** reorder widgets on the dashboard grid.
- **Resize:** adjust widget spans (1–4 columns) within grid rules.
- **Hide / Collapse:** hide low-value widgets (recoverable from a widget library) or collapse to a header-only card.
- **Save Layout:** persisted per user + role; explicit "Save layout" state feedback.
- **Reset Layout:** one-click restore of the workspace/role default.
- **Role-specific layouts:** the workspace template preloads a layout per role (Leader ≠ Developer ≠ QA ≠ Admin); members start there and customize.
- **Guaranteed widgets:** KPI strip and at-risk/blocked list cannot be removed; Mission Control and Stakeholder Dashboard remain fixed by design.

**Behaviors**

- Edit mode: "Customize" toggle reveals widget chrome (drag handle, resize, hide) without disrupting live data.
- Changes are optimistic with save/revert; unsaved changes prompt on leave.
- Dashboard customization never changes underlying data or reports — only the surface arrangement.

---

## Appendix

### A. Screen Checklist

| Screen | Purpose | Key actions | States | Responsive |
|---|---|---|---|---|
| Workspace Hub | Launcher | Open/Create workspace | Empty | Grid → rows |
| Workspace Overview | Orient | Open Dashboard, invite, new project | New-member | Stacks |
| Dashboard (×8) | Operate/monitor | Drill, assign, report | Empty | KPI scroll |
| Mission Control | Display | None (read) | — | Desktop-only |
| Projects | Portfolio | Create/open/archive | Empty/filtered | Cards → rows |
| Project Detail | Container | Start sprint, create feature | Hold/archive | Tabs scroll |
| Sprint Board | Control | DnD, assign, estimate | No-sprint | Stacked lanes |
| Sprint Detail | Sprint view | Edit, start/complete, retro | Planning/complete | Stacked |
| Features | Browse | Create/open/bulk | Empty/no-results | Table → cards |
| Feature Detail | Central object | Status, session, QA, deps | Blocked/rejected | Tabs scroll |
| Teams | Units | Create/manage members | Paused/archived | Cards |
| Team Detail | Team view | Manage members, report | No-members | Tabs scroll |
| Members | Roster | Invite, roles | Suspended | Table |
| Member Profile | Person view | Notify, reports | No-access | Stacked |
| Knowledge Base | Docs | Create/edit/link | Empty/archive | Tree drawer |
| Calendar | Time context | Focus block, jump | Empty month | Week → day |
| Reports | Outputs | Generate/share/schedule | Generating/no-data | Charts stack |
| Analytics | Insight | Filter/drill/export | Not-enough-data | Charts stack |
| Activity | Audit | Filter/export | Empty/filtered | Timeline |
| Notifications | Signals | Act, mute, preferences | Empty | Panel/list |
| Search | Discovery | Filter, open | No-results | Sheet |
| Settings / Admin | Configure | Branding, roles, audit, danger | Unsaved-guard | Nav drawer |

### B. Relationship to WPS & PRD

| WPS Section | UXS Expands |
|---|---|
| WPS §2–§3 | §3–§5 (shell, hub, overview, nav) |
| WPS §6–§10 | §7 (screens), §8 (forms) |
| WPS §12 (dashboards incl. 12.8/12.9) | §5–§6 |
| WPS §13 Notifications | §3.6, §7.14 |
| WPS §14 Search | §7.15, §3.5 |
| WPS §17 UX Principles | §1–§2, §12–§13 |
| PRD §13 UX Principles | §1–§2 |
| WPS v1.1 additions; insights & timeline | §15–§16 (v1.1) |

### C. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | Draft | Product | Initial complete Workspace UX specification |
| v1.1 | Draft | Product | Added Workspace Intelligence (§15) and Version 1.1 Addendum (§16): FTUE (§4.3), Quick Actions (§5.4), Universal Timeline (§7.13), Smart Empty States (§9), Progressive Disclosure (§7.18), Favorites & Pinned Items (§3.7), Recently Visited (§3.8), Command Center (§3.5), Split View (§7.19), Dashboard Customization (§6). No v1.0 chapters modified. |

---

*End of document — FocusFlow UXS v1.1*
