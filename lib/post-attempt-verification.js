/**
 * Post-Attempt Verification Service
 * 
 * Runs integrity checks after submission to detect inconsistencies.
 */

import Attempt from '../models/Attempt.js';
import SessionHeartbeat from '../models/SessionHeartbeat.js';
import { createAuditLog } from './audit-logger.js';
import connectMongoDB from './mongodb.js';

const TIME_CONSISTENCY_BUFFER_MS = 5000; // ±5 seconds buffer
const SUSPICIOUS_HEARTBEAT_GAP_MS = 30000; // 30 seconds

/**
 * Verify total time consistency
 * @param {Object} attempt - Attempt document
 * @param {Number} expectedDurationSeconds - Expected duration in seconds
 * @returns {Object} - Verification result
 */
export function verifyTimeConsistency(attempt, expectedDurationSeconds) {
  if (!attempt.startedAt || !attempt.submittedAt) {
    return {
      passed: false,
      reason: 'Missing start or submit timestamp',
      details: {
        hasStartedAt: !!attempt.startedAt,
        hasSubmittedAt: !!attempt.submittedAt
      }
    };
  }

  const actualDurationMs = new Date(attempt.submittedAt) - new Date(attempt.startedAt);
  const expectedDurationMs = expectedDurationSeconds * 1000;
  const difference = Math.abs(actualDurationMs - expectedDurationMs);

  const passed = difference <= TIME_CONSISTENCY_BUFFER_MS;

  return {
    passed,
    reason: passed 
      ? 'Time consistency check passed'
      : `Time difference exceeds buffer (${Math.round(difference / 1000)}s > ${TIME_CONSISTENCY_BUFFER_MS / 1000}s)`,
    details: {
      actualDurationSeconds: Math.round(actualDurationMs / 1000),
      expectedDurationSeconds,
      differenceSeconds: Math.round(difference / 1000),
      bufferSeconds: TIME_CONSISTENCY_BUFFER_MS / 1000
    }
  };
}

/**
 * Verify question order
 * @param {Object} attempt - Attempt document
 * @returns {Object} - Verification result
 */
export function verifyQuestionOrder(attempt) {
  // This is a simplified check - in production, you might want to verify
  // the actual order of questions based on audit logs
  const answeredCount = attempt.answeredQuestions?.length || 0;
  const skippedCount = attempt.skippedQuestions?.length || 0;
  const totalProcessed = answeredCount + skippedCount;

  // Current question index should reflect progress
  const expectedIndex = totalProcessed;

  // Allow some tolerance (questions might be skipped/answered out of strict order)
  const passed = attempt.currentQuestionIndex >= expectedIndex - 1 && 
                 attempt.currentQuestionIndex <= expectedIndex + 1;

  return {
    passed,
    reason: passed
      ? 'Question order check passed'
      : `Question index inconsistency (current: ${attempt.currentQuestionIndex}, expected: ~${expectedIndex})`,
    details: {
      currentQuestionIndex: attempt.currentQuestionIndex,
      answeredCount,
      skippedCount,
      totalProcessed,
      expectedIndex
    }
  };
}

/**
 * Verify answer timestamps (simplified - would need audit log data for full verification)
 * @param {Object} attempt - Attempt document
 * @returns {Object} - Verification result
 */
export function verifyAnswerTimestamps(attempt) {
  if (!attempt.startedAt || !attempt.submittedAt) {
    return {
      passed: false,
      reason: 'Missing start or submit timestamp'
    };
  }

  // Basic check: all violations should be within attempt timeframe
  const startTime = new Date(attempt.startedAt);
  const submitTime = new Date(attempt.submittedAt);

  const violationsOutOfRange = attempt.violations?.filter(v => {
    const violationTime = new Date(v.timestamp);
    return violationTime < startTime || violationTime > submitTime;
  }) || [];

  const passed = violationsOutOfRange.length === 0;

  return {
    passed,
    reason: passed
      ? 'Answer timestamp check passed'
      : `${violationsOutOfRange.length} violations outside attempt timeframe`,
    details: {
      violationsChecked: attempt.violations?.length || 0,
      violationsOutOfRange: violationsOutOfRange.length
    }
  };
}

