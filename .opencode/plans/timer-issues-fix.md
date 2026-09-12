# Timer Issues Fix Plan

## Issues Found

### Critical

**1. `activeTimerRouter` fails to stop parallel timers**
- File: `mainApp/src/modules/worklog/services/activeTimerRouter.ts:32-43`
- `stopTaskTimer` routes through legacy engine stores, which can't stop parallel timers
- Backend sessions started via `startParallelTimer` become orphaned zombies

**2. `rebuildDayCache` ignores personal sessions**
- File: `mainApp/src/modules/worklog/services/useStore.ts:408`
- Only `api.sessions.list()` passed to `rebuildDayCache()`
- Personal session time excluded from daily/weekly progress cache

### Moderate

**3. Legacy heartbeat overwrites for parallel timers**
- Both stores call `startTimerHeartbeat()` (single shared interval) when starting parallel timers
- Each call replaces previous `onStale` callback
- Only last-registered stale callback fires on 404

**4. Personal timer leaks into worklog UI**
- `useStore` subscribes to `timerEngine` and sets `activeTaskId` for personal sessions
- Worklog views show personal task as "active work task"

### Minor

**5. Parallel timer ticker not stopped on individual stop**
- `stopTicker()` only called when all tasks idle
- 1-second interval runs with only paused timers

**6. Cross-tab localStorage echo**
- localStorage fallback doesn't filter sender messages

---

## Fix 1: activeTimerRouter parallel stop routing

File: `mainApp/src/modules/worklog/services/activeTimerRouter.ts`

Replace the imports and `stopTaskTimer` function:

```typescript
import { parallelTimerEngine, TimerSessionKind } from './parallelTimerEngine';
import { timerEngine } from './timerEngine';
import { api } from '@shared/utils/api';
import { offlineQueue, createOpId } from '@shared/utils/offlineQueue';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';

// ... getTaskSessionKind stays the same ...

/**
 * Stop a specific task's session, routed to its owning store/backend.
 * No-op if the task's timer is already idle.
 *
 * Handles both parallel timers (in parallelTimerEngine) and legacy single
 * timers (in timerEngine) by checking which engine owns the active session.
 */
export async function stopTaskTimer(taskId: string): Promise<void> {
  // Check parallel engine first
  const parallelSnapshot = parallelTimerEngine.getSnapshot(taskId);
  if (parallelSnapshot && parallelSnapshot.timerState !== 'idle') {
    const kind = parallelSnapshot.sessionKind;
    const sessionId = parallelSnapshot.sessionId;
    const now = Date.now();
    const opId = createOpId();

    const res = await parallelTimerEngine.stop(taskId, now);
    if (!res.success && res.error !== 'Timer is already idle') return;

    // Route API stop to the correct endpoint
    if (sessionId) {
      try {
        if (kind === 'personal') {
          await api.personalSessions.stop(sessionId, now, opId);
          await usePersonalTaskStore.getState().fetchTasks();
        } else {
          await api.sessions.stop(sessionId, now, opId);
          await useStore.getState().fetchTasks();
        }
      } catch {
        offlineQueue.enqueue('STOP_SESSION', taskId, sessionId, { endTime: now }, opId, kind ?? 'work');
      }
    }
    return;
  }

  // Fall back to legacy single timer engine
  const legacyState = timerEngine.getState();
  if (legacyState === 'idle') return;
  if (timerEngine.getActiveTaskId() !== taskId) return;

  const kind = timerEngine.getSessionKind();
  if (kind === 'personal') {
    await usePersonalTaskStore.getState().stopTimer(taskId);
  } else {
    await useStore.getState().stopTimer(taskId);
  }
}
```

---

## Fix 2: Include personal sessions in rebuildDayCache

File: `mainApp/src/modules/worklog/services/useStore.ts`

In `loadAll`, after fetching work sessions, also fetch personal sessions:

```typescript
// Around line 401-408, change:
try {
  const allSessions = await api.sessions.list();
  const match = allSessions.find((s: any) => s.isActive);
  const localTimer = loadTimer();

  rebuildDayCache(allSessions);

// To:
try {
  const [allSessions, personalSessions] = await Promise.all([
    api.sessions.list().catch(() => []),
    api.personalSessions.list().catch(() => []),
  ]);
  const match = allSessions.find((s: any) => s.isActive);
  const localTimer = loadTimer();

  // Include personal sessions in day cache for accurate daily/weekly totals
  rebuildDayCache([...allSessions, ...personalSessions]);
```

