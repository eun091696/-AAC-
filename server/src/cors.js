'use strict';

/**
 * Applies CORS headers when the request Origin is in the allowlist.
 * If allowedOrigins is empty, no CORS headers are added (cross-origin browser
 * requests will be blocked by the browser itself) — safest default for prod.
 * Returns true if this was a preflight OPTIONS request that was fully handled.
 */
function applyCors(req, res, allowedOrigins) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

module.exports = { applyCors };
