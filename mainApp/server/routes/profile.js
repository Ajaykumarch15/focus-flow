const express = require('express');
const User    = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── GET /api/profile ──────────────────────────────────────────────────────────
router.get('/', (req, res) => res.json(req.user));

// ── PATCH /api/profile ────────────────────────────────────────────────────────
router.patch('/', async (req, res, next) => {
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
