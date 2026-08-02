const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { createAuthLoginLimiter, createAuthRegisterLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// IES-P0-09: strict, per-IP+per-account limits on credential endpoints.
// Login counts only failed attempts (successful logins don't consume quota);
// register counts every attempt to throttle account-creation spam.
const loginLimiter = createAuthLoginLimiter();
const registerLimiter = createAuthRegisterLimiter();

// ── Helper: sign a JWT ────────────────────────────────────────────────────────
// Embeds the user's tokenVersion (`tv`); protect rejects tokens whose `tv` no
// longer matches the user (invalidated on soft-delete / role change).
const signToken = (user) =>
  jwt.sign({ id: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'An account with this email already exists' });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash });

    res.status(201).json({
      token: signToken(user),
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    // Need passwordHash for comparison — select it explicitly; googleTokens stays off the response.
    // Soft-deleted users (deletedAt set) are rejected at login.
    const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash -googleTokens');
    // Defensive: the query already filters deletedAt, but never trust a stale doc.
    if (!user || user.deletedAt)
      return res.status(401).json({ message: 'Invalid email or password' });

    const valid = await user.comparePassword(password);
    if (!valid)
      return res.status(401).json({ message: 'Invalid email or password' });

    res.json({
      token: signToken(user),
      user,   // passwordHash stripped by toJSON transform
    });
    Activity.create({ userId: user._id, action: 'login', details: { email: user.email } }).catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the currently authenticated user (used on app boot to restore session)
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// ── Google OAuth URL Generator ────────────────────────────────────────────────
router.get('/google/url', protect, (req, res) => {
  try {
    const { getOAuth2Client } = require('../utils/googleDrive');
    const oauth2Client = getOAuth2Client();
    
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No authorization token provided' });
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      state: token
    });

    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Google OAuth Disconnect ───────────────────────────────────────────────────
router.post('/google/disconnect', protect, async (req, res) => {
  try {
    const user = req.user;
    user.googleConnected = false;
    user.googleTokens = undefined;
    await user.save();
    res.json({ message: 'Disconnected Google Drive successfully', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Google Callback Route Handler ─────────────────────────────────────────────
const handleGoogleCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/settings?error=missing_params`);
  }

  try {
    const { getOAuth2Client } = require('../utils/googleDrive');
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const userId = decoded.id;
    const user = await User.findById(userId);
    if (!user || user.deletedAt) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/settings?error=user_not_found`);
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    user.googleConnected = true;
    user.googleTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.googleTokens?.refreshToken,
      expiryDate: tokens.expiry_date,
    };

    user.markModified('googleTokens');
    await user.save();

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/settings?google_connected=true`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/settings?error=oauth_failed`);
  }
};

router.handleGoogleCallback = handleGoogleCallback;

module.exports = router;
