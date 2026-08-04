# FocusFlow — Design Token Specification (DTS)

**Product Name:** FocusFlow
**Document Type:** Design Token Specification (DTS)
**Supersedes:** N/A — carries the reusable *values* behind the Design System Specification (DSS v1.0)
**Source of Truth:** FocusFlow DSS (v1.0); FocusFlow UXS (v1.1); FocusFlow WPS (v1.1); FocusFlow PRD (v1.0)
**Audience:** Designers, Frontend Engineers, Design System Engineers, QA Engineers, future web/mobile/desktop teams
**Status:** Draft v1.1
**Scope:** Platform-agnostic design tokens — colors, typography, spacing, radii, shadows, motion, z-index, sizing, and iconography. The DSS defines **the rules**; this document defines **the reusable values**. No code, no JSON payloads, no CSS — tokens are specified as name/value documentation so any platform (web, mobile, desktop) can consume them independently.

---

## 1. Purpose & Relationship

- **DSS** answers *how* FocusFlow looks and behaves (rules, components, semantics).
- **DTS** answers *with what values* — the shared primitives that keep web, mobile, and future desktop apps visually consistent while each implementation evolves independently.
- Every token has: **name**, **category**, **value(s)** (dark/light where applicable), and **usage**.
- Token changes are additive by default; value changes bump the DTS version without touching the DSS.

## 2. Token Model

### 2.1 Naming Convention

```
<category>-<semantic>[-<modifier>]

Examples:
  color-bg-canvas          → background
  color-accent-default     → accent primary
  space-lg                 → 24 px spacing step
  type-body-14             → body size token
  radius-card              → card corner radius
  elevation-float          → floating elevation shadow
  motion-duration-200      → 200 ms transition
  zindex-overlay           → overlay layer
```

### 2.2 Categories

| Category | Prefix | Contents |
|---|---|---|
| Color | `color-` | Semantic, brand, accent, neutral, chart, status, priority, surface |
| Typography | `type-` | Families, sizes, weights, line-heights, letter-spacing |
| Spacing | `space-` | The base-4 spacing scale |
| Radius | `radius-` | Corner radii for components/surfaces |
| Elevation | `elevation-` | Surface + shadow definitions |
| Motion | `motion-` | Durations, curves, easing |
| Z-Index | `zindex-` | Layer stack |
| Size | `size-` | Component hit targets, icon sizes, avatar sizes |
| Iconography | `icon-` | Stroke, sizes, grid |

### 2.3 Primitive vs Semantic

- **Primitive** (raw): `gray-600`, `blue-500` — shared raw values.
- **Semantic** (meaning): `color-text-primary`, `color-health-blocked` — map to primitives and carry meaning.
- Implementations consume **semantic** tokens; primitives change only via the DTS, never per-app.

---

## 3. Color Tokens

### 3.1 Semantic Colors (both themes)

| Token | Dark | Light | Usage |
|---|---|---|---|
| `color-success` | green-500 | green-600 | Verified, shipped, Healthy |
| `color-warning` | amber-400 | amber-600 | At Risk, overdue |
| `color-danger` | red-500 | red-600 | Blocked, error, destructive |
| `color-info` | blue-400 | blue-600 | Waiting, announcements |
| `color-health-planned` | gray-400 | gray-500 | Planned |
| `color-success-contrast` | dark text | light text | Text on success fills |
| `color-warning-contrast` | dark text | light text | Text on warning fills |
| `color-danger-contrast` | white text | white text | Text on danger fills |

### 3.2 Brand Colors

| Token | Value | Usage |
|---|---|---|
| `color-brand-primary` | brand hue (dark) | Mark, primary actions |
| `color-brand-primary-hover` | darkened | Hover/pressed |
| `color-brand-primary-active` | darkened further | Active |
| `color-brand-on-primary` | contrast | Text on brand fill |
| `color-brand-support` | support tone | Emphasis, never status |

### 3.3 Workspace Accent (derived from one seed)

| Token | Derivation | Usage |
|---|---|---|
| `color-accent-default` | seed hue | Links, active nav, primary actions |
| `color-accent-hover` | seed −light | Hover |
| `color-accent-pressed` | seed −light | Pressed |
| `color-accent-on-accent` | computed contrast | Text/icons on accent fills |
| `color-accent-subtle` | seed +alpha | Background tints, selected states |

