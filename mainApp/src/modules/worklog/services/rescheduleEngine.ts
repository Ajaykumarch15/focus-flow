/**
 * rescheduleEngine.ts — Pure, unit-testable rescheduling algorithms.
 *
 * Given an extended (currently running / overtime) schedule item plus the rest
 * of that day's schedule, each strategy produces a RescheduleProposal: a list
 * of slot changes, detected conflicts, and warnings. Nothing here performs IO
 * or mutates state — callers apply the changes only after user confirmation.
 *
 * All math is in minutes-since-midnight. End times <= start times are treated
 * as midnight-crossing (rule #7) and normalized by adding 1440.
 */

import {
  ScheduleItem,
  RescheduleProposal,
  RescheduleStrategy,
  RescheduleItemChange,
} from '@shared/types';
import { timeToMinutes } from './scheduleAnalytics';

export interface RescheduleInput {
  /** The schedule item being extended */
  scheduleId: string;
  /** Additional minutes requested for the target slot */
  extraMinutes: number;
  /** All same-day schedule items for the target's date (any status) */
  schedules: ScheduleItem[];
  /** Resolve a display title for a schedule's task (populated object or store lookup) */
  resolveTaskTitle: (s: ScheduleItem) => string;
  /** Working hours in minutes-since-midnight */
  workStartMins: number;
  workEndMins: number;
  /** Minimum duration a flexible task may shrink to (default 15) */
  minDurationMins?: number;
}

