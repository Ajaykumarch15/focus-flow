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
      'backlog',
      'blockers',
      'teams',
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
      '/admin/audit',
      '/admin/people',
      '/admin/teams',
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

describe('S4-T3 regression: deep-link pages, never daily mega-tabs', () => {
  it('routes projects/teams/members to dedicated pages, not TeamWorkspace', () => {
    const lines = appSource.split('\n');
    const projectsLine = lines.find((l) => l.includes('path="projects"'));
    const teamsLine = lines.find((l) => l.includes('path="teams"'));
    const membersLine = lines.find((l) => l.includes('path="members"'));
    expect(projectsLine).toContain('WorkspaceProjectsPage');
    expect(teamsLine).toContain('WorkspaceTeamsPage');
    expect(membersLine).toContain('WorkspaceMembersPage');
    expect(projectsLine).not.toContain('TeamWorkspace');
    expect(teamsLine).not.toContain('TeamWorkspace');
    expect(membersLine).not.toContain('TeamWorkspace');
  });

  it('TeamWorkspace no longer declares projects or admin tabs', () => {
    const teamWorkspace = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/TeamWorkspace.tsx'), 'utf8');
    expect(teamWorkspace).toContain("type TeamTab = 'dashboard' | 'docs' | 'calendar';");
    expect(teamWorkspace).not.toMatch(/'projects'|'admin'/);
  });

  it('retired admin routes redirect to the Audit deep link', () => {
    const lines = appSource.split('\n');
    for (const p of ['/admin/overview', '/admin/analytics', '/admin/activity']) {
      const line = lines.find((l) => l.includes(`path="${p}"`));
      expect(line).toContain('Navigate to="/admin/audit" replace');
    }
    expect(routePaths).toContain('/admin/audit');
  });

  it('admin sidebar navigation no longer points at retired routes', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/AdminSidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/\/admin\/(overview|analytics|activity)/);
    expect(sidebar).toContain("to: '/admin/audit'");
  });
});
