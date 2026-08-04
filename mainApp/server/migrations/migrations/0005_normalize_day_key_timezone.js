// IES-P1-06: normalize calendar-day storage to the user's timezone.
//
// Before P1-06, three different "today" implementations existed:
//   - sessions/streaks used a UTC YYYY-MM-DD key with a server-local midnight
//     boundary (off by one day near midnight),
//   - habit entries were stored at server-local midnight,
//   - task deadlines were stored as the UTC-midnight instant of the calendar
//     date the user picked (off by one day for negative-offset timezones).
//
// This migration re-encodes existing habit entry dates and task deadlines as
// the user-timezone midnight of the day they represent:
//   - Habit entries: the day the instant falls in, in the user's timezone
//     (`dayKey(ts, tz)`). Server-local midnight of day D round-trips to D when
//     the server runs in (or near) the user's timezone — the previous behavior.
//   - Task deadlines: the UTC calendar date of the instant (`toISOString` key).
//     The legacy client encoded the picked date as UTC midnight, so the UTC
//     calendar day IS the picked date — this preserves it in every timezone.
//
// Idempotent: re-running on already-normalized data is a no-op.
// `streak.lastDate` strings are left untouched: users who never changed their
// timezone keep the old UTC-key behavior (RM-6), and the sessions route derives
// boundaries from the user's timezone from now on.
'use strict';

const { dayKey, localDateToUtc } = require('../../utils/dates');

function normalizeDate(value) {
  if (value == null) return null;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function userTz(tzByUser, userId) {
  const id = userId && typeof userId.toString === 'function' ? userId.toString() : userId;
  return tzByUser.get(id) || 'UTC';
}

module.exports = {
  async up({ db }) {
    const users = await db
      .collection('users')
      .find({}, { projection: { _id: 1, settings: 1 } })
      .toArray();
    const tzByUser = new Map(users.map((u) => [u._id.toString(), u.settings?.timezone || 'UTC']));

    // Habit entries: re-encode each entry date as the user-tz midnight of the
    // day it falls in (legacy storage was server-local midnight).
    const habits = await db
      .collection('habits')
      .find({ entries: { $exists: true, $ne: [] } })
      .toArray();
    for (const habit of habits) {
      const timeZone = userTz(tzByUser, habit.userId);
      let changed = false;
      for (const entry of habit.entries || []) {
        const ts = normalizeDate(entry && entry.date);
        if (ts == null) continue;
        const normalized = localDateToUtc(dayKey(ts, timeZone), timeZone).getTime();
        if (normalized !== ts) {
          entry.date = new Date(normalized);
          changed = true;
        }
      }
      if (changed) {
        await db.collection('habits').updateOne(
          { _id: habit._id },
          { $set: { entries: habit.entries } }
        );
      }
    }

    // Task deadlines: re-encode each deadline as the user-tz midnight of the
    // picked UTC calendar date (legacy client encoded the date as UTC midnight).
    const tasks = await db
      .collection('tasks')
      .find({ deadline: { $ne: null } })
      .toArray();
    for (const task of tasks) {
      const timeZone = userTz(tzByUser, task.userId);
      const ts = normalizeDate(task.deadline);
      if (ts == null) continue;
      const pickedDay = new Date(ts).toISOString().slice(0, 10);
      const normalized = localDateToUtc(pickedDay, timeZone).getTime();
      if (normalized !== ts) {
        await db.collection('tasks').updateOne(
          { _id: task._id },
          { $set: { deadline: new Date(normalized) } }
        );
      }
    }
  },
};
