import { describe, it, expect } from 'vitest';
import { calculateScheduleMetrics } from '../scheduleAnalytics';
import { ScheduleItem } from '../../types';

describe('Smart Schedule Analytics & Metrics (Phase 6)', () => {
  const sampleSchedules: ScheduleItem[] = [
    {
      _id: 's1',
      userId: 'u1',
      taskId: 't1',
      date: '2026-08-17',
      startTime: '09:00',
      endTime: '10:30', // 90 mins planned
      status: 'completed',
      actualTimeMs: 75 * 60 * 1000, // 75 mins worked
    },
    {
      _id: 's2',
      userId: 'u1',
      taskId: 't2',
      date: '2026-08-17',
      startTime: '11:00',
      endTime: '12:00', // 60 mins planned
      status: 'scheduled',
      actualTimeMs: 30 * 60 * 1000, // 30 mins worked so far
    },
  ];

  it('correctly calculates planned, worked, and remaining times without modifying completed session history', () => {
    const metrics = calculateScheduleMetrics(sampleSchedules);
    expect(metrics.totalTasks).toBe(2);
    expect(metrics.completedTasks).toBe(1);
    expect(metrics.plannedMinutes).toBe(150); // 90 + 60
    expect(metrics.actualMinutes).toBe(105);   // 75 + 30
    expect(metrics.plannedMinutes - metrics.actualMinutes).toBe(45); // Remaining: 45 mins
  });
});