### 3.4 Neutral Palette

| Token | Dark | Light | Usage |
|---|---|---|---|
| `color-bg-canvas` | gray-950 | white | App background |
| `color-surface-raised` | gray-900 | gray-50 | Cards, panels |
| `color-surface-floating` | gray-850 | white | Popovers, menus, dialogs |
| `color-surface-overlay` | gray-950 @60% | black @40% | Scrim |
| `color-border-subtle` | gray-800 | gray-200 | Hairlines, dividers |
| `color-border-strong` | gray-600 | gray-400 | Emphasis borders |
| `color-text-primary` | gray-50 | gray-900 | Primary text |
| `color-text-secondary` | gray-300 | gray-600 | Muted text |
| `color-text-tertiary` | gray-500 | gray-500 | Placeholders |
| `color-text-disabled` | gray-600 | gray-400 | Disabled text |
| `color-text-inverse` | white | gray-950 | Inverse surfaces |

### 3.5 Mission Control Palette (dark, distance-tuned)

| Token | Value | Usage |
|---|---|---|
| `color-mc-bg` | near-black | Fullscreen background |
| `color-mc-surface` | dark raised | Widget panels |
| `color-mc-border` | subtle bright | Widget borders (visible at distance) |
| `color-mc-text-primary` | bright white | Headline values |
| `color-mc-text-secondary` | muted bright | Labels |
| Health tokens reuse §3.1 at higher intensity | | |

### 3.6 Chart Colors

| Token | Value | Usage |
|---|---|---|
| `color-chart-1 … 8` | categorical hues (colorblind-safe) | Series |
| `color-chart-seq-min / -max` | sequential ramp ends | Heatmaps |
| `color-chart-div-neg / -pos` | diverging ramp | Diverging data |
| `color-chart-grid` | neutral hairline | Chart gridlines |
| `color-chart-axis` | neutral | Axis lines |

### 3.7 Status & Health (companion shapes, not color-only)

| Token | Value | Note |
|---|---|---|
| `color-health-*` | §3.1 | Semantic health colors |
| `color-priority-p0 / p1 / p2` | danger / warning / neutral | Priority via intensity + label |

---

## 4. Typography Tokens

| Token | Size | Weight | Line-height | Usage |
|---|---|---|---|---|
| `type-display` | 24–28 px | 700 | 1.2 | Page titles |
| `type-h2` | 18 px | 600 | 1.3 | Section headings |
| `type-h3` | 16 px | 600 | 1.3 | Card titles |
| `type-body` | 13–14 px | 400 | 1.5 | Default text |
| `type-body-medium` | 13–14 px | 500 | 1.5 | Emphasized body |
| `type-label` | 11–12 px | 500 | 1.4 | Meta, badges, tooltips |
| `type-mono` | 12–13 px | 400 | 1.5 | Code, IDs, data |
| `type-mc-display` | 28–64 px | 700 | 1.1 | Mission Control |

| Token | Value | Usage |
|---|---|---|
| `font-family-sans` | system-ui stack | UI text |
| `font-family-mono` | bundled mono | Code, data |
| `type-weight-regular / medium / semibold / bold` | 400 / 500 / 600 / 700 | Weights |
| `type-tabular` | tabular numerals | Tables, KPI |
| `type-reading-measure` | 60–80 ch | KB, reports |

---

## 5. Spacing Tokens

| Token | Value | Usage |
|---|---|---|
| `space-xs` | 4 px | Icon insets, label gaps |
| `space-sm` | 8 px | Row gaps, chip gaps |
| `space-md` | 12 px | Grouped controls |
| `space-lg` | 16 px | Card padding, section gaps |
| `space-xl` | 24 px | Between widgets/cards |
| `space-2xl` | 32 px | Between page sections |
| `space-3xl` | 48 px | Page gutters, modal padding |

| Token | Value | Usage |
|---|---|---|
| `grid-cols-desktop / tablet / mobile` | 12 / 8 / 4 | Column grids |
| `grid-gutter` | 16 px | Base gutter |
| `grid-gutter-wide` | 24 px | Wide dashboards |
| `container-content-max` | 1600 px | Max content width |
| `container-read-max` | 72–80 ch | Reading measure |

---

