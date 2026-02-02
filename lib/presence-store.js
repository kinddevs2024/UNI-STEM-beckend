/**
 * In-memory presence store for heartbeat tracking
 *
 * Avoids DB writes on every heartbeat (every 3 sec per user).
 * Batches persist to MongoDB every 15-30 seconds.
 *
 * Key: `${attemptId}:${socketId}`
 * Value: { attemptId, socketId, lastSeenAt, status, dirty }
 */

const PRESENCE_MAP = new Map();

const KEY_SEP = ':';

function makeKey(attemptId, socketId) {
  return `${attemptId}${KEY_SEP}${socketId}`;
}

/**
 * Update presence (in-memory only, marks dirty for batch persist)
 * @param {string} attemptId
 * @param {string} socketId
 * @param {string} status - 'connected' | 'disconnected'
 * @param {Date} [lastSeenAt] - defaults to now
 */
export function update(attemptId, socketId, status = "connected", lastSeenAt = new Date()) {
  const key = makeKey(attemptId, socketId);
  const existing = PRESENCE_MAP.get(key);
  const entry = {
    attemptId,
    socketId,
    lastSeenAt: lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt),
    status,
    dirty: true,
  };
  PRESENCE_MAP.set(key, entry);
  return entry;
}

/**
 * Get presence for one attempt+socket
 */
export function get(attemptId, socketId) {
  return PRESENCE_MAP.get(makeKey(attemptId, socketId));
}

/**
 * Get all presence entries for an attempt (for compliance checks)
 */
export function getAllForAttempt(attemptId) {
  const prefix = `${attemptId}${KEY_SEP}`;
  const entries = [];
  for (const [key, val] of PRESENCE_MAP) {
    if (key.startsWith(prefix) && val.status === "connected") {
      entries.push(val);
    }
  }
  return entries;
}

/**
 * Remove presence (e.g. after disconnect persist)
 */
export function remove(attemptId, socketId) {
  return PRESENCE_MAP.delete(makeKey(attemptId, socketId));
}

/**
 * Get dirty entries for batch flush
 */
export function getDirtyEntries() {
  const entries = [];
  for (const [key, val] of PRESENCE_MAP) {
    if (val.dirty) {
      entries.push({ ...val });
    }
  }
  return entries;
}

/**
 * Mark entries as clean after successful persist
 */
export function markClean(attemptId, socketId) {
  const key = makeKey(attemptId, socketId);
  const entry = PRESENCE_MAP.get(key);
  if (entry) {
    entry.dirty = false;
  }
}

/**
 * Mark all given entries as clean
 */
export function markAllClean(entries) {
  for (const e of entries) {
    markClean(e.attemptId, e.socketId);
  }
}

const STALE_TIMEOUT_MS = 60000; // 60s without update = stale

/**
 * Remove sessions that haven't sent a heartbeat in 60+ seconds
 * Called at the start of each batch flush to clean up stale entries
 */
export function removeStaleSessions() {
  const now = Date.now();
  let removed = 0;
  for (const [key, val] of PRESENCE_MAP.entries()) {
    const age = now - new Date(val.lastSeenAt).getTime();
    if (age > STALE_TIMEOUT_MS) {
      PRESENCE_MAP.delete(key);
      removed++;
    }
  }
  return removed;
}
