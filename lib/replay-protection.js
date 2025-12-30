/**
 * Replay & Bot Protection Service
 * 
 * Prevents replay attacks, bot automation, and delayed answer submission
 * using nonce-based question access validation.
 */

import crypto from 'crypto';
import { createAuditLog } from './audit-logger.js';

// Configuration
const NONCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes per question
const MIN_ANSWER_TIME_MS = 5000; // Minimum 5 seconds (prevents bot speed)
const MAX_ANSWER_TIME_MS = 10 * 60 * 1000; // Maximum 10 minutes per question

/**
 * Generate unique nonce for question access
 * @returns {String} - Random nonce string
 */
export function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Issue nonce for question access
 * @param {Object} attempt - Attempt document
 * @param {String} questionId - Question ID
 * @returns {Object} - Nonce data { nonce, issuedAt, expiresAt }
 */
export function issueQuestionNonce(attempt, questionId) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + NONCE_EXPIRY_MS);

  const nonce = generateNonce();

  // Store nonce in attempt (using Object, not Map for MongoDB compatibility)
  if (!attempt.questionNonces || typeof attempt.questionNonces !== 'object') {
    attempt.questionNonces = {};
  }

  attempt.questionNonces[questionId] = {
    nonce,
    issuedAt: now,
    expiresAt,
    used: false
  };

  return {
    nonce,
    issuedAt: now,
    expiresAt
  };
}

/**
 * Validate answer nonce
 * @param {Object} attempt - Attempt document
 * @param {String} questionId - Question ID
 * @param {String} nonce - Nonce from client
 * @returns {Object} - Validation result { valid, reason }
 */
export function validateAnswerNonce(attempt, questionId, nonce) {
  if (!attempt.questionNonces || typeof attempt.questionNonces !== 'object' || !attempt.questionNonces[questionId]) {
    return {
      valid: false,
      reason: 'No nonce issued for this question'
    };
  }

  const nonceData = attempt.questionNonces[questionId];

  // Check if nonce matches
  if (nonceData.nonce !== nonce) {
    return {
      valid: false,
      reason: 'Nonce mismatch - possible replay attack'
    };
  }

  // Check if already used
  if (nonceData.used) {
    return {
      valid: false,
      reason: 'Nonce already used - possible replay attack'
    };
  }

  // Check if expired
  const now = new Date();
  if (now > new Date(nonceData.expiresAt)) {
    return {
      valid: false,
      reason: 'Nonce expired'
    };
  }

  // Mark as used
  nonceData.used = true;
  attempt.questionNonces[questionId] = nonceData;

  return {
    valid: true,
    reason: 'Nonce validated successfully'
  };
}

/**
 * Check answer time window
 * @param {Object} attempt - Attempt document
 * @param {String} questionId - Question ID
 * @param {Date} submittedAt - When answer was submitted
 * @returns {Object} - Validation result { valid, reason, timeSpent }
 */
export function checkAnswerTimeWindow(attempt, questionId, submittedAt) {
  if (!attempt.questionNonces || typeof attempt.questionNonces !== 'object' || !attempt.questionNonces[questionId]) {
    return {
      valid: false,
      reason: 'No nonce data found for question',
      timeSpent: null
    };
  }

  const nonceData = attempt.questionNonces[questionId];
  const now = new Date(submittedAt || new Date());
  const issuedAt = new Date(nonceData.issuedAt);
  const timeSpent = now - issuedAt;

  // Check minimum time (prevents bot speed)
  if (timeSpent < MIN_ANSWER_TIME_MS) {
    return {
      valid: false,
      reason: `Answer submitted too quickly (${Math.round(timeSpent / 1000)}s < ${MIN_ANSWER_TIME_MS / 1000}s minimum)`,
      timeSpent
    };
  }

  // Check maximum time
  if (timeSpent > MAX_ANSWER_TIME_MS) {
    return {
      valid: false,
      reason: `Answer submitted too late (${Math.round(timeSpent / 1000)}s > ${MAX_ANSWER_TIME_MS / 1000}s maximum)`,
      timeSpent
    };
  }

  return {
    valid: true,
    reason: 'Answer time window valid',
    timeSpent
  };
}

/**
 * Reject replayed answer and log
 * @param {String} attemptId - Attempt ID
 * @param {String} questionId - Question ID
 * @param {String} reason - Rejection reason
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} - Rejection result
 */
export async function rejectReplayedAnswer(attemptId, questionId, reason, req) {
  // Log rejection to audit
  await createAuditLog({
    attemptId,
    eventType: 'replay_rejection',
    metadata: {
      questionId,
      reason,
      timestamp: new Date().toISOString()
    },
    req
  });

  return {
    rejected: true,
    reason
  };
}
