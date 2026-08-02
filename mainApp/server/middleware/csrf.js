// IES-P0-12: CSRF defense via SameSite=Lax + strict Origin/Referer validation.
//
// The session JWT travels in an httpOnly+SameSite=Lax cookie, so browsers will
// not attach it to cross-site POSTs. This middleware is the second layer: any
// state-changing request that DOES carry an Origin/Referer must come from an
// allowed origin (the configured client URL or the API's own origin). Requests
// with no Origin/Referer (curl, server-to-server, same-site tools) are allowed —
// SameSite=Lax already keeps cookies off hostile cross-site requests.

const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function allowedOrigins(req) {
  const origins = new Set();
  if (process.env.CLIENT_URL) {
    try {
      origins.add(new URL(process.env.CLIENT_URL).origin);
    } catch {
      // invalid CLIENT_URL — ignore, caller env validation rejects it anyway
    }
  }
  // Same-origin API requests (e.g. behind a reverse proxy) must be allowed.
  origins.add(`${req.protocol}://${req.get('host')}`);
  return origins;
}

function csrfProtect(req, res, next) {
  if (!METHODS.has(req.method)) return next();

  const origin = req.headers.origin || (req.headers.referer ? originFromReferer(req.headers.referer) : null);

  // No Origin and no Referer → not a browser-initiated cross-site request.
  if (!origin) return next();
  // A `null` origin comes from sandboxed contexts — treat as hostile.
  if (origin === 'null') return res.status(403).json({ message: 'Invalid request origin' });

  if (allowedOrigins(req).has(origin)) return next();
  return res.status(403).json({ message: 'Invalid request origin' });
}

module.exports = { csrfProtect };
