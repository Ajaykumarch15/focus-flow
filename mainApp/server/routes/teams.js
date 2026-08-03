const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();

// IES-P0-16: body/param/query schemas.
const teamFields = {
  name: requiredString(100, 'name', 'Team name is required'),
  description: z.string().max(2000, 'Description too long'),
  members: z.array(objectId).max(100, 'Too many members'),
};
const teamCreateSchema = z.object({ ...teamFields }).passthrough();
const teamPatchSchema = z.object(teamFields).partial().passthrough();
const teamParamsSchema = z.object({ id: objectId });
const teamAnalyticsQuerySchema = z.object({
  from: z.coerce.number().finite('from must be a valid timestamp'),
  to: z.coerce.number().finite('to must be a valid timestamp'),
}).partial();

// All team routes require admin privileges
router.use(protect);
router.use(admin);

// ── IES-P1-23: membership only ever references active users ──────────────────
// Populate `members` with a `deletedAt: null` match so soft-deleted users are
// never rendered as team members. On write, the members array is filtered to
// active users up front; on soft-delete the admin cascade `$pull`s the user out
// of every team. `keepActiveMembers` also drops the `null`s that mongoose's
// populate-match leaves in place of excluded members.
const ACTIVE_MEMBERS_POPULATE = { path: 'members', select: 'name email avatar role', match: { deletedAt: null } };

function keepActiveMembers(team) {
  if (team && Array.isArray(team.members)) {
    team.members = team.members.filter((m) => m && m._id);
  }
  return team;
}

async function activeMemberIds(members) {
  if (!members || members.length === 0) return [];
  const active = await User.find({ _id: { $in: members }, deletedAt: null }).select('_id');
  return active.map((m) => m._id);
}

// ── GET /api/teams ────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const teams = await Team.find({}).populate(ACTIVE_MEMBERS_POPULATE);
    res.json(teams.map(keepActiveMembers));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/teams ───────────────────────────────────────────────────────────
router.post('/', validate(teamCreateSchema), async (req, res, next) => {
  try {
    const { name, description, members } = req.body;
    const team = new Team({
      name,
      description,
      members: await activeMemberIds(members || []),
      createdBy: req.user._id
    });
    await team.save();
    const populated = keepActiveMembers(await team.populate(ACTIVE_MEMBERS_POPULATE));
    res.status(201).json(populated);
    Activity.create({ userId: req.user._id, action: 'team.created', details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/teams/:id ──────────────────────────────────────────────────────
router.patch('/:id', validate(teamPatchSchema, { params: teamParamsSchema }), async (req, res, next) => {
  try {
    const { name, description, members } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (members) updates.members = await activeMemberIds(members);

    const team = keepActiveMembers(await Team.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate(ACTIVE_MEMBERS_POPULATE));
    
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
    Activity.create({ userId: req.user._id, action: 'team.updated', details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/teams/:id ─────────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: teamParamsSchema }), async (req, res, next) => {
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
router.get('/:id/analytics', validate(null, { params: teamParamsSchema, query: teamAnalyticsQuerySchema }), async (req, res, next) => {
  try {
    const team = keepActiveMembers(await Team.findById(req.params.id).populate({ path: 'members', select: 'name email', match: { deletedAt: null } }));
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
