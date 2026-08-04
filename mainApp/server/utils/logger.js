// IES-P0-20: single structured JSON logger with redaction.
//
//   - All output is JSON via pino (writes to stderr so stdout stays clean).
//   - URL segments redact 24-hex ObjectIds, emails, and report share tokens.
//   - Error serialization redacts the same patterns from message/stack.
//   - `redact` config censors any object key that smells like a secret.
//
// `configureLogger` lets tests point the singleton at an in-memory sink.
'use strict';

const pino = require('pino');

const HEX_TOKEN_RE = /\b[0-9a-fA-F]{24}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// Censor known secret-ish keys wherever they appear in a logged object.
const REDACT_PATHS = [
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.expiryDate',
  '*.shareToken',
  '*.googleDocId',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

function redactUrl(url = '') {
  return String(url)
    .replace(/\/share\/token\/[^/?]+/g, '/share/token/[REDACTED]')
    .replace(/\/share\/(?!token\/)[^/?]+(\/revoke)?/g, '/share/[REDACTED]$1')
    .replace(HEX_TOKEN_RE, '[REDACTED]')
    .replace(EMAIL_RE, '[REDACTED]');
}

function createLogger(options = {}) {
  return pino(
    {
      level: options.level || process.env.LOG_LEVEL || 'info',
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      serializers: {
        err(err) {
          if (!err) return err;
          return {
            type: err.type || err.name,
            message: redactUrl(err.message),
            stack: err.stack ? redactUrl(err.stack) : undefined,
          };
        },
      },
      base: undefined, // no pid/hostname in every line
      ...(options.pinoOptions || {}),
    },
    options.destination || process.stderr
  );
}

// The exported `logger` is a stable wrapper that always delegates to the
// *current* pino instance, so `configureLogger` (used by tests to redirect
// output to an in-memory sink) takes effect for every module that already
// destructured `logger` at require time.
let instance = createLogger();

const logger = {
  info: (...args) => instance.info(...args),
  error: (...args) => instance.error(...args),
  warn: (...args) => instance.warn(...args),
  debug: (...args) => instance.debug(...args),
  fatal: (...args) => instance.fatal(...args),
  child: (...args) => instance.child(...args),
};

function configureLogger(options = {}) {
  instance = createLogger(options);
  return instance;
}

// Request log: request id, method, redacted URL, status, duration.
function requestLogger(req, res, next) {
  req.id = req.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info(
      {
        req: { id: req.id, method: req.method, url: redactUrl(req.originalUrl), remoteAddress: req.ip },
        res: { statusCode: res.statusCode },
        durationMs: Math.round(durationMs * 100) / 100,
      },
      'request completed'
    );
  });

  next();
}

module.exports = { logger, configureLogger, createLogger, requestLogger, redactUrl, REDACT_PATHS };
