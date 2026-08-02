/**
 * buildPatch(body, allowlist)
 *
 * Builds a plain object safe to pass to MongoDB as a `$set` patch from an
 * arbitrary request body.
 *
 * - Only allowlisted fields are copied through; everything else is dropped.
 * - Nested sub-document fields are matched on dotted paths, e.g.
 *   "problemFlow.problem", "moodMetrics.energy".
 * - MongoDB operator keys ("$set", "$inc", ...), prototype-pollution keys
 *   ("__proto__", "constructor", "prototype"), and non-string keys are rejected.
 * - Whole nested documents are only accepted if allowlisted explicitly.
 */
function flatten(allowlist, prefix = '') {
  const out = new Set();
  for (const [key, value] of Object.entries(allowlist)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === true) {
      out.add(path);
    } else if (value && typeof value === 'object') {
      for (const child of flatten(value, path)) out.add(child);
    }
  }
  return out;
}

function isDangerousKey(key) {
  return (
    key.startsWith('$') ||
    key.includes('__proto__') ||
    key.includes('constructor') ||
    key.includes('prototype')
  );
}

function buildPatch(body, allowlist) {
  const patch = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return patch;

  const allowed = flatten(allowlist);

  for (const key of Object.keys(body)) {
    if (isDangerousKey(key)) continue;
    if (!allowed.has(key)) continue;
    patch[key] = body[key];
  }

  return patch;
}

module.exports = { buildPatch };
