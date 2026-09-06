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
      '/collab/workspaces',
      '/home',
      '/collab/:workspaceId/dashboard',
      '/collab/:workspaceId/team',
      '/collab/:workspaceId/leaderboard',
      '/collab/:workspaceId/activity',
      '/collab/:workspaceId/search',
      '/settings',
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

describe('S4-T3 regression: admin sidebar', () => {
  it('admin sidebar navigation no longer points at retired routes', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/AdminSidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/\/admin\/(overview|analytics|activity)/);
    expect(sidebar).toContain("to: '/admin/audit'");
  });
});

describe('S4-T4 regression: role-aware defaults + /team collision cleanup', () => {
  it('/collab/:workspaceId/team is declared once, backed by ProjectsPage', () => {
    const teamRoutes = appSource.match(/<Route\s+path="\/collab\/:workspaceId\/team"/g) ?? [];
    expect(teamRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="\/collab\/:workspaceId\/team"\s+element={<ProjectsPage \/>}/);
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
    expect(protectedRoute).toContain('resolveDefaultLanding(user?.role)');
    expect(protectedRoute).not.toMatch(/to="\/dashboard"/);
  });

  it('personal sidebar no longer links /team; logo navigates to /home', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/to: '\/team'/);
    expect(sidebar).toContain("navigate('/home')");
  });
});

describe('PI-1.1 regression: personal insights deep-link', () => {
  it('declares the /worklog/insights route once, backed by InsightsPage', () => {
    const insightRoutes = appSource.match(/<Route\s+path="\/worklog\/insights"/g) ?? [];
    expect(insightRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="\/worklog\/insights"\s+element={<InsightsPage \/>}/);
    expect(routePaths).toContain('/worklog/insights');
  });

  it('lazy-loads InsightsPage alongside the personal pages', () => {
    expect(appSource).toMatch(/const InsightsPage\s*=\s*lazy\(\(\) => import\('\.\/pages\/InsightsPage'\)/);
  });

  it('worklog sidebar links to /worklog/insights next to Reports', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("to: '/worklog/reports'");
    expect(sidebar).toContain("to: '/worklog/insights'");
    expect(sidebar).toContain("label: 'Insights'");
  });

  it('insights page is responsive and a Reports companion, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toMatch(/p-6\s+lg:p-8\s+max-w-\[1400px\]/);
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).toContain('Most Important');
    expect(page).toContain("Today's Insights");
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('insights are generated by the pure daily selector with honest empty rules', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectDailyInsights');
    expect(selectors).toContain('computeRangeStats');
    expect(selectors).toContain('confidence');
    expect(selectors).toContain('mostImportant');
    expect(selectors).toContain('period');
  });
});

describe('PI-1.2 regression: weekly insights on the same page', () => {
  it('insights page renders the weekly section as a Today companion, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toContain("This Week's Insights");
    expect(page).toContain('selectWeeklyInsights');
    expect(page).toContain('Weekly Focus');
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('weekly insights come from a pure ISO-week selector with an honest baseline rule', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectWeeklyInsights');
    expect(selectors).toContain('startOfIsoWeekInTz');
    expect(selectors).toContain('getComparisonDelta');
    expect(selectors).toContain('prevStats');
    expect(selectors).toContain('weekly-trend');
  });

  it('the ISO week is bounded in src/utils/time.ts, not inlined in the selector', () => {
    const time = readFileSync(resolve(process.cwd(), 'src/utils/time.ts'), 'utf8');
    expect(time).toContain('export function startOfIsoWeekInTz');
    expect(time).toContain('export function endOfIsoWeekInTz');
    expect(time).toContain('export function formatDateShortInTz');
  });
});

describe('PI-1.3 regression: work-pattern insights on the same page', () => {
  it('insights page renders the Work Pattern section below the weekly section, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toContain('Work Pattern Insights');
    expect(page).toContain('selectWorkPatternInsights');
    expect(page).toContain('Pattern Focus');
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('work-pattern insights come from a pure selector over a trailing 4-week window', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectWorkPatternInsights');
    expect(selectors).toContain('hourOfDayInTz');
    expect(selectors).toContain('weekdayInTz');
    expect(selectors).toContain('PATTERN_WINDOW_WEEKS');
    expect(selectors).toContain('pattern-time-of-day');
    expect(selectors).toContain('pattern-weekday');
    expect(selectors).toContain('pattern-session-length');
  });

  it('the wall-clock hour and weekday helpers live in src/utils/time.ts', () => {
    const time = readFileSync(resolve(process.cwd(), 'src/utils/time.ts'), 'utf8');
    expect(time).toContain('export function hourOfDayInTz');
    expect(time).toContain('export function weekdayInTz');
  });
});

describe('PI-1.4 regression: task insights on the same page', () => {
  it('insights page renders the Task section below the weekly section, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toContain('Task Insights');
    expect(page).toContain('selectTaskInsights');
    expect(page).toContain('Task Focus');
    expect(page).toContain('insights-task-heading');
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('task insights come from a pure selector over the open task list', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectTaskInsights');
    expect(selectors).toContain('task-overdue');
    expect(selectors).toContain('task-stale');
    expect(selectors).toContain('task-priority');
    expect(selectors).toContain('task-subtasks');
    expect(selectors).toContain('TASK_STALE_DAYS');
    expect(selectors).toContain('t.deadline');
  });
});

describe('PI-1.5 regression: knowledge insights on the same page', () => {
  it('insights page renders the Knowledge section below the task section, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/modules/worklog/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toContain('Knowledge Insights');
    expect(page).toContain('selectKnowledgeInsights');
    expect(page).toContain('Knowledge Focus');
    expect(page).toContain('insights-knowledge-heading');
    expect(page).toContain('useCollaborationStore');
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('knowledge insights derive from selectKnowledge as the single source of truth', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectKnowledgeInsights');
    expect(selectors).toContain('knowledge-base');
    expect(selectors).toContain('knowledge-decisions');
    expect(selectors).toContain('knowledge-lessons');
    expect(selectors).toContain('knowledge-links');
    expect(selectors).toContain('knowledge-docs');
    expect(selectors).toMatch(/import[^;]*selectKnowledge/);
    expect(selectors).toContain('selectKnowledge(input.docs, input.workLogs, input.journals)');
  });
});
