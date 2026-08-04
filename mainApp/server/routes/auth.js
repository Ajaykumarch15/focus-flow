const express = require('express');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { createAuthLoginLimiter, createAuthRegisterLimiter } = require('../middleware/rateLimit');
const { logger } = require('../utils/logger');
const { z, email, validate } = require('../utils/validation');

const router = express.Router();

// IES-P0-16: body schemas.
// IES-P1-25: password policy is "at least 12 characters" (no complexity
// requirements) — enforced at the schema, the route, and the client UI so a
// weak password can never slip through any single layer.
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  email,
  password: z.string().min(12, 'Password must be at least 12 characters').max(200, 'Password too long'),
});

// Password reset flow — DOCUMENTED ONLY (out of scope unless the PRD requires it):
//   1. POST /api/auth/forgot  → issue an opaque single-use reset token (hashed in
//      the user doc with a short TTL, mirroring the googleOAuth nonce pattern),
//      emailed to the address. Never leaks whether the email exists.
//   2. GET  /api/auth/reset?token=…  → validate token + expiry, render the form.
//   3. POST /api/auth/reset   → hash the new password (min 12), consume the token,
//      and bump tokenVersion so any in-flight JWTs are revoked.
//   4. Rate-limit every step with the same strict per-IP limiter as register.

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email and password are required').max(255),
  password: z.string().min(1, 'Email and password are required').max(200),
});

// IES-P0-10: OAuth state TTL — a nonce that expires before it is consumed is
// treated as invalid, forcing the user to start a fresh connect flow.
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const sha256hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const pkceChallenge = (verifier) =>
  crypto.createHash('sha256').update(verifier).digest('base64url');
const randomToken = () => crypto.randomBytes(32).toString('hex');

// IES-P0-09: strict, per-IP+per-account limits on credential endpoints.
// Login counts only failed attempts (successful logins don't consume quota);
// register counts every attempt to throttle account-creation spam.
const loginLimiter = createAuthLoginLimiter();
const registerLimiter = createAuthRegisterLimiter();

// ── Helper: sign a JWT ────────────────────────────────────────────────────────
// Embeds the user's tokenVersion (`tv`); protect rejects tokens whose `tv` no
// longer matches the user (invalidated on soft-delete / role change / logout).
const signToken = (user) =>
  jwt.sign({ id: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '30d' });

