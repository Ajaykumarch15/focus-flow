// IES-P0-18: boot retry with backoff + graceful shutdown.
//
//   - Mongo connect failure is retried (bounded, exponential backoff) instead of
//     an immediate hard `process.exit(1)`.
//   - SIGINT/SIGTERM drain in-flight requests (`server.close`), then disconnect
//     mongoose, with a timeout force-exit so the process can never hang.
//
// All knobs are env-overridable for tests/ops:
//   BOOT_MAX_RETRIES (default 5), BOOT_RETRY_BASE_DELAY_MS (default 1000),
//   SHUTDOWN_TIMEOUT_MS (default 10000).
'use strict';

const mongoose = require('mongoose');
const { logger } = require('./logger');

const MAX_RETRIES = Number(process.env.BOOT_MAX_RETRIES) || 5;
const BASE_DELAY_MS = Number(process.env.BOOT_RETRY_BASE_DELAY_MS) || 1000;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000;

async function connectWithRetry(uri, options = {}) {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? BASE_DELAY_MS;
  const log = options.logger || logger;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(uri);
      log.info('MongoDB connection established');
      return;
    } catch (err) {
      log.error({ attempt, maxRetries }, `MongoDB connection failed: ${err.message}`);
      if (attempt >= maxRetries) {
        log.error('MongoDB connection retries exhausted, exiting');
        process.exit(1);
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function startServer(app, port, options = {}) {
  const log = options.logger || logger;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      log.info({ port }, `Server listening on http://localhost:${port}`);
      resolve(server);
    });
    server.once('error', (err) => {
      log.error({ err: err.message }, 'Failed to start HTTP server');
      reject(err);
    });
  });
}

function createShutdownHandler(options = {}) {
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  const log = options.logger || logger;
  let server = options.server || null;
  let shuttingDown = false;

  return async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'Shutting down gracefully');

    const forceTimer = setTimeout(() => {
      log.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs);
    forceTimer.unref();

    try {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    } catch (err) {
      log.warn({ err: err.message }, 'Error closing HTTP server');
    }

    try {
      await mongoose.disconnect();
    } catch (err) {
      log.warn({ err: err.message }, 'Error disconnecting mongoose');
    }

    clearTimeout(forceTimer);
    process.exit(0);
  };
}

module.exports = {
  connectWithRetry,
  startServer,
  createShutdownHandler,
  MAX_RETRIES,
  BASE_DELAY_MS,
  SHUTDOWN_TIMEOUT_MS,
};
