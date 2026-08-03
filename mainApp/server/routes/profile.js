const express = require('express');
const User    = require('../models/User');
const protect = require('../middleware/auth');
const { z, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: PATCH /api/profile accepts only known, well-typed fields.
// IES-P1-07: settings values are bounded here too, so a hostile body can't
// persist a value that the User model (validated on every save) would reject.
const profileSettingsSchema = z.record(z.string(), z.unknown()).refine(
  (settings) => {
    if (settings.dailyGoal !== undefined) {
      const goal = settings.dailyGoal;
      return typeof goal === 'number' && Number.isFinite(goal) && goal >= 0 && goal <= 24;
    }
    return true;
  },
  { message: 'dailyGoal must be between 0 and 24 hours' }
);

const profilePatchSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name too long'),
  avatar: z.string().max(2000, 'Avatar URL too long'),
  leaderboardOptIn: z.boolean(),
  settings: profileSettingsSchema,
}).partial().passthrough();

// ── GET /api/profile ──────────────────────────────────────────────────────────
router.get('/', (req, res) => res.json(req.user));

// ── PATCH /api/profile ────────────────────────────────────────────────────────
router.patch('/', validate(profilePatchSchema), async (req, res, next) => {
  try {
    const { name, avatar, settings, leaderboardOptIn } = req.body;
    const updates = {};
    if (name)     updates.name   = name;
    if (avatar)   updates.avatar = avatar;
    if (leaderboardOptIn !== undefined) updates.leaderboardOptIn = leaderboardOptIn;
    if (settings) updates.settings = { ...req.user.settings.toObject(), ...settings };

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-googleTokens');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