// IES-P0-12: the session JWT is delivered in an httpOnly cookie so no script can
// read it (XSS-proof). SameSite is computed per request:
//  - Same-origin deployments (nginx proxy, single host) → Lax (strictest).
//  - Cross-origin deployments (static SPA host + separate API host, e.g. two
//    Render services) → None + Secure. SameSite=Lax would make the browser
//    silently drop the cookie on cross-origin fetch(), which logs users out
//    immediately after login/register. None is only emitted over HTTPS.
const SESSION_COOKIE = 'ff_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d, matching signToken
const sessionCookieOptions = (req) => {
  const secure = process.env.NODE_ENV === 'production';
  let sameSite = 'lax';
  try {
    const clientOrigin = new URL(process.env.CLIENT_URL).origin;
    const apiOrigin = `${req.protocol}://${req.get('host')}`;
    if (secure && clientOrigin !== apiOrigin) sameSite = 'none';
  } catch {
    // invalid/missing CLIENT_URL — env validation rejects it at boot anyway.
  }
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
};
const setSessionCookie = (res, token, req) => res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
const clearSessionCookie = (res, req) =>
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(req), maxAge: undefined });

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', registerLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    if (password.length < 12)
      return res.status(400).json({ message: 'Password must be at least 12 characters' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'An account with this email already exists' });

    const passwordHash = await User.hashPassword(password);
    let user;
    try {
      user = await User.create({ name, email, passwordHash });
    } catch (err) {
      // IES-P1-25: two concurrent registers can both pass the findOne pre-check,
      // then one create loses the race on the unique email index (E11000). Map
      // that to the same friendly 409 instead of leaking the raw Mongo error.
      if (err && err.code === 11000) {
        return res.status(409).json({ message: 'An account with this email already exists' });
      }
      throw err;
    }

    setSessionCookie(res, signToken(user), req);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    // passwordHash is included by default (not select:false), so a pure
    // exclusion projection keeps it available for comparePassword while keeping
    // googleTokens out of the query result. Mixing `+passwordHash` (inclusion)
    // with `-googleTokens` (exclusion) is rejected by MongoDB. The toJSON
    // transform additionally strips both from the response.
    // Soft-deleted users (deletedAt set) are rejected at login.
    const user = await User.findOne({ email, deletedAt: null }).select('-googleTokens');
    // Defensive: the query already filters deletedAt, but never trust a stale doc.
    if (!user || user.deletedAt)
      return res.status(401).json({ message: 'Invalid email or password' });

    const valid = await user.comparePassword(password);
    if (!valid)
      return res.status(401).json({ message: 'Invalid email or password' });

    setSessionCookie(res, signToken(user), req);
    res.json({ user });   // passwordHash stripped by toJSON transform
    Activity.create({ userId: user._id, action: 'login', details: { email: user.email } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Clears the session cookie and bumps the user's tokenVersion so the issued
// JWT is revoked server-side and can never be replayed. (Trade-off: also signs
// out that user's other sessions — a single global session version.)
router.post('/logout', protect, async (req, res, next) => {
  try {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    clearSessionCookie(res, req);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the currently authenticated user (used on app boot to restore session)
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// ── Google OAuth URL Generator ────────────────────────────────────────────────
// IES-P0-10: no JWT/bearer token in the URL. Issues an opaque single-use nonce
// (stored hashed with an expiry) plus a PKCE code_challenge; the callback redeems
// the code only with the matching code_verifier, proving possession of the flow.
router.get('/google/url', protect, async (req, res, next) => {
  try {
    const { getOAuth2Client } = require('../utils/googleDrive');
    const oauth2Client = getOAuth2Client();

    const state = randomToken();
    const codeVerifier = randomToken();
    const codeChallenge = pkceChallenge(codeVerifier);

    req.user.googleOAuth = {
      stateHash: sha256hex(state),
      stateExpiry: new Date(Date.now() + OAUTH_STATE_TTL_MS),
      codeVerifier,
    };
    req.user.markModified('googleOAuth');
    await req.user.save();

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ── Google OAuth Disconnect ───────────────────────────────────────────────────
router.post('/google/disconnect', protect, async (req, res, next) => {
  try {
    const user = req.user;
    user.googleConnected = false;
    user.googleTokens = undefined;
    user.driveSyncError = ''; // IES-P1-24: disconnecting resets any prior failure.
    await user.save();
    res.json({ message: 'Disconnected Google Drive successfully', user });
  } catch (err) {
    next(err);
  }
});

// ── Google Callback Route Handler ─────────────────────────────────────────────
const handleGoogleCallback = async (req, res, next) => {
  const { code, state } = req.query;
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  if (!code || !state) {
    return res.redirect(`${base}/settings?error=missing_params`);
  }

  try {
    const { getOAuth2Client } = require('../utils/googleDrive');

    // The callback carries an opaque nonce, not a JWT. Find the user by the
    // stored hash — a nonce we never issued simply doesn't match.
    const user = await User.findOne({ 'googleOAuth.stateHash': sha256hex(state) });
    if (!user || user.deletedAt) {
      return res.redirect(`${base}/settings?error=user_not_found`);
    }
    if (!user.googleOAuth.stateExpiry || new Date(user.googleOAuth.stateExpiry) < new Date()) {
      return res.redirect(`${base}/settings?error=state_expired`);
    }

    const codeVerifier = user.googleOAuth.codeVerifier;

    // Single-use: consume the nonce BEFORE redeeming the code, so a replayed
    // callback can never redeem the same authorization code twice.
    user.googleOAuth = undefined;
    user.markModified('googleOAuth');
    await user.save();

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code, { code_verifier: codeVerifier });

    user.googleConnected = true;
    user.googleTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.googleTokens?.refreshToken,
      expiryDate: tokens.expiry_date,
    };
    user.driveSyncError = ''; // IES-P1-24: a fresh connection clears prior failures.

    user.markModified('googleTokens');
    await user.save();

    res.redirect(`${base}/settings?google_connected=true`);
  } catch (err) {
    logger.warn('Google OAuth callback failed');
    res.redirect(`${base}/settings?error=oauth_failed`);
  }
};

router.handleGoogleCallback = handleGoogleCallback;

module.exports = router;
