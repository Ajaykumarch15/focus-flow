import { describe, it, expect } from 'vitest';
import { proposeShiftAll, proposeRelocate, proposeShrink, proposeKeepAsIs, makeInput } from './rescheduleEngine';
import { ScheduleItem } from '@shared/types';

const DATE = '2026-06-01';

const baseTask = { id: 't1', title: 'Task' } as never;

function item(
  id: string,
  taskId: string,
  startTime: string,
  endTime: string,
  opts: Partial<Partial<ScheduleItem>> = {},
): ScheduleItem {
  return {
    _id: id,
    userId: 'u1',
    taskId: { id: taskId, title: `T-${id}`, priority: 'medium' } as never,
    date: DATE,
    startTime,
    endTime,
    status: 'scheduled',
    ...opts,
  } as ScheduleItem;
}

function input(schedules: ScheduleItem[], scheduleId: string, extraMinutes: number) {
  return makeInput({
    scheduleId,
    extraMinutes,
    schedules,
    tasks: [],
    workStartMins: 9 * 60,
    workEndMins: 17 * 60,
  });
}

void baseTask;

describe('rescheduleEngine — Option 1: shift-all', () => {
  it('extends the target and shifts every subsequent movable task forward', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '12:00'),
      item('c', 't-c', '12:00', '13:00'),
      item('d', 't-d', '13:00', '13:30'),
    ];
    const p = proposeShiftAll(input(schedules, 'a', 30))!;
    expect(p.extraMinutes).toBe(30);
    expect(p.totalExtraMins).toBe(30);

    const target = p.changes.find(c => c.scheduleId === 'a')!;
    expect(target.to).toEqual({ date: DATE, startTime: '10:00', endTime: '11:30' });

    const b = p.changes.find(c => c.scheduleId === 'b')!;
    expect(b.to).toEqual({ date: DATE, startTime: '11:30', endTime: '12:30' });
    const c = p.changes.find(c => c.scheduleId === 'c')!;
    expect(c.to).toEqual({ date: DATE, startTime: '12:30', endTime: '13:30' });
    const d = p.changes.find(c => c.scheduleId === 'd')!;
    expect(d.to).toEqual({ date: DATE, startTime: '13:30', endTime: '14:00' });
    expect(p.conflicts).toHaveLength(0);
  });

  it('does not move locked tasks and reports conflicts against them', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('fix', 't-fix', '13:00', '14:00', { locked: true, status: 'in-progress' }),
      item('b', 't-b', '11:00', '12:00'),
    ];
    // b shifts +60: 12:00-13:00 (no overlap with fix). fix stays 13:00-14:00.
    const p = proposeShiftAll(input(schedules, 'a', 60))!;
    const fixChange = p.changes.find(c => c.scheduleId === 'fix');
    expect(fixChange).toBeUndefined();
    const bChange = p.changes.find(c => c.scheduleId === 'b')!;
    expect(bChange.to.startTime).toBe('12:00');
    expect(p.conflicts).toHaveLength(0);

    // Bigger extend: shift pushes b into fix's slot → conflict reported
    const p2 = proposeShiftAll(input(schedules, 'a', 90))!;
    expect(p2.conflicts.length).toBeGreaterThan(0);
  });

  it('warns when the shift pushes tasks beyond working hours', () => {
    const schedules = [
      item('a', 't-a', '15:00', '16:00'),
      item('b', 't-b', '16:00', '16:45'),
    ];
    const p = proposeShiftAll(input(schedules, 'a', 60))!;
    // b would end 17:45 > 17:00 end of work hours
    expect(p.beyondWorkHours).toBe(true);
    expect(p.warnings.some(w => w.includes('working hours'))).toBe(true);
  });

  it('returns null for invalid input', () => {
    const schedules = [item('a', 't-a', '10:00', '11:00')];
    expect(proposeShiftAll(input(schedules, 'missing', 30))).toBeNull();
    expect(proposeShiftAll(input(schedules, 'a', 0))).toBeNull();
    expect(proposeShiftAll(input(schedules, 'a', -5))).toBeNull();
  });
});

