const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// All team routes require admin privileges
router.use(protect);
router.use(admin);

// ── GET /api/teams ────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const teams = await Team.find({}).populate('members', 'name email avatar role');
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/teams ───────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, description, members } = req.body;
    const team = new Team({
      name,
      description,
      members: members || [],
      createdBy: req.user._id
    });
    await team.save();
    const populated = await team.populate('members', 'name email avatar role');
    res.status(201).json(populated);
    Activity.create({ userId: req.user._id, action: 'team.created', details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/teams/:id ──────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, description, members } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (members) updates.members = members;

    const team = await Team.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('members', 'name email avatar role');
    
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
    Activity.create({ userId: req.user._id, action: 'team.updated', details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/teams/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json({ message: 'Team deleted' });
    Activity.create({ userId: req.user._id, action: 'team.deleted', details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/teams/:id/analytics ──────────────────────────────────────────────
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id).populate('members', 'name email');
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const memberIds = team.members.map(m => m._id);
    const { from, to } = req.query;

    const sessionQuery = { userId: { $in: memberIds }, isActive: false };
    if (from || to) {
      sessionQuery.startTime = {};
      if (from) sessionQuery.startTime.$gte = Number(from);
      if (to)   sessionQuery.startTime.$lte = Number(to);
    }

    const [completedSessions, activeSessions, tasks] = await Promise.all([
      Session.find({ ...sessionQuery, isActive: false }).populate('userId', 'name email'),
      Session.find({ userId: { $in: memberIds }, isActive: true }).populate('userId', 'name email'),
      Task.find({ userId: { $in: memberIds } })
    ]);

    // Aggregate by member
    const memberStats = {};
    const now = Date.now();

    team.members.forEach(m => {
      memberStats[m._id] = { 
        userId: m._id,
        name: m.name,
        totalTimeMs: 0, 
        completedTasks: 0,
        sessionCount: 0
      };
    });

    completedSessions.forEach(s => {
      const uid = s.userId._id.toString();
      if (memberStats[uid]) {
        memberStats[uid].totalTimeMs += (s.activeTime || 0);
        memberStats[uid].sessionCount += 1;
      }
    });

    // ADD LIVE PROGRESS: Include ongoing sessions for members
    activeSessions.forEach(s => {
      const uid = s.userId._id.toString();
      if (memberStats[uid]) {
        const liveActive = Math.max(0, now - s.startTime - (s.totalPauseDuration || 0));
        memberStats[uid].totalTimeMs += liveActive;
        memberStats[uid].sessionCount += 1;
      }
    });

    tasks.forEach(t => {
      if (t.status === 'completed' && memberStats[t.userId]) {
        memberStats[t.userId].completedTasks += 1;
      }
    });

    const totalTimeMs = Object.values(memberStats).reduce((acc, m) => acc + m.totalTimeMs, 0);

    res.json({
      teamName: team.name,
      summary: {
        totalTimeMs,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        activeMembers: team.members.length
      },
      memberBreakdown: Object.values(memberStats)
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
