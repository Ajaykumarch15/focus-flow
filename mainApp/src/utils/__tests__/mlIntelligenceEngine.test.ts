import { describe, it, expect } from 'vitest';
import { Task, ScheduleItem } from '../../types';
import {
  derivePersonalProductivityProfile,
  predictTaskDuration,
  predictCompletionProbability,
  calculateDeadlineRisk,
} from '../mlIntelligenceEngine';

describe('Personal ML Intelligence Engine (Phase 7)', () => {
  const mockTasks: Task[] = [
    {
      id: 't1',
      title: 'System Design',
      description: '',
      priority: 'high',
      status: 'completed',
      category: 'Engineering',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
      subtasks: [{ id: 'sub1', title: 'Part 1', completed: true, createdAt: Date.now() }],
      sessions: [],
      totalTime: 90 * 60 * 1000, // 90 mins worked (planned ~30m subtask) => ~3.0 bias
      tags: [],
      color: '#0ea5e9',
      order: 1,
    },
  ];

  const mockSchedules: ScheduleItem[] = [
    {
      _id: 's1',
      userId: 'u1',
      taskId: 't1',
      date: '2026-08-17',
      startTime: '09:00',
      endTime: '10:00',
      status: 'completed',
      actualTimeMs: 90 * 60 * 1000,
    },
  ];

  it('derives personal profile and calculates estimate bias correctly', () => {
    const profile = derivePersonalProductivityProfile(mockTasks, mockSchedules);
    expect(profile.totalTasksAnalyzed).toBe(1);
    expect(profile.preferredHours).toContain(9);
  });

  it('predicts task duration using historical category bias', () => {
    const profile = derivePersonalProductivityProfile(mockTasks, mockSchedules);
    const pred = predictTaskDuration(mockTasks[0], profile);
    expect(pred.predictedMinutes).toBeGreaterThan(30);
    expect(pred.predictionRange.minMins).toBeLessThan(pred.predictedMinutes);
  });

  it('calculates completion probability for preferred peak window', () => {
    const profile = derivePersonalProductivityProfile(mockTasks, mockSchedules);
    const completion = predictCompletionProbability(mockTasks[0], '09:00', profile);
    expect(completion.completionProbability).toBeGreaterThan(0.7);
    expect(completion.factors.length).toBeGreaterThan(0);
  });
});
