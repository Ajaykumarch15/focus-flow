import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]*)"/g)].map((m) => m[1]);

describe('route table', () => {
  it('contains no paths with whitespace', () => {
    const spaced = routePaths.filter((p) => /\s/.test(p));
    expect(spaced).toEqual([]);
  });

  it('contains the canonical workspace routes', () => {
    const expected = [
      '/',
      '/login',
      '/register',
      '/hub',
      '/team',
      '/w/:workspaceId',
      'overview',
      'projects',
      'sprints',
      'members',
      'activity',
      'reports',
      'analytics',
      'knowledge',
      'calendar',
      'settings',
      '/dashboard',
      '/worklog',
      '/worklog/:id',
      '/reports',
      '/tasks',
      '/tasks/:id',
      '/journal',
      '/habits',
      '/leaderboard',
      '/focus',
      '/activity',
      '/admin/overview',
      '/admin/people',
      '/admin/teams',
      '/admin/analytics',
      '/admin/activity',
      '/admin/settings',
    ];
    for (const p of expected) {
      expect(routePaths).toContain(p);
    }
  });

  it('contains no typo duplicates', () => {
    const typos = ['overview hover', '/team text', '/worklog text', '/analytics text', '/analytics font', '/settings text'];
    for (const p of typos) {
      expect(routePaths).not.toContain(p);
    }
  });
});
