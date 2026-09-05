import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  getSchedulePlannedMinutes,
  calculateScheduleMetrics,
  formatMinutes,
} from '../scheduleAnalytics';
import { ScheduleItem } from '@shared/types';

describe('Schedule Analytics', () => {
  it('converts time string HH:mm to minutes from midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('14:00')).toBe(840);
    expect(timeToMinutes('invalid')).toBe(0);
  });

  it('calculates planned minutes for a schedule item', () => {
    const item: Partial<ScheduleItem> = {
      startTime: '09:00',
      endTime: '10:30',
    };
    expect(getSchedulePlannedMinutes(item as ScheduleItem)).toBe(90);
  });

  it('formats minutes into human readable text', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('calculates metrics for a list of schedule items', () => {
    const schedules: Partial<ScheduleItem>[] = [
      {
        _id: '1',
        startTime: '09:00',
        endTime: '10:30', // 90 min planned
        status: 'completed',
        actualTimeMs: 75 * 60 * 1000, // 75 min actual
      },
      {
        _id: '2',
        startTime: '11:00',
        endTime: '12:00', // 60 min planned
        status: 'scheduled',
        actualTimeMs: 0,
      },
    ];

    const metrics = calculateScheduleMetrics(schedules as ScheduleItem[]);
    expect(metrics.totalTasks).toBe(2);
    expect(metrics.completedTasks).toBe(1);
    expect(metrics.plannedMinutes).toBe(150);
    expect(metrics.actualMinutes).toBe(75);
    expect(metrics.progressPercent).toBe(50);
  });
});
