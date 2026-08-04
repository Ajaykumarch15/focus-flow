/**
 * pomodoro.ts — Pure pomodoro math shared by FocusMode.
 *
 * FocusMode is a mode over the timerEngine: the focus (work) portion of a
 * pomodoro runs through the engine and records a real session. These helpers
 * keep the countdown/progress derivation pure and unit-testable.
 */

/** Remaining time (ms) in a session given elapsed (ms). Never negative. */
export function pomodoroTimeLeft(durationMs: number, elapsedMs: number): number {
  return Math.max(0, durationMs - elapsedMs);
}

/** Progress 0..100 given elapsed (ms) against a session duration (ms). */
export function pomodoroProgress(durationMs: number, elapsedMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100));
}

/** True when a session has fully elapsed its duration (ms). */
export function isPomodoroComplete(durationMs: number, elapsedMs: number): boolean {
  return durationMs > 0 && elapsedMs >= durationMs;
}
