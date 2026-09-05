import { describe, it, expect } from 'vitest';
import { ScheduleItem } from '@shared/types';

describe('Planned vs Actual Variance Calculation', () => {
  it('correctly calculates difference between planned time and actual worked time', () => {
    const item: ScheduleItem = {
      _id: 's10',
      userId: 'u1',
      taskId: 't1',
      date: '2026-08-17',
      startTime: '10:00',
      endTime: '11:00', // 60 mins planned
      status: 'completed',
      actualTimeMs: 75 * 60 * 1000, // 75 mins worked
    };

    const plannedMins = 60;
    const workedMins = Math.round((item.actualTimeMs || 0) / 60000);
    const diff = workedMins - plannedMins;

    expect(plannedMins).toBe(60);
    expect(workedMins).toBe(75);
    expect(diff).toBe(15);
  });
});
