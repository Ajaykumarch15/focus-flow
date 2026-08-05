import { FocusSessionPanel } from '../components/focus/FocusSessionPanel';
import { EngineeringMemoryPanel } from '../components/memory/EngineeringMemoryPanel';

// ── FocusMode (S1-T5 + S1-T6) ────────────────────────────────────────────────
// The /focus route hosts the Focus Session Panel — the primary execution
// workspace — beside the Engineering Memory panel. The responsive grid stacks
// both columns on narrow screens and splits them on xl+ screens. Both panels
// own their data fetching and reuse the existing stores/APIs; this page stays
// a thin mount so the route, lazy chunk and navigation labels remain unchanged.

export function FocusMode() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
      <FocusSessionPanel />
      <div className="p-6 lg:p-8">
        <EngineeringMemoryPanel />
      </div>
    </div>
  );
}
