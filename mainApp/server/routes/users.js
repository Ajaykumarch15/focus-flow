const express = require('express');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

// GET /api/users — list all active users (for member pickers)
router.get('/', protect, async (req, res, next) => {
  try {
    const users = await User.find({ deletedAt: null })
      .select('name email avatar')
      .sort({ name: 1 })
      .limit(500);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
