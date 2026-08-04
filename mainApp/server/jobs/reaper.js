// IES-P1-26: reclaim zombie sessions. `Session.isActive` used to never expire —
// a closed tab or crashed client left a permanently "active" session that skewed
// analytics ("active now") forever. The client now sends a heartbeat every
// HEARTBEAT interval; this job closes any active session whose last heartbeat is
// older than STALE_MS, mirroring the start-time orphan sweep in routes/sessions.js.
//
// Heartbeat cadence (client) is ~30s; 10 minutes without one means the session
// is abandoned, not merely paused — the app is closed or the tab was killed.

const Session = require('../models/Session');
const Task = require('../models/Task');
const { logger } = require('../utils/logger');

const STALE_MS = 10 * 60 * 1000; // a session with no beat for 10 min is a zombie

/**
 * Finalize one stale session the same way an explicit stop would: close any open
 * pause, cap the end at the last verified heartbeat, and recompute activeTime.
 * Never credits the client for time after it stopped reporting.
 */
async function closeStaleSession(session, now) {
  const lastAlive = Number.isFinite(session.lastHeartbeat)
    ? session.lastHeartbeat
    : session.startTime;

  const lastPause = [...(session.pauseLog || [])].reverse().find((p) => !p.resumeTime);
  if (lastPause) {
    lastPause.resumeTime = lastAlive;
    session.totalPauseDuration = Math.max(0, session.totalPauseDuration || 0) + Math.max(0, lastAlive - lastPause.pauseStart);
  }

  session.endTime = lastAlive;
  session.isActive = false;
  session.activeTime = Math.max(0, lastAlive - session.startTime - (session.totalPauseDuration || 0));
  await session.save();
  return session;
}

/**
 * Sweep stale active sessions. Returns the number closed.
 *
 * The `$exists: false` branch covers sessions created before lastHeartbeat was
 * added to the model: those are only reaped if startTime is also older than the
 * cutoff, so a freshly-created-but-unmigrated doc can't be closed by accident.
 */
async function reapStaleSessions({ now = Date.now() } = {}) {
  const cutoff = now - STALE_MS;

  const stale = await Session.find({
    isActive: true,
    $or: [
      { lastHeartbeat: { $lt: cutoff } },
      { lastHeartbeat: { $exists: false }, startTime: { $lt: cutoff } },
    ],
  });
  if (!stale.length) return 0;

  for (const session of stale) {
    try {
      await closeStaleSession(session, now);
    } catch (err) {
      logger.warn({ err, sessionId: String(session._id) }, 'Reaper failed to close stale session');
    }
  }

  // Keep task totals honest (same recompute as the start-time orphan sweep).
  const taskIds = [...new Set(stale.map((s) => s.taskId.toString()))];
  await Promise.all(taskIds.map(async (taskId) => {
    const allSessions = await Session.find({ taskId, isActive: false });
    const totalTime = allSessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);
    await Task.findOneAndUpdate({ _id: taskId }, { totalTime, status: 'todo' });
  }));

  return stale.length;
}

let scheduled = false;
let running = false;

/**
 * Start the recurring reaper. unref()'d so it never keeps the process alive in
 * tests; overlapping sweeps are skipped, never queued.
 */
function startReaper({ intervalMs = 5 * 60 * 1000, now } = {}) {
  if (scheduled) throw new Error('Session reaper already scheduled');
  scheduled = true;

  const handle = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await reapStaleSessions(now ? { now } : {});
    } catch (err) {
      logger.warn({ err }, 'Session reaper sweep failed');
    } finally {
      running = false;
    }
  }, intervalMs);
  handle.unref?.();
  return handle;
}

module.exports = { STALE_MS, closeStaleSession, reapStaleSessions, startReaper };
