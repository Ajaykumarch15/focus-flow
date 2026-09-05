import { PersonalActivityTimeline } from '@personal/components/PersonalActivityTimeline';

// ── PersonalActivityPage (S1-T7) ──────────────────────────────────────────────
// Mount point for the Personal Activity Timeline at /activity. All logic lives
// in the component + pure selectors; this wrapper exists only so the route has
// a stable, independently testable page.
export function PersonalActivityPage() {
  return <PersonalActivityTimeline />;
}
