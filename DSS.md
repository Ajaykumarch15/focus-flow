# FocusFlow — Design System Specification (DSS)

**Product Name:** FocusFlow
**Document Type:** Design System Specification (DSS)
**Supersedes:** N/A — defines the visual and interaction design language for the entire FocusFlow platform
**Source of Truth:** FocusFlow PRD (v1.0); FocusFlow WPS (v1.1); FocusFlow UXS (v1.1)
**Audience:** Product Designers, UX Designers, Frontend Engineers, Design System Engineers, QA Engineers, Accessibility Specialists, Product Managers
**Status:** Draft v1.1
**Scope:** The complete visual and interaction design language used across every FocusFlow surface — Personal Workspace, Workspace, Admin, Mission Control, and future mobile/desktop apps. This document intentionally contains **no** React components, CSS, Tailwind classes, HTML, Figma files, JSON design tokens, APIs, or database schemas. Reusable *values* live in the separate Design Token Specification (DTS).

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Brand Language](#2-brand-language)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing System](#5-spacing-system)
6. [Elevation & Surfaces](#6-elevation--surfaces)
7. [Components](#7-components)
8. [Icons](#8-icons)
9. [Motion System](#9-motion-system)
10. [Layout System](#10-layout-system)
11. [Responsive Design](#11-responsive-design)
12. [Accessibility](#12-accessibility)
13. [Content Design](#13-content-design)
14. [Design Patterns](#14-design-patterns)
15. [Dashboard System](#15-dashboard-system)
16. [Data Visualization](#16-data-visualization)
17. [Workspace Branding](#17-workspace-branding)
18. [Future Evolution](#18-future-evolution)

---

## 1. Design Philosophy

### 1.1 Visual Identity

FocusFlow is a **developer cockpit**: precise, calm, information-dense but organized. The aesthetic is a distinct identity that sits alongside — never copies — Linear, GitHub, Notion, Raycast, and Vercel. Where those lean into flair or noise, FocusFlow commits to **clarity of evidence**.

Three pillars:

1. **Evidence over decoration.** Every pixel supports a decision. Charts, health colors, and progress are the interface — not marketing.
2. **Calm density.** A lot of information, zero noise. High data density within generous structural whitespace.
3. **Sharp and quiet.** Sharp corners on data surfaces, restrained color, one accent. The tool recedes; the work is prominent.

### 1.2 Brand Personality

- **Precise** — like a well-tuned CLI: exact, fast, predictable.
- **Quiet** — no celebration, no confetti, no empty-state jokes that wear out.
- **Trustworthy** — every number is traceable to evidence; the UI never overclaims.
- **Developer-native** — git vocabulary, markdown, copy-to-clipboard, shortcuts first.

### 1.3 Developer-First Experience

- Dark-first (developer default); light is first-class (§3.11).
- Keyboard-first: every nav item and common action has a shortcut (UXS §11.3).
- Markdown everywhere; code/IDs in monospace; zero-required-field creation.
- The Command Center (UXS §16.8) is the universal entry point.

### 1.4 Calm Workspace

- Statuses are colors first, words second (with labels for a11y).
- Insights surface where they belong, never interrupt (UXS §15).
- Progressive disclosure keeps large pages calm (UXS §16.5).

### 1.5 Minimal Cognitive Load

- One mental model: the same card, badge, and state vocabulary repeats everywhere.
- Automation first: anything derivable is derived; the UI surfaces decisions, not data entry.
- Consistent component vocabulary means learn-once, use-everywhere.

### 1.6 Automation-First

- Progress, health, reports, and timelines are derived from evidence (PRD/WPS).
- Manual input is reserved for *intent* (what's next, what's learned).
- The design system never adds ceremony: no mandatory fields, no process theater.

### 1.7 Consistency Principles

- **One vocabulary:** identical component rules across surfaces and platforms.
- **Token-driven:** designers and engineers consume the same semantic values (DTS).
- **Patterns over novelty:** a new page is composed from existing components unless a genuine gap exists.
- **No per-feature style:** styling decisions belong to the system, not individual screens.

### 1.8 Experience Principles

1. Sub-150 ms perceived interaction latency.
2. Skeleton-first loading; no full-screen spinners for known content shapes.
3. Optimistic updates with silent reconciliation.
4. Dead-end prevention: every page has a forward action.
5. Explainability: restricted or derived states always explain *why*.

---

## 2. Brand Language

### 2.1 Logo Usage

- **Primary lockup:** wordmark + mark; used in the Hub, top bar, and invitations.
- **Clear space:** logo never sits closer to other elements than its own height.
- **Minimum size:** wordmark not below legible reading size; mark not below 16 px in UI.
- **Backgrounds:** logo provided for dark, light, and accent surfaces; never recolor, skew, or add effects.
- **Placement:** top-left in product surfaces; centered on invitations and external share-links.

### 2.2 Workspace Branding

Workspaces carry their own identity within the platform brand (WPS §17.1; DSS §17): logo, banner, accent color, icon, description. Platform brand is always visible as the container; workspace brand personalizes the content.

### 2.3 Iconography Philosophy

- One single-weight stroke set (§8) — functional, geometric, recognizable at 16 px.
- Icons communicate *type of thing* (file, member, status, action), never substitute for words on primary actions.
- Status icons are a separate, color-semantic family (§3.7).

### 2.4 Illustration Style

- **Minimal geometric:** flat shapes, 2–3 tones from the neutral palette, one accent, no gradients.
- Used for empty states, onboarding, and error surfaces — never as decoration on data screens.
- Rounded-square containers; consistent stroke/rounding language with components.

### 2.5 Photography Policy

- Photography is **not** used in product surfaces (data screens stay clean).
- Allowed in marketing contexts only, and never inside the Workspace chrome.

### 2.6 Empty State Illustrations

- Follow §2.4 style; each empty state pairs illustration + explanation + action (UXS §16.4).
- Library covers projects, features, sprints, teams, KB, reports, search, and notifications.

### 2.7 Mascot (if any)

- No mascot in product. If a mascot is introduced for onboarding/marketing, it must be quiet, monochrome-capable, and never appear on data surfaces.

### 2.8 Voice and Tone

- **Tone:** direct, calm, competent. Sentences are short. No exclamation marks in system copy.
- **Vocabulary:** git-native and precise ("sprint," "feature," "QA lane," "sign-off," "release," "merge").
- **Errors** own the problem and give a path; **success** is understated; **empty states** are helpful, not witty.

---

## 3. Color System

### 3.1 Roles of Color

| Role | Use |
|---|---|
| **Semantic** | Health, status, success/error/info — fixed meanings (§3.5, §3.7) |
| **Brand** | Platform identity: primary mark, links, active states (§3.2) |
| **Workspace accent** | Per-workspace personalization (§3.3, §17) |
| **Neutral** | Structure: text, backgrounds, borders, surfaces (§3.4) |
| **Chart** | Data visualization palette (§3.6, §16) |

### 3.2 Brand Colors

- **Primary brand:** a single confident hue used for the mark, primary actions, and active navigation. Chosen for distinctiveness within the developer-tool landscape (not blue-default).
- **Brand pair:** dark support tone for emphasis; never used for semantic states.
- Brand colors are **not** used for health/status — those stay semantic.

### 3.3 Workspace Accent Colors

- Accent = one configurable hue per workspace (WPS §17.1).
- Derived automatically from a single accent seed: light/dark variants for hover/pressed/active and an accent-on-surface pairing.
- Contrast rule: accent text on surface must pass AA; accent fills on surface must pass AA for large text/icons or be paired with text.
- The palette of allowed accents is curated (hues chosen for distinguishability and accessibility) — not free-form hex.

### 3.4 Neutral Palette & Surface Hierarchy

- Neutrals define the surface stack: **background → surface → elevated → overlay**.
- Dark and light themes each have their own neutral ramp.
- Text levels: primary, secondary (muted), tertiary (placeholder), and disabled.
- Borders: subtle hairline for structure, stronger for emphasis states (focus, selected).

### 3.5 Semantic Colors

| Semantic | Meaning | Usage |
|---|---|---|
| **Success** | Verified, shipped, done | Confirmation, QA approved, health Healthy |
| **Warning** | Attention, risk | At-risk flags, overdue, health At Risk |
| **Danger** | Blocked, error, destructive | Blocked, validation errors, delete/reject |
| **Info** | Neutral information | Announcements, tips, waiting |

### 3.6 Chart Colors

- Chart palette is **separate from semantic colors** so data doesn't imply status.
- Categorical palette of 8–10 hues, distinguishable in dark/light and for color-blind users.
- Sequential/diverging variants for heatmaps and continuous data (§16).

### 3.7 Health & Status Colors

Fixed mapping, never overridden by branding:

| State | Dark | Light | Companion |
|---|---|---|---|
| Healthy | green | green | ● dot + label |
| At Risk | amber | amber | ● dot + label |
| Blocked | red | red | ● dot + label |
| Waiting | blue | blue | ● dot + label |
| Planned | neutral | neutral | ○ dot + label |

Status is always **color + shape + label** (WCAG: never color alone).

### 3.8 Priority Colors

- Priority is expressed via **intensity of the same neutral/semantic family + label**, not rainbow hues (e.g., P0 = danger, P1 = warning, P2 = neutral). No arbitrary colors for priority.

### 3.9 Backgrounds

- App background is the lowest contrast surface; content surfaces sit on it via §6 elevation.
- Mission Control uses a **dedicated, higher-contrast background** tuned for distance viewing (§6, §15).

### 3.10 Borders

- Default: hairline neutral border on cards, dividers, table rows.
- Emphasized: focus ring (accent or semantic), selected state border, drag-over highlight.
- Borders never carry semantic meaning alone.

### 3.11 Dark Mode & Light Mode

- **Dark** is default (developer-first). **Light** is first-class and complete.
- Both themes share the same semantic mapping; only neutral surfaces and text contrast change.
- Instant toggle (`T`), persisted, system-follow option (UXS §2.15).

### 3.12 Contrast Requirements

- Text: AA (4.5:1) minimum; large text/icons AA (3:1).
- Health dots on any surface: 3:1 minimum against the surface they sit on.
- Focus rings: 3:1 against adjacent surfaces and distinct from borders.

### 3.13 Future Theming

- All color decisions are expressed as **semantic tokens** (DTS) so future themes (high-contrast, custom workspace themes, OLED) swap values, not architecture.

---

## 4. Typography

### 4.1 Font Families

| Family | Use |
|---|---|
| **Sans (UI)** | All interface text, headings, labels, body |
| **Mono** | IDs, code, time, estimates, feature IDs, tables data, diffs |

- Sans: system-ui stack with a bundled option for consistency; geometric-friendly, clear on data screens.
- Mono: legible at 12 px, tabular figures for numbers in tables.

### 4.2 Scale

A compact ratio (~1.25) suited to dense tooling:

| Token | Size | Weight | Use |
|---|---|---|---|
| Display | 24–28 / 700 | Page title |
| H2 | 18 / 600 | Section heading |
| H3 | 16 / 600 | Card / sub-section title |
| Body | 13–14 / 400 | Default text |
| Mono | 12–13 / 400 | Code, IDs, data |
| Label | 11–12 / 500 | Meta, badges, tooltips |
| Mission Control | 28–64 / 700 | Distance viewing |

### 4.3 Hierarchy

- One H1 per page; sections descend H2 → H3; never skip levels.
- Emphasis via weight and size, not color alone; muted text for secondary info.
- Hierarchy must survive data density: labels attach to values, never float orphaned.

### 4.4 Code Typography

- Mono for: feature IDs (F-42), sprint IDs, repo paths, commit refs, JSON snippets, estimates.
- Code blocks: mono, relaxed leading, subtle background, horizontal scroll with visible overflow affordance.

### 4.5 Tables

- 13 px base; headers 12 / 500 uppercase-ish (sentence case), muted; tabular numerals for numeric columns.
- No vertical striping by default; row hover only.

### 4.6 Data Typography

- Large numerals on KPI/metric cards: Display weight, tabular figures.
- Percentages always beside progress bars (§16).
- Number formatting localized; time uses relative ("3d ago") with absolute on hover.

### 4.7 Responsive Typography

- Font scale is fixed on desktop/tablet; mobile may reduce body to 12.5–13 px minimums.
- Headings may reflow but never shrink below legibility; no scaling beyond ±8%.
- Mission Control typography scales with viewport width for distance legibility.

### 4.8 Accessibility

- All text AA 4.5:1 in both themes.
- Line height 1.4–1.5; paragraph width 60–80 characters for reading surfaces (KB, reports).
- No font below 12 px; 11 px reserved for dense metadata labels with ample letter-spacing.

### 4.9 Reading Comfort

- KB docs, reports, and comment bodies: max reading measure, comfortable leading, clear paragraph spacing.
- Body copy uses proportional sans; code uses mono; never faux-bold/faux-italic.

---

## 5. Spacing System

### 5.1 Spacing Scale

A base-4 scale (values land in DTS):

| Token | Value | Use |
|---|---|---|
| xs | 4 px | Inset icons, label-to-field |
| sm | 8 px | Row gaps, chip gaps |
| md | 12 px | Grouped controls |
| lg | 16 px | Card padding, section gaps |
| xl | 24 px | Between widgets/cards |
| 2xl | 32 px | Between page sections |
| 3xl | 48 px | Page gutters, modal padding |

### 5.2 Grid System

- 12-column fluid grid (desktop), 8-column (tablet), 4-column (mobile).
- 16 px base gutter; 24 px between major columns on wide dashboards.
- Cards span 1–4 columns; dashboards use a 4-column master grid.

### 5.3 Responsive Grid

- Breakpoints: desktop ≥1280, laptop 1024–1279, tablet 640–1023, mobile <640 (UXS §10.1).
- Grid collapses gracefully; gutters shrink at tablet, single-column at mobile.

### 5.4 Container Widths

- Content max ≈ 1600 px centered; wide dashboards may extend to 1920 px.
- Reading surfaces (KB, reports) constrained to ~72–80 chars measure.
- Full-bleed reserved for Mission Control and split view.

### 5.5 Card Spacing

- Card inner padding: 16 px (content), 12 px (dense rows).
- Card-to-card gap: 24 px on dashboards; 16 px on dense lists.
- Card header → body gap: 12 px; body → footer gap: 12 px.

### 5.6 Dashboard Spacing

- KPI strip: 16 px items, 16 px gaps, section gap 24 px below.
- Widgets: 24 px gutters; widget header 16 px; widget body padding 16 px.
- At-risk/activity feeds: 8 px row gaps inside the widget.

### 5.7 Whitespace Philosophy

- Whitespace organizes; it never dilutes density on data surfaces.
- Structural whitespace (between sections) is generous; internal spacing (within rows) is tight.
- Empty states and onboarding use *more* whitespace for focus.

---

## 6. Elevation & Surfaces

### 6.1 Elevation Model

Elevation is expressed as **surface + border + shadow** layers, tokenized (DTS). Only three levels in product, plus overlays:

| Level | Surface | Use |
|---|---|---|
| **Ground** | app background | Page background |
| **Raised** | card/panel surface | Default content surfaces |
| **Floating** | elevated surface + shadow | Popovers, menus, toasts, command palette |
| **Overlay** | scrim + floating | Dialogs, drawers, bottom sheets, modals |

### 6.2 Cards

- Ground-surface-based (Raised): border hairline, no shadow by default.
- Interactive cards: hover lift (1 px translate + border accent), focus ring.
- Anatomy: header (title + meta/actions), body, optional footer (avatars, progress, badges).

### 6.3 Panels

- Persistent structural containers (side panels, settings sections): Raised, hairline border, no shadow.
- Not interactive unless explicitly a list of actions.

### 6.4 Dialogs

- Overlay: scrim (neutral, 60% opacity dark), Floating surface, rounded corners per DTS radius, focus-trapped.
- Width by intent: small confirm 400 px; forms up to 640 px; wide (dependency graph) up to 960 px.

### 6.5 Drawers

- Side-surfaced panels (sidebar, KB tree on mobile, filters): Floating, slides from edge, scrim optional (mobile full).
- Full-height on desktop rail; full-screen sheet on mobile.

### 6.6 Bottom Sheets (mobile)

- Mobile-only dialogs: Floating surface, rounded top corners, drag handle, scrim.
- Full-height for Command Center and complex forms.

### 6.7 Mission Control

- Dedicated **dark, high-contrast** surface tuned for distance viewing (large type, no subtle hairlines).
- Uses the same semantic colors at higher intensity for readability across a room (UXS §6.9).

### 6.8 Hover

- Interactive elements: border accent + 1 px lift (cards), background tint (rows/menu items), no motion > 150 ms.
- Hover never the only affordance (touch devices have no hover).

### 6.9 Focus

- Focus ring: 2 px, accent or semantic-appropriate, 3:1 contrast, offset 2 px.
- Never suppressed; `:focus-visible` model (visible for keyboard).

### 6.10 Selected

- Selected state: surface tint + border accent + persistent check/indicator.
- In tables: row highlight + accent left-rail or checkbox.

### 6.11 Disabled

- Opacity-reduced (no full invisibility); cursor default; never traps info (tooltip explains why, when useful).
- Disabled ≠ unreadable: disabled text must still be legible.

---

## 7. Components

For each component: **Purpose · Variants · Anatomy · Behavior · States · Accessibility · Responsive · Usage guidelines · Do's & Don'ts.**

### 7.1 Buttons

- **Purpose:** trigger actions.
- **Variants:** primary, secondary, ghost, destructive, icon-only, link-button (UXS §2.6).
- **Anatomy:** label (+ optional icon left for actions, right for external), min height 32 px (44 px touch), padding 12×16.
- **Behavior:** press feedback 50 ms; busy state (spinner in place, disabled); loading never swaps layout.
- **States:** default, hover, pressed, focus, disabled, busy.
- **A11y:** real `<button>` semantics, aria-pressed for toggles, descriptive labels.
- **Responsive:** full-width on mobile for primary actions; icon-only keeps ≥ 44 px target.
- **Usage:** one primary per view; destructive separated from primary; no emoji in labels.
- **Do:** keep labels verb-first, consistent ("New Feature"). **Don't:** stack two primaries, use color-only emphasis.

### 7.2 Inputs

- **Purpose:** capture text/data.
- **Variants:** text, textarea, search, select, combobox, date/time, toggle, checkbox, radio, chips/tags (UXS §2.7).
- **Anatomy:** label above, field, helper, optional counter, validation message.
- **Behavior:** validate on blur; inline errors; Enter commits (single-line); Tab order logical.
- **States:** default, hover, focus, filled, error, disabled, read-only.
- **A11y:** every input has a programmatic label; error messages linked to the field.
- **Responsive:** inputs full-width on mobile; date/time use native pickers.
- **Usage:** placeholders are examples, not labels.
- **Do:** show requirements upfront. **Don't:** disable inputs to "hide" them.

### 7.3 Search

- **Purpose:** find entities and actions.
- **Variants:** global (Command Center), scoped (within a list), list-filter search.
- **Anatomy:** search icon, field, clear button, results below, type indicators.
- **Behavior:** debounced results; keyboard navigable; highlights matches (§7.15 UXS).
- **States:** idle, typing, loading (skeleton rows), results, no-results, error.
- **A11y:** aria-live result announcements; clear labels; focus management.
- **Responsive:** full-width on mobile; scoped search in drawers.
- **Usage:** search reaches everything the user can access; never private data.

### 7.4 Command Palette

- **Purpose:** universal command center (UXS §16.8).
- **Variants:** default (⌘K), action-only (`>`), scoped (`/`), favorites, recent.
- **Anatomy:** centered modal, query field, result groups (Actions/Search/Favorites/Recent), footer hints.
- **Behavior:** fuzzy match, prefix grammar, role/context-aware, async actions with in-place progress.
- **States:** idle, typing, loading, grouped results, empty, error.
- **A11y:** focus lands in field; arrow navigation; Esc closes; results announced.
- **Responsive:** full-screen sheet on mobile.
- **Usage:** the primary navigation power tool; every page and common action reachable.

### 7.5 Cards

- **Purpose:** group related content into tappable units.
- **Variants:** project, feature, member, team, stat, widget, insight.
- **Anatomy:** header (title, meta, health, actions), body, footer (avatars/progress).
- **Behavior:** click → entity; hover lift for interactive; non-interactive cards have no hover.
- **States:** default, hover, focus, selected, archived (read-only), disabled.
- **A11y:** interactive cards are single links/buttons, not nested interactives.
- **Responsive:** grid → single column on mobile.
- **Usage:** consistent anatomy across all card types.

### 7.6 Feature Cards

- **Purpose:** compact representation of a feature (boards/lists).
- **Anatomy:** ID + title, health badge, type chip, assignee avatar, estimate, progress, session/activity dot, bug icon.
- **Behavior:** quick-assign, quick-estimate, inline comment, DnD on board (UXS §7.3).
- **States:** per §7.5 + drag state (lifted, invalid-drop spring back).
- **Responsive:** full-width on mobile; move via menu (no DnD).

### 7.7 Project Cards

- **Purpose:** portfolio units on Projects list / Overview.
- **Anatomy:** icon/color, name, health badge, active sprint %, open features, team scope, member avatars, archived flag.
- **Behavior:** click → Project Detail; hover lift.
- **Usage:** never display estimates/QA internals on cards (density + Stakeholder boundary).

### 7.8 Member Cards

- **Purpose:** person representation on dashboards/boards.
- **Anatomy:** avatar + presence dot, name, role, live status ("Focusing on X"), current feature, aggregate focus, quick actions.
- **Behavior:** hover reveals quick actions; click → profile.
- **Privacy:** never shows private tasks/sessions (UXS §7.8).

### 7.9 Team Cards

- **Purpose:** team units on Teams list.
- **Anatomy:** name, leader, member count, scoped projects, active sprint health, paused/archived flags.

### 7.10 Tables

- **Purpose:** structured data browsing (§7.10 UXS).
- **Variants:** default (read), selectable (bulk actions), nested (expandable rows).
- **Anatomy:** sticky header, sortable columns, row actions, optional pagination/infinite scroll.
- **Behavior:** click row → entity; sort via header; bulk select bar appears on selection.
- **States:** default, hover, selected, empty, no-results, loading (skeleton), disabled rows.
- **A11y:** proper table semantics or grid role; sort announced; focus on rows.
- **Responsive:** horizontal scroll or card conversion on mobile.
- **Usage:** tabular numerals; direct labels; no visual-only info.

### 7.11 Data Grid

- **Purpose:** dense, editable/customizable data (Analytics drill-down).
- **Anatomy:** table + frozen columns + inline edit + column controls.
- **Behavior:** column resize/reorder, inline edit (Enter commit, Esc cancel), export.
- **Responsive:** horizontal scroll; inline edit via tap.

### 7.12 Tabs

- **Purpose:** switch views within a screen (Project/Feature/Team Detail).
- **Variants:** underline (primary), segmented (dense filters), scrollable (mobile).
- **Anatomy:** tab label, optional badge count, active underline accent.
- **Behavior:** keyboard arrow switching; state preserved per tab.
- **A11y:** proper tablist semantics; focus moves into panel.
- **Responsive:** scrollable on mobile.

### 7.13 Sidebar

- **Purpose:** workspace-scoped primary navigation (UXS §3.2).
- **Anatomy:** logo/workspace, Favorites, Overview, Dashboard, modules, Admin (role), bottom (switcher, avatar).
- **Behavior:** collapse to icon rail; remembers per-user; role-aware items.
- **A11y:** nav landmark, current-page indication, focus management on collapse.

### 7.14 Top Bar

- **Purpose:** global chrome (UXS §3.3).
- **Anatomy:** workspace name, ⌘K search, notifications bell, timer ticker, avatar menu.
- **Behavior:** workspace name → Overview; bell opens notifications panel.
- **Responsive:** search collapses to icon on mobile (opens Command Center).

### 7.15 Breadcrumbs

- **Purpose:** context and back-navigation (UXS §3.4).
- **Anatomy:** `Workspace → Project → Sprint → Feature`, each a link; ellipsis overflow.
- **Behavior:** click any level; current page non-clickable.
- **A11y:** nav landmark with aria-label "Breadcrumb."

### 7.16 Navigation

- **Purpose:** cross-surface wayfinding.
- **Patterns:** sidebar + top bar + breadcrumbs + Command Center + keyboard shortcuts (UXS §11.3).
- **Rules:** role-aware, dead-end prevention, context preservation on workspace switch.

### 7.17 Charts

- **Purpose:** visualize derived data (§16).
- **Variants:** progress bar, burndown line, sparkline, bar/stacked, donut, timeline/gantt, dependency graph.
- **Anatomy:** chart + title + legend + value labels + tooltip.
- **Behavior:** hover/focus tooltip; click-through to data; chart-type switch where supported.
- **A11y:** data available as table/export; patterns not color-only; reduced-motion friendly.
- **Responsive:** simplify on mobile (line → value).

### 7.18 Progress Bars

- **Purpose:** single measure vs. target.
- **Anatomy:** label, bar, numeric value always visible (§2.10 UXS).
- **Behavior:** animated fill on load/recalc; live updates without jitter.
- **States:** under-target, at-target, over-target (health-colored only when health-derived).

### 7.19 Badges

- **Purpose:** compact status/role labels.
- **Anatomy:** dot + label (health), plain pill (role/type).
- **Variants:** status, role, type, count (bell), tag.
- **Rules:** color + shape + text; truncation with tooltip.

### 7.20 Avatars

- **Purpose:** represent members.
- **Anatomy:** image or initials fallback, presence dot (online/focusing/reviewing/testing/away/blocked/meeting), optional ring (me).
- **Behavior:** hover → presence tooltip; click → profile.
- **Sizes:** 16 (dense rows), 20 (cards), 24–32 (headers), 40 (profiles).
- **A11y:** role img with name; decorative duplicates hidden.

### 7.21 Timeline

- **Purpose:** chronological event record (UXS §16.3 Universal Timeline).
- **Anatomy:** vertical rail, event nodes (type icon + semantic color), title, meta, time, actions.
- **Behavior:** filter/search/pin/bookmark/comment/export; live append; day grouping.
- **States:** pinned, bookmarked, comment-thread, collapsed day group.

### 7.22 Comments

- **Purpose:** threaded discussion on features/docs/events.
- **Anatomy:** avatar, author, time, body (markdown), actions (reply, mention, react-lite, edit).
- **Behavior:** mentions trigger notifications (WPS §13); optimistic post with inline error recovery.

### 7.23 Markdown

- **Purpose:** authoring surfaces (KB, feature descriptions, reports, comments).
- **Anatomy:** editor toolbar, write/preview split, `/` command menu, rendered output.
- **Rules:** consistent renderer everywhere; code fences; tables; checklists.
- **A11y:** rendered content keyboard-navigable; headings semantic.

### 7.24 Forms

- **Purpose:** structured capture (UXS §8).
- **Anatomy:** fields, validation, actions row, optional progress (multi-step).
- **Behavior:** zero-required-field creation; live validation on blur; optimistic create.
- **States:** dirty/clean, saving/saved/error, submitting.
- **Responsive:** single column on mobile; inline on wide for short fields.

### 7.25 Dialogs

- **Purpose:** focused tasks/confirmations (UXS §6.4).
- **Variants:** confirm, form, wide (graph).
- **Behavior:** focus trap, Esc cancel, click-scrim to cancel (destructive requires explicit click), title + description.
- **Destructive confirm:** type-to-confirm for workspace deletion (WPS §2.5).

### 7.26 Notifications

- **Purpose:** actionable signals (WPS §13).
- **Variants:** toast (top-right), bell panel, digest.
- **Anatomy:** icon, title, context, time, action, dismiss.
- **Behavior:** priority-based (High persists); click-through; per-category mute.
- **Responsive:** toasts stack full-width on mobile.

### 7.27 Toast

- **Purpose:** transient feedback.
- **Anatomy:** icon, message, optional action ("Open", "Undo"), auto-dismiss (High persists).
- **Behavior:** slide-in 200 ms; stack max 3; never covers primary actions permanently.
- **A11y:** aria-live polite; actions keyboard-reachable.

### 7.28 Skeletons

- **Purpose:** perceived-performance loading (§2.14 UXS).
- **Anatomy:** shapes mirroring final content (cards, rows, avatars, charts).
- **Behavior:** shimmer subtle; replaced ≤ 1.5 s typical; slow-state pattern beyond 3 s.
- **A11y:** aria-busy on container; no "Loading…" spam.

### 7.29 Empty States

- **Purpose:** educate and guide (UXS §16.4).
- **Anatomy:** illustration, explanation, recommended action (primary), shortcut hint, related docs.
- **Variants:** empty, no-results, not-enough-data, permission-scoped.
- **Never:** bare "No items."

### 7.30 Loading Indicators

- **Purpose:** indeterminate progress (only for unknown-shape work).
- **Variants:** inline spinner (buttons), row spinner (infinite scroll), page state (rare — prefer skeletons).
- **Rules:** never a full-screen spinner for known content shapes.

### 7.31 Status Indicators

- **Purpose:** live status of work/members (WPS §11.1).
- **Variants:** presence dots, "Focusing on X" cards, status badges, health dots.
- **Behavior:** live updates; derived, never self-reported.
- **A11y:** non-color cues; announcements for significant changes.

### 7.32 Activity Cards

- **Purpose:** compact event summaries (Overview/activity feeds).
- **Anatomy:** icon, headline, meta, time, click-through.
- **Behavior:** part of feeds and the Universal Timeline; actionability preserved.

### 7.33 Mission Control Widgets

- **Purpose:** distance-legible ops widgets (UXS §6.9).
- **Variants:** sprint health, burndown sparkline, at-risk list, QA queue, presence grid, milestone strip, heartbeat.
- **Anatomy:** large type, high-contrast semantic colors, no subtle hairlines.
- **Behavior:** live refresh; auto-scroll for long lists; dims when idle.

---

## 8. Icons

### 8.1 Style

- Single-weight **stroke** icons (1.5–2 px), geometric, rounded ends consistent with the platform.
- Rendered at 16 px default; grid-aligned; optical alignment within bounds.
- No filled variants except active-nav and status families.

### 8.2 Stroke

- Consistent stroke across the set; no mixed weights.
- Cutouts and gaps ≥ 2 px at 16 px to stay crisp.

### 8.3 Sizes

| Size | Use |
|---|---|
| 16 px | Default: inline, menus, table rows |
| 20 px | Sidebar, top bar |
| 24 px | Empty states, onboarding, dialog headers |
| 32 px+ | Mission Control, feature illustrations |

### 8.4 Consistency

- One set, one naming convention, one meaning per glyph (documented in the icon index).
- New icons go through design-system review; no per-feature custom glyphs.

### 8.5 Semantic Usage

- Icons support but never replace words on primary actions.
- Action icons are verbs; entity icons are nouns; status icons are the semantic family.

### 8.6 Status Icons

- Dedicated semantic set (check, warning, block, wait, planned) matching §3.7 colors.
- Include non-color shapes for a11y.

### 8.7 File Icons

- Document types: KB doc, report, release notes, attachment — distinct, consistent.

### 8.8 Role Icons

- Owner/Admin/PM/Leader/Developer/QA/Viewer — each a distinct glyph used in rosters and role pickers.

### 8.9 Health Icons

- Health represented by dot glyphs (+ labels), matching §3.7; never unique per-workspace.

### 8.10 Animation Rules

- Icons animate only for state change (loading spinner, progress), never idle animation.
- Reduced-motion disables icon animation.

---

## 9. Motion System

### 9.1 Motion Philosophy

Motion communicates **state and causality**, never spectacle. 150–250 ms transitions, ease-out, one motion per interaction.

### 9.2 Transitions

| Purpose | Duration | Curve |
|---|---|---|
| Hover/lift | 150 ms | ease-out |
| UI state change | 150–200 ms | ease-out |
| Panels/drawers | 200 ms | ease-out |
| Dialogs/overlays | 200–250 ms | ease-out (fade+scale) |
| Page transition | 150 ms | fade/slide |

### 9.3 Hover

- 150 ms, subtle (border/lift/tint), no content displacement.

### 9.4 Focus

- Focus ring appears instantly (no fade); content transitions respect reduced-motion.

### 9.5 Page Transitions

- Subtle fade/slide 150 ms; no splash, no parallax, no intro sequences.

### 9.6 Animated Counters

- KPI counters count up 300 ms then settle; value-format stable (no jitter); reduced-motion = instant.

### 9.7 Progress

- Progress bar fill 300 ms ease-out; live updates re-render without animation jitter.

### 9.8 Loading

- Skeleton shimmer subtle and slow (not attention-grabbing); replace on content.

### 9.9 Success

- Understated: brief accent flash or check-in-place; never confetti.

### 9.10 Error

- Immediate (no animation delay); inline field errors; toast slide-in 200 ms.

### 9.11 Reduced Motion

- `prefers-reduced-motion`: disable all non-essential animation (counters, lifts, shimmer, auto-scroll).
- Essential motion (focus, error, progress at 50 ms) retained.

### 9.12 Performance Budget

- Total in/out per interaction ≤ 250 ms; no animation on pure data changes; 60 fps.

---

## 10. Layout System

### 10.1 Page Templates

| Template | Use |
|---|---|
| **Shell page** | Standard: top bar + sidebar + breadcrumb + content |
| **Detail page** | Tabs under a header (Project/Feature/Team Detail) |
| **List page** | Toolbar + list/card/table |
| **Dashboard page** | KPI strip + widget grid (§15) |
| **Hub page** | Pre-workspace launcher |
| **Settings page** | Left settings nav + content |
| **Fullscreen** | Mission Control, Command Center (modal), split view |
| **Reading page** | KB docs, reports (constrained measure) |

### 10.2 Dashboard Layouts

- 4-column master grid; widgets span 1–4; KPI strip above.
- Customizable per user/role (UXS §16.10); guaranteed widgets fixed.

### 10.3 Workspace Layouts

- Workspace frame: sidebar (Favorites + Overview + Dashboard + modules) + top bar + content.
- Landing: Overview (§5 UXS); operational: Dashboard (§6 UXS).

### 10.4 Form Layouts

- Single column (mobile/short), two-column (wide, paired fields), wizard (onboarding, §4.3 UXS).
- Actions bottom-right (desktop) / bottom bar (mobile).

### 10.5 Tables

- Full-width within container; toolbar above; bulk bar appears on selection; sticky header.
- Pagination vs infinite scroll: infinite for feeds/activity; pagination for audit/exportable data.

### 10.6 Responsive Containers

- Containers fluid to breakpoints; reading surfaces constrained; dashboards reflow (UXS §10).

### 10.7 Side Panels

- Drawers: settings/filters/context; slide-in; scrim on mobile; resize handles on desktop.

### 10.8 Split View

- Primary + context panes; draggable divider; pairs remembered per user (UXS §16.9).
- Desktop/laptop only; Mission Control excluded.

### 10.9 Mission Control

- Dedicated fullscreen layout: top strip, left/center/right rails, footer heartbeat (UXS §6.9).
- Distance-legible type; high-contrast surfaces.

---

## 11. Responsive Design

### 11.1 Breakpoints

| Class | Width | Behavior |
|---|---|---|
| Desktop | ≥ 1280 | Full 12-col, full sidebar, dashboard grid |
| Laptop | 1024–1279 | 12-col condensed, sidebar default collapsed |
| Tablet | 640–1023 | 8-col, sidebar drawer, 2-col dashboards |
| Mobile | < 640 | 4-col, single-column stacks, sheets, touch-first |

### 11.2 Desktop

- Full experience; split view; dashboard grids; Mission Control.

### 11.3 Laptop

- Slightly condensed spacing; sidebar collapses to rail; dashboards compress.

### 11.4 Tablet

- Sidebar → drawer; tables scroll or convert; cards 2-col; modals → sheets.

### 11.5 Mobile

- Read-and-track emphasis (UXS §10.3); full-width inputs; bottom sheets; 44 px targets; no heavy authoring by default.

### 11.6 Touch

- Targets ≥ 44 px; swipe only as enhancement; pull-to-refresh where sensible; DnD via long-press + fallback menus.

### 11.7 Keyboard

- Full keyboard parity on every surface; visible focus; shortcut cheatsheet (`?`).

### 11.8 Adaptive Navigation

- Sidebar → drawer (mobile); top bar collapses search; breadcrumbs truncate; tabs scroll.

### 11.9 Adaptive Components

- Cards → rows (mobile); tables → cards/scroll; charts → simplified; mission control desktop-only with access notice.

---

## 12. Accessibility

1. **WCAG 2.1 AA minimum** across all surfaces; AAA where practical.
2. **Keyboard:** every interaction reachable; DnD has menu alternatives; focus never trapped (except dialogs with trap + Esc).
3. **Focus:** visible, ordered, skip-link to content; `:focus-visible` model.
4. **Screen readers:** semantic landmarks, labels on all controls, live regions for status changes.
5. **Contrast:** text AA 4.5:1; large text/icons 3:1; focus rings 3:1 (UXS §12).
6. **Forms:** labeled inputs, inline + summary errors, errors not color-only.
7. **Charts:** data available as table/export; patterns + labels, not color alone.
8. **Tables:** proper semantics, sort announced, keyboard row navigation.
9. **Motion:** reduced-motion honored (§9.11).
10. **Color blindness:** semantic colors paired with shapes/labels; chart palette colorblind-safe.
11. **Touch targets:** ≥ 44 px; no hover-only affordances.
12. **Error handling:** clear messages with recovery paths; never silent failures.

---

## 13. Content Design

### 13.1 Headings

- Page-level H1, section H2, cards H3; verb-first action titles; sentence case in UI.
- Headings answer "what is this?" in ≤ 6 words where possible.

### 13.2 Buttons

- Verb-first, object-second ("New Feature," "Start Sprint," "Generate Report").
- Never all-caps; never exclamation marks; destructive labeled clearly ("Delete project").

### 13.3 Labels

- Field labels: nouns, sentence case, specific ("Sprint goal," not "Details").
- Group labels (segments, filters) concise; units always present ("days," "%").

### 13.4 Tooltips

- Short, informative ("Marks the feature At Risk — Leader will be notified").
- Hover + focus; no critical info only in tooltips.

### 13.5 Placeholders

- Examples, not instructions ("e.g., F-42" or "Describe what this feature does…").
- Never a substitute for the label.

### 13.6 Error Messages

- State the problem, the cause, and the fix in one line ("'X' is required — add a title to continue").
- Tone: neutral, specific; never blame the user.

### 13.7 Success Messages

- Understated, confirmatory ("Saved," "Invite sent," "Sprint started").
- Include next step only when it helps ("Report ready — share it").

### 13.8 Empty States

- Explanation + recommended action + shortcut + related docs (UXS §16.4).

### 13.9 Confirmation Dialogs

- Title = action ("Archive project?"); body = consequence; confirm button repeats the verb; destructive uses destructive styling + type-to-confirm for irreversible ops.

### 13.10 Notifications

- One-line title + context + action (WPS §13); no marketing-style copy.

### 13.11 Microcopy

- Help text explains *why*, not just *what* ("Sessions attached to a feature roll up to team reports — everything else stays private").
- Consistent terminology across product + docs (glossary in WPS Appendix A).

### 13.12 Technical Terminology

- Git-native, precise; document synonyms once; never mix ("Done" vs "Complete").

---

## 14. Design Patterns

### 14.1 CRUD

- Consistent create/edit/archive/delete semantics (WPS §2.5); archive over delete; delete cascade-aware + confirmation.

### 14.2 Tables

- Sortable, sticky headers, bulk actions, infinite scroll vs pagination rules (§7.10).

### 14.3 Search

- Global Command Center + scoped filters; ranking by relevance + access (WPS §14).

### 14.4 Filters

- Persistent, combinable, saved per view where valuable; "clear all" always available.

### 14.5 Sorting

- Default order stated; toggle ascending/descending; persisted per user.

### 14.6 Bulk Actions

- Selection reveals bulk bar; destructive bulk requires confirm; progress + undo where possible.

### 14.7 Infinite Scrolling

- Feeds, activity, timeline; intersection trigger; end-of-list indicator; keyboard reachable.

### 14.8 Pagination

- Audit log, exported data, large tables; page size remembered.

### 14.9 Drag-and-Drop

- Sprint board only (UXS §7.3); keyboard alternative; invalid-drop feedback; no ceremonial DnD elsewhere.

### 14.10 Wizard

- FTUE onboarding (§4.3 UXS) and multi-step forms: stepper, "why" per step, skip/resume, "Step X of N."

### 14.11 Onboarding

- Guided, resumable, permission-aware; checklist on Overview until complete.

### 14.12 Workspace Switching

- Hub → workspace; context preserved; recent-first ordering.

### 14.13 Progressive Disclosure

- Initial + Advanced modes (UXS §16.5); core never hidden; advanced reachable via tabs too.

### 14.14 Command Palette

- The universal pattern for create/navigate/act (UXS §16.8).

### 14.15 Shortcuts

- Single consistent set (§11.3 UXS); discoverable via `?`; never conflict between surfaces.

---

## 15. Dashboard System

### 15.1 Dashboard Inventory

| Dashboard | Purpose (UXS §6) |
|---|---|
| Personal Dashboard | "What's mine today" |
| Workspace Dashboard | Today's operational health |
| Leader Dashboard | Delivery + risk per team |
| QA Dashboard | Verification pipeline |
| Stakeholder Dashboard | Business-facing, no engineering detail |
| Admin Dashboard | Operational control |
| Project Dashboard | Single-project health |
| Feature Dashboard | Single-feature health |
| Mission Control | Distance ops display |

### 15.2 Widget System

- **Anatomy:** header (title, meta, actions) + body + optional footer.
- **Grid:** 4-column master; widget spans 1–4; KPI strip above.
- **Lifecycle:** default layout (role/template) → user customization → saved layout (UXS §16.10).

### 15.3 Dashboard Customization

- Drag/reorder, resize, hide/collapse, save/reset; guaranteed widgets (KPI strip, at-risk list) non-removable (UXS §16.10).

### 15.4 Saved Layouts

- Per-user + role default; explicit save feedback; reset restores role default.

### 15.5 Responsive Behavior

- KPI strip scrolls horizontally; widgets stack; charts simplify; Mission Control desktop-only.

---

## 16. Data Visualization

### 16.1 Charts

- Chart family (§7.17): progress bar, burndown line, sparkline, bar/stacked, donut, timeline/gantt, dependency graph.
- Direct labels preferred; tooltips on hover/focus; click-through to data.

### 16.2 Heatmaps

- Optional (member load, activity by hour/day); sequential color ramp, colorblind-safe, labeled cells.

### 16.3 Burndown

- Remaining estimate vs. ideal line; points labeled; live updates; health-color only for status.

### 16.4 Velocity

- Bar per sprint vs. average reference line; history shown; context labels.

### 16.5 Progress

- Bar + numeric value always (§7.18); derive from status + feature-linked time (WPS §10.1).

### 16.6 Timelines

- Milestone/release/sprint windows; event markers; day gridlines; health-colored markers.

### 16.7 Dependency Graph

- Interactive nodes + directional edges; color by health; cycle detection (WPS §10.6).

### 16.8 Analytics Cards

- Compact stat + trend; one metric per card; unit and period labeled.

### 16.9 Metric Cards

- KPI strip items: label, large value, delta, trend sparkline.

### 16.10 KPI Cards

- Consistent anatomy across all dashboards; counters animate (§9.6); values click-through to source.

### 16.11 Export-Ready Layouts

- Reports/analytics render identically in-app and exported (PDF); colors print-safe; no interactive-only info.

---

## 17. Workspace Branding

### 17.1 Workspace Logos

- Square mark; rendered at sidebar/top-bar/Overview/report sizes; safe-area preserved; no effects.

### 17.2 Banners

- Wide image for Overview header; safe areas for text contrast; file policy (dimensions/format) defined in DTS/guidelines.

### 17.3 Accent Colors

- One curated accent per workspace (§3.3); derived variants; AA contrast enforced; health colors never replaced.

### 17.4 Themes

- Workspace theme = accent + branding; light/dark both supported; platform theme stays the foundation.

### 17.5 Custom Icons

- Workspace icon glyph from the platform set; no custom upload in v1 (consistent rendering).

### 17.6 Branding Restrictions

- Branding never alters semantic colors, typography hierarchy, or component behavior.
- Branding is Admin/Owner-managed (WPS §17.1); audit-logged.

### 17.7 Multi-Workspace Identity

- Each workspace reads distinctly via branding while the platform frame stays consistent — users always recognize "this is FocusFlow, containing Workspace X."

---

## 18. Future Evolution

### 18.1 Future Mobile Design System

- Same tokens (DTS) and component rules; touch-first variants; bottom sheets; simplified data density.

### 18.2 Desktop Application

- Same components; added: window chrome integration, multi-window split, native shortcuts, offline behavior.

### 18.3 Plugin Ecosystem

- Plugins consume the component vocabulary and tokens; no plugin may fork semantics; review gate for new surface patterns.

### 18.4 AI Surfaces

- AI features (WPS §18 Phase 4) render insights in existing surfaces (§15); AI never bypasses a11y or token rules.

### 18.5 Wearables (optional)

- Notifications/mission-critical status only; inherit health/semantic colors at reduced fidelity.

### 18.6 New Component Governance

- New components require: purpose, variants, anatomy, behavior, states, a11y, responsive, usage, do's/don'ts — added here before implementation.

### 18.7 Versioning Strategy

- The DSS version tracks breaking visual/interaction changes; additive changes bump minor; token values live in DTS (independently versioned).

### 18.8 Deprecation Policy

- Deprecate in three steps: mark deprecated (minor) → remove references (next major) → delete (one major later); migration notes required.

---

## Appendix

### A. Component Inventory Summary

| Component | Variants | Status |
|---|---|---|
| Buttons | 6 | v1.0 |
| Inputs | 10 | v1.0 |
| Search / Command Palette | 3 | v1.0 |
| Cards (project/feature/member/team/stat) | 5 | v1.0 |
| Tables / Data Grid | 3 | v1.0 |
| Tabs | 3 | v1.0 |
| Navigation (sidebar/top bar/breadcrumbs) | 3 | v1.0 |
| Charts | 7 | v1.0 |
| Badges / Avatars | 2 | v1.0 |
| Timeline | 1 | v1.1 (UXS §16.3) |
| Mission Control widgets | 7 | v1.0 |
| Empty states / Skeletons | 2 | v1.0 |

### B. Relationship to Other Documents

| Document | DSS Relationship |
|---|---|
| PRD (v1.0) | Product intent; DSS makes it visual |
| WPS (v1.1) | Structural/behavioral spec; DSS defines the design language |
| UXS (v1.1) | Screen/state/motion UX; DSS defines components + tokens' rules |
| DTS | Carries the concrete token values the DSS rules reference |

### C. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | Draft | Product | Initial complete Design System Specification |
| v1.1 | Draft | Product | Added governance appendices: Component Lifecycle (D), Component Ownership (E), Design Review Checklist (F), Component Deprecation Policy (G), Design Governance (H). No v1.0 chapters modified. |

### D. Component Lifecycle

Every component lives through a defined lifecycle. Components are only consumable in **Stable**; anything earlier is opt-in and must not spread across the application without explicit governance sign-off.

```
Experimental
    ↓
Beta
    ↓
Stable
    ↓
Deprecated
    ↓
Removed
```

| Stage | Meaning | Consumption Rule |
|---|---|---|
| **Planned** | Documented intent; not yet built | No usage |
| **Experimental** | Working but unvalidated; API may change | Opt-in only; flagged in UI; no production screens |
| **Beta** | Validated in real flows; API stabilizing | Allowed in limited production surfaces with owner sign-off |
| **Stable** | Fully specified (DSS §7), tested, a11y + responsive gated | Default — all surfaces may use |
| **Deprecated** | Replaced; kept for compatibility | No new usage; migration required (Appendix G) |
| **Removed** | Deleted from the system | None |

**Example status board:**

| Component | Status |
|---|---|
| Button | Stable |
| Card | Stable |
| Feature Card | Stable |
| Mission Control | Experimental |
| Dependency Graph | Beta |
| AI Insights Panel | Planned |

**Rules**

- A component cannot jump stages without a design review (Appendix H).
- Status is documented per component in the inventory (Appendix A) and in the component's own spec.
- New surfaces must prefer **Stable** components; using Beta/Experimental requires a noted exception.

### E. Component Ownership

Every reusable component has a single accountable **owner** (a person, team, or module). Ownership is about accountability for behavior, states, a11y, responsive behavior, and versioning — not about controlling contributions.

| Component | Owner |
|---|---|
| Buttons | Design System |
| Inputs | Design System |
| Cards | Design System |
| Charts | Analytics Module |
| Feature Cards | Workspace Module |
| Mission Control | Workspace Module |
| Command Palette | Platform Module |
| Markdown | Knowledge Base Module |

**Owner responsibilities**

- Maintain the component spec (DSS §7 anatomy) and status (Appendix D).
- Review proposed changes, variants, and cross-module usage.
- Own the migration plan when the component is deprecated (Appendix G).
- Be the escalation point for defects, a11y gaps, and ambiguous usage.

**Rules**

- Exactly **one** owner per component; no shared ownership.
- Cross-cutting changes (theming, a11y) still route through the owner for sign-off.
- If multiple modules contribute, the owner coordinates; this prevents drift when many developers contribute.

### F. Design Review Checklist

Every new screen (or significant change) must pass this checklist before it is considered done. This doubles as the **QA design checklist**.

| # | Check |
|---|---|
| 1 | Uses existing components (no bespoke UI) |
| 2 | Uses existing spacing tokens (DTS) |
| 3 | Uses the typography hierarchy (§4) |
| 4 | Accessible (WCAG 2.1 AA, §12) |
| 5 | Responsive across breakpoints (§11) |
| 6 | Dark mode verified (§3.11) |
| 7 | Keyboard navigation complete (§12) |
| 8 | Loading state defined (§7.28 skeletons) |
| 9 | Error state defined (§9.3 UXS) |
| 10 | Empty state defined (UXS §16.4) |
| 11 | Permission/access state defined (§9.5 UXS) |
| 12 | Motion rules followed (§9) |

**Process**

- Screens without a passing checklist do not ship.
- Checklist sign-off is recorded per screen; a reviewer other than the author signs off.
- New component patterns trigger the full component-gate (Appendix H) in addition to this checklist.

### G. Component Deprecation Policy

Whenever a component is replaced, follow the staged deprecation — never a hard swap.

1. **Mark Deprecated** — status updated; component still functional; no new usage permitted.
2. **Keep compatibility one major version** — existing consumers keep working; no breaking changes during this window.
3. **Provide a migration guide** — document old → new mapping, behavioral differences, and migration steps (mirrors DTS token migration).
4. **Remove only after the next major release** — deletion happens at a major version boundary, at least one major after deprecation was marked.

**Rules**

- Deprecation is announced and auditable; consumers are notified.
- Critical defects in a deprecated component are fixed until removal, but no new features are added.
- Usage must be swept before removal; remaining consumers block removal or receive an approved exception.

### H. Design Governance

#### H.1 How new components enter the design system

1. **Proposal** — identify a genuine gap (a screen cannot be composed from existing Stable components).
2. **Spec** — full DSS §7 entry: purpose, variants, anatomy, behavior, states, a11y, responsive, usage, do's/don'ts.
3. **Status assignment** — begins at Planned/Experimental (Appendix D) with an owner (Appendix E).

#### H.2 Review process

- **Design review** — cross-functional (design, frontend, QA, a11y) against DSS + UXS + DTS.
- **Token review** — any new visual value requires a DTS entry before implementation.

#### H.3 Approval process

- **Stable promotion** requires: passing the Design Review Checklist (F), a11y audit, responsive gate, and owner sign-off.
- **Exceptions** (using Beta/Experimental, per-feature styling) require written, dated approval logged to the design log.

#### H.4 Versioning

- **DSS** — additive changes bump minor; breaking visual/interaction changes bump major.
- **DTS** — value changes bump minor; renames bump major (DTS governs token semantics).
- Components track their own status independently (Appendix D).

#### H.5 Breaking changes

- Breaking changes require: deprecation first (Appendix G), a migration guide, a major version bump, and owner sign-off.
- No breaking change ships silently.

#### H.6 Migration process

- Migration guides are published at deprecation and maintained through removal.
- Cross-platform migration (web/mobile/desktop) is coordinated by the owning module.

#### H.7 Design audits

- Regular (quarterly) audits: component usage against inventory, token usage against DTS, accessibility spot-checks, dead/duplicate pattern sweep, checklist compliance.
- Audit findings enter the backlog as governance items with owners.

---

*End of document — FocusFlow DSS v1.1*
