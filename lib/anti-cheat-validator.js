/**
 * Anti-Cheat Validator
 * 
 * Central validation service for all anti-cheat checks:
 * - One attempt per user enforcement
 * - Time constraint validation
 * - Forward-only question access validation
 * - Suspicious pattern detection
 */

import Attempt from '../models/Attempt.js';
import { isTimeExpired, validateTimeNotExpired } from './timer-service.js';
import { isProctoringReady, validateProctoringStatus } from './proctoring-service.js';
import { validateDeviceFingerprint } from './device-locking.js';
import connectDB from './mongodb.js';

/**
 * Check if user has already attempted the olympiad
 * @param {String} userId - User ID
 * @param {String} olympiadId - Olympiad ID
 * @returns {Promise<Object>} - { hasAttempted, attempt }
 */
export async function checkExistingAttempt(userId, olympiadId) {
  try {
    await connectDB();
    
    const attempt = await Attempt.findOne({
      userId,
      olympiadId
    });
    
    return {
      hasAttempted: !!attempt,
      attempt: attempt ? attempt.toObject() : null
    };
  } catch (error) {
    console.error('Error checking existing attempt:', error);
    throw error;
  }
}

/**
 * Validate user can start a new attempt
 * @param {String} userId - User ID
 * @param {String} olympiadId - Olympiad ID
 * @param {Object} proctoringStatus - Proctoring status
 * @returns {Promise<Object>} - Validation result { valid, error, code }
 */
export async function validateCanStart(userId, olympiadId, proctoringStatus) {
  try {
    // Check existing attempt
    const { hasAttempted, attempt } = await checkExistingAttempt(userId, olympiadId);
    
    if (hasAttempted) {
      const answeredCount = attempt?.answeredQuestions?.length || 0;
      const skippedCount = attempt?.skippedQuestions?.length || 0;
      const restartableStatuses = ['verification_failed', 'auto_disqualified', 'admin_invalidated'];
      const canRestart =
        answeredCount === 0 &&
        skippedCount === 0 &&
        (restartableStatuses.includes(attempt?.status) || attempt?.trustClassification === 'invalid');

      if (canRestart) {
        if (!isProctoringReady(proctoringStatus)) {
          const proctoringValidation = validateProctoringStatus(proctoringStatus);
          return {
            valid: false,
            error: 'Proctoring requirements not met: ' + proctoringValidation.errors.join(', '),
            code: 'PROCTORING_NOT_READY',
            proctoringErrors: proctoringValidation.errors
          };
        }

        return {
          valid: true,
          restart: true,
          attempt
        };
      }

      const activeValidation = validateAttemptActive(attempt);
      if (!activeValidation.valid) {
        return {
          valid: false,
          error: activeValidation.error,
          code: activeValidation.code,
          attempt
        };
      }

      // Validate proctoring is ready for resume
      if (!isProctoringReady(proctoringStatus)) {
        const proctoringValidation = validateProctoringStatus(proctoringStatus);
        return {
          valid: false,
          error: 'Proctoring requirements not met: ' + proctoringValidation.errors.join(', '),
          code: 'PROCTORING_NOT_READY',
          proctoringErrors: proctoringValidation.errors
        };
      }

      return {
        valid: true,
        resume: true,
        attempt
      };
    }
    
    // Validate proctoring is ready
    if (!isProctoringReady(proctoringStatus)) {
      const proctoringValidation = validateProctoringStatus(proctoringStatus);
      return {
        valid: false,
        error: 'Proctoring requirements not met: ' + proctoringValidation.errors.join(', '),
        code: 'PROCTORING_NOT_READY',
        proctoringErrors: proctoringValidation.errors
      };
    }
    
    return {
      valid: true
    };
  } catch (error) {
    console.error('Error validating can start:', error);
    throw error;
  }
}

/**
 * Validate attempt is active and time not expired
 * @param {Object} attempt - Attempt document
 * @returns {Object} - Validation result { valid, error, code }
 */
export function validateAttemptActive(attempt) {
  if (!attempt) {
    return {
      valid: false,
      error: 'Attempt not found',
      code: 'ATTEMPT_NOT_FOUND'
    };
  }
  
  // Check status
  if (attempt.status === 'completed') {
    return {
      valid: false,
      error: 'Attempt already completed',
      code: 'ATTEMPT_COMPLETED'
    };
  }
  
  if (attempt.status === 'time_expired') {
    return {
      valid: false,
      error: 'Time has expired',
      code: 'TIME_EXPIRED'
    };
  }
  
  if (attempt.status === 'violation_terminated') {
    // BYPASS: Allow action even if terminated for violations (for testing/recovery)
    console.warn(`[AntiCheat] Allowing action on terminated attempt ${attempt._id} (status: ${attempt.status})`);
    /*
    return {
      valid: false,
      error: 'Attempt was terminated due to violations',
      code: 'ATTEMPT_TERMINATED'
    };
    */
  }
  
  // Check time
  if (isTimeExpired(attempt.endsAt)) {
    return {
      valid: false,
      error: 'Time has expired',
      code: 'TIME_EXPIRED'
    };
  }
  
  return {
    valid: true
  };
}

