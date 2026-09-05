import type { DecisionItem, StructuredBlocker } from '@worklog/services/useWorkLogStore';

// ── S2-T2: Focus shell capture intent helpers (ECIS §B.3 · DCX §2) ────────────
// Pure, side-effect free helpers for the inline blocker / decision capture that
// appears on an intentional pause of a focus session. The panel renders only
// when the session is paused and a linked work log exists — never during flow.
// The payload builders shape drafts exactly for workLogs.addBlocker / addDecision.

export type CaptureKind = 'blocker' | 'decision';

export interface BlockerDraft {
  title: string;
  severity: StructuredBlocker['severity'] | '';
  notes: string;
}

export interface DecisionDraft {
  title: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: string;
}

export type BlockerPayload = Omit<StructuredBlocker, '_id' | 'createdAt'>;
export type DecisionPayload = Omit<DecisionItem, '_id' | 'timestamp'>;

const DEFAULT_SEVERITY: StructuredBlocker['severity'] = 'medium';

export function buildBlockerPayload(draft: BlockerDraft): BlockerPayload {
  return {
    title: draft.title.trim(),
    severity: draft.severity === '' ? DEFAULT_SEVERITY : draft.severity,
    status: 'open',
    notes: draft.notes.trim(),
  };
}

export function buildDecisionPayload(draft: DecisionDraft): DecisionPayload {
  return {
    title: draft.title.trim(),
    context: draft.context.trim(),
    decision: draft.decision.trim(),
    rationale: draft.rationale.trim(),
    alternatives: draft.alternatives.trim(),
  };
}

export function canCaptureOnPause(paused: boolean, workLogId: string | null): boolean {
  return paused && workLogId !== null && workLogId !== '';
}
