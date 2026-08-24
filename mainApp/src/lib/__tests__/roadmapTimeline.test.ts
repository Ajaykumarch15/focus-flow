import { describe, it, expect } from 'vitest';
import {
  splitDatedUndated,
  selectTimelineSpan,
  selectTimelineTicks,
  milestoneAxisX,
  todayAxisX,
  sortMilestonesChronologically,
} from '../roadmapTimeline';
import type { RoadmapMilestoneDoc } from '../../types/roadmap';

const DAY = 86_400_000;

// Personal-shaped docs (RoadmapMilestoneDoc subset used by the timeline).
function ms(
  id: string,
  opts: { targetDate?: string | null; order?: number; status?: RoadmapMilestoneDoc['status']; progress?: number } = {},
): RoadmapMilestoneDoc {
  return {
    _id: id,
    userId: 'u1',
    roadmapId: 'r1',
    phaseId: 'p1',
    title: `M-${id}`,
    description: '',
    order: opts.order ?? 0,
    targetDate: opts.targetDate ?? undefined,
    status: opts.status ?? 'todo',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    totalTasks: 2,
    completedTasks: opts.progress === 100 ? 2 : 0,
    progress: opts.progress ?? 0,
  };
}

describe('B9 - compareByTargetDate / chronological ordering', () => {
  it('orders dated milestones ascending regardless of input order', () => {
    const rows = [
      ms('c', { targetDate: '2026-09-10' }),
      ms('a', { targetDate: '2026-07-01' }),
      ms('b', { targetDate: '2026-08-15' }),
    ];
    expect(sortMilestonesChronologically(rows).map(m => m._id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps undated milestones last without hiding them', () => {
    const rows = [
      ms('u1'),
      ms('d1', { targetDate: '2026-12-01' }),
      ms('u2'),
      ms('d2', { targetDate: '2026-05-05' }),
    ];
    const ordered = sortMilestonesChronologically(rows);
    expect(ordered.map(m => m._id)).toEqual(['d2', 'd1', 'u1', 'u2']);
  });

  it('breaks same-date ties with order (stable lanes)', () => {
    const rows = [
      ms('second', { targetDate: '2026-06-01', order: 2 }),
      ms('first', { targetDate: '2026-06-01', order: 1 }),
      ms('third', { targetDate: '2026-06-01', order: 7 }),
    ];
    expect(sortMilestonesChronologically(rows).map(m => m._id)).toEqual(['first', 'second', 'third']);
  });

  it('completed and overdue milestones keep their date position (no re-bucketing)', () => {
    const rows = [
      ms('done-past', { targetDate: '2026-01-15', status: 'completed', progress: 100 }),
      ms('late-open', { targetDate: '2026-02-01' }),
      ms('future', { targetDate: '2027-01-01' }),
    ];
    expect(sortMilestonesChronologically(rows).map(m => m._id)).toEqual(['done-past', 'late-open', 'future']);
  });
});

describe('B9 - splitDatedUndated', () => {
  it('splits a mixed set, each side chronologically ordered', () => {
    const rows = [
      ms('u1'),
      ms('b', { targetDate: '2026-08-01' }),
      ms('u2'),
      ms('a', { targetDate: '2026-03-01' }),
    ];
    const { dated, undated } = splitDatedUndated(rows);
    expect(dated.map(m => m._id)).toEqual(['a', 'b']);
    expect(undated.map(m => m._id)).toEqual(['u1', 'u2']);
  });

  it('handles all-undated and all-dated extremes', () => {
    const undatedOnly = splitDatedUndated([ms('x'), ms('y')]);
    expect(undatedOnly.dated).toHaveLength(0);
    expect(undatedOnly.undated).toHaveLength(2);

    const datedOnly = splitDatedUndated([ms('x', { targetDate: '2026-01-01' })]);
    expect(datedOnly.dated).toHaveLength(1);
    expect(datedOnly.undated).toHaveLength(0);
  });
});

describe('B9 - axis span / ticks / positions', () => {
  it('returns null span when nothing is dated (axis hidden, not fabricated)', () => {
    expect(selectTimelineSpan([ms('a'), ms('b')])).toBeNull();
    expect(selectTimelineSpan([])).toBeNull();
  });

  it('pads single-date spans so one milestone reads as a point', () => {
    const span = selectTimelineSpan([ms('solo', { targetDate: '2026-06-15' })])!;
    expect(span.max - span.min).toBeGreaterThanOrEqual(30 * DAY);
  });

  it('spans min..max across many dated milestones', () => {
    const span = selectTimelineSpan([
      ms('early', { targetDate: '2026-01-01' }),
      ms('mid', { targetDate: '2026-06-01' }),
      ms('late', { targetDate: '2026-12-31' }),
      ms('ghost'),
    ])!;
    expect(new Date(span.min).toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(new Date(span.max).toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('places dates at 0/100 ends and middle proportionally', () => {
    // Range must exceed 30 days so expandSpan does not pad the ends inward.
    const span = selectTimelineSpan([
      ms('a', { targetDate: '2026-01-01' }),
      ms('z', { targetDate: '2026-03-01' }),
    ])!;
    expect(milestoneAxisX({ targetDate: '2026-01-01' }, span)).toBe(0);
    expect(milestoneAxisX({ targetDate: '2026-03-01' }, span)).toBe(100);
    // Day 31 of a 59-day range sits mid-axis.
    const mid = milestoneAxisX({ targetDate: '2026-02-01' }, span)!;
    expect(mid).toBeGreaterThan(45);
    expect(mid).toBeLessThan(60);
  });

  it('never fabricates a position for undated milestones', () => {
    const span = selectTimelineSpan([ms('a', { targetDate: '2026-01-01' })])!;
    expect(milestoneAxisX({ targetDate: null }, span)).toBeNull();
    expect(milestoneAxisX({}, span)).toBeNull();
  });

  it('emits exactly `count` ascending ticks within the span', () => {
    const span = selectTimelineSpan([
      ms('a', { targetDate: '2026-01-01' }),
      ms('z', { targetDate: '2026-12-01' }),
    ])!;
    const ticks = selectTimelineTicks(span);
    expect(ticks).toHaveLength(5);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].x).toBeGreaterThan(ticks[i - 1].x);
    expect(ticks[0].label).toMatch(/Jan/);
  });
});

describe('B9 - today marker', () => {
  const span = selectTimelineSpan([
    ms('a', { targetDate: '2026-08-01' }),
    ms('z', { targetDate: '2026-08-31' }),
  ])!;

  it('marks today only when inside the span', () => {
    expect(todayAxisX('2026-08-16', span)).not.toBeNull();
    const x = todayAxisX('2026-08-16', span)!;
    expect(x).toBeGreaterThan(40);
    expect(x).toBeLessThan(60);
  });

  it('stays honest outside the range (past and future)', () => {
    expect(todayAxisX('2026-07-01', span)).toBeNull(); // before
    expect(todayAxisX('2026-09-30', span)).toBeNull(); // after
  });
});

describe('B9 - combination matrix (dated × undated × statuses)', () => {
  const combos: Array<[string, RoadmapMilestoneDoc[]]> = [
    ['no milestones', []],
    ['one dated', [ms('only', { targetDate: '2026-05-05' })]],
    ['one undated', [ms('only')]],
    ['all undated', [ms('a'), ms('b'), ms('c')]],
    ['all same date', [
      ms('a', { targetDate: '2026-04-04', order: 3 }),
      ms('b', { targetDate: '2026-04-04', order: 1 }),
      ms('c', { targetDate: '2026-04-04', order: 2 }),
    ]],
    ['past completed + future open', [
      ms('past-done', { targetDate: '2025-01-01', status: 'completed', progress: 100 }),
      ms('future-open', { targetDate: '2027-06-01' }),
    ]],
    ['mixed everything', [
      ms('u1'),
      ms('old-done', { targetDate: '2025-03-01', status: 'completed', progress: 100 }),
      ms('same-1', { targetDate: '2026-10-10', order: 2 }),
      ms('same-2', { targetDate: '2026-10-10', order: 1 }),
      ms('u2'),
      ms('far', { targetDate: '2028-02-02' }),
    ]],
  ];

  it.each(combos)('%s: ordering keeps dated chronological + undated last + visible', (_name, rows) => {
    const ordered = sortMilestonesChronologically(rows);
    const seen = new Set<string>();
    let lastDated = '';
    for (const m of ordered) {
      expect(seen.has(m._id)).toBe(false); // no drops, no duplicates
      seen.add(m._id);
      if (m.targetDate) {
        expect(m.targetDate >= lastDated || lastDated === '' ? true : m.targetDate >= lastDated).toBe(true);
        lastDated = m.targetDate;
      }
    }
    // Undated never precede a dated row.
    const firstUndated = ordered.findIndex(m => !m.targetDate);
    const lastDatedIdx = ordered.reduce((acc, m, i) => (m.targetDate ? i : acc), -1);
    if (firstUndated !== -1 && lastDatedIdx !== -1) {
      expect(firstUndated).toBeGreaterThan(lastDatedIdx);
    }
    // Span exists iff at least one dated row exists.
    const span = selectTimelineSpan(rows);
    expect(!!span).toBe(rows.some(r => !!r.targetDate));
    if (span) {
      for (const r of rows) {
        const x = milestoneAxisX(r, span);
        if (r.targetDate) expect(x).not.toBeNull();
        else expect(x).toBeNull();
      }
    }
  });
});
