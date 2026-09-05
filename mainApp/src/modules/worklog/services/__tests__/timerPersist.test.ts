import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addCompletedSession,
  loadTodayMs,
  saveTodayMs,
  loadDayMs,
  loadWeekMs,
  clearTodayMs,
} from '../timerPersist';
import { getTodayKey, getIsoWeekStartKey, getIsoWeekEndKey, addDaysToKey } from '@shared/utils/time';

const DAY_CACHE_KEY = 'ff_day_cache';
const LEGACY_TODAY_KEY = 'ff_today_ms';

describe('timerPersist day cache (IES-P1-19)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z')); // Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addCompletedSession accumulates into today\'s day-cache entry', () => {
    addCompletedSession(60_000);
    addCompletedSession(120_000);
    expect(loadTodayMs()).toBe(180_000);
    expect(loadDayMs(getTodayKey())).toBe(180_000);
  });

  it('saveTodayMs overwrites today\'s total', () => {
    addCompletedSession(60_000);
    saveTodayMs(300_000);
    expect(loadTodayMs()).toBe(300_000);
  });

  it('loadWeekMs sums only keys inside the current ISO week (Mon–Sun)', () => {
    const startKey = getIsoWeekStartKey();
    const endKey = getIsoWeekEndKey();
    const lastWeekMonday = addDaysToKey(startKey, -7);
    const nextWeekMonday = addDaysToKey(endKey, 1);
    const midWeek = addDaysToKey(startKey, 3);

    localStorage.setItem(DAY_CACHE_KEY, JSON.stringify({
      [lastWeekMonday]: 1_000_000,
      [startKey]: 60_000,
      [midWeek]: 120_000,
      [endKey]: 30_000,
      [nextWeekMonday]: 2_000_000,
    }));

    expect(loadWeekMs()).toBe(60_000 + 120_000 + 30_000);
  });

  it('returns 0 for an empty cache — no fabricated week total', () => {
    expect(loadWeekMs()).toBe(0);
    expect(loadTodayMs()).toBe(0);
    expect(loadDayMs(getTodayKey())).toBe(0);
  });

  it('migrates a legacy ff_today_ms snapshot into the day cache', () => {
    localStorage.setItem(LEGACY_TODAY_KEY, JSON.stringify({ date: getTodayKey(), ms: 45_000 }));
    expect(loadTodayMs()).toBe(45_000);
    expect(loadDayMs(getTodayKey())).toBe(45_000);
    expect(localStorage.getItem(LEGACY_TODAY_KEY)).toBeNull();
  });

  it('clearTodayMs wipes the whole day cache', () => {
    addCompletedSession(90_000);
    clearTodayMs();
    expect(loadTodayMs()).toBe(0);
    expect(loadWeekMs()).toBe(0);
    expect(localStorage.getItem(DAY_CACHE_KEY)).toBeNull();
  });
});
