import { FocusSessionPanel } from '../components/focus/FocusSessionPanel';

// ── FocusMode (S1-T5) ─────────────────────────────────────────────────────────
// The /focus route now hosts the Focus Session Panel — the primary execution
// workspace. All session control, context resolution and work-log/note wiring
// lives in FocusSessionPanel and reuses the existing timerEngine store actions;
// this page stays a thin mount so the route, lazy chunk and navigation labels
// remain unchanged.

export function FocusMode() {
  return <FocusSessionPanel />;
}
