/**
 * Emergency Controls Service
 * 
 * Admin capabilities for managing attempts in exceptional situations.
 */

import Attempt from '../models/Attempt.js';
import { createAuditLog } from './audit-logger.js';
import connectMongoDB from './mongodb.js';

/**
 * Pause attempt (stops timer)
 * @param {String} attemptId - Attempt ID
 * @param {String} reason - Reason for pause
 * @param {String} adminId - Admin user ID
 * @returns {Promise<Object>} - Pause result
 */
export async function pauseAttempt(attemptId, reason, adminId) {
  await connectMongoDB();

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  if (attempt.status !== 'started') {
    return {
      success: false,
      reason: `Cannot pause attempt with status: ${attempt.status}`
    };
  }

  attempt.status = 'paused';
  attempt.pausedAt = new Date();
  attempt.pausedBy = adminId;
  attempt.pauseReason = reason;

  await attempt.save();

  // Log to audit
  await createAuditLog({
    attemptId: attempt._id,
    userId: attempt.userId,
    olympiadId: attempt.olympiadId,
    eventType: 'admin_pause',
    metadata: {
      reason,
      adminId,
      pausedAt: attempt.pausedAt
    }
  });

  return {
    success: true,
    attemptStatus: attempt.status,
    pausedAt: attempt.pausedAt
  };
}

/**
 * Force submit attempt (even if time expired or violations)
 * @param {String} attemptId - Attempt ID
 * @param {String} adminId - Admin user ID
 * @returns {Promise<Object>} - Force submit result
 */
export async function forceSubmitAttempt(attemptId, adminId) {
  await connectMongoDB();

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  if (attempt.status === 'completed') {
    return {
      success: false,
      reason: 'Attempt already completed'
    };
  }

  attempt.status = 'completed';
  attempt.submittedAt = new Date();
  attempt.completedAt = new Date();
  attempt.adminSubmitted = true;

  await attempt.save();

  // Log to audit
  await createAuditLog({
    attemptId: attempt._id,
    userId: attempt.userId,
    olympiadId: attempt.olympiadId,
    eventType: 'admin_force_submit',
    metadata: {
      adminId,
      submittedAt: attempt.submittedAt,
      originalStatus: attempt.status
    }
  });

  return {
    success: true,
    attemptStatus: attempt.status,
    submittedAt: attempt.submittedAt
  };
}

/**
 * Invalidate attempt
 * @param {String} attemptId - Attempt ID
 * @param {String} reason - Reason for invalidation
 * @param {String} adminId - Admin user ID
 * @returns {Promise<Object>} - Invalidation result
 */
export async function invalidateAttempt(attemptId, reason, adminId) {
  await connectMongoDB();

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  attempt.status = 'admin_invalidated';
  attempt.invalidatedAt = new Date();
  attempt.invalidatedBy = adminId;
  attempt.invalidationReason = reason;

  await attempt.save();

  // Log to audit
  await createAuditLog({
    attemptId: attempt._id,
    userId: attempt.userId,
    olympiadId: attempt.olympiadId,
    eventType: 'admin_invalidate',
    metadata: {
      reason,
      adminId,
      invalidatedAt: attempt.invalidatedAt
    }
  });

  return {
    success: true,
    attemptStatus: attempt.status,
    invalidatedAt: attempt.invalidatedAt
  };
}
