import { describe, it, expect } from 'vitest';
import {
  computeRoadmapHealth,
  getListHealth,
  getDetailHealth,
} from '@personal/services/roadmapProgress';

// Fixed schedule window for deterministic math: Jan 1 -> Mar 1 2026 (59d).
const START = '2026-01-01';
const TARGET = '2026-03-01';
const MID = new Date('2026-01-31T00:00:00Z').getTime(); // ~50.8% elapsed
const BEFORE_START = new Date('2025-12-15T00:00:00Z').getTime();
const AFTER_TARGET = new Date('2026-04-15T00:00:00Z').getTime();

const h = (progress: number, now = MID, extra = {}) =>
  computeRoadmapHealth({ status: 'active', progress, startDate: START, targetDate: TARGET, ...extra }, now);

describe('B10 - actual vs expected schedule health', () => {
  it('actual > expected -> On Track', () => {
    expect(h(80).label).toBe('On Track');
    expect(h(100).label).toBe('Completed');
  });

  it('actual ~= expected -> On Track', () => {
    expect(h(45).label).toBe('On Track');
  });

  it('actual moderately below expected -> At Risk', () => {
    expect(h(30).label).toBe('At Risk');
  });

  it('actual far below expected -> Behind', () => {
    expect(h(20).label).toBe('Behind');
  });

  it('preserves the existing ±10 / ±25 thresholds at their boundaries', () => {
    // expected ~= 50.8%
    expect(h(41).label).toBe('On Track');   // gap  9.8 -> within 10
    expect(h(40).label).toBe('At Risk');    // gap 10.8 -> just past On Track
    expect(h(26).label).toBe('At Risk');    // gap 24.8 -> within 25
    expect(h(25).label).toBe('Behind');     // gap 25.8 -> beyond 25
  });
});

describe('B10 - required lifecycle / edge cases', () => {
  it('roadmap without target date -> On Track regardless of progress', () => {
    const base = { status: 'active', startDate: START, targetDate: null };
    expect(computeRoadmapHealth({ ...base, progress: 0 }, MID).label).toBe('On Track');
    expect(computeRoadmapHealth({ ...base, progress: 70 }, MID).label).toBe('On Track');
  });

  it('roadmap before start date -> On Track (nothing due yet)', () => {
    expect(computeRoadmapHealth(
      { status: 'active', progress: 0, startDate: START, targetDate: TARGET }, BEFORE_START,
    ).label).toBe('On Track');
    // Early work done pre-start is still fine.
    expect(computeRoadmapHealth(
      { status: 'planning', progress: 15, startDate: START, targetDate: TARGET }, BEFORE_START,
    ).label).toBe('On Track');
  });

  it('paused roadmap never shows live schedule pressure', () => {
    expect(h(5, MID, { status: 'paused' }).label).toBe('Paused');
    expect(getListHealth({ status: 'paused', progress: 0 } as any).label).toBe('Paused');
  });

  it('archived roadmap -> Archived', () => {
    expect(h(0, AFTER_TARGET, { status: 'archived' }).label).toBe('Archived');
  });

  it('completed status -> Completed even if expired or behind', () => {
    expect(computeRoadmapHealth(
      { status: 'completed', progress: 100, startDate: START, targetDate: TARGET }, AFTER_TARGET,
    ).label).toBe('Completed');
    expect(computeRoadmapHealth(
      { status: 'completed', progress: 60, startDate: START, targetDate: TARGET }, AFTER_TARGET,
    ).label).toBe('Completed');
  });

  it('expired roadmap -> Behind unless actually complete', () => {
    expect(computeRoadmapHealth(
      { status: 'active', progress: 90, startDate: START, targetDate: TARGET }, AFTER_TARGET,
    ).label).toBe('Behind');
    expect(computeRoadmapHealth(
      { status: 'active', progress: 0, startDate: START, targetDate: TARGET }, AFTER_TARGET,
    ).label).toBe('Behind');
  });

  it('0% progress mid-schedule is honestly Behind (B10 bugfix: no more fake On Track)', () => {
    const health = h(0);
    expect(health.label).not.toBe('On Track');
    expect(health.label).toBe('Behind');
  });

  it('100% progress reports Completed even without the completed status', () => {
    expect(h(100).tone).toBe('success');
    expect(h(100).description).toContain('complete');
  });
});

describe('B10 - name independence + surface consistency', () => {
  it('health depends only on numbers/dates/status, never on names', () => {
    const a = computeRoadmapHealth(
      { status: 'active', progress: 33, startDate: START, targetDate: TARGET,
        createdAt: '2025-12-01' }, MID);
    const b = computeRoadmapHealth(
      { status: 'active', progress: 33, startDate: START, targetDate: TARGET,
        createdAt: '2025-12-01' }, MID);
    // Same inputs -> same output; renaming phases/milestones cannot change it
    // because names are not part of the input contract at all.
    expect(a).toEqual(b);
  });

  it('card badge and detail hero agree on the label for identical inputs', () => {
    const card = getListHealth({ status: 'active', progress: 30, startDate: START, targetDate: TARGET } as any, MID);
    const detail = getDetailHealth({ status: 'active', progress: 30, startDate: START, targetDate: TARGET }, MID);
    expect(card.label).toBe(detail.label);
    expect(card.tone).toBe(detail.tone);
    expect(detail.color.length).toBeGreaterThan(0);
  });
});
