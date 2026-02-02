/**
 * Heartbeat Enforcement Service
 *
 * Detects and penalizes missed heartbeats, prevents silence abuse.
 * Checks in-memory presence-store first, then MongoDB for stale/disconnected sessions.
 */

import SessionHeartbeat from '../models/SessionHeartbeat.js';
import Attempt from '../models/Attempt.js';
import { createAuditLog } from './audit-logger.js';
import connectMongoDB from './mongodb.js';
import * as presenceStore from './presence-store.js';

// Configuration
export const MAX_MISSED_HEARTBEATS = 3;
export const HEARTBEAT_INTERVAL_MS = 5000; // Client sends every 5 seconds
export const GRACE_WINDOW_MS = 15000; // Allow 15 seconds before flagging

/**
 * Calculate missed heartbeats based on time gap
 * @param {Date} lastSeenAt - Last heartbeat timestamp
 * @param {Date} currentTime - Current server time
 * @returns {Number} - Count of missed heartbeats
 */
export function calculateMissedHeartbeats(lastSeenAt, currentTime = new Date()) {
  if (!lastSeenAt) {
    return MAX_MISSED_HEARTBEATS + 1; // Consider it as missed if no lastSeenAt
  }

  const gapMs = currentTime - new Date(lastSeenAt);
  const expectedHeartbeats = Math.floor(gapMs / HEARTBEAT_INTERVAL_MS);
  
  // Account for grace window
  if (gapMs < GRACE_WINDOW_MS) {
    return 0; // Within grace window
  }

  // Calculate missed heartbeats beyond grace window
  const missedHeartbeats = Math.max(0, expectedHeartbeats - 1); // -1 to account for grace window
  
  return missedHeartbeats;
}

/**
 * Check heartbeat compliance for an attempt
 * Checks in-memory presence-store first, then MongoDB
 * @param {String} attemptId - Attempt ID
 * @returns {Promise<Object>} - Compliance status
 */
export async function checkHeartbeatCompliance(attemptId) {
  try {
    // Check in-memory presence first (hot path for active sessions)
    const presenceEntries = presenceStore.getAllForAttempt(attemptId);
    if (presenceEntries.length > 0) {
      const latest = presenceEntries.reduce((a, b) =>
        new Date(b.lastSeenAt) > new Date(a.lastSeenAt) ? b : a
      );
      const now = new Date();
      const missedCount = calculateMissedHeartbeats(latest.lastSeenAt, now);
      return {
        compliant: missedCount <= MAX_MISSED_HEARTBEATS,
        missedHeartbeats: missedCount,
        reason: missedCount > MAX_MISSED_HEARTBEATS
          ? `Exceeded maximum missed heartbeats (${MAX_MISSED_HEARTBEATS})`
          : 'Heartbeat compliance OK',
        lastSeenAt: latest.lastSeenAt,
      };
    }

    // Fallback to MongoDB for stale/disconnected sessions
    await connectMongoDB();
    const latestHeartbeat = await SessionHeartbeat.findOne({
      attemptId,
      status: 'connected',
    }).sort({ lastSeenAt: -1 });

    if (!latestHeartbeat) {
      return {
        compliant: false,
        missedHeartbeats: MAX_MISSED_HEARTBEATS + 1,
        reason: 'No heartbeat records found',
        lastSeenAt: null,
      };
    }

    const now = new Date();
    const missedCount = calculateMissedHeartbeats(latestHeartbeat.lastSeenAt, now);

    return {
      compliant: missedCount <= MAX_MISSED_HEARTBEATS,
      missedHeartbeats: missedCount,
      reason: missedCount > MAX_MISSED_HEARTBEATS
        ? `Exceeded maximum missed heartbeats (${MAX_MISSED_HEARTBEATS})`
        : 'Heartbeat compliance OK',
      lastSeenAt: latestHeartbeat.lastSeenAt,
    };
  } catch (error) {
    console.error('Error checking heartbeat compliance:', error);
    return {
      compliant: false,
      missedHeartbeats: MAX_MISSED_HEARTBEATS + 1,
      reason: 'Error checking heartbeat compliance',
      error: error.message,
    };
  }
}

/**
 * Detect missed heartbeats and create violation if needed
 * @param {String} attemptId - Attempt ID
 * @param {Date} lastSeenAt - Last seen timestamp
 * @returns {Promise<Object>} - Detection result
 */
export async function detectMissedHeartbeats(attemptId, lastSeenAt) {
  try {
    await connectMongoDB();

    const missedCount = calculateMissedHeartbeats(lastSeenAt);

    if (missedCount > MAX_MISSED_HEARTBEATS) {
      // Get attempt to update
      const attempt = await Attempt.findById(attemptId);
      if (!attempt) {
        return {
          detected: false,
          reason: 'Attempt not found'
        };
      }

      // Update missed heartbeat count
      attempt.missedHeartbeats = (attempt.missedHeartbeats || 0) + missedCount;
      attempt.lastHeartbeatAt = lastSeenAt;

      // Create violation
      const violation = await createHeartbeatViolation(attemptId, missedCount);

      await attempt.save();

      return {
        detected: true,
        missedHeartbeats: attempt.missedHeartbeats,
        violationCreated: violation.created
      };
    }

    return {
      detected: false,
      missedHeartbeats: missedCount,
      reason: 'Within allowed threshold'
    };
  } catch (error) {
    console.error('Error detecting missed heartbeats:', error);
    throw error;
  }
}

/**
 * Create heartbeat violation
 * @param {String} attemptId - Attempt ID
 * @param {Number} missedCount - Number of missed heartbeats
 * @returns {Promise<Object>} - Violation creation result
 */
export async function createHeartbeatViolation(attemptId, missedCount) {
  try {
    const connectMongoDB = (await import('./mongodb.js')).default;
    await connectMongoDB();

    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.status !== 'started') {
      return {
        created: false,
        reason: 'Attempt not found or not active'
      };
    }

    // Check if we already have a recent heartbeat violation (prevent duplicates)
    const recentHeartbeatViolation = attempt.violations?.find(v => 
      v.type === 'HEARTBEAT_GAP' && 
      new Date() - new Date(v.timestamp) < 60000 // Within last minute
    );

    if (!recentHeartbeatViolation) {
      // Add violation
      attempt.violations.push({
        type: 'HEARTBEAT_GAP',
        timestamp: new Date(),
        details: {
          missedHeartbeats: missedCount,
          maxAllowed: MAX_MISSED_HEARTBEATS,
          graceWindowMs: GRACE_WINDOW_MS
        }
      });

      await attempt.save();

      // Log to audit
      await createAuditLog({
        attemptId: attempt._id,
        userId: attempt.userId,
        olympiadId: attempt.olympiadId,
        eventType: 'heartbeat_violation',
        metadata: {
          missedHeartbeats: missedCount,
          maxAllowed: MAX_MISSED_HEARTBEATS,
          totalMissed: attempt.missedHeartbeats
        }
      });

      return {
        created: true,
        violationCount: attempt.violations.length
      };
    } else {
      return {
        created: false,
        reason: 'Recent heartbeat violation already exists'
      };
    }
  } catch (error) {
    console.error('Error creating heartbeat violation:', error);
    throw error;
  }
}
