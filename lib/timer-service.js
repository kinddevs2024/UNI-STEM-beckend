/**
 * Timer Service - Server-authoritative timer management
 * 
 * This service ensures that timers are managed server-side and cannot be manipulated
 * by clients. The server calculates endsAt = startedAt + duration and validates
 * all time-based operations against server time.
 */

/**
 * Calculate the end time for an olympiad attempt
 * @param {Date} startedAt - Server timestamp when attempt started
 * @param {Number} durationSeconds - Duration in seconds
 * @returns {Date} - Calculated end time
 */
export function calculateEndTime(startedAt, durationSeconds) {
  if (!startedAt || !durationSeconds) {
    throw new Error('startedAt and durationSeconds are required');
  }
  
  const start = new Date(startedAt);
  const endsAt = new Date(start.getTime() + (durationSeconds * 1000));
  
  return endsAt;
}

/**
 * Get remaining time in seconds
 * @param {Date} endsAt - End timestamp
 * @returns {Number} - Remaining seconds (0 if expired)
 */
export function getRemainingTime(endsAt) {
  if (!endsAt) {
    return 0;
  }
  
  const now = new Date();
  const end = new Date(endsAt);
  const remaining = Math.max(0, Math.floor((end - now) / 1000));
  
  return remaining;
}

/**
 * Check if time has expired
 * @param {Date} endsAt - End timestamp
 * @returns {Boolean} - True if expired
 */
export function isTimeExpired(endsAt) {
  if (!endsAt) {
    return true;
  }
  
  const now = new Date();
  const end = new Date(endsAt);
  
  return now >= end;
}

/**
 * Validate that current time is before end time
 * @param {Date} endsAt - End timestamp
 * @throws {Error} - If time has expired
 */
export function validateTimeNotExpired(endsAt) {
  if (isTimeExpired(endsAt)) {
    throw new Error('TIME_EXPIRED');
  }
}

/**
 * Format remaining time as MM:SS
 * @param {Number} seconds - Remaining seconds
 * @returns {String} - Formatted time string (MM:SS or HH:MM:SS)
 */
export function formatRemainingTime(seconds) {
  if (seconds <= 0) {
    return '00:00';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get timer status object for client
 * @param {Date} endsAt - End timestamp
 * @returns {Object} - Timer status with remaining time and formatted string
 */
export function getTimerStatus(endsAt) {
  const remaining = getRemainingTime(endsAt);
  const expired = isTimeExpired(endsAt);
  
  return {
    endsAt: endsAt.toISOString(),
    remainingSeconds: remaining,
    formatted: formatRemainingTime(remaining),
    expired,
    serverTime: new Date().toISOString()
  };
}
