const express = require('express');
const crypto = require('crypto');
const protect = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const PersonalTask = require('../models/PersonalTask');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const PersonalRoadmap = require('../models/PersonalRoadmap');
const Schedule = require('../models/Schedule');
const Habit = require('../models/Habit');
const Project = require('../models/Project');

const router = express.Router();
router.use(protect);

function computeChecksum(data) {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

// ── POST /api/backup/export ──────────────────────────────────────────────────
router.post('/export', async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [tasks, personalTasks, journals, workLogs, roadmaps, schedules, habits, projects] = await Promise.all([
      Task.find({ userId }).lean(),
      PersonalTask.find({ userId }).lean(),
      Journal.find({ userId }).lean(),
      WorkLog.find({ userId }).lean(),
      PersonalRoadmap.find({ userId }).lean(),
      Schedule.find({ userId }).lean(),
      Habit.find({ userId }).lean(),
      Project.find({ userId }).lean(),
    ]);

    const activeLogs = workLogs.filter(w => !w.closedAt);
    const closedLogs = workLogs.filter(w => w.closedAt);

    const profile = {
      name: req.user.name,
      email: req.user.email,
      settings: req.user.settings || {},
      streak: req.user.streak,
      totalPoints: req.user.totalPoints,
      leaderboardOptIn: req.user.leaderboardOptIn,
    };

    const data = {
      profile,
      theme: req.user.settings?.theme || {},
      tasks,
      journals,
      personalTasks,
      workLogs: { activeLogs, closedLogs },
      roadmaps,
      schedules,
      habits,
      projects,
      workspacePreference: req.user.settings?.activeWorkspace || 'personal',
    };

    const checksum = computeChecksum(data);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: String(userId),
      checksum,
      data,
    };

    res.json(backup);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/backup/import ──────────────────────────────────────────────────
router.post('/import', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const backup = req.body;

    if (!backup || backup.version !== 1 || !backup.data) {
      return res.status(400).json({ message: 'Invalid backup format' });
    }

    const checksum = computeChecksum(backup.data);
    if (checksum !== backup.checksum) {
      return res.status(400).json({ message: 'Backup integrity check failed (checksum mismatch)' });
    }

    const d = backup.data;
    const counts = { tasks: 0, journals: 0, personalTasks: 0, activeLogs: 0, closedLogs: 0, roadmaps: 0, schedules: 0, habits: 0, projects: 0 };

    // Merge tasks by title+createdAt dedup
    if (Array.isArray(d.tasks)) {
      for (const t of d.tasks) {
        const exists = await Task.findOne({ userId, title: t.title, createdAt: t.createdAt }).lean();
        if (!exists) {
          await Task.create({ ...t, userId, _id: undefined });
          counts.tasks++;
        }
      }
    }

    if (Array.isArray(d.journals)) {
      for (const j of d.journals) {
        const exists = await Journal.findOne({ userId, createdAt: j.createdAt }).lean();
        if (!exists) {
          await Journal.create({ ...j, userId, _id: undefined });
          counts.journals++;
        }
      }
    }

    if (Array.isArray(d.personalTasks)) {
      for (const t of d.personalTasks) {
        const exists = await PersonalTask.findOne({ userId, title: t.title, createdAt: t.createdAt }).lean();
        if (!exists) {
          await PersonalTask.create({ ...t, userId, _id: undefined });
          counts.personalTasks++;
        }
      }
    }

    if (d.workLogs) {
      const allLogs = [...(d.workLogs.activeLogs || []), ...(d.workLogs.closedLogs || [])];
      for (const wl of allLogs) {
        const exists = await WorkLog.findOne({ userId, createdAt: wl.createdAt }).lean();
        if (!exists) {
          const created = await WorkLog.create({ ...wl, userId, _id: undefined });
          if (wl.closedAt) counts.closedLogs++;
          else counts.activeLogs++;
        }
      }
    }

    if (Array.isArray(d.roadmaps)) {
      for (const r of d.roadmaps) {
        const exists = await PersonalRoadmap.findOne({ userId, title: r.title, createdAt: r.createdAt }).lean();
        if (!exists) {
          await PersonalRoadmap.create({ ...r, userId, _id: undefined });
          counts.roadmaps++;
        }
      }
    }

    if (Array.isArray(d.schedules)) {
      for (const s of d.schedules) {
        const exists = await Schedule.findOne({ userId, title: s.title, createdAt: s.createdAt }).lean();
        if (!exists) {
          await Schedule.create({ ...s, userId, _id: undefined });
          counts.schedules++;
        }
      }
    }

    if (Array.isArray(d.habits)) {
      for (const h of d.habits) {
        const exists = await Habit.findOne({ userId, title: h.title, createdAt: h.createdAt }).lean();
        if (!exists) {
          await Habit.create({ ...h, userId, _id: undefined });
          counts.habits++;
        }
      }
    }

    if (Array.isArray(d.projects)) {
      for (const p of d.projects) {
        const exists = await Project.findOne({ userId, name: p.name }).lean();
        if (!exists) {
          await Project.create({ ...p, userId, _id: undefined });
          counts.projects++;
        }
      }
    }

    // Update profile settings if present
    if (d.profile?.settings) {
      await User.findByIdAndUpdate(userId, { $set: { settings: d.profile.settings } });
    }

    res.json({ imported: counts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