## 6. Radius Tokens

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4 px | Chips, badges, inputs |
| `radius-md` | 6 px | Buttons, cards, panels |
| `radius-lg` | 8 px | Dialogs, drawers |
| `radius-xl` | 12 px | Bottom sheets, large surfaces |
| `radius-pill` | 999 px | Pills, avatars |
| `radius-mc` | 4 px | Mission Control widgets (sharp) |

---

## 7. Elevation & Shadow Tokens

| Token | Value | Usage |
|---|---|---|
| `elevation-ground` | none (border) | App background |
| `elevation-raised` | hairline border, no shadow | Cards, panels |
| `elevation-floating` | border + soft shadow (ambient + key) | Popovers, menus, toasts |
| `elevation-overlay` | floating + scrim | Dialogs, drawers, sheets |
| `elevation-drag` | elevated shadow | Dragged cards |

Shadows defined in both themes (light shadows differ from dark); token carries the correct per-theme values.

---

## 8. Motion Tokens

| Token | Value | Usage |
|---|---|---|
| `motion-duration-50` | 50 ms | Press, focus |
| `motion-duration-150` | 150 ms | Hover, page transition |
| `motion-duration-200` | 200 ms | UI state, panels, toasts |
| `motion-duration-250` | 250 ms | Dialogs, overlays |
| `motion-duration-300` | 300 ms | Progress fill, counters |
| `motion-curve-ease-out` | ease-out | Default |
| `motion-curve-spring-subtle` | subtle spring | Drag drop, lift |
| `motion-reduce` | off | Reduced-motion override |

---

## 9. Z-Index Tokens

| Token | Value | Usage |
|---|---|---|
| `zindex-base` | 0 | Page content |
| `zindex-sticky` | 10 | Sticky headers, toasts stack |
| `zindex-popover` | 20 | Menus, tooltips, palette |
| `zindex-drawer` | 30 | Drawers, sheets |
| `zindex-overlay` | 40 | Dialogs, scrims |
| `zindex-mission-control` | 50 | Fullscreen Mission Control |
| `zindex-toast` | 60 | Toasts above overlays |

---

## 10. Size Tokens

| Token | Value | Usage |
|---|---|---|
| `size-target-min` | 32 px | Desktop interactive |
| `size-target-touch` | 44 px | Touch targets |
| `size-icon-sm / md / lg` | 16 / 20 / 24 px | Icons |
| `size-avatar-xs / sm / md / lg / xl` | 16 / 20 / 24 / 32 / 40 px | Avatars |
| `size-button-min-h` | 32 px | Button height |
| `size-input-min-h` | 32 px | Input height |

---

## 11. Iconography Tokens

| Token | Value | Usage |
|---|---|---|
| `icon-stroke` | 1.5–2 px | Stroke weight |
| `icon-grid` | 24 px | Design grid, optical alignment |
| `icon-set-style` | stroke, rounded | Style rule |
| `icon-semantic-family` | separate filled set | Status icons |

---

## 12. Token Governance

- **Semantic over primitive:** implementations reference semantic tokens; primitives are internal.
- **Aliasing:** semantic tokens alias primitives in one place (the DTS), so a single value change propagates across surfaces and platforms.
- **Versioning:** additive changes bump minor; value changes bump minor (consumers pick up via tooling); breaking renames bump major. DSS and DTS version independently.
- **Theming:** dark/light are token **value sets** over the same semantic names; future themes (high-contrast, OLED) add value sets, never new names.
- **Review gate:** new tokens require a DTS entry + DSS usage note before adoption (matches DSS §18.6).

---

## Appendix

### A. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | Draft | Product | Initial Design Token Specification |
| v1.1 | Draft | Product | Added Appendix B: Token Aliasing Strategy, Platform Overrides, Token Audit Rules, Token Migration Guide, Token Validation Rules. No v1.0 sections modified. |

### B. Token Governance & Operations

#### B.1 Token Aliasing Strategy

Tokens resolve through an explicit **four-layer aliasing hierarchy**. Lower layers are the raw storage; higher layers carry meaning. Implementations consume **Application** tokens only; nothing consumes primitives directly.

```
Primitive
    ↓
Semantic
    ↓
Component
    ↓
Application
```

