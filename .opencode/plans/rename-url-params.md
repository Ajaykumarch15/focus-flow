# Plan: Rename URL Parameters in Personal Workspace Routes

## Goal
Replace generic `:id` parameters with descriptive names (`:taskId`, `:roadmapId`) across all personal-workspace routes to eliminate URL confusion.

## Changes

### 1. Route Definitions (App.tsx)

**Lines 211, 216-218:** Update route paths

| Current | New |
|---|---|
| `/personal/tasks/:id` | `/personal/tasks/:taskId` |
| `/personal/roadmaps/:id` | `/personal/roadmaps/:roadmapId` |
| `/personal/roadmaps/:id/phases/:phaseId` | `/personal/roadmaps/:roadmapId/phases/:phaseId` |
| `/personal/roadmaps/:id/phases/:phaseId/milestones/:milestoneId` | `/personal/roadmaps/:roadmapId/phases/:phaseId/milestones/:milestoneId` |

### 2. Page Components - useParams Updates

#### PersonalTaskDetail.tsx (line 29)
```diff
- const { id } = useParams<{ id: string }>();
+ const { taskId } = useParams<{ taskId: string }>();
```
Then update all `id` references to `taskId` in the component (lines 40, 258, 268, 278, 288).

#### RoadmapDetailPage.tsx (line 41)
```diff
- const { id } = useParams<{ id: string }>();
+ const { roadmapId } = useParams<{ roadmapId: string }>();
```
Then update all `id` references to `roadmapId` (lines 56-58, 65-69, 110, 292, 340-341).

#### PhaseDetailPage.tsx (line 29)
```diff
- const { id, phaseId } = useParams<{ id: string; phaseId: string }>();
+ const { roadmapId, phaseId } = useParams<{ roadmapId: string; phaseId: string }>();
```
Then update all `id` references to `roadmapId` (lines 51, 77, 83, 142, 158, 269).

#### MilestoneDetailPage.tsx (line 41)
```diff
- const { id, phaseId, milestoneId } = useParams<{ id: string; phaseId: string; milestoneId: string }>();
+ const { roadmapId, phaseId, milestoneId } = useParams<{ roadmapId: string; phaseId: string; milestoneId: string }>();
```
Then update all `id` references to `roadmapId` (lines 81, 126, 139-141, 146, 157, 168, 186, 203, 206, 225, 232).

### 3. Breadcrumbs.tsx

#### PARAM_LABELS (line 38-47)
Add new entries:
```diff
  const PARAM_LABELS: Record<string, string> = {
    workspaceId: 'Workspace',
    memberId: 'Member',
    projectId: 'Project',
    sprintId: 'Sprint',
    featureId: 'Feature',
    docId: 'Document',
-   id: 'Details',
    token: 'Shared Report',
+   taskId: 'Task',
+   roadmapId: 'Roadmap',
  };
```

#### DYNAMIC_ROUTES (lines 49-56)
```diff
  const DYNAMIC_ROUTES = [
-   '/worklog/tasks/:id',
-   '/worklog/logs/:id',
-   '/personal/roadmaps/:id',
-   '/personal/roadmaps/:id/phases/:phaseId',
-   '/personal/roadmaps/:id/phases/:phaseId/milestones/:milestoneId',
+   '/worklog/tasks/:taskId',
+   '/worklog/logs/:id',
+   '/personal/roadmaps/:roadmapId',
+   '/personal/roadmaps/:roadmapId/phases/:phaseId',
+   '/personal/roadmaps/:roadmapId/phases/:phaseId/milestones/:milestoneId',
    '/reports/share/token/:token',
  ];
```

Note: `/worklog/logs/:id` stays as-is since it's outside the personal-workspace scope.

### 4. Routes Test (routes.test.ts)

#### Expected routes (lines 34, 38)
```diff
-     '/personal/tasks/:id',
+     '/personal/tasks/:taskId',
      ...
-     '/personal/roadmaps/:id',
+     '/personal/roadmaps/:roadmapId',
```

Also add missing routes to the test:
```diff
+     '/personal/roadmaps/:roadmapId/phases/:phaseId',
+     '/personal/roadmaps/:roadmapId/phases/:phaseId/milestones/:milestoneId',
+     '/personal/schedule',
+     '/personal/settings',
```

### 5. Navigation Calls (no changes needed)

All navigation calls already use the entity's `.id` or `._id` property (e.g., `navigate(\`/personal/tasks/${task.id}\`)`), so they don't need to change. The URL path structure remains identical - only the parameter name in the route definition changes.

Files to verify (no edits expected):
- `Sidebar.tsx` (line 441)
- `PersonalTodayPage.tsx` (lines 134, 202, 318, 351, 384, 409, 432, 456)
- `PersonalPage.tsx` (line 120)
- `PersonalTasks.tsx` (line 407)
- `PersonalAnalyticsPage.tsx` (lines 255, 347)
- `RoadmapsPage.tsx` (lines 138, 215)
- `PersonalActivityTimeline.tsx` (line 96)
- `CreateRoadmapModal.tsx` (line 67)
- `LinkedRoadmapCard.tsx` (lines 79, 91, 104)
- `PersonalScheduleDayView.tsx` (lines 113, 145, 177, 201)
- `PersonalScheduleWeekView.tsx` (line 102)

### 6. Test File Updates

#### personalTaskDetail.test.tsx (line 58)
```diff
- <MemoryRouter initialEntries={[`/personal/tasks/${taskId}`]}>
+ <MemoryRouter initialEntries={[`/personal/tasks/${taskId}`]}>
```
No change needed - the test already uses the correct URL structure.

## Verification

After all changes:
1. Run `npm run lint` (or equivalent)
2. Run `npm run typecheck` (or `tsc --noEmit`)
3. Run `npx vitest run src/__tests__/routes.test.ts`
4. Manual verification: navigate to each personal-workspace route and confirm breadcrumbs display correctly
