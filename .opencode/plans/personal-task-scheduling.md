# Plan: Personal Task Scheduling + Today/Missed/Upcoming Derived States

## Goal
Add `scheduledDate` to PersonalTask, derive Today/Missed/Upcoming/Completed states dynamically, and integrate into TodayPage and PersonalTasks page.

---

## Phase 1: Backend — PersonalTask Model
**File:** `mainApp/server/models/PersonalTask.js`

Add field:
```js
scheduledDate: { type: Date, default: null },
```

Add index:
```js
personalTaskSchema.index({ userId: 1, scheduledDate: 1 });
```

No other model changes needed. States are derived, not stored.

---

## Phase 2: Backend — PersonalTasks Route
**File:** `mainApp/server/routes/personalTasks.js`

### 2a. POST / — Accept `scheduledDate`
Add `scheduledDate` to `taskCreateSchema`:
```js
scheduledDate: dateInput.optional(),
```
Pass through to `PersonalTask.create()`.

### 2b. PATCH /:id — Accept `scheduledDate`
Add `scheduledDate` to `taskPatchSchema`:
```js
scheduledDate: dateInput.nullable().optional(),
```
Add `scheduledDate: true` to `TASK_PATCH_FIELDS`.

### 2c. GET / — Add optional `scheduledDate` query param
When `?scheduledDate=YYYY-MM-DD` is provided, filter tasks to that date:
```js
if (req.query.scheduledDate) {
  const dayStart = new Date(req.query.scheduledDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  filter.scheduledDate = { $gte: dayStart, $lt: dayEnd };
}
```

---

## Phase 3: Frontend — Task Type
**File:** `mainApp/src/types/index.ts`

Add to `Task` interface:
```ts
scheduledDate?: number; // timestamp, undefined = not scheduled
```

---

## Phase 4: Frontend — Store + API
### 4a. API client
**File:** `mainApp/src/utils/api.ts`

Update `personalTasks.create` and `personalTasks.update` to include `scheduledDate` in the body type.

### 4b. mapTask
**File:** `mainApp/src/store/usePersonalTaskStore.ts`

Add to `mapTask()`:
```ts
scheduledDate: doc.scheduledDate ? new Date(doc.scheduledDate).getTime() : undefined,
```

### 4c. addTask
Update `addTask` in the store interface and implementation to accept `scheduledDate`.

---

## Phase 5: Derived State Utility
**New file:** `mainApp/src/utils/personalTaskSchedule.ts`

```ts
type ScheduledState = 'completed' | 'today' | 'missed' | 'upcoming' | 'unscheduled';

function getScheduledState(task: { status: string; scheduledDate?: number }, now?: Date): ScheduledState
function isScheduledToday(task: { scheduledDate?: number }, now?: Date): boolean
function isMissed(task: { status: string; scheduledDate?: number }, now?: Date): boolean
function getUpcomingTasks(tasks: Task[], now?: Date): Task[]
function getTodayTasks(tasks: Task[], now?: Date): Task[]
function getMissedTasks(tasks: Task[], now?: Date): Task[]
```

Logic:
- `completed`: `status === 'completed'`
- `today`: `scheduledDate` falls on today's date and not completed
- `missed`: `scheduledDate < today` and not completed
- `upcoming`: `scheduledDate > today` and not completed
- `unscheduled`: no `scheduledDate` set

---

## Phase 6: TodayPage Integration
**File:** `mainApp/src/pages/TodayPage.tsx`

### Changes:
1. Import `usePersonalTaskStore` and `getTodayTasks`/`getMissedTasks` from `personalTaskSchedule`
2. Call `fetchTasks()` on mount (if not already loaded)
3. Derive today's personal tasks and missed personal tasks
4. Add new sections to the layout:
   - **"Scheduled Today"** section — personal tasks where `scheduledDate === today`
   - **"Missed"** section — personal tasks where `scheduledDate < today` and not completed
5. These sections appear after the existing "Continue Working" / "Today's Focus" sections
6. Each task card shows title, scheduled date badge, start timer button

---

## Phase 7: PersonalTasks Page
**File:** `mainApp/src/pages/PersonalTasks.tsx`

### Changes:
1. Add new filter tabs/buttons: "All" | "Today" | "Missed" | "Upcoming" | "Scheduled"
2. Import `getScheduledState`, `isScheduledToday`, `isMissed` from `personalTaskSchedule`
3. When "Today" tab is active, filter to tasks where `scheduledDate === today`
4. When "Missed" tab is active, filter to tasks where `scheduledDate < today` and not completed
5. When "Upcoming" tab is active, filter to tasks where `scheduledDate > today` and not completed
6. Show scheduled date on task cards when present
7. Show derived state badge (Today/Missed/Upcoming/Completed) on task cards

---

## Phase 8: CreateTaskModal
**File:** `mainApp/src/components/tasks/CreateTaskModal.tsx`

### Changes:
1. Add `scheduledDate` to form state (default: empty string)
2. Add date picker input labeled "Scheduled Date" below the deadline field
3. Pass `scheduledDate` to `addTask()` call
4. The field is optional — tasks can exist without a scheduled date

---

## Phase 9: TaskCard
**File:** `mainApp/src/components/tasks/TaskCard.tsx`

### Changes:
1. Import `getScheduledState` from `personalTaskSchedule`
2. When `task.scheduledDate` exists, show a badge with the derived state:
   - Today → cyan badge "Today"
   - Missed → red badge "Missed"
   - Upcoming → blue badge "Upcoming" with date
   - Completed → green badge "Completed"
3. Show the scheduled date as secondary text

---

## Phase 10: Roadmap Detail Page
**File:** `mainApp/src/pages/RoadmapDetailPage.tsx`

### Changes:
1. The roadmap detail already fetches tasks via `PersonalTask.find({ personalRoadmapRef })`
2. Add scheduled date display on task items in the roadmap view
3. Show derived state badge next to each task

---

## Execution Order
1. Phase 1: Model field
2. Phase 2: Route updates
3. Phase 3: Frontend type
4. Phase 4: Store + API
5. Phase 5: Derived state utility
6. Phase 6: TodayPage
7. Phase 7: PersonalTasks page
8. Phase 8: CreateTaskModal
9. Phase 9: TaskCard
10. Phase 10: Roadmap detail
11. Typecheck + tests

## Files Modified
| File | Change |
|------|--------|
| `server/models/PersonalTask.js` | Add `scheduledDate` field + index |
| `server/routes/personalTasks.js` | Accept `scheduledDate` in create/update; optional filter in list |
| `src/types/index.ts` | Add `scheduledDate` to Task interface |
| `src/utils/api.ts` | Update personalTasks body types |
| `src/store/usePersonalTaskStore.ts` | Map `scheduledDate` in `mapTask`; accept in `addTask` |
| `src/utils/personalTaskSchedule.ts` | **New** — derived state utility |
| `src/pages/TodayPage.tsx` | Add personal tasks "Scheduled Today" + "Missed" sections |
| `src/pages/PersonalTasks.tsx` | Add Today/Missed/Upcoming filter tabs |
| `src/components/tasks/CreateTaskModal.tsx` | Add scheduled date input |
| `src/components/tasks/TaskCard.tsx` | Show scheduled date + derived state badge |
| `src/pages/RoadmapDetailPage.tsx` | Show scheduled date on roadmap tasks |
