import { PersonalFocusSessionPanel } from '../components/focus/PersonalFocusSessionPanel';

// ── PersonalFocusMode ────────────────────────────────────────────────────────
// The /personal/focus route hosts the Personal Focus Session Panel — the primary
// execution workspace for personal tasks. Mirrors the work /focus page but
// scoped to personal tasks and the personal store.

export function PersonalFocusMode() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PersonalFocusSessionPanel />
    </div>
  );
}