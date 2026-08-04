// Model 1 · task-switch parity: every path that closes a session applies the
// same accounting.
//
// Before, `PATCH /:id/stop` awarded points/streak, recomputed the task total
// and synced linked worklogs, while the start-time orphan sweep (POST / with a
// session already open — the task-switch close) only recomputed task totals.
// A switch therefore left points, streaks and worklogs unsynced for the closed
// session. Both explicit stops and orphan closes now funnel through here.
//
// The reaper (`jobs/reaper.js`) reuses `finalizeSessionDoc` for the document
// mutation only; it deliberately skips the rewards (an abandoned zombie isn't
// credited) and keeps its own task-total recompute.
'use strict';

const Session = require('../models/Session');
const Task    = require('../models/Task');
const User    = require('../models/User');
const { syncTaskWorkLogs } = require('./worklogSync');
const { dayKey, localDateToUtc, userTimezone } = require('./dates');
const { logger } = require('./logger');

/**
 * Finalize a session document in place (no save): close any open pause at
 * `endTime`, mark inactive, recompute activeTime and focusScore. Pure — no DB
 * access, so the reaper can reuse it for zombie closes.
 */
function finalizeSessionDoc(session, endTime) {
  const lastPause = [...(session.pauseLog || [])].reverse().find((p) => !p.resumeTime);
  if (lastPause) {
    lastPause.resumeTime = endTime;
    session.totalPauseDuration =
      Math.max(0, session.totalPauseDuration || 0) + Math.max(0, endTime - lastPause.pauseStart);
  }

  session.endTime = endTime;
  session.isActive = false;
  session.activeTime = Math.max(0, endTime - session.startTime - (session.totalPauseDuration || 0));
  session.lastHeartbeat = endTime; // IES-P1-26

  // IES-P1-07: focusScore is bounded [0, 100] in the schema too.
  let score = 100;
  score -= (session.pauseCount || 0) * 5;
  if (session.activeTime > 0) {
    const pauseRatio = session.totalPauseDuration / session.activeTime;
    score -= Math.min(50, pauseRatio * 20);
  }
  session.focusScore = Math.max(0, Math.min(100, Math.round(score)));
  return session;
}

/**
 * Points, streak, task-total recompute and linked-worklog sync — the side
 * effects an explicit stop applies. Assumes the session doc is already
 * finalized and saved.
 *
 * IES-P1-06: the day key and the start-of-day boundary come from the user's
 * timezone — a UTC key over a server-local boundary used to drift by a day
 * near midnight.
 * IES-P1-08: points use an atomic $inc and the streak day-gate is a conditional
 * update, so concurrent stops can never lose an increment or double-count a day.
 */
async function rewardAndSync({ user, session, timeZone = userTimezone(user) }) {
  const todayStr = dayKey(session.endTime, timeZone);
  const todayStart = localDateToUtc(todayStr, timeZone).getTime();

  const todaySessions = await Session.find({
    userId: user._id,
    isActive: false,
    startTime: { $gte: todayStart },
  });
  const todayTotalMs = todaySessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);
  const goalMs = (user.settings?.dailyGoal ?? 8) * 3600000;

  const sessionPoints = Math.round((session.activeTime / 60000) * (session.focusScore / 100));
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

  const allSessions = await Session.find({ taskId: session.taskId, userId: user._id, isActive: false });
  const totalTime = allSessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);
  await Task.findByIdAndUpdate(session.taskId, { totalTime, status: 'todo' });

  // Sync to WorkLog automatically.
  // IES-P1-02: session-stop is the single writer for linked worklogs.
  try {
    await syncTaskWorkLogs(user._id, session.taskId, { timeZone });
  } catch (err) {
    logger.warn('WorkLog sync failed');
  }
}

/**
 * Finalize + reward in one step for the single-session paths (explicit stop).
 */
async function finalizeAndReward({ user, session, endTime }) {
  finalizeSessionDoc(session, endTime);
  await session.save();
  await rewardAndSync({ user, session });
  return session;
}

module.exports = { finalizeSessionDoc, rewardAndSync, finalizeAndReward };
