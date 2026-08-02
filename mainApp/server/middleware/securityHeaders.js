// IES-P0-11: security headers + strict Content Security Policy (helmet).
const helmet = require('helmet');

const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  // 'unsafe-inline' required for the inline <style> block in index.html (and any
  // style-injecting UI libs); styles move to a file in FE-6 / IES-P0-25.
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  // Dev client (localhost:5173) fetches the API cross-origin at :5001 and uses
  // a websocket for HMR; behind nginx in prod /api is same-origin ('self').
  'connect-src': ["'self'", 'ws://localhost:5173', 'http://localhost:5001'],
  'frame-ancestors': ["'none'"],
};

function createSecurityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: CSP_DIRECTIVES,
    },
    referrerPolicy: { policy: 'no-referrer' },
  });
}

module.exports = { createSecurityHeaders, CSP_DIRECTIVES };
