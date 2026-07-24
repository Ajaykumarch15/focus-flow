# Implementation Plan: Skeleton Loading States

## Goal
Replace full-page spinners and empty loading states with skeleton placeholder components that mirror the actual page layout, providing better perceived performance.

## Approach

### 1. Create Reusable Skeleton Component
**File:** `src/components/ui/Skeleton.tsx` (NEW)

A primitive `Skeleton` component with Tailwind pulse animation, plus pre-built layout variants:

```tsx
// Primitive: animated placeholder block
<Skeleton className="h-4 w-32 rounded" />

// Pre-built variants:
<SkeletonText lines={3} />
<SkeletonCard />        // Generic card shape
<SkeletonCircle size={40} />
<SkeletonStatCard />    // Matches the stat card pattern used across pages
```

- Uses `bg-surface-800 animate-pulse rounded-xl` to match the dark theme
- All variants accept `className` for override

### 2. Create Page-Level Skeleton Layouts
For each page that needs skeletons, create a dedicated skeleton layout component (co-located or in the same file) that mirrors the real page structure.

### 3. Wire Up Loading States
Replace existing spinner/text loading indicators with skeleton components. For pages that currently have NO loading state, add a `dataLoading` check from the store.

---

## Pages to Update (8 pages)

### Priority 1 — Complex layouts with existing spinners

| Page | Current Pattern | Skeleton Layout Needed |
|------|----------------|----------------------|
| **Leaderboard** | Full-page Loader2 | Podium (3 cards of different heights) + user list rows |
| **Admin** | Full-page Loader2 | 4 stat cards + user/team card grid |
| **Reports** | Loader2 in DayDetail | Calendar grid + stat cards + day list cards |
| **ShareReport** | Full-page Loader2 | 4 stat cards + work log cards |
| **WorkLog** | Loader2 centered | Header + work log card skeletons |

### Priority 2 — Pages with no loading state (cache-first, but benefit from skeletons)

| Page | Current Pattern | Skeleton Layout Needed |
|------|----------------|----------------------|
| **Dashboard** | None (cached) | 4 stat cards + progress bar + task cards + chart placeholder |
| **Analytics** | None (loading tracked but unused) | 4 stat cards + 4 chart card placeholders + top tasks bars |
| **Habits** | Text "Loading habits..." | 3 stat cards + habit card skeletons |

### Pages NOT Updated (keep as-is)
- **Landing** — Static page, no data loading
- **Login/Register** — Button spinners are sufficient for auth forms
- **FocusMode** — Loads instantly from store
- **Settings** — Form-based, loads instantly from store
- **TaskDetail** — Loads synchronously from store
- **ProtectedRoute/App** — Brief session restore, spinner is fine
- **Journal** — Simple card list, cached from store

---

## File Change Summary

| File | Change | Description |
|------|--------|-------------|
| `src/components/ui/Skeleton.tsx` | **CREATE** | Reusable skeleton primitives + layout variants |
| `src/pages/Dashboard.tsx` | MODIFY | Add skeleton layout for initial load |
| `src/pages/Analytics.tsx` | MODIFY | Wire up existing `loading` state with skeleton |
| `src/pages/Leaderboard.tsx` | MODIFY | Replace Loader2 spinner with podium + list skeleton |
| `src/pages/Admin.tsx` | MODIFY | Replace Loader2 spinners with stat + card grid skeleton |
| `src/pages/Reports.tsx` | MODIFY | Replace DayDetail spinner with skeleton layout |
| `src/pages/ShareReport.tsx` | MODIFY | Replace full-page spinner with skeleton layout |
| `src/pages/WorkLog.tsx` | MODIFY | Replace centered spinner with skeleton cards |
| `src/pages/Habits.tsx` | MODIFY | Replace "Loading habits..." text with skeleton layout |

## Implementation Order

1. Create `src/components/ui/Skeleton.tsx` — all primitives and variant components
2. Dashboard skeleton — highest traffic page
3. Analytics skeleton — complex chart layout
4. Leaderboard skeleton — podium + list
5. Admin skeleton — stats + grid
6. Reports skeleton — calendar + details
7. ShareReport skeleton — public page
8. WorkLog skeleton — card list
9. Habits skeleton — stats + cards
10. Run `npm run build` to verify
