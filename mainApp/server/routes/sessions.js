const express = require('express');
const Session = require('../models/Session');
const Task    = require('../models/Task');
const User    = require('../models/User');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { serverTime } = require('../utils/sessionTime');
const { syncTaskWorkLogs } = require('../utils/worklogSync');
const { dayKey, localDateToUtc, userTimezone } = require('../utils/dates');
const { logger } = require('../utils/logger');
const { z, objectId, timestamp, opId, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param schemas — timestamps are coerced finite numbers (NaN never passes).
// IES-P1-05: `opId` is the optional offline-replay idempotency key.
const sessionParamsSchema = z.object({ id: objectId });
const sessionCreateSchema = z.object({ taskId: objectId, startTime: timestamp.optional(), opId });
const sessionPauseSchema = z.object({ pauseTime: timestamp.optional(), opId });
const sessionResumeSchema = z.object({ resumeTime: timestamp.optional(), opId });
const sessionStopSchema = z.object({ endTime: timestamp.optional(), opId });

// Helper to auto-add timeline entries to active WorkLogs
async function addTimelineEntryToWorkLogs(userId, taskId, type, title, description = '') {
  try {
    const logs = await WorkLog.find({
      userId,
      $or: [{ taskRef: taskId }, { isActive: true }]
    });

    for (const log of logs) {
      log.timelineEntries.push({
        timestamp: Date.now(),
        type,
        title,
        description,
        category: 'Focus Session'
      });
      await log.save();
    }
  } catch (err) {
    logger.warn('Failed to add timeline entry to WorkLogs');
  }
}

// IES-P1-02: session↔worklog time sync now lives in utils/worklogSync.js.
// Session-stop is the single writer (`syncTaskWorkLogs`); GET computes
// effective totals read-only. Timeline entries above are a separate UX concern
// and keep the active-log catch-all.

// IES-P1-05: offline-replay dedupe. `appliedOpIds` records which client opIds
// have already been applied to a session, so a replayed pause/resume/stop is
// ignored instead of re-applied.
function hasAppliedOp(session, opId) {
  return Boolean(opId && Array.isArray(session.appliedOpIds) && session.appliedOpIds.includes(opId));
}

function markApplied(session, opId) {
  if (opId && !hasAppliedOp(session, opId)) {
    session.appliedOpIds = [...(session.appliedOpIds || []), opId];
  }
}

// ── GET /api/sessions — fetch sessions (optional ?taskId=, ?active=true) ──────
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.taskId) filter.taskId = req.query.taskId;
    if (req.query.active === 'true') filter.isActive = true;

    const sessions = await Session.find(filter).sort({ startTime: -1 });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions — start a new session ──────────────────────────────────
