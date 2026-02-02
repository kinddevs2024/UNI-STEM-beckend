import { protect } from '../../../../lib/auth.js';
import connectMongoDB from '../../../../lib/mongodb.js';
import Attempt from '../../../../models/Attempt.js';
import { validateAttemptActive } from '../../../../lib/anti-cheat-validator.js';
import { validateDeviceFingerprint } from '../../../../lib/device-locking.js';
import { checkRateLimit } from '../../../../lib/rate-limiting.js';
import { getClientIP } from '../../../../lib/device-fingerprint.js';
import { findQuestionsByOlympiadId } from '../../../../lib/question-helper.js';
import { connectDB } from '../../../../lib/json-db.js';
import { createAuditLog } from '../../../../lib/audit-logger.js';

/**
 * Skip current question (triggered on tab close/refresh)
 * POST /api/olympiads/[id]/skip
 * 
 * Marks current question as skipped and advances to next question.
 * Called when user closes tab, refreshes page, or navigates away.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        success: false,
        message: authResult.error 
      });
    }

    await connectDB();
    await connectMongoDB();

    const { id: olympiadId } = req.query;
    const userId = authResult.user._id;
    const { reason, deviceFingerprint } = req.body || {};

    // Find attempt
    const attempt = await Attempt.findOne({
      userId,
      olympiadId
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false,
        message: 'Attempt not found',
        code: 'ATTEMPT_NOT_FOUND'
      });
    }

    // Validate device fingerprint (if provided)
    if (deviceFingerprint) {
      const deviceValidation = validateDeviceFingerprint(attempt, deviceFingerprint);
      if (!deviceValidation.valid && deviceValidation.driftDetected) {
        const { handleDeviceSwitch } = await import('../../../../lib/device-locking.js');
        await handleDeviceSwitch(attempt, deviceFingerprint, req);
        return res.status(403).json({
          success: false,
          message: 'Device switch detected. Attempt cannot continue on different device.',
          code: 'DEVICE_SWITCH_DETECTED',
          attemptStatus: attempt.status
        });
      }
    }

    // Check if device switch already detected
    if (attempt.deviceSwitchDetected && attempt.status === 'device_switch_detected') {
      return res.status(403).json({
        success: false,
        message: 'Device switch detected. Attempt cannot continue.',
        code: 'DEVICE_SWITCH_DETECTED',
        attemptStatus: attempt.status
      });
    }

    // Rate limiting check
    const ip = getClientIP(req);
    const rateLimitResult = checkRateLimit('/skip', attempt._id.toString(), userId.toString(), ip);
    if (!rateLimitResult.allowed) {
      attempt.violations.push({
        type: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date(),
        details: {
          endpoint: '/skip',
          limit: rateLimitResult.limit,
          ip
        }
      });
      await attempt.save();

      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.resetAt
      });
    }

    // Get questions to determine total count
    const allQuestions = await findQuestionsByOlympiadId(olympiadId);
    if (!allQuestions || allQuestions.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No questions found for this olympiad' 
      });
    }

    const currentIdx = attempt.currentQuestionIndex;

    // Get current question ID
    if (currentIdx >= 0 && currentIdx < allQuestions.length) {
      const currentQuestion = allQuestions[currentIdx];
      
      // Only skip if not already answered or skipped
      if (
        !attempt.answeredQuestions.includes(currentQuestion._id) &&
        !attempt.skippedQuestions.includes(currentQuestion._id)
      ) {
        // Add to skipped questions
        attempt.skippedQuestions.push(currentQuestion._id);
        
        // Advance to next question if not last
        if (currentIdx < allQuestions.length - 1) {
          attempt.currentQuestionIndex = currentIdx + 1;
        }
        
        await attempt.save();

        // Create audit log
        await createAuditLog({
          attemptId: attempt._id,
          userId,
          olympiadId,
          eventType: 'skip',
          metadata: {
            questionIndex: currentIdx,
            questionId: currentQuestion._id,
            reason: reason || 'tab_close_refresh',
            nextQuestionIndex: attempt.currentQuestionIndex
          },
          req
        });
      }
    }

    res.json({
      success: true,
      currentQuestionIndex: attempt.currentQuestionIndex,
      skippedQuestions: attempt.skippedQuestions.length
    });
  } catch (error) {
    console.error('Skip question error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to skip question'
    });
  }
}
