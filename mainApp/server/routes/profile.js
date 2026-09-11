const express = require('express');
const User    = require('../models/User');
const Task    = require('../models/Task');
const Session = require('../models/Session');
const protect = require('../middleware/auth');
const { z, validate } = require('../utils/validation');

const router = express.Router();

// ── Validation Schemas ────────────────────────────────────────────────────────

const profileSettingsSchema = z.record(z.string(), z.unknown()).refine(
  (settings) => {
    const validGoal = (v) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 24;
    if (settings.dailyGoal !== undefined && !validGoal(settings.dailyGoal)) return false;
    if (settings.personalDailyGoal !== undefined && !validGoal(settings.personalDailyGoal)) return false;
    return true;
  },
  { message: 'dailyGoal and personalDailyGoal must be between 0 and 24 hours' }
);

const socialLinksSchema = z.object({
  website:  z.string().max(200).default(''),
  github:   z.string().max(200).default(''),
  twitter:  z.string().max(200).default(''),
  linkedin: z.string().max(200).default(''),
}).partial().default({});

const profilePatchSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name too long'),
  avatar: z.string().max(2000, 'Avatar URL too long'),
  bio: z.string().max(500, 'Bio too long').default(''),
  socialLinks: socialLinksSchema,
  leaderboardOptIn: z.boolean(),
  settings: profileSettingsSchema,
}).partial().passthrough();

// ── Protected Routes (require auth) ──────────────────────────────────────────

router.use(protect);

// GET /api/profile — current user's full profile
router.get('/', (req, res) => res.json(req.user));

// PATCH /api/profile — update own profile
router.patch('/', validate(profilePatchSchema), async (req, res, next) => {
  try {
    const { name, avatar, bio, socialLinks, settings, leaderboardOptIn } = req.body;
    const updates = {};
    if (name)     updates.name   = name;
    if (avatar !== undefined) updates.avatar = avatar;
    if (bio !== undefined)    updates.bio = bio;
    if (socialLinks) updates.socialLinks = { ...req.user.socialLinks?.toObject(), ...socialLinks };
    if (leaderboardOptIn !== undefined) updates.leaderboardOptIn = leaderboardOptIn;
    if (settings) updates.settings = { ...req.user.settings.toObject(), ...settings };

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-googleTokens');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ── Public Profile Routes ────────────────────────────────────────────────────

// GET /api/profile/:userId — public profile view
router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const isSelf = String(req.user._id) === String(userId);

    const user = await User.findById(userId)
      .select('name avatar bio socialLinks createdAt streak totalPoints leaderboardOptIn');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Non-self viewers require leaderboard opt-in
    if (!isSelf && !user.leaderboardOptIn) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      socialLinks: user.socialLinks,
      joinedAt: user.createdAt,
      streak: user.streak,
      totalPoints: user.totalPoints,
      leaderboardOptIn: user.leaderboardOptIn,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/profile/:userId/stats — aggregated profile stats
router.get('/:userId/stats', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const isSelf = String(req.user._id) === String(userId);

    const user = await User.findById(userId).select('leaderboardOptIn');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!isSelf && !user.leaderboardOptIn) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Each aggregation is independently guarded so one failure doesn't break the whole response

    let tasksCompleted = 0;
    try {
      const taskStats = await Task.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            tasksCompleted: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          },
        },
      ]);
      tasksCompleted = taskStats[0]?.tasksCompleted || 0;
    } catch (err) {
      console.error('[ProfileStats] Task aggregation failed:', err.message);
    }

    let sessionsCount = 0;
    let totalFocusMs = 0;
    try {
      const sessionStats = await Session.aggregate([
        { $match: { userId: user._id, isActive: false } },
        {
          $group: {
            _id: null,
            sessionsCount: { $sum: 1 },
            totalFocusMs: { $sum: '$activeTime' },
          },
        },
      ]);
      sessionsCount = sessionStats[0]?.sessionsCount || 0;
      totalFocusMs = sessionStats[0]?.totalFocusMs || 0;
    } catch (err) {
      console.error('[ProfileStats] Session aggregation failed:', err.message);
    }

    const dailyHours = {};
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const dailySessions = await Session.aggregate([
        { $match: { userId: user._id, isActive: false, startTime: { $gte: oneYearAgo.getTime() } } },
        {
          $project: {
            day: {
              $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$startTime' } },
            },
            activeTime: 1,
          },
        },
        {
          $group: {
            _id: '$day',
            totalMs: { $sum: '$activeTime' },
          },
        },
      ]);
      for (const entry of dailySessions) {
        dailyHours[entry._id] = Math.round(entry.totalMs / 3600000 * 10) / 10;
      }
    } catch (err) {
      console.error('[ProfileStats] Daily hours aggregation failed:', err.message);
    }

    let recentActivity = [];
    try {
      const recentTasks = await Task.find({ userId: user._id, status: 'completed' })
        .select('title completedAt totalTime')
        .sort({ completedAt: -1 })
        .limit(10)
        .lean();

      const recentSessions = await Session.find({ userId: user._id, isActive: false })
        .select('startTime activeTime')
        .sort({ startTime: -1 })
        .limit(10)
        .lean();

      recentActivity = [
        ...recentTasks.map(t => ({
          type: 'task_completed',
          title: t.title,
          date: t.completedAt,
          durationMs: t.totalTime,
        })),
        ...recentSessions.map(s => ({
          type: 'session_logged',
          title: 'Focus session',
          date: new Date(s.startTime).toISOString(),
          durationMs: s.activeTime,
        })),
      ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
    } catch (err) {
      console.error('[ProfileStats] Recent activity query failed:', err.message);
    }

    let rank = null;
    try {
      if (user.leaderboardOptIn) {
        const rankResult = await User.aggregate([
          { $match: { leaderboardOptIn: true, deletedAt: null } },
          { $sort: { totalPoints: -1 } },
          { $group: { _id: null, userIds: { $push: '$_id' } } },
          {
            $project: {
              rank: {
                $addArrays: [
                  [{ $indexOfArray: ['$userIds', user._id] }],
                ],
              },
            },
          },
        ]);
        if (rankResult.length > 0 && rankResult[0].rank[0] >= 0) {
          rank = rankResult[0].rank[0] + 1;
        }
      }
    } catch (err) {
      console.error('[ProfileStats] Leaderboard rank aggregation failed:', err.message);
    }

    res.json({
      totalFocusMs,
      tasksCompleted,
      sessionsCount,
      dailyHours,
      recentActivity,
      rank,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
