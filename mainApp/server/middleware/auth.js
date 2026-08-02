const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verifies JWT and attaches req.user.
 * Usage: router.get('/protected', protect, handler)
 */
module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token — authorisation denied' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load fresh user doc. googleTokens is deliberately retained on req.user:
    // server-side Drive sync reads it from this doc (googleDrive.js, projects.js,
    // workLogs.js). It is stripped from every response by User's toJSON transform.
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};