| Layer | Example | Purpose |
|---|---|---|
| **Primitive** | `gray-900` | Raw value; the only place concrete numbers live |
| **Semantic** | `surface-raised` | Meaning within the platform (§3.4) |
| **Component** | `card-background` | Value bound to a component's anatomy (§7 DSS) |
| **Application** | `project-card` | Value bound to a specific surface (a Project Card) |

```
gray-900
    ↓
Surface Raised
    ↓
Card Background
    ↓
Project Card
```

**Rules**

- Aliasing is **one-directional** (primitive → application); applications never reference lower layers directly.
- The mapping is documented in the DTS and maintained centrally, so a single primitive change propagates without touching apps.
- Each alias step may add theme/context resolution (dark/light, hover/focus) without new names.

#### B.2 Platform Overrides

Semantic names are **identical across platforms**; values may differ where platform ergonomics require it. Semantic names never change per platform.

| Aspect | Rule |
|---|---|
| **Semantic name** | Identical on web, mobile, desktop — never overridden |
| **Value** | May differ within documented bounds (e.g., spacing, touch targets) |
| **Override list** | Only tokens explicitly listed may differ; everything else is lockstep |

**Example — spacing override:**

| Token | Web/Desktop | Mobile | Note |
|---|---|---|---|
| `space-lg` | 16 px | 12 px | Touch density |
| Semantic name | `space-lg` | `space-lg` | **Same everywhere** |

**Documented override domains**

- **Spacing:** density compression on mobile (compact grids, tighter gutters).
- **Touch targets:** `size-target-*` raise on mobile (§10).
- **Typography:** body may drop to 12.5–13 px on mobile; Mission Control scale grows with viewport.
- **Elevation:** mobile uses elevation more sparingly (bottom sheets over floating panels).
- **Motion:** mobile shortens durations by up to 25% (perceived responsiveness); reduced-motion honored everywhere.

**Rules**

- Any platform override must be recorded here before it ships.
- An override may change a value — never the semantic meaning (health colors, semantic roles are override-proof).

#### B.3 Token Audit Rules

Tokens are audited on a regular cadence (aligned with DSS §H.7 design audits). The audit tracks:

| Category | Check |
|---|---|
| **Unused tokens** | Tokens with no consumer; candidates for removal |
| **Deprecated tokens** | Tokens marked deprecated but still referenced |
| **Duplicate tokens** | Two tokens resolving to the same value/meaning; collapse |
| **Platform differences** | Overrides drift outside the documented domains (B.2) |
| **Version history** | Every token's value history, aliases, and migrations are recorded |

**Rules**

- Unused tokens are deprecated (not silently deleted) per the migration guide (B.4).
- Duplicates are consolidated through an alias, never by hard-swapping consumers.
- Audit results are reported per design review; findings are tracked with owners.

#### B.4 Token Migration Guide

Whenever a token changes, document the migration as a first-class record.

| Field | Content |
|---|---|
| **Old** | The deprecated token name + value |
| **New** | The replacement token name + value |
| **Migration** | The mapping/alias and any behavioral notes |
| **Breaking?** | Whether consumers must change (renames are breaking; value-only changes are not) |

**Migration flow**

```
Old
 ↓
New
 ↓
Migration guide published
 ↓
Breaking? → Yes → major bump + deprecation window
         → No  → minor bump, alias in place
```

**Rules**

- Migrations are additive first: ship the new token + alias, verify consumers, then deprecate the old.
- A migration is not complete until the old token is unreferenced and removed at the next major.
- Migration records are kept for the full deprecation window (matches DSS Appendix G).

#### B.5 Token Validation Rules

Every token must satisfy **all** of the following before adoption:

| Rule | Requirement |
|---|---|
| **Unique** | Name is unique; no duplicate semantics |
| **Semantic** | Name expresses meaning, not raw value (`surface-raised`, never `gray-900`) at the semantic layer |
| **Reusable** | Used by more than one context, or justified as a deliberate exception |
| **Platform independent** | Name and meaning hold across web/mobile/desktop; platform differences live in overrides (B.2) |
| **Accessible** | Color tokens pass AA contrast in both themes; values verified against §3.12 (DSS) |
| **Versioned** | Entry in the DTS with version history; changes follow B.4 |

**Rules**

- New tokens are proposed with all six checks; a failing check blocks adoption (review gate, §12).
- Validation is re-run during audits (B.3) for existing tokens.

---

*End of document — FocusFlow DTS v1.1*
