import { describe, it, expect } from 'vitest';
import { pomodoroTimeLeft, pomodoroProgress, isPomodoroComplete } from '../pomodoro';

describe('IES-P1-01 · pomodoro math (TaskDetail timer)', () => {
  const WORK_MS = 25 * 60 * 1000;

  it('timeLeft counts down from duration and never goes negative', () => {
    expect(pomodoroTimeLeft(WORK_MS, 0)).toBe(WORK_MS);
    expect(pomodoroTimeLeft(WORK_MS, 10 * 60000)).toBe(15 * 60000);
    expect(pomodoroTimeLeft(WORK_MS, 30 * 60000)).toBe(0);
    expect(pomodoroTimeLeft(WORK_MS, 99999999)).toBe(0);
  });

  it('progress is a 0..100 percentage, clamped', () => {
    expect(pomodoroProgress(WORK_MS, 0)).toBe(0);
    expect(pomodoroProgress(WORK_MS, 12.5 * 60000)).toBe(50);
    expect(pomodoroProgress(WORK_MS, WORK_MS)).toBe(100);
    expect(pomodoroProgress(WORK_MS, 2 * WORK_MS)).toBe(100);
    expect(pomodoroProgress(WORK_MS, -5000)).toBe(0);
    expect(pomodoroProgress(0, 1000)).toBe(0);
  });

  it('isComplete flips only after the full duration has elapsed', () => {
    expect(isPomodoroComplete(WORK_MS, WORK_MS - 1)).toBe(false);
    expect(isPomodoroComplete(WORK_MS, WORK_MS)).toBe(true);
    expect(isPomodoroComplete(WORK_MS, WORK_MS + 1000)).toBe(true);
    expect(isPomodoroComplete(0, 1000)).toBe(false);
  });
});
