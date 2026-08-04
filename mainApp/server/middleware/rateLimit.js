// ── Rate limiting (IES-P0-09) ────────────────────────────────────────────────
// Two tiers of in-memory limiting (single-process deployment):
//   * Auth (strict)   — /api/auth/login and /api/auth/register. Login keys on
//                       IP + account and counts only FAILED attempts, so a
//                       successful login never consumes quota; N failures
//                       temporarily lock out that IP+account combo.
//                       Register keys on IP and counts every attempt (successes
//                       included) to throttle account-creation spam.
//   * API (lenient)   — safety net on every /api route (reports, admin, etc.),
//                       per-IP.
// Memory-backed stores are fine here; swap for a Redis-backed store if the
// service is ever scaled to multiple processes.
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_LOGIN_LIMIT = 10;           // failed attempts per IP+account
const AUTH_REGISTER_LIMIT = 5;         // requests per IP (successes count)
const API_LIMIT = 300;                 // requests per IP per window

// Account portion of the login key. ipKeyGenerator prepends a validated,
// IPv6-safe IP prefix so the composite key is `${ip}:${account}`.
function authAccount(req) {
  const email = req.body && req.body.email
    ? String(req.body.email).trim().toLowerCase()
    : '';
  return email || 'anon';
}

const baseConfig = {
  windowMs: AUTH_WINDOW_MS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

function createAuthLoginLimiter(overrides = {}) {
  return rateLimit({
    ...baseConfig,
    limit: AUTH_LOGIN_LIMIT,
    keyGenerator: ipKeyGenerator(authAccount),
    skipSuccessfulRequests: true,
    message: { message: 'Too many failed login attempts. Please try again later.' },
    ...overrides,
  });
}

function createAuthRegisterLimiter(overrides = {}) {
  return rateLimit({
    ...baseConfig,
    limit: AUTH_REGISTER_LIMIT,
    message: { message: 'Too many registration attempts. Please try again later.' },
    ...overrides,
  });
}

function createApiLimiter(overrides = {}) {
  return rateLimit({
    ...baseConfig,
    limit: API_LIMIT,
    message: { message: 'Too many requests. Please slow down.' },
    ...overrides,
  });
}

module.exports = { createAuthLoginLimiter, createAuthRegisterLimiter, createApiLimiter };
