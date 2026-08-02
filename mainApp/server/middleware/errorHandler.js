// IES-P0-14: single owner of error responses.
//
// Contract:
//   - 4xx thrown by routes (`err.status` + optional `err.code`) keep their
//     status and their crafted, safe message.
//   - Mongoose ValidationError / CastError / duplicate-key map to structured
//     400/409 responses.
//   - Everything else becomes a sanitized 500. The full error is logged
//     server-side; raw `err.message` never reaches the client.
//
// Mount order (index.js): routes → notFoundHandler → errorHandler.

const { logger, redactUrl } = require('../utils/logger');

function normalizeError(err) {
  if (err.status && err.status >= 400 && err.status < 500) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code || 'BAD_REQUEST',
          message: err.message || 'Bad request',
        },
      },
    };
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map(e => e.message)
      .join('; ');
    return { status: 400, body: { error: { code: 'VALIDATION_ERROR', message } } };
  }

  if (err.name === 'CastError') {
    return {
      status: 400,
      body: { error: { code: 'INVALID_PARAMETER', message: `Invalid value for "${err.path}"` } },
    };
  }

  if (err.code === 11000) {
    return { status: 409, body: { error: { code: 'CONFLICT', message: 'Resource already exists' } } };
  }

  return { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' } } };
}

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const { status, body } = normalizeError(err);
  logger.error(
    {
      err,
      req: { method: req.method, url: redactUrl(req.originalUrl), id: req.id },
      res: { statusCode: status },
    },
    'request failed'
  );
  res.status(status).json(body);
};

module.exports.normalizeError = normalizeError;

// IES-P0-14: JSON 404 catch-all. Mounted AFTER all routes, BEFORE the error handler.
module.exports.notFoundHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
};
