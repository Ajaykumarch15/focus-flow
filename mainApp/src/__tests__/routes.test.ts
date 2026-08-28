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
      '/worklog/focus',
      '/personal',
      '/personal/today',
      '/personal/tasks',
      '/personal/tasks/:id',
      '/personal/focus',
      '/personal/activity',
      '/personal/analytics',
      '/personal/roadmaps',
      '/personal/roadmaps/:id',
      '/personal/journal',
      '/personal/search',
      '/collab/dashboard',
      '/home',
      '/collab/team',
      '/collab/leaderboard',
      '/collab/activity',
      '/collab/search',
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

describe('S4-T4 regression: role-aware defaults + /team collision cleanup', () => {
  it('/collab/team is declared once, backed by TeamProjects', () => {
    const teamRoutes = appSource.match(/<Route\s+path="\/collab\/team"/g) ?? [];
    expect(teamRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="\/collab\/team"\s+element={<TeamProjects \/>}/);
  });

  it('removes the dead personal /team → TeamWorkspace route', () => {
    expect(appSource).not.toMatch(/<Route\s+path="\/team"\s+element={<TeamWorkspace \/>}/);
    expect(appSource).toMatch(/<Route\s+path="overview"\s+element={<TeamWorkspace \/>}/);
  });

  it('role-aware landings use the default-view helper', () => {
    const login = readFileSync(resolve(process.cwd(), 'src/pages/Login.tsx'), 'utf8');
    const register = readFileSync(resolve(process.cwd(), 'src/pages/Register.tsx'), 'utf8');
    const protectedRoute = readFileSync(resolve(process.cwd(), 'src/components/auth/ProtectedRoute.tsx'), 'utf8');
    for (const source of [login, register, protectedRoute]) {
      expect(source).toContain('resolveDefaultLanding');
    }
    expect(login).toContain('useAuthStore.getState().user?.role');
    expect(register).toContain('useAuthStore.getState().user?.role');
    expect(protectedRoute).toContain('resolveDefaultLanding(user?.role)');
    expect(protectedRoute).not.toMatch(/to="\/dashboard"/);
  });

  it('personal sidebar no longer links /team; logo navigates to /home', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/to: '\/team'/);
    expect(sidebar).toContain("navigate('/home')");
  });
});

describe('P1-T1 regression: actionable project overview', () => {
  it('declares the project detail route once, backed by ProjectLayout with an index overview', () => {
    const projectRoutes = appSource.match(/<Route\s+path="projects\/:projectId"/g) ?? [];
    expect(projectRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="projects\/:projectId"\s+element={<ProjectLayout \/>}/);
    expect(appSource).toMatch(/<Route index element={<ProjectOverviewPage \/>} \/>/);
    expect(routePaths).toContain('projects/:projectId');
  });

  it('lazy-loads ProjectOverviewPage alongside the other workspace pages', () => {
    expect(appSource).toMatch(/const ProjectOverviewPage = lazy\(\(\) => import\('\.\/pages\/collaboration\/ProjectOverviewPage'\)/);
  });

  it('page layout is responsive (mobile stacks, desktop splits 2fr/1fr, KPIs 4-up)', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/ProjectOverviewPage.tsx'), 'utf8');
    expect(page).toMatch(/grid-cols-1\s+lg:grid-cols-\[2fr_1fr\]/);
    expect(page).toMatch(/grid-cols-2\s+lg:grid-cols-4/);
    expect(page).toContain('Current Sprint');
    expect(page).toContain('Active Features');
    expect(page).toContain('Team Progress');
    expect(page).toContain('Recent Work');
    expect(page).toContain('Blockers');
    expect(page).toContain('Releases & Milestones');
  });

  it('project cards on WorkspaceProjectsPage link to the detail overview', () => {
    const projectsPage = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/WorkspaceProjectsPage.tsx'), 'utf8');
    expect(projectsPage).toContain(`to={\`/w/\${activeWorkspaceId}/projects/\${proj.id}\`}`);
    expect(projectsPage).toContain('Open Project Overview');
  });

  it('Breadcrumbs already label the project detail param', () => {
    const breadcrumbs = readFileSync(resolve(process.cwd(), 'src/components/ui/Breadcrumbs.tsx'), 'utf8');
    expect(breadcrumbs).toContain('/w/:workspaceId/projects/:projectId');
    expect(breadcrumbs).toMatch(/projectId:\s*'Project'/);
  });
});

describe('P1-T2 regression: project timeline deep-link', () => {
  it('declares the timeline as a nested ProjectLayout route, backed by ProjectTimelinePage', () => {
    const timelineRoutes = appSource.match(/<Route\s+path="timeline"\s+element={<ProjectTimelinePage \/>}/g) ?? [];
    expect(timelineRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="projects\/:projectId"\s+element={<ProjectLayout \/>}/);
    expect(routePaths).toContain('timeline');
  });

  it('lazy-loads ProjectTimelinePage', () => {
    expect(appSource).toMatch(/const ProjectTimelinePage = lazy\(\(\) => import\('\.\/pages\/collaboration\/ProjectTimelinePage'\)/);
  });

  it('Breadcrumbs label the timeline segment', () => {
    const breadcrumbs = readFileSync(resolve(process.cwd(), 'src/components/ui/Breadcrumbs.tsx'), 'utf8');
    expect(breadcrumbs).toContain('/w/:workspaceId/projects/:projectId/timeline');
    expect(breadcrumbs).toMatch(/timeline:\s*'Timeline'/);
  });

  it('the project overview page links to the timeline', () => {
    const overview = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/ProjectOverviewPage.tsx'), 'utf8');
    expect(overview).toContain('View Timeline');
    expect(overview).toContain('navigate(`${projectsUrl}/${overview.project.id}/timeline`)');
  });

  it('timeline page is responsive and filter state lives in the URL', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/ProjectTimelinePage.tsx'), 'utf8');
    expect(page).toMatch(/p-6\s+lg:p-8\s+max-w-\[1600px\]/);
    expect(page).toContain('useSearchParams');
    expect(page).toMatch(/flex\s+flex-wrap\s+items-center\s+gap-2/);
    expect(page).toContain('aria-pressed');
    expect(page).toContain('groupTimelineEventsByDay');
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
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("to: '/worklog/reports'");
    expect(sidebar).toContain("to: '/worklog/insights'");
    expect(sidebar).toContain("label: 'Insights'");
  });

  it('insights page is responsive and a Reports companion, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
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
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
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
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
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
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
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
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
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
