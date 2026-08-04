'use strict';

// IES-P1-17 · system-wide admin analytics via MongoDB aggregation pipelines.
//
// The previous implementation (admin.js /system-analytics) loaded every session,
// task, and user in the period into Node and aggregated in JS. Here the heavy
// lifting — per-day focus, per-status/per-category task totals, per-day signups —
// happens in the database with $match/$group/$facet, so Node memory stays
// bounded regardless of collection size. Output fields mirror the old handler
// exactly so the admin UI is unchanged.
//
// Window semantics preserved from the original handler:
//   - headline session metrics : completed sessions in [period, now)
//   - dailyFocus               : completed sessions in [max(period, now-30d), now)
//     (week → last 7d, month → last 30d, quarter → last 30d, as before)
//   - userGrowth               : signups in the trailing 30 days, zero-filled
//   - day keys are UTC ("YYYY-MM-DD"), matching the old toISOString().slice(0,10)
//   - live (currently running) sessions add to `totalSessions` only — never to
//     `totalFocusMs`, `avgFocusScore`, or `activeUsers` — exactly as before.

const User = require('../models/User');
const Task = require('../models/Task');
const Session = require('../models/Session');

const DAY_MS = 86400000;
const DAILY_SERIES_DAYS = 30;
const PERIOD_MS = { week: 7 * DAY_MS, month: 30 * DAY_MS, quarter: 90 * DAY_MS };

function resolvePeriod(period) {
  return PERIOD_MS[period] || PERIOD_MS.month;
}

function utcDayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function runSystemAnalytics({ period, now = Date.now() }) {
  const periodName = period || 'month';
  const fromMs = now - resolvePeriod(periodName);
  const dailyFromMs = Math.max(fromMs, now - DAILY_SERIES_DAYS * DAY_MS);
  const thirtyDaysAgoMs = now - DAILY_SERIES_DAYS * DAY_MS;

  // IES-P1-23 · soft-deleted users must never count toward system analytics.
  // Session/task pipelines $lookup the owning user and keep only rows whose
  // user is active (`'u.deletedAt': null`), so a deleted user's child data
  // drops out of focus totals, task totals, active-user counts, and the live
  // session count. The live-session count moves into a third `$facet` branch so
  // the whole run stays a single pipeline over the sessions collection.
  const [totalUsers, newUsers, sessionAgg, taskAgg, userGrowthAgg] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ deletedAt: null, createdAt: { $gte: new Date(fromMs) } }),
    Session.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $match: { 'u.deletedAt': null } },
      { $facet: {
          period: [
            { $match: { isActive: false, startTime: { $gte: fromMs, $lt: now } } },
            { $group: {
                _id: null,
                totalFocusMs: { $sum: '$activeTime' },
                totalFocusScore: { $sum: '$focusScore' },
                sessionCount: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
              } },
            { $project: { _id: 0, totalFocusMs: 1, totalFocusScore: 1, sessionCount: 1, uniqueUsers: { $size: '$uniqueUsers' } } },
          ],
          daily: [
            { $match: { isActive: false, startTime: { $gte: dailyFromMs, $lt: now } } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$startTime' }, timezone: 'UTC' } },
                totalMs: { $sum: '$activeTime' },
                sessionCount: { $sum: 1 },
                activeUsers: { $addToSet: '$userId' },
              } },
            { $project: { _id: 0, date: '$_id', totalMs: 1, sessionCount: 1, activeUsers: { $size: '$activeUsers' } } },
            { $sort: { date: 1 } },
          ],
          live: [
            { $match: { isActive: true } },
            { $count: 'n' },
          ],
        } },
    ]),
    Task.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $match: { 'u.deletedAt': null, createdAt: { $gte: new Date(fromMs) } } },
      { $facet: {
          totals: [
            { $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              } },
          ],
          byCategory: [
            // Legacy JS used `t.category || 'Uncategorized'`, so null/'' map too.
            { $group: {
                _id: { $cond: [{ $in: ['$category', [null, '']] }, 'Uncategorized', '$category'] },
                totalTimeMs: { $sum: '$totalTime' },
                taskCount: { $sum: 1 },
              } },
            { $project: { _id: 0, category: '$_id', totalTimeMs: 1, taskCount: 1 } },
            { $sort: { totalTimeMs: -1 } },
            { $limit: 10 },
          ],
        } },
    ]),
    User.aggregate([
      // IES-P1-23: the signup trend now excludes soft-deleted users too — the
      // legacy behavior (count every createdAt) kept deleted users in the chart.
      { $match: { deletedAt: null, createdAt: { $gte: new Date(thirtyDaysAgoMs) } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        } },
    ]),
  ]);

  const periodStats = sessionAgg[0]?.period?.[0] || { totalFocusMs: 0, totalFocusScore: 0, sessionCount: 0, uniqueUsers: 0 };
  // IES-P1-23: live sessions are counted from the same (deleted-user-filtered)
  // pipeline — `$facet.live` reports how many active sessions belong to active users.
  const liveSessionCount = sessionAgg[0]?.live?.[0]?.n || 0;
  const avgFocusScore = periodStats.sessionCount > 0
    ? Math.round(periodStats.totalFocusScore / periodStats.sessionCount)
    : 0;

  const taskTotals = taskAgg[0]?.totals?.[0] || { totalTasks: 0, completedTasks: 0 };
  const totalTasks = taskTotals.totalTasks || 0;
  const completedTasks = taskTotals.completedTasks || 0;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const dailyFocus = sessionAgg[0]?.daily || [];
  const topCategories = taskAgg[0]?.byCategory || [];

  const signupCounts = new Map((userGrowthAgg || []).map((group) => [group._id, group.count]));
  const userGrowth = [];
  for (let i = DAILY_SERIES_DAYS - 1; i >= 0; i--) {
    const date = utcDayKey(now - i * DAY_MS);
    userGrowth.push({ date, count: signupCounts.get(date) || 0 });
  }

  return {
    period: periodName,
    totalUsers,
    newUsers,
    activeUsers: periodStats.uniqueUsers,
    totalFocusMs: periodStats.totalFocusMs,
    totalSessions: periodStats.sessionCount + liveSessionCount,
    avgFocusScore,
    taskCompletionRate,
    totalTasks,
    completedTasks,
    dailyFocus,
    topCategories,
    userGrowth,
  };
}

module.exports = { runSystemAnalytics };
