// EEP2-P4.1.3 / DDS §6.1 + §10: the Sprint lifecycle state machine.
//
// Vocabulary (draft → planned → active → completed): a sprint is born as a
// `draft` (scope being planned), is latched into `planned` by the commit
// endpoint (P4.1.4), then advances `active` → `completed`. DDS §6.1 allows a
// completed sprint to reopen to `active`. Transitions are strict — states
// cannot be skipped (draft → active, draft → completed and planned →
// completed are all rejected with a clear 400).
//
// Guards (DDS §6.1):
//   • planned → active requires `now >= startDate` — a sprint cannot start
//     before its time-box begins.
//   • there is deliberately NO time guard on active → completed (early or late
//     completion is a legitimate plan/execution decision).
//
// The module is pure and deterministic: pass an explicit `now` for tests.
'use strict';

const { httpError } = require('./validation');

const SPRINT_STATUSES = ['draft', 'planned', 'active', 'completed'];

const TRANSITIONS = {
  draft: ['planned'],
  planned: ['active'],
  active: ['completed'],
  completed: ['active'], // reopen
};

function isSprintStatus(status) {
  return SPRINT_STATUSES.includes(status);
}

function nextStatuses(from) {
  return isSprintStatus(from) ? [...TRANSITIONS[from]] : [];
}

function canTransition(from, to) {
  return isSprintStatus(from) && TRANSITIONS[from].includes(to);
}

/**
 * Throws an HTTP 400 unless `from → to` is a legal, guard-passing transition.
 * Returns `{ from, to }` on success.
 */
function assertTransition(from, to, { now = Date.now(), startDate } = {}) {
  if (!isSprintStatus(from)) {
    throw httpError(400, 'INVALID_STATUS', `Unknown sprint status: ${from}`);
  }
  if (!isSprintStatus(to)) {
    throw httpError(400, 'INVALID_STATUS', `Unknown sprint status: ${to}`);
  }
  if (!canTransition(from, to)) {
    const allowed = TRANSITIONS[from].length ? TRANSITIONS[from].join(', ') : 'none';
    throw httpError(
      400,
      'INVALID_TRANSITION',
      `Invalid sprint status transition ${from} → ${to} (sprints cannot skip states; allowed: ${allowed})`
    );
  }
  if (to === 'active' && from === 'planned' && startDate && now < new Date(startDate).getTime()) {
    throw httpError(400, 'SPRINT_NOT_STARTED', 'Sprint cannot start before its startDate');
  }
  return { from, to };
}

module.exports = {
  SPRINT_STATUSES,
  TRANSITIONS,
  isSprintStatus,
  nextStatuses,
  canTransition,
  assertTransition,
};
