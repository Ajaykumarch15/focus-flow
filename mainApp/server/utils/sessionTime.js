/**
 * Server-authoritative session timestamps (IES-P0-07).
 *
 * Client-supplied start/pause/resume/end timestamps are never trusted
 * unbounded. `serverTime` accepts a client value only when it is plausible
 * (finite, not in the future beyond clock skew, within the 24h recency window,
 * and after the session start), otherwise it falls back to server Date.now().
 * This bounds `activeTime` — and therefore points, streaks and WorkLog time —
 * even when the offline queue replays previously-queued operations.
 */

// IES-P1-27: shared bounds come from `utils/dates.js` (single definition).
const { FUTURE_SKEW_MS, MAX_SESSION_AGE_MS } = require('./dates');

/**
 * @param {number|undefined|null} clientValue  epoch ms supplied by the client
 * @param {object} [opts]
 * @param {number} [opts.min]  session startTime; pause/resume/stop must not precede it
 * @param {number} [opts.now]  injectable server clock for tests (default Date.now())
 * @returns {number} epoch ms safe to record
 */
function serverTime(clientValue, { min = Number.NEGATIVE_INFINITY, now = Date.now() } = {}) {
  if (!Number.isFinite(clientValue)) return now;
  if (clientValue > now + FUTURE_SKEW_MS) return now;            // no future times
  if (clientValue < now - MAX_SESSION_AGE_MS) return now;        // no unbounded recency
  if (clientValue < min) return now;                             // end/pause/resume after start
  return clientValue;
}

module.exports = { serverTime, FUTURE_SKEW_MS, MAX_SESSION_AGE_MS };