interface Interval { st: number; e: number; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startMins(s: ScheduleItem): number {
  return timeToMinutes(s.startTime);
}

/** Normalized end in minutes, handling midnight-crossing slots */
function endMins(s: ScheduleItem): number {
  const st = startMins(s);
  let e = timeToMinutes(s.endTime);
  if (e <= st) e += 1440;
  return e;
}

/** Item occupies real time on the plan (not cancelled / completed / skipped) */
function isLive(s: ScheduleItem): boolean {
  return s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'skipped';
}

/** Items the engine must never move: locked/fixed events and running tasks */
function isImmovable(s: ScheduleItem): boolean {
  return !!s.locked || s.status === 'in-progress';
}

/** Movable = live future work the user has not locked */
function isMovable(s: ScheduleItem): boolean {
  return isLive(s) && !isImmovable(s);
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.st < b.e && a.e > b.st;
}

const DE_PRIORITIES: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

/** Priority of a schedule's task (populated or not) */
function priorityOf(item: ScheduleItem): number {
  const t = item.taskId;
  const p = (typeof t === 'object' && t !== null ? (t as { priority?: string }).priority : undefined) || 'medium';
  return DE_PRIORITIES[p] || 2;
}

function minsToTime(mins: number): string {
  // Cap at 23:59 — the schema rejects >= 24:00
  const clamped = Math.max(0, Math.min(1439, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function describeOverlap(aTitle: string, a: Interval, bTitle: string, b: Interval, date: string): string {
  const lo = Math.max(a.st, b.st);
  const hi = Math.min(a.e, b.e);
  return `"${aTitle}" (${minsToTime(a.st)}–${minsToTime(a.e)}) would overlap fixed/running "${bTitle}" (${minsToTime(b.st)}–${minsToTime(b.e)}) on ${date} from ${minsToTime(lo)} to ${minsToTime(hi)}`;
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/** Base proposal fields shared by all strategies */
function buildBase(input: RescheduleInput) {
  const target = input.schedules.find(s => s._id === input.scheduleId);
  if (!target) return null;
  const extra = Math.floor(input.extraMinutes);
  if (!Number.isFinite(extra) || extra < 1) return null;
  const origEnd = endMins(target);
  const newEndRaw = origEnd + extra;
  return { target, extra, origEnd, newEndRaw };
}

function toChange(
  s: ScheduleItem,
  st: number,
  e: number,
  kind: RescheduleItemChange['kind'],
  input: RescheduleInput,
  extraFields: Partial<RescheduleItemChange> = {},
): RescheduleItemChange {
  return {
    scheduleId: s._id,
    taskTitle: input.resolveTaskTitle(s),
    kind,
    from: { date: s.date, startTime: s.startTime, endTime: s.endTime },
    to: { date: s.date, startTime: minsToTime(st), endTime: minsToTime(e) },
    ...extraFields,
  };
}

/** Shared post-processing: working-hours overflow */
function withWorkHours(proposal: RescheduleProposal, input: RescheduleInput): RescheduleProposal {
  const over = proposal.changes.filter(c => timeToMinutes(c.to.endTime) > input.workEndMins);
  proposal.beyondWorkHours = over.length > 0;
  if (proposal.beyondWorkHours) {
    proposal.warnings.push(
      `Extension pushes ${over.map(c => `"${c.taskTitle}"`).join(', ')} beyond working hours (${minsToTime(input.workEndMins)}).`,
    );
  }
  return proposal;
}

// ---------------------------------------------------------------------------
// Option 1: Sequentially shift all affected tasks
// ---------------------------------------------------------------------------

export function proposeShiftAll(input: RescheduleInput): RescheduleProposal | null {
  const base = buildBase(input);
  if (!base) return null;
  const { target, extra, origEnd, newEndRaw } = base;

  const changes: RescheduleItemChange[] = [
    toChange(target, startMins(target), newEndRaw, 'extended', input),
  ];
  const conflicts: string[] = [];
  const warnings: string[] = [];

  // Subsequent live movable items (start at/after the target's original end),
  // shifted as a block. Locked/fixed items are NOT moved — overlaps with them
  // are reported as conflicts below.
  const subsequent = input.schedules
    .filter(s => s._id !== target._id && isMovable(s) && startMins(s) >= origEnd)
    .sort((a, b) => startMins(a) - startMins(b));

  // Immutable slots these shifted items must not crash into
  const immovable = input.schedules.filter(s => isImmovable(s) && isLive(s) && s._id !== target._id);

  // The new extended slot must not overlap an immovable item either
  const extendedInterval: Interval = { st: startMins(target), e: newEndRaw };
  for (const im of immovable) {
    const imIv: Interval = { st: startMins(im), e: endMins(im) };
    if (overlaps(extendedInterval, imIv)) {
      conflicts.push(describeOverlap(input.resolveTaskTitle(target), extendedInterval, input.resolveTaskTitle(im), imIv, target.date));
    }
  }

  for (const s of subsequent) {
    const st = startMins(s) + extra;
    const e = endMins(s) + extra;
    changes.push(toChange(s, st, e, 'shifted', input));
    const shiftedIv: Interval = { st, e };
    for (const im of immovable) {
      const imIv: Interval = { st: startMins(im), e: endMins(im) };
      if (overlaps(shiftedIv, imIv)) {
        conflicts.push(describeOverlap(input.resolveTaskTitle(s), shiftedIv, input.resolveTaskTitle(im), imIv, s.date));
      }
    }
  }

  const proposal: RescheduleProposal = {
    strategy: 'shift-all',
    beyondWorkHours: false,
    scheduleId: target._id,
    extraMinutes: extra,
    changes,
    conflicts,
    warnings,
    totalExtraMins: extra,
  };
  if (conflicts.length > 0) {
    warnings.push('Fixed/locked or running tasks conflict with the shift. Unlock them or use another strategy.');
  }
  return withWorkHours(proposal, input);
}

// ---------------------------------------------------------------------------
// Option 2: Move conflicting tasks to new available slots
// ---------------------------------------------------------------------------

export function proposeRelocate(input: RescheduleInput): RescheduleProposal | null {
  const base = buildBase(input);
  if (!base) return null;
  const { target, extra, newEndRaw } = base;
  const changes: RescheduleItemChange[] = [
    toChange(target, startMins(target), newEndRaw, 'extended', input),
  ];
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const extendedIv: Interval = { st: startMins(target), e: newEndRaw };

  // Everything that stays put (immovable first, then non-conflicting live items)
  const stays = input.schedules.filter(s => {
    if (s._id === target._id || !isLive(s)) return false;
    const iv: Interval = { st: startMins(s), e: endMins(s) };
    return !overlaps(extendedIv, iv);
  });

  const directlyConflicting = input.schedules
    .filter(s => {
      if (s._id === target._id || !isLive(s)) return false;
      return overlaps(extendedIv, { st: startMins(s), e: endMins(s) });
    })
    .sort((a, b) => startMins(a) - startMins(b));

  // Busy map = immovable items + items that stay (deduped)
  const busy: Interval[] = [];
  const busyOwner: string[] = [];
  for (const s of input.schedules) {
    if (s._id === target._id || !isLive(s)) continue;
    if (isImmovable(s)) {
      busy.push({ st: startMins(s), e: endMins(s) });
      busyOwner.push(input.resolveTaskTitle(s));
    }
  }
  for (const s of stays) {
    busy.push({ st: startMins(s), e: endMins(s) });
    busyOwner.push(input.resolveTaskTitle(s));
  }
  busy.push({ st: extendedIv.st, e: extendedIv.e });
  busyOwner.push(input.resolveTaskTitle(target));
  busy.sort((a, b) => a.st - b.st);

  for (const s of directlyConflicting) {
    const title = input.resolveTaskTitle(s);
    const d = endMins(s) - startMins(s);

    if (isImmovable(s)) {
      conflicts.push(describeOverlap(title, { st: startMins(s), e: endMins(s) }, input.resolveTaskTitle(target), extendedIv, s.date));
      conflicts.push(
        `"${title}" is locked/running and cannot be relocated — resolve the overlap manually (unlock it or move "${input.resolveTaskTitle(target)}").`,
      );
      continue;
    }

    // Find the earliest free slot >= the item's original start that fits d,
    // within working hours and clear of every busy interval.
    let found: Interval | null = null;
    const earliest = startMins(s);
    for (let cursor = Math.max(earliest, input.workStartMins); cursor + d <= input.workEndMins; ) {
      const clash = busy.findIndex(b => cursor < b.e && cursor + d > b.st);
      if (clash === -1) {
        found = { st: cursor, e: cursor + d };
        break;
      }
      cursor = busy[clash].e;
    }

    if (!found) {
      conflicts.push(
        `No available slot on ${s.date} fits "${title}" (${d}m) after ${minsToTime(earliest)}. Consider another day or a different strategy.`,
      );
      continue;
    }

    // Guard against two relocated items claiming the same space
    busy.push({ st: found.st, e: found.e });
    busy.sort((a, b) => a.st - b.st);

    changes.push(toChange(s, found.st, found.e, 'moved', input));
  }

  const proposal: RescheduleProposal = {
    strategy: 'relocate',
    beyondWorkHours: false,
    scheduleId: target._id,
    extraMinutes: extra,
    changes,
    conflicts,
    warnings,
    totalExtraMins: extra,
  };
  if (directlyConflicting.length === 0) {
    warnings.push('No scheduled tasks overlap the extended slot — nothing else needs to move.');
  }
  return withWorkHours(proposal, input);
}

// ---------------------------------------------------------------------------
// Option 3: Shrink flexible subsequent tasks
// ---------------------------------------------------------------------------

export function proposeShrink(input: RescheduleInput): RescheduleProposal | null {
  const base = buildBase(input);
  if (!base) return null;
  const { target, extra, origEnd, newEndRaw } = base;
  const minDur = Math.max(5, input.minDurationMins ?? 15);

  const changes: RescheduleItemChange[] = [
    toChange(target, startMins(target), newEndRaw, 'extended', input),
  ];
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const subsequent = input.schedules
    .filter(s => s._id !== target._id && isLive(s) && startMins(s) >= origEnd)
    .sort((a, b) => startMins(a) - startMins(b));

  const immovable = input.schedules.filter(s => isImmovable(s) && isLive(s) && s._id !== target._id);

  // Status/duration guard for immovable subsequent items — shifting them left by
  // absorbed time is forbidden; the chain can only close up around them.
  const fixedSubsequent = subsequent.filter(isImmovable);

  // Candidates that may shrink duration: movable, duration above minimum
  const candidates = subsequent.filter(s => {
    if (!isMovable(s)) return false;
    return (endMins(s) - startMins(s)) - minDur > 0;
  });
  // Prefer shrinking lower-priority tasks first
  candidates.sort((a, b) => priorityOf(a) - priorityOf(b));

  // Greedily allocate shrink budget by priority
  let budget = extra;
  const shrinkById = new Map<string, number>();
  for (const s of candidates) {
    if (budget <= 0) break;
    const cap = (endMins(s) - startMins(s)) - minDur;
    const take = Math.min(cap, budget);
    shrinkById.set(s._id, take);
    budget -= take;
  }

  const absorbed = extra - budget;
  if (budget > 0) {
    warnings.push(
      `Flexible tasks can only absorb ${absorbed}m of the requested ${extra}m — ${budget}m cannot fit while respecting the ${minDur}m minimum. Choose another strategy or a smaller extension.`,
    );
  }

  // Rebuild the chain: close up from the extended end, applying shrinks
  const extendedIv: Interval = { st: startMins(target), e: newEndRaw };
  for (const im of immovable) {
    const imIv: Interval = { st: startMins(im), e: endMins(im) };
    if (imIv.st >= origEnd && overlaps(extendedIv, imIv)) {
      conflicts.push(describeOverlap(input.resolveTaskTitle(im), imIv, input.resolveTaskTitle(target), extendedIv, im.date));
    }
  }

  let cursor = newEndRaw;
  for (const s of subsequent) {
    if (isImmovable(s)) {
      // Fixed sub-events break the chain reversal (they keep their slots, so the
      // shrunk chain must not jump over them)
      conflicts.push(
        `"${input.resolveTaskTitle(s)}" is locked/running and sits later today — it cannot participate in shrinking; adjust manually if needed.`,
      );
      continue;
    }
    const d = endMins(s) - startMins(s) - (shrinkById.get(s._id) || 0);
    if (cursor + d > 1439) {
      conflicts.push(`"${input.resolveTaskTitle(s)}" would cross midnight — not scheduled automatically.`);
      continue;
    }
    const shrunk = shrinkById.get(s._id) || 0;
    changes.push(toChange(
      s, cursor, cursor + d, 'shrunk', input,
      { originalMins: endMins(s) - startMins(s), reducedMins: d },
    ));
    if (shrunk > 0) {
      warnings.push(`"${input.resolveTaskTitle(s)}" reduced by ${shrunk}m — less time may fit that task's work.`);
    }
    cursor += d;
  }
  // Immovable subsequent items that were skipped must not be overlapped by the chain
  for (const fs of fixedSubsequent) {
    const fsIv: Interval = { st: startMins(fs), e: endMins(fs) };
    for (const c of changes) {
      if (c.scheduleId === fs._id || c.scheduleId === target._id) continue;
      if (overlaps({ st: timeToMinutes(c.to.startTime), e: timeToMinutes(c.to.endTime) }, fsIv)) {
        conflicts.push(describeOverlap(c.taskTitle, { st: timeToMinutes(c.to.startTime), e: timeToMinutes(c.to.endTime) }, input.resolveTaskTitle(fs), fsIv, fs.date));
      }
    }
  }

  const proposal: RescheduleProposal = {
    strategy: 'shrink',
    beyondWorkHours: false,
    scheduleId: target._id,
    extraMinutes: extra,
    changes,
    conflicts,
    warnings,
    totalExtraMins: extra,
    absorbedMins: absorbed,
    unabsorbedMins: budget,
  };
  return withWorkHours(proposal, input);
}

// ---------------------------------------------------------------------------
// Option 4: Keep everything else as-is (allow overlap, warn + acknowledge)
// ---------------------------------------------------------------------------

export function proposeKeepAsIs(input: RescheduleInput): RescheduleProposal | null {
  const base = buildBase(input);
  if (!base) return null;
  const { target, extra, newEndRaw } = base;

  const changes: RescheduleItemChange[] = [
    toChange(target, startMins(target), newEndRaw, 'extended', input),
  ];
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const extendedIv: Interval = { st: startMins(target), e: newEndRaw };
  const overlapping = input.schedules.filter(s => {
    if (s._id === target._id || !isLive(s)) return false;
    return overlaps(extendedIv, { st: startMins(s), e: endMins(s) });
  });

  for (const s of overlapping) {
    conflicts.push(describeOverlap(input.resolveTaskTitle(target), extendedIv, input.resolveTaskTitle(s), { st: startMins(s), e: endMins(s) }, s.date));
  }

  if (overlapping.length > 0) {
    warnings.push(
      `Keeping the rest of the schedule unchanged means "${input.resolveTaskTitle(target)}" overlaps ${overlapping.length} task(s). Your explicit acknowledgement is required to apply this.`,
    );
  }

  const proposal: RescheduleProposal = {
    strategy: 'keep-as-is',
    beyondWorkHours: false,
    scheduleId: target._id,
    extraMinutes: extra,
    changes,
    conflicts,
    warnings,
    totalExtraMins: extra,
  };
  return withWorkHours(proposal, input);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function buildProposal(strategy: RescheduleStrategy, input: RescheduleInput): RescheduleProposal | null {
  switch (strategy) {
    case 'shift-all': return proposeShiftAll(input);
    case 'relocate': return proposeRelocate(input);
    case 'shrink': return proposeShrink(input);
    case 'keep-as-is': return proposeKeepAsIs(input);
    default: return null;
  }
}

/** Convenience: build the engine input from store data */
export function makeInput(opts: {
  scheduleId: string;
  extraMinutes: number;
  schedules: ScheduleItem[];
  tasks: { id: string; title: string }[];
  workStartMins: number;
  workEndMins: number;
  minDurationMins?: number;
}): RescheduleInput {
  const taskMap = new Map(opts.tasks.map(t => [t.id, t.title]));
  return {
    scheduleId: opts.scheduleId,
    extraMinutes: opts.extraMinutes,
    schedules: opts.schedules,
    resolveTaskTitle: (s) => {
      const t = s.taskId;
      if (typeof t === 'object' && t !== null) return (t as { title?: string }).title || 'Untitled Task';
      return taskMap.get(String(t)) || 'Untitled Task';
    },
    workStartMins: opts.workStartMins,
    workEndMins: opts.workEndMins,
    minDurationMins: opts.minDurationMins,
  };
}

