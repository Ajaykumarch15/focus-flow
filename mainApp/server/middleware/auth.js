const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const SESSION_COOKIE = 'ff_session';

// IES-P0-12: the session JWT now lives in an httpOnly cookie. Read it there
// first, fall back to a Bearer header for non-browser clients / tooling.
// Cookie-header parsing is a belt-and-braces fallback for apps that don't mount
// cookie-parser (e.g. unit-test harnesses).
function readSessionToken(req) {
  if (req.cookies && req.cookies[SESSION_COOKIE]) return req.cookies[SESSION_COOKIE];

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith(`${SESSION_COOKIE}=`)) return trimmed.slice(SESSION_COOKIE.length + 1);
    }
  }

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
}

/**
 * Protect routes — verifies the session token and attaches req.user.
 * Usage: router.get('/protected', protect, handler)
 */
module.exports = async (req, res, next) => {
  try {
    const token = readSessionToken(req);
    if (!token) {
      return res.status(401).json({ message: 'No token — authorisation denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load fresh user doc. googleTokens is deliberately retained on req.user:
    // server-side Drive sync reads it from this doc (googleDrive.js, projects.js,
    // workLogs.js). It is stripped from every response by User's toJSON transform.
    const user = await User.findById(decoded.id).select('-passwordHash');

    // IES-P0-08: soft-deleted users are blocked per-request...
    if (!user || user.deletedAt) return res.status(401).json({ message: 'Token invalid or expired' });

    // ...and tokens carry the user's tokenVersion, bumped on delete/role change
    // and logout, so a previously-issued token is rejected immediately. Legacy
    // tokens without `tv` fail against a versioned user (forces a re-login).
    if (decoded.tv !== user.tokenVersion) return res.status(401).json({ message: 'Token invalid or expired' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};

module.exports.SESSION_COOKIE = SESSION_COOKIE;
