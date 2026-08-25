require('dotenv').config();
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { logger, requestLogger } = require('./utils/logger');
const { connectWithRetry, startServer, createShutdownHandler } = require('./utils/serverLifecycle');
const { healthRoutes, metricsMiddleware } = require('./middleware/health');

// ── Fail-fast environment validation ─────────────────────────────────────────
// Refuses to boot on missing/weak/placeholder config so a compromised or
// misconfigured deployment fails loudly instead of running insecurely.
const PLACEHOLDER_JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production_min_32_chars';

function validateEnvironment() {
  const errors = [];
  const jwtSecret = process.env.JWT_SECRET || '';

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
    errors.push('JWT_SECRET must not be the known placeholder value — generate a new one');
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required');
  } else if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'CLIENT_URL']) {
    if (!process.env[key]) errors.push(`${key} is required`);
  }
  for (const key of ['GOOGLE_REDIRECT_URI', 'CLIENT_URL']) {
    if (process.env[key]) {
      try {
        new URL(process.env[key]);
      } catch {
        errors.push(`${key} must be a valid URL`);
      }
    }
  }

  if (!process.env.PORT) {
    errors.push('PORT is required');
  } else {
    const port = Number(process.env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push('PORT must be an integer between 1 and 65535');
    }
  }

  if (errors.length > 0) {
    const banner = [
      '❌  Invalid environment configuration — refusing to boot:',
      ...errors.map(error => `   - ${error}`),
      '',
    ].join('\n');
    fs.writeSync(2, banner);
    process.exit(1);
  }
}

validateEnvironment();

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const sessionRoutes = require('./routes/sessions');
const journalRoutes = require('./routes/journals');
const profileRoutes = require('./routes/profile');
const workLogRoutes = require('./routes/workLogs');
const habitRoutes = require('./routes/habits');
const reportRoutes = require('./routes/reports');   // ← NEW
const adminRoutes = require('./routes/admin');     // ← NEW
const teamRoutes  = require('./routes/teams');     // ← NEW
const workspaceRoutes = require('./routes/workspaces'); // IES-P2-01
const projectRoutes = require('./routes/projects');
const notificationRoutes = require('./routes/notifications'); // IES-P2-05
const searchRoutes = require('./routes/search');             // IES-P2-06
const sprintRoutes = require('./routes/sprints');            // IES-R1
const featureRoutes = require('./routes/features');          // IES-R1
const milestoneRoutes = require('./routes/milestones');      // EEP2-P3.2.1
const phaseRoutes = require('./routes/phases');              // EEP2-P3.2.2
const moduleRoutes = require('./routes/modules');            // EEP2-P3.2.3
const commentRoutes = require('./routes/comments');          // EEP2-P5.3.1
const attachmentRoutes = require('./routes/attachments');    // EEP2-P5.3.2
const personalRoadmapRoutes = require('./routes/personalRoadmaps'); // Personal Roadmaps
const scheduleRoutes = require('./routes/schedules');         // Schedule & Planner
const { createApiLimiter } = require('./middleware/rateLimit'); // IES-P0-09
const { createSecurityHeaders } = require('./middleware/securityHeaders'); // IES-P0-11
const { csrfProtect } = require('./middleware/csrf'); // IES-P0-12
const errorHandler = require('./middleware/errorHandler'); // IES-P0-14
const { startReaper } = require('./jobs/reaper');          // IES-P1-26

const app = express();

// IES-P0-09b: behind Render's proxy X-Forwarded-For is always present. Without
// trusting the proxy, express-rate-limit's keyGenerator throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and every /api call 400s. Trust the first
// hop so the client IP is derived correctly in production (harmless locally).
app.set('trust proxy', 1);

// IES-P0-11: CSP + X-Frame-Options + nosniff + HSTS + Referrer-Policy.
app.use(createSecurityHeaders());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(require('cookie-parser')()); // IES-P0-12: read the httpOnly session cookie
// IES-P0-09: lenient per-IP safety net on every /api route (reports, admin, …).
// Auth routes add their own stricter limiter on top.
app.use('/api', createApiLimiter());
// IES-P0-12: reject cross-site state-changing requests (Origin/Referer check).
app.use('/api', csrfProtect);
// IES-P0-19: count requests for /api/metrics.
app.use('/api', metricsMiddleware);
// IES-P0-20: structured JSON request log (request id, status, duration, redacted URL).
app.use(requestLogger);

app.get('/auth/google/callback', authRoutes.handleGoogleCallback);

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/reports', reportRoutes);            // ← NEW
app.use('/api/admin', adminRoutes);              // ← NEW
app.use('/api/teams', teamRoutes);              // ← NEW
app.use('/api/workspaces', workspaceRoutes);    // IES-P2-01
app.use('/api/projects', projectRoutes);
app.use('/api/notifications', notificationRoutes); // IES-P2-05
app.use('/api/search', searchRoutes);              // IES-P2-06
app.use('/api/sprints', sprintRoutes);             // IES-R1
app.use('/api/features', featureRoutes);           // IES-R1
app.use('/api/milestones', milestoneRoutes);       // EEP2-P3.2.1
app.use('/api/phases', phaseRoutes);               // EEP2-P3.2.2
app.use('/api/modules', moduleRoutes);             // EEP2-P3.2.3
app.use('/api/comments', commentRoutes);           // EEP2-P5.3.1
app.use('/api/attachments', attachmentRoutes);     // EEP2-P5.3.2
app.use('/api/roadmaps', personalRoadmapRoutes);   // Personal Roadmaps
app.use('/api/schedules', scheduleRoutes);         // Schedule & Planner

// IES-P0-19: liveness, readiness, metrics.
app.use('/api', healthRoutes());

// IES-P0-14: JSON 404 catch-all, then the single sanitized error handler.
app.use(errorHandler.notFoundHandler);
app.use(errorHandler);

// IES-P0-18: bounded boot retry, then graceful shutdown on SIGINT/SIGTERM.
const PORT = process.env.PORT || 5001;
(async () => {
  await connectWithRetry(process.env.MONGODB_URI);
  const server = await startServer(app, PORT);
  // IES-P1-26: reclaim abandoned sessions in the background. unref()'d — it never
  // keeps the process alive on its own.
  startReaper();
  const shutdown = createShutdownHandler({ server });
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  logger.info('Server booted');
})().catch((err) => {
  logger.error({ err }, 'Server failed to boot');
  process.exit(1);
});