---

## Fix 3: Use startSessionHeartbeat for parallel timers

File: `mainApp/src/modules/worklog/services/useStore.ts`

In `startParallelTimer`, replace `startTimerHeartbeat` with `startSessionHeartbeat`:

```typescript
// Around line 786, change:
startTimerHeartbeat(() => {
  parallelTimerEngine.stop(taskId);
});

// To:
import { startSessionHeartbeat, stopSessionHeartbeat } from '@worklog/services/timerHeartbeat';

// In startParallelTimer:
if (sessionDoc._id) {
  startSessionHeartbeat(sessionDoc._id, 'work', () => {
    parallelTimerEngine.stop(taskId);
  });
}
```

File: `mainApp/src/modules/personal-workspace/services/usePersonalTaskStore.ts`

Same change in `startParallelTimer`:

```typescript
// Around line 455, change:
startTimerHeartbeat(() => {
  parallelTimerEngine.stop(taskId);
});

// To:
import { startSessionHeartbeat, stopSessionHeartbeat } from '@worklog/services/timerHeartbeat';

// In startParallelTimer:
if (sessionDoc._id) {
  startSessionHeartbeat(sessionDoc._id, 'personal', () => {
    parallelTimerEngine.stop(taskId);
  });
}
```

Also update `stopParallelTimer` in both stores to call `stopSessionHeartbeat` with the sessionId.

---

## Fix 4: Filter useStore subscription to exclude personal sessions

File: `mainApp/src/modules/worklog/services/useStore.ts`

Around line 285-293, filter the timerEngine subscription:

```typescript
// Change:
timerEngine.subscribe((newSnapshot) => {
  set({
    activeTaskId: newSnapshot.taskId,
    activeSessionId: newSnapshot.sessionId,
    activeTimerState: newSnapshot.timerState as TimerState,
    currentSessionStart: newSnapshot.sessionStartTime || undefined,
    currentPauseStart: newSnapshot.pauseStart,
  });
});

// To:
timerEngine.subscribe((newSnapshot) => {
  // Skip personal sessions — they belong to usePersonalTaskStore
  if (newSnapshot.sessionKind === 'personal') return;
  set({
    activeTaskId: newSnapshot.taskId,
    activeSessionId: newSnapshot.sessionId,
    activeTimerState: newSnapshot.timerState as TimerState,
    currentSessionStart: newSnapshot.sessionStartTime || undefined,
    currentPauseStart: newSnapshot.pauseStart,
  });
});
```

---

## Fix 5: Stop ticker when no running timers remain

File: `mainApp/src/modules/worklog/services/parallelTimerEngine.ts`

In the `stop` method, after deleting the timer, check if ticker should stop:

```typescript
// Around line 350, after this.timers.delete(taskId), add:
// Stop ticker if no running timers remain (paused timers don't need ticking)
if (this.getRunningTimers().length === 0) {
  this.stopTicker();
}
```

---

## Fix 6: Add senderId filtering to localStorage fallback

File: `mainApp/src/modules/worklog/services/timerEngine.ts`

Add a `senderId` property and filter in constructor and handleRemoteMessage:

```typescript
// Add property:
private senderId: string = Math.random().toString(36).substring(2);

// In broadcast method, around line 452-458:
private broadcast(type: string, payload: any): void {
  const msg = { type, payload, senderId: this.senderId };
  // ... rest stays the same
}

// In localStorage fallback listener, around line 441-448:
window.addEventListener('storage', (e) => {
  if (e.key === 'ff_active_timer_sync_event' && e.newValue) {
    try {
      const data = JSON.parse(e.newValue);
      if (data.senderId === this.senderId) return; // skip self
      this.handleRemoteMessage(data);
    } catch { /* ignore */ }
  }
});
```

Same changes for `parallelTimerEngine.ts`:

```typescript
// Add property:
private senderId: string = Math.random().toString(36).substring(2);

// In broadcast method:
const msg = { type, payload, senderId: this.senderId };

// In localStorage fallback:
if (data.senderId === this.senderId) return; // skip self
```

---

## Implementation Order

1. Fix 1 (critical) — activeTimerRouter parallel stop
2. Fix 2 (critical) — rebuildDayCache personal sessions
3. Fix 4 — Filter useStore subscription
4. Fix 3 — startSessionHeartbeat for parallel
5. Fix 5 — Stop ticker on individual stop
6. Fix 6 — senderId filtering

All changes are backward-compatible. No breaking changes to API or data models.