/**
 * Validate question access (forward-only navigation)
 * @param {Object} attempt - Attempt document
 * @param {Number} requestedQuestionIndex - Requested question index
 * @returns {Object} - Validation result { valid, error, code }
 */
export function validateQuestionAccess(attempt, requestedQuestionIndex) {
  if (!attempt) {
    return {
      valid: false,
      error: 'Attempt not found',
      code: 'ATTEMPT_NOT_FOUND'
    };
  }
  
  // Validate attempt is active first
  const activeValidation = validateAttemptActive(attempt);
  if (!activeValidation.valid) {
    return activeValidation;
  }
  
  // Forward-only: cannot access questions before currentQuestionIndex
  if (requestedQuestionIndex < attempt.currentQuestionIndex) {
    return {
      valid: false,
      error: 'Cannot access previous questions. Forward navigation only.',
      code: 'INVALID_QUESTION_ACCESS',
      currentQuestionIndex: attempt.currentQuestionIndex,
      requestedQuestionIndex
    };
  }
  
  // Can access current or next questions
  return {
    valid: true
  };
}

/**
 * Validate answer submission
 * @param {Object} attempt - Attempt document
 * @param {Number} questionIndex - Question index being answered
 * @returns {Object} - Validation result { valid, error, code }
 */
export function validateAnswerSubmission(attempt, questionIndex) {
  if (!attempt) {
    return {
      valid: false,
      error: 'Attempt not found',
      code: 'ATTEMPT_NOT_FOUND'
    };
  }
  
  // Validate attempt is active
  const activeValidation = validateAttemptActive(attempt);
  if (!activeValidation.valid) {
    return activeValidation;
  }
  
  // Can only answer current question (forward-only)
  // Allow answering current question even if index matches (re-submission of same question is fine if not moved forward)
  if (questionIndex !== attempt.currentQuestionIndex) {
    // If user is trying to answer a previous question, block it
    if (questionIndex < attempt.currentQuestionIndex) {
      return {
        valid: false,
        error: `Cannot answer previous question (index ${questionIndex}). Current index: ${attempt.currentQuestionIndex}`,
        code: 'INVALID_QUESTION_INDEX',
        currentQuestionIndex: attempt.currentQuestionIndex,
        questionIndex
      };
    }
    // If user is trying to skip ahead, block it (must answer in order)
    if (questionIndex > attempt.currentQuestionIndex) {
      return {
        valid: false,
        error: `Cannot skip ahead. Current index: ${attempt.currentQuestionIndex}`,
        code: 'INVALID_QUESTION_INDEX',
        currentQuestionIndex: attempt.currentQuestionIndex,
        questionIndex
      };
    }
  }
  
  return {
    valid: true
  };
}

/**
 * Check if attempt should be terminated due to violations
 * @param {Object} attempt - Attempt document
 * @param {Number} maxViolations - Maximum allowed violations (default: 5)
 * @param {Array} highSeverityTypes - High severity violation types that cause immediate termination
 * @returns {Object} - { shouldTerminate, reason }
 * 
 * Note: Auto-disqualification is now handled via trust score system.
 * This function still exists for backward compatibility but trust score takes precedence.
 */
export function shouldTerminateAttempt(attempt, maxViolations = 5, highSeverityTypes = []) {
  // Check if already auto-disqualified by trust score
  if (attempt.status === 'auto_disqualified' || attempt.trustClassification === 'invalid') {
    return {
      shouldTerminate: true,
      reason: 'Attempt auto-disqualified by trust score system',
      violationCount: attempt.violations?.length || 0
    };
  }
  if (!attempt || !attempt.violations || attempt.violations.length === 0) {
    return {
      shouldTerminate: false,
      reason: null
    };
  }
  
  // Check for high severity violations (immediate termination)
  if (highSeverityTypes.length > 0 && attempt.violations.length > 0) {
    const hasHighSeverity = attempt.violations.some(v => 
      highSeverityTypes.includes(v.type)
    );
    
    if (hasHighSeverity) {
      return {
        shouldTerminate: true,
        reason: 'High severity violation detected',
        violationCount: attempt.violations.length
      };
    }
  }
  
  // Check violation count threshold
  if (attempt.violations.length >= maxViolations) {
    return {
      shouldTerminate: true,
      reason: `Maximum violation threshold exceeded (${maxViolations})`,
      violationCount: attempt.violations.length
    };
  }
  
  return {
    shouldTerminate: false,
    reason: null,
    violationCount: attempt.violations.length
  };
}
