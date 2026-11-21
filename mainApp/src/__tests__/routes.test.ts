import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]*)"/g)].map((m) => m[1]);

describe('route table', () => {
  it('contains no paths with whitespace', () => {
    const spaced = routePaths.filter((p) => /\s/.test(p));
    expect(spaced).toEqual([]);
  });

  it('contains the canonical routes', () => {
    const expected = [
      '/',
      '/login',
      '/register',
      '/worklog/dashboard',
      '/worklog/tasks',
      '/worklog/tasks/:id',
      '/worklog/schedule',
      '/worklog/logs',
      '/worklog/logs/:id',
      '/worklog/knowledge',
      '/worklog/search',
      '/worklog/reports',
      '/worklog/insights',
      '/worklog/habits',
      '/personal',
      '/personal/today',
      '/personal/tasks',
      '/personal/tasks/:id',
      '/personal/activity',
      '/personal/analytics',
      '/personal/roadmaps',
      '/personal/roadmaps/:id',
      '/personal/journal',
      '/personal/search',
      '/collab/*',
      '/home',
      '/settings',
      '/admin/audit',
      '/admin/people',
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

describe('S4-T3 regression: admin sidebar', () => {
  it('admin sidebar navigation no longer points at retired routes', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/AdminSidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/\/admin\/(overview|analytics|activity)/);
    expect(sidebar).toContain("to: '/admin/audit'");
  });
});

describe('collab workspace removal', () => {
  it('legacy collab routes redirect home and no collab pages are mounted', () => {
    expect(appSource).toMatch(/<Route\s+path="\/collab\/\*"\s+element={<Navigate\s+to="\/home"/);
    expect(appSource).not.toMatch(/<Route\s+path="\/collab\/:workspaceSlug/);
    expect(appSource).not.toContain('ProjectsPage');
  });

  it('legacy admin teams and meeting members routes redirect', () => {
    expect(appSource).toMatch(/<Route\s+path="\/admin\/teams"\s+element={<Navigate\s+to="\/admin\/people"/);
    expect(appSource).toMatch(/<Route\s+path="\/meetings\/members"\s+element={<Navigate\s+to="\/meetings"/);
  });

  it('role-aware landings use the default-view helper', () => {
    const login = readFileSync(resolve(process.cwd(), 'src/shared/pages/Login.tsx'), 'utf8');
    const register = readFileSync(resolve(process.cwd(), 'src/shared/pages/Register.tsx'), 'utf8');
    const protectedRoute = readFileSync(resolve(process.cwd(), 'src/shared/components/auth/ProtectedRoute.tsx'), 'utf8');
    for (const source of [login, register, protectedRoute]) {
      expect(source).toContain('resolveDefaultLanding');
    }
    expect(login).toContain('useAuthStore.getState().user?.role');
    expect(register).toContain('useAuthStore.getState().user?.role');
    expect(protectedRoute).toContain('resolveDefaultLanding(user?.roleId?.level)');
    expect(protectedRoute).not.toMatch(/to="\/dashboard"/);
  });

  it('personal sidebar no longer links /projects; logo navigates to /home', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/to: '\/projects'/);
    expect(sidebar).toContain("navigate('/home')");
  });
});

describe('WorkLog insights removal', () => {
  it('redirects the legacy insights route to reports and no longer loads InsightsPage', () => {
    expect(appSource).toMatch(/<Route\s+path="\/worklog\/insights"\s+element={<Navigate\s+to="\/worklog\/reports"/);
    expect(appSource).not.toContain('InsightsPage');
    expect(appSource).not.toContain('insightsSelectors');
  });

  it('removes the insights links from the worklog sidebar and personal page', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).not.toContain("to: '/worklog/insights'");
    expect(sidebar).not.toContain("label: 'Insights'");
    const personal = readFileSync(resolve(process.cwd(), 'src/modules/personal-workspace/pages/PersonalPage.tsx'), 'utf8');
    expect(personal).not.toContain('/worklog/insights');
  });

  it('deletes the insights page, selectors and their tests', () => {
    expect(existsSync(resolve(process.cwd(), 'src/modules/worklog/pages/InsightsPage.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/modules/worklog/services/insightsSelectors.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/modules/worklog/services/__tests__/insightsSelectors.test.ts'))).toBe(false);
  });
});

describe('Top navigation and island header', () => {
  it('renders the horizontal top nav and hides breadcrumbs in the island header', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/AppLayout.tsx'), 'utf8');
    const header = readFileSync(resolve(process.cwd(), 'src/shared/components/ui/GlobalHeader.tsx'), 'utf8');
    expect(layout).toContain('<TopNav />');
    expect(layout).not.toContain('<Sidebar />');
    expect(layout).not.toContain('<GlobalHeader />');
    expect(header).not.toContain('Breadcrumbs');
    expect(header).toContain('bg-transparent');
    expect(header).not.toContain('rounded-2xl');
  });
});

describe('Analytics and Reports moved to the header menu', () => {
  it('links Analytics/Reports from the profile dropdown and not from the sidebar', () => {
    const header = readFileSync(resolve(process.cwd(), 'src/shared/components/ui/HeaderControls.tsx'), 'utf8');
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/Sidebar.tsx'), 'utf8');
    expect(header).toContain("'/personal/analytics'");
    expect(header).toContain("'/worklog/reports'");
    expect(sidebar).not.toContain("to: '/personal/analytics'");
    expect(sidebar).not.toContain("to: '/worklog/reports'");
  });
});

describe('WorkLog habits consolidation', () => {
  it('embeds the daily habit tracker on Tasks and Today, without a sidebar link', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).not.toContain("to: '/worklog/habits'");
    expect(sidebar).not.toContain("label: 'Habits'");
    const tasks = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/Tasks.tsx'), 'utf8');
    const today = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/TodayPage.tsx'), 'utf8');
    expect(tasks).toContain('DailyHabitsPanel');
    expect(today).toContain('HabitsSummaryCard');
    expect(appSource).toMatch(/<Route\s+path="\/worklog\/habits"\s+element={<Navigate\s+to="\/worklog\/tasks"/);
    expect(existsSync(resolve(process.cwd(), 'src/modules/worklog/pages/Habits.tsx'))).toBe(false);
  });
});

