import { describe, it, expect } from 'vitest';
import { deriveScheduleState, getMinutesUntilStart, getMinutesSinceStart } from '../useScheduleEvaluator';
import { ScheduleItem, Task } from '../../types';

describe('useScheduleEvaluator utilities', () => {
  const dummyTask: Task = {
    id: 'task-1',
    title: 'Test Focus Task',
    description: '',
    status: 'todo',
    priority: 'high',
    tags: [],
    subtasks: [],
    sessions: [],
    category: 'Work',
    totalTime: 0,
    order: 0,
    color: '#0ea5e9',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const dummySchedule: ScheduleItem = {
    _id: 'sched-1',
    userId: 'user-1',
    taskId: 'task-1',
    date: '2026-08-17',
    startTime: '09:00',
    endTime: '10:00',
    status: 'scheduled',
    recurrence: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('derives "upcoming" when current time is more than 5 minutes before start time', () => {
    // 08:50 AM on 2026-08-17
    const nowMs = new Date(2026, 7, 17, 8, 50, 0, 0).getTime();
    const state = deriveScheduleState(dummySchedule, dummyTask, nowMs);
    expect(state).toBe('upcoming');
  });

  it('derives "starting-soon" when current time is within 5 minutes before start time', () => {
    // 08:57 AM on 2026-08-17
    const nowMs = new Date(2026, 7, 17, 8, 57, 0, 0).getTime();
    const state = deriveScheduleState(dummySchedule, dummyTask, nowMs);
    expect(state).toBe('starting-soon');
  });

  it('derives "ongoing" when current time is between start and end time', () => {
    // 09:30 AM on 2026-08-17
    const nowMs = new Date(2026, 7, 17, 9, 30, 0, 0).getTime();
    const state = deriveScheduleState(dummySchedule, dummyTask, nowMs);
    expect(state).toBe('ongoing');
  });

  it('derives "missed" when current time is past end time and task is incomplete', () => {
    // 10:30 AM on 2026-08-17
    const nowMs = new Date(2026, 7, 17, 10, 30, 0, 0).getTime();
    const state = deriveScheduleState(dummySchedule, dummyTask, nowMs);
    expect(state).toBe('missed');
  });

  it('derives "completed" if task status is completed regardless of time', () => {
    const completedTask = { ...dummyTask, status: 'completed' as const };
    const nowMs = new Date(2026, 7, 17, 8, 50, 0, 0).getTime();
    const state = deriveScheduleState(dummySchedule, completedTask, nowMs);
    expect(state).toBe('completed');
  });

  it('calculates getMinutesUntilStart correctly', () => {
    const nowMs = new Date(2026, 7, 17, 8, 55, 0, 0).getTime();
    expect(getMinutesUntilStart(dummySchedule, nowMs)).toBe(5);
  });

  it('calculates getMinutesSinceStart correctly', () => {
    const nowMs = new Date(2026, 7, 17, 9, 15, 0, 0).getTime();
    expect(getMinutesSinceStart(dummySchedule, nowMs)).toBe(15);
  });
});
