// IES-P1-02: single timezone-aware session↔worklog sync implementation.
//
// Previously `syncSessionToWorkLogs` (sessions.js) and `syncWorkEntries`
// (workLogs.js) grouped sessions with different day semantics and double-counted
// across timezones. Every path now funnels through the pure builders in
// `worklogSyncCore.js`:
//
//   - `syncWorkLog`         recompute one worklog from its linked task's sessions
//                           (persist:false → read-only effective totals)
//   - `syncWorkLogsBulk`    batch read-only recompute for many worklogs with a
//                           single session query (kills the GET / N+1)
//   - `syncTaskWorkLogs`    session-stop single writer for a task's worklogs
//
// Work entries are a pure function of the task's sessions; session-stop is the
// single writer. Unlinked logs are never written.
'use strict';

const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const core = require('./worklogSyncCore');

/**
 * Recompute one worklog's work entries from its linked task's sessions.
 * With `persist: true` (the only writer paths) the document is saved; with
 * `persist: false` (GET) the in-memory doc reflects effective totals only.
 */
async function syncWorkLog(log, userId, { timeZone = 'UTC', now = Date.now(), persist = true } = {}) {
  const taskId = log.taskRef?._id || log.taskRef;
  if (!taskId) return log;
  const sessions = await Session.find({ userId, taskId });
  const { workEntries, totalActiveMs } = core.applyEffectiveWorkEntries(log, sessions, timeZone, now);
  log.workEntries = workEntries;
  log.totalActiveMs = totalActiveMs;
  if (persist && typeof log.save === 'function') {
    await log.save();
  }
  return log;
}

/**
 * IES-P1-03: batch read-only recompute for a list of worklogs. Loads every
 * task's sessions in ONE query (`{ taskId: { $in: [...] } }`) instead of one
 * `Session.find` per log, groups them by taskId, and applies the same pure
 * core used by `syncWorkLog`. Never persists.
 */
async function syncWorkLogsBulk(logs, userId, { timeZone = 'UTC', now = Date.now() } = {}) {
  if (!Array.isArray(logs) || logs.length === 0) return logs;
  const taskIds = [
    ...new Set(
      logs
        .map((log) => log.taskRef?._id || log.taskRef)
        .filter((taskId) => taskId != null)
        .map((taskId) => String(taskId))
    ),
  ];

  const sessionsByTask = new Map();
  if (taskIds.length > 0) {
    const sessions = await Session.find({ userId, taskId: { $in: taskIds } });
    for (const session of sessions) {
      const key = String(session.taskId);
      if (!sessionsByTask.has(key)) sessionsByTask.set(key, []);
      sessionsByTask.get(key).push(session);
    }
  }

  for (const log of logs) {
    const taskId = log.taskRef?._id || log.taskRef;
    if (taskId == null) continue;
    const sessions = sessionsByTask.get(String(taskId)) || [];
    const { workEntries, totalActiveMs } = core.applyEffectiveWorkEntries(log, sessions, timeZone, now);
    log.workEntries = workEntries;
    log.totalActiveMs = totalActiveMs;
  }
  return logs;
}

/**
 * Session-stop single writer: recompute and persist every worklog linked to the
 * task (taskRef). Unlinked logs are deliberately left untouched — the client
 * only wires timer time to a log via taskRef.
 */
async function syncTaskWorkLogs(userId, taskId, { timeZone = 'UTC', now = Date.now() } = {}) {
  const logs = await WorkLog.find({ userId, taskRef: taskId });
  for (const log of logs) {
    await syncWorkLog(log, userId, { timeZone, now, persist: true });
  }
  return logs;
}

module.exports = {
  ...core,
  syncWorkLog,
  syncWorkLogsBulk,
  syncTaskWorkLogs,
};