router.post('/', validate(sessionCreateSchema), async (req, res, next) => {
  try {
    const { taskId, startTime, opId } = req.body;
    if (!taskId) return res.status(400).json({ message: 'taskId is required' });

    const task = await Task.findOne({ _id: taskId, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // IES-P1-05: a replayed START with the same opId must not create a second
    // session. The partial unique index on (userId, clientOpId) covers races.
    if (opId) {
      const existing = await Session.findOne({ userId: req.user._id, clientOpId: opId });
      if (existing) return res.status(200).json(existing);
    }

    const now = serverTime(startTime);

    const existingSameTaskSession = await Session.findOne({
      userId: req.user._id,
      taskId,
      isActive: true,
    });

    if (existingSameTaskSession) {
      return res.status(200).json(existingSameTaskSession);
    }

    const orphanedSessions = await Session.find({ userId: req.user._id, isActive: true });
    const orphanedTaskIds = [...new Set(orphanedSessions.map(s => s.taskId.toString()))];

    await Promise.all(orphanedSessions.map(async (activeSession) => {
      const lastPause = [...activeSession.pauseLog].reverse().find(p => !p.resumeTime);
      if (lastPause) {
        lastPause.resumeTime = now;
        activeSession.totalPauseDuration += now - lastPause.pauseStart;
      }
      activeSession.endTime = now;
      activeSession.isActive = false;
      activeSession.activeTime = Math.max(
        0,
        now - activeSession.startTime - activeSession.totalPauseDuration
      );
      await activeSession.save();
    }));

    await Promise.all(orphanedTaskIds.map(async (orphanedTaskId) => {
      const allSessions = await Session.find({ taskId: orphanedTaskId, userId: req.user._id, isActive: false });
      const totalTime = allSessions.reduce((acc, s) => acc + s.activeTime, 0);
      await Task.findOneAndUpdate(
        { _id: orphanedTaskId, userId: req.user._id },
        { totalTime, status: 'todo' }
      );
    }));

    let session;
    try {
      session = await Session.create({
        userId: req.user._id,
        taskId,
        startTime: now,
        isActive: true,
        lastHeartbeat: now,
        ...(opId ? { clientOpId: opId } : {}),
      });
    } catch (err) {
      // Concurrent replay of the same opId: return the winner instead of 500.
      if (err?.code === 11000 && opId) {
        const existing = await Session.findOne({ userId: req.user._id, clientOpId: opId });
        if (existing) return res.status(200).json(existing);
      }
      throw err;
    }

    await Task.findByIdAndUpdate(taskId, { status: 'active' });

    // Auto timeline entry
    await addTimelineEntryToWorkLogs(req.user._id, taskId, 'timer_start', `▶ Started Focus Session`, `Task: ${task.title}`);

    res.status(201).json(session);
    Activity.create({ userId: req.user._id, action: 'session.started', details: { taskId, taskTitle: task.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/pause — log a pause start ───────────────────────
router.patch('/:id/pause', validate(sessionPauseSchema, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const { pauseTime, opId } = req.body;

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    // IES-P1-05: ignore a replayed pause whose opId was already applied.
    if (hasAppliedOp(session, opId)) return res.json(session);

    const now = serverTime(pauseTime, { min: session.startTime });

    const hasOpenPause = session.pauseLog.some(p => !p.resumeTime);
    if (!hasOpenPause) {
      session.pauseLog.push({ pauseStart: now });
      session.pauseCount = (session.pauseCount || 0) + 1;
    }
    session.lastHeartbeat = now; // IES-P1-26
    markApplied(session, opId);
    await session.save();

    await Task.findByIdAndUpdate(session.taskId, { status: 'paused' });

    // Auto timeline entry
    await addTimelineEntryToWorkLogs(req.user._id, session.taskId, 'timer_pause', `⏸ Paused Focus Session`);

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/resume — close the last pause entry ──────────────
router.patch('/:id/resume', validate(sessionResumeSchema, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const { resumeTime, opId } = req.body;

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    // IES-P1-05: ignore a replayed resume whose opId was already applied.
    if (hasAppliedOp(session, opId)) return res.json(session);

    const now = serverTime(resumeTime, { min: session.startTime });

    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      const pauseDuration = Math.max(0, now - lastPause.pauseStart);
      session.totalPauseDuration += pauseDuration;
    }
    session.lastHeartbeat = now; // IES-P1-26
    markApplied(session, opId);
    await session.save();

    await Task.findByIdAndUpdate(session.taskId, { status: 'active' });

    // Auto timeline entry
    await addTimelineEntryToWorkLogs(req.user._id, session.taskId, 'timer_resume', `▶ Resumed Focus Session`);

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/stop — finalise the session ─────────────────────
router.patch('/:id/stop', validate(sessionStopSchema, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const { endTime, opId } = req.body;

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // IES-P1-05: ignore a replayed stop whose opId was already applied.
    if (hasAppliedOp(session, opId)) return res.json(session);

    if (!session.isActive) {
      markApplied(session, opId);
      await session.save();
      return res.json(session);
    }

    const now = serverTime(endTime, { min: session.startTime });

    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      session.totalPauseDuration += Math.max(0, now - lastPause.pauseStart);
    }

    session.endTime = now;
    session.isActive = false;
    session.activeTime = Math.max(0, now - session.startTime - session.totalPauseDuration);
    session.lastHeartbeat = now; // IES-P1-26

    let score = 100;
    score -= (session.pauseCount || 0) * 5;
    if (session.activeTime > 0) {
      const pauseRatio = session.totalPauseDuration / session.activeTime;
      score -= Math.min(50, pauseRatio * 20);
    }
    // IES-P1-07: focusScore is bounded [0, 100] in the schema too.
    session.focusScore = Math.max(0, Math.min(100, Math.round(score)));

    markApplied(session, opId);
    await session.save();

    const user = req.user;
    // IES-P1-06: the day key and the start-of-day boundary both come from the
    // user's timezone — a UTC key over a server-local boundary used to drift
    // by one day near midnight.
    const timeZone = userTimezone(user);
    const todayStr = dayKey(Date.now(), timeZone);
    const todayStart = localDateToUtc(todayStr, timeZone).getTime();

    const todaySessions = await Session.find({
      userId: user._id,
      isActive: false,
      startTime: { $gte: todayStart }
    });
    const todayTotalMs = todaySessions.reduce((acc, s) => acc + s.activeTime, 0);
    const goalMs = (user.settings?.dailyGoal ?? 8) * 3600000;

    const sessionPoints = Math.round((session.activeTime / 60000) * (session.focusScore / 100));

    // IES-P1-08: points use an atomic $inc and the streak day-gate is a
    // conditional update, so concurrent stops can never lose an increment or
    // double-count a day. The continue/reset filters both encode "today not yet
    // counted", which only one racing stop can win.
    await User.updateOne({ _id: user._id }, { $inc: { totalPoints: sessionPoints } });

    if (todayTotalMs >= goalMs) {
      const yesterdayStr = dayKey(todayStart - 1, timeZone);

      const continued = await User.updateOne(
        { _id: user._id, 'streak.lastDate': yesterdayStr },
        { $inc: { 'streak.current': 1 }, $set: { 'streak.lastDate': todayStr } }
      );
      if (!continued.modifiedCount) {
        await User.updateOne(
          { _id: user._id, 'streak.lastDate': { $nin: [yesterdayStr, todayStr] } },
          { $set: { 'streak.current': 1, 'streak.lastDate': todayStr } }
        );
      }
      // best = max(best, current) — atomic pipeline update (MongoDB 4.2+).
      await User.updateOne(
        { _id: user._id },
        [{ $set: { 'streak.best': { $max: ['$streak.best', '$streak.current'] } } }]
      );
    }

    const allSessions = await Session.find({ taskId: session.taskId, userId: req.user._id, isActive: false });
    const totalTime = allSessions.reduce((acc, s) => acc + s.activeTime, 0);
    await Task.findByIdAndUpdate(session.taskId, { totalTime, status: 'todo' });

    // Sync to WorkLog automatically + auto timeline entry.
    // IES-P1-02: session-stop is the single writer for linked worklogs.
    try {
      await syncTaskWorkLogs(req.user._id, session.taskId, {
        timeZone: userTimezone(req.user),
      });
    } catch (err) {
      logger.warn('WorkLog sync failed');
    }
    const mins = Math.round(session.activeTime / 60000);
    await addTimelineEntryToWorkLogs(req.user._id, session.taskId, 'timer_stop', `■ Stopped Focus Session (${mins}m logged)`);

    res.json(session);
    Activity.create({ userId: req.user._id, action: 'session.completed', details: { taskId: session.taskId, activeMs: session.activeTime } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/heartbeat — client liveness beat ────────────────
// IES-P1-26: the client sends this periodically while a session is open (running
// OR paused). One atomic $set means the reaper never races a fresh beat; a beat
// for a session the reaper just closed returns 404 and the client can restart.
// The optional `at` is server-validated via serverTime — no fabricated beats.
router.patch('/:id/heartbeat', validate(null, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, isActive: true },
      { $set: { lastHeartbeat: serverTime(req.body && req.body.at) } },
      { new: true, projection: { lastHeartbeat: 1 } }
    );
    if (!session) return res.status(404).json({ message: 'Active session not found' });
    res.json({ lastHeartbeat: session.lastHeartbeat });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