describe('rescheduleEngine — Option 2: relocate', () => {
  it('relocates only directly conflicting tasks', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'), // extended to 11:30
      item('b', 't-b', '11:00', '12:00'), // conflicts
      item('c', 't-c', '12:00', '13:00'), // free — stays
      item('d', 't-d', '13:00', '13:30'), // free — stays
      item('e', 't-e', '14:00', '15:00'), // free — stays
    ];
    const p = proposeRelocate(input(schedules, 'a', 30))!;
    const b = p.changes.find(c => c.scheduleId === 'b')!;
    // b keeps 60m duration; busy: a(10:00-11:30), c(12:00-13:00), d(13:00-13:30), e(14:00-15:00).
    // 11:30-12:30 clashes c | 13:00-13:30 clashes d | 13:30-14:30 clashes e | 15:00-16:00 free.
    expect(b.kind).toBe('moved');
    expect(b.to.startTime).toBe('15:00');
    expect(b.to.endTime).toBe('16:00');

    // Non-conflicting tasks unchanged
    expect(p.changes.find(c => c.scheduleId === 'c')).toBeUndefined();
    expect(p.changes.find(c => c.scheduleId === 'd')).toBeUndefined();
  });

  it('reports a conflict when no slot fits (cannot silently drop a task)', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '12:00'),
      item('last', 't-l', '16:00', '17:00'), // blocks the tail
      item('filler', 't-f', '12:00', '16:00'), // fills the rest of the day
    ];
    const p = proposeRelocate(input(schedules, 'a', 30))!;
    expect(p.conflicts.some(c => c.includes('b') || c.toLowerCase().includes('no available slot'))).toBe(true);
  });

  it('preserves duration of relocated tasks and never overlaps the extended slot', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '12:00'),
    ];
    const p = proposeRelocate(input(schedules, 'a', 45))!;
    const b = p.changes.find(c => c.scheduleId === 'b')!;
    expect(b.to.startTime).toBe('11:45');
    expect(b.to.endTime).toBe('12:45'); // full 60m duration preserved
    expect(b.kind).toBe('moved');
  });
});

describe('rescheduleEngine — Option 3: shrink', () => {
  it('closes the chain and absorbs the extension across shrinkable tasks', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '12:00'),
      item('c', 't-c', '12:00', '13:00'),
      item('d', 't-d', '13:00', '13:30'),
    ];
    const p = proposeShrink(input(schedules, 'a', 30))!;
    const a = p.changes.find(c => c.scheduleId === 'a')!;
    expect(a.to.endTime).toBe('11:30');

    const b = p.changes.find(c => c.scheduleId === 'b')!;
    const c = p.changes.find(c => c.scheduleId === 'c')!;
    const d = p.changes.find(c => c.scheduleId === 'd')!;
    // All same priority → budget allocated in start order: b takes all 30m.
    expect(b.to).toEqual({ date: DATE, startTime: '11:30', endTime: '12:00' });
    expect(c.to).toEqual({ date: DATE, startTime: '12:00', endTime: '13:00' });
    expect(d.to).toEqual({ date: DATE, startTime: '13:00', endTime: '13:30' });
    expect(p.absorbedMins).toBe(30);
    expect(p.unabsorbedMins).toBe(0);
  });

  it('cannot shrink below minimum duration and reports unabsorbed minutes', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '11:20'), // 20m → can shrink max 5m
    ];
    const p = proposeShrink(input(schedules, 'a', 30))!;
    expect(p.absorbedMins).toBe(5);
    expect(p.unabsorbedMins).toBe(25);
    expect(p.warnings.some(w => w.includes('cannot fit'))).toBe(true);
  });

  it('never shrinks a locked or running task', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '12:00', { locked: true, status: 'in-progress' }),
      item('c', 't-c', '12:00', '13:00'),
    ];
    const p = proposeShrink(input(schedules, 'a', 30))!;
    // The immovable task is never given a change entry
    expect(p.changes.some(c => c.scheduleId === 'b')).toBe(false);
    // …and its slot is protected by conflict reporting
    expect(p.conflicts.length).toBeGreaterThan(0);
  });
});

describe('rescheduleEngine — Option 4: keep-as-is', () => {
  it('changes only the target and flags all overlaps for acknowledgement', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
      item('b', 't-b', '11:00', '12:00'),
      item('c', 't-c', '12:00', '13:00'),
    ];
    const p = proposeKeepAsIs(input(schedules, 'a', 30))!;
    expect(p.changes).toHaveLength(1);
    const a = p.changes[0];
    expect(a.to).toEqual({ date: DATE, startTime: '10:00', endTime: '11:30' });
    expect(p.conflicts).toHaveLength(1); // overlaps b (12:00? no — b starts 11:00 < 11:30)
  });

  it('reports no conflicts when nothing is scheduled after', () => {
    const schedules = [
      item('a', 't-a', '10:00', '11:00'),
    ];
    const p = proposeKeepAsIs(input(schedules, 'a', 30))!;
    expect(p.conflicts).toHaveLength(0);
    expect(p.warnings).toHaveLength(0);
  });
});
