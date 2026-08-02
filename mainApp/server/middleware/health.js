// IES-P0-19: liveness, readiness, and simple request metrics.
//
//   GET /api/health        → always 200 with uptime/memory/DB state (liveness)
//   GET /api/health/ready  → 200 when the DB is connected, else 503 (readiness)
//   GET /api/metrics       → in-memory counters for requests by method/status
//
// `readinessState` reads mongoose directly so /health/ready reflects reality.
'use strict';

const express = require('express');
const mongoose = require('mongoose');

const metrics = {
  startedAt: Date.now(),
  requests: { total: 0, byMethod: {}, byStatus: {} },
};

function readinessState() {
  return mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
}

// Count every request (method immediately, status once the response finishes).
function metricsMiddleware(req, res, next) {
  metrics.requests.total += 1;
  const method = req.method;
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;

  res.on('finish', () => {
    const status = String(res.statusCode);
    metrics.requests.byStatus[status] = (metrics.requests.byStatus[status] || 0) + 1;
  });

  next();
}

function healthRoutes() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      db: { state: readinessState(), connected: readinessState() === 1 },
    });
  });

  router.get('/health/ready', (_req, res) => {
    if (readinessState() === 1) {
      return res.json({ status: 'ready' });
    }
    res.status(503).json({ status: 'not_ready', db: readinessState() });
  });

  router.get('/metrics', (_req, res) => {
    res.json({
      uptime: process.uptime(),
      startedAt: new Date(metrics.startedAt),
      requests: metrics.requests,
      memory: process.memoryUsage(),
    });
  });

  return router;
}

module.exports = { healthRoutes, metricsMiddleware, readinessState, metrics };