/**
 * Verify heartbeat timeline
 * @param {String} attemptId - Attempt ID
 * @returns {Promise<Object>} - Verification result
 */
export async function verifyHeartbeatTimeline(attemptId) {
  try {
    await connectMongoDB();

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) {
      return {
        passed: false,
        reason: 'Attempt not found'
      };
    }

    // Get all heartbeats for this attempt
    const heartbeats = await SessionHeartbeat.find({
      attemptId
    }).sort({ lastSeenAt: 1 });

    if (heartbeats.length === 0) {
      return {
        passed: false,
        reason: 'No heartbeat records found',
        details: {
          heartbeatCount: 0
        }
      };
    }

    // Check for suspicious gaps
    const suspiciousGaps = [];
    for (let i = 1; i < heartbeats.length; i++) {
      const gap = new Date(heartbeats[i].lastSeenAt) - new Date(heartbeats[i - 1].lastSeenAt);
      if (gap > SUSPICIOUS_HEARTBEAT_GAP_MS) {
        suspiciousGaps.push({
          index: i,
          gapSeconds: Math.round(gap / 1000),
          timestamp: heartbeats[i].lastSeenAt
        });
      }
    }

    const passed = suspiciousGaps.length === 0;

    return {
      passed,
      reason: passed
        ? 'Heartbeat timeline check passed'
        : `${suspiciousGaps.length} suspicious gaps detected`,
      details: {
        heartbeatCount: heartbeats.length,
        suspiciousGaps: suspiciousGaps.length,
        gaps: suspiciousGaps
      }
    };
  } catch (error) {
    console.error('Error verifying heartbeat timeline:', error);
    return {
      passed: false,
      reason: 'Error verifying heartbeat timeline',
      error: error.message
    };
  }
}

/**
 * Run all post-attempt verification checks
 * @param {String} attemptId - Attempt ID
 * @param {Number} expectedDurationSeconds - Expected duration in seconds
 * @returns {Promise<Object>} - Verification results
 */
export async function runPostAttemptVerification(attemptId, expectedDurationSeconds) {
  try {
    await connectMongoDB();

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) {
      return {
        passed: false,
        reason: 'Attempt not found',
        results: {}
      };
    }

    // Run all checks
    const timeConsistency = verifyTimeConsistency(attempt, expectedDurationSeconds);
    const questionOrder = verifyQuestionOrder(attempt);
    const answerTimestamps = verifyAnswerTimestamps(attempt);
    const heartbeatTimeline = await verifyHeartbeatTimeline(attemptId);

    // Determine overall result
    const allPassed = timeConsistency.passed && 
                     questionOrder.passed && 
                     answerTimestamps.passed && 
                     heartbeatTimeline.passed;

    const results = {
      timeConsistency,
      questionOrder,
      answerTimestamps,
      heartbeatTimeline,
      overallPassed: allPassed
    };

    // Update attempt with verification results
    attempt.verificationStatus = allPassed ? 'passed' : 'failed';
    attempt.verificationResults = results;
    
    if (!allPassed) {
      attempt.status = 'verification_failed';
    }

    await attempt.save();

    // Log verification to audit
    await createAuditLog({
      attemptId: attempt._id,
      userId: attempt.userId,
      olympiadId: attempt.olympiadId,
      eventType: 'post_attempt_verification',
      metadata: {
        passed: allPassed,
        results
      }
    });

    return {
      passed: allPassed,
      reason: allPassed 
        ? 'All verification checks passed'
        : 'One or more verification checks failed',
      results
    };
  } catch (error) {
    console.error('Error running post-attempt verification:', error);
    throw error;
  }
}
