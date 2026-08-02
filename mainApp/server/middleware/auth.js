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

    // IES-P0-08: soft-deleted users are blocked per-request...
    if (!user || user.deletedAt) return res.status(401).json({ message: 'Token invalid or expired' });

    // ...and tokens carry the user's tokenVersion, bumped on delete/role change,
    // so a previously-issued token is rejected immediately. Legacy tokens
    // without `tv` fail against a versioned user (forces a clean re-login).
    if (decoded.tv !== user.tokenVersion) return res.status(401).json({ message: 'Token invalid or expired' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};
