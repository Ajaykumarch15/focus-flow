import { describe, it, expect } from 'vitest';
import { mapLog } from '../dataMapper';

const RAW = {
  _id: 'log1',
  title: 'Fix login bug',
  problem: 'Session token invalid',
  gitBranch: 'feature/login-fix',
  gitRef: { repository: 'repo', commitIds: ['abc'] },
  problemFlow: { investigation: 'Token expiry' },
  workEntries: [
    { _id: 'e1', date: '2026-01-02', what: 'b', startedAt: 1, endedAt: 2, activeMs: 1000 },
    { _id: 'e2', date: '2026-01-01', what: 'a', startedAt: 1, endedAt: 2, activeMs: 500 },
  ],
  completedItems: [{ _id: 'c1', text: 'Done', category: 'feature', done: true, completedAt: 1, createdAt: 1 }],
  status: 'reviewing',
  mood: 4,
  tags: ['auth'],
};

describe('mapLog (shared doc → WorkLog mapper)', () => {
  it('produces identical output for identical input (both views share the mapper)', () => {
    const a = mapLog(RAW);
    const b = mapLog(RAW);
    expect(a).toEqual(b);
    expect(a).toHaveProperty('_id', 'log1');
  });

  it('normalizes defaults for missing fields', () => {
    const log = mapLog({ _id: 'x' });
    expect(log.title).toBe('Untitled Work Item');
    expect(log.status).toBe('in-progress');
    expect(log.mood).toBe(3);
    expect(log.problemFlow.problem).toBe('');
    expect(log.problemFlow.investigation).toBe('');
    expect(log.workEntries).toEqual([]);
    expect(log.tags).toEqual([]);
    expect(log.totalActiveMs).toBe(0);
  });

  it('maps nested sub-documents and sorts work entries desc by date', () => {
    const log = mapLog(RAW);
    expect(log.gitBranch).toBe('feature/login-fix');
    expect(log.gitRef.repository).toBe('repo');
    expect(log.gitRef.branch).toBe('feature/login-fix');
    expect(log.problemFlow.problem).toBe('Session token invalid');
    expect(log.problemFlow.investigation).toBe('Token expiry');
    expect(log.workEntries.map(e => e.date)).toEqual(['2026-01-02', '2026-01-01']);
    expect(log.workEntries[1].what).toBe('a');
    expect(log.completedItems[0].text).toBe('Done');
    expect(log.status).toBe('reviewing');
    expect(log.mood).toBe(4);
    expect(log.tags).toEqual(['auth']);
  });
});
