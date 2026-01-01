import { connectDB } from '../../../../../lib/json-db.js';
import { findOlympiadById } from '../../../../../lib/olympiad-helper.js';
import { findQuestionsByOlympiadId } from '../../../../../lib/question-helper.js';
import { protect } from '../../../../../lib/auth.js';
import connectMongoDB from '../../../../../lib/mongodb.js';
import Attempt from '../../../../../models/Attempt.js';
import { validateQuestionAccess } from '../../../../../lib/anti-cheat-validator.js';
import { validateDeviceFingerprint } from '../../../../../lib/device-locking.js';
import { issueQuestionNonce } from '../../../../../lib/replay-protection.js';
import { createAuditLog } from '../../../../../lib/audit-logger.js';

/**
 * Get question for attempt (forward-only navigation)
 * GET /api/olympiads/[id]/question/[questionIndex]
 * 
 * Returns question if accessible. Enforces forward-only navigation.
 * Updates currentQuestionIndex if advancing to next question.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    const { id: olympiadId, questionIndex } = req.query;
    const userId = authResult.user._id;
    const requestedIndex = parseInt(questionIndex, 10);
    // Device fingerprint validation optional for GET requests (read-only)
    // Can be passed as query param if needed, but not required for question retrieval

    if (isNaN(requestedIndex) || requestedIndex < 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid question index' 
      });
    }

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

    // Check if device switch already detected (already handled, just prevent access)
    if (attempt.deviceSwitchDetected && attempt.status === 'device_switch_detected') {
      return res.status(403).json({
        success: false,
        message: 'Device switch detected. Attempt cannot continue.',
        code: 'DEVICE_SWITCH_DETECTED',
        attemptStatus: attempt.status
      });
    }

    // Validate question access (forward-only)
    const validation = validateQuestionAccess(attempt, requestedIndex);
    if (!validation.valid) {
      return res.status(403).json({ 
        success: false,
        message: validation.error,
        code: validation.code,
        currentQuestionIndex: validation.currentQuestionIndex,
        requestedQuestionIndex: validation.requestedQuestionIndex
      });
    }

    // Get olympiad
    const olympiad = findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Get questions
    const allQuestions = findQuestionsByOlympiadId(olympiadId);
    if (!allQuestions || allQuestions.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No questions found for this olympiad' 
      });
    }

    // Check if question index is valid
    if (requestedIndex >= allQuestions.length) {
      return res.status(400).json({ 
        success: false,
        message: `Question index ${requestedIndex} is out of range. Total questions: ${allQuestions.length}` 
      });
    }

    // Update currentQuestionIndex if advancing (forward-only navigation)
    if (requestedIndex > attempt.currentQuestionIndex) {
      attempt.currentQuestionIndex = requestedIndex;
      await attempt.save();

      // Log question access
      await createAuditLog({
        attemptId: attempt._id,
        userId,
        olympiadId,
        eventType: 'question_access',
        metadata: {
          questionIndex: requestedIndex,
          previousQuestionIndex: attempt.currentQuestionIndex - 1
        },
        req
      });
    }

    // Get question (don't include correct answer for test questions)
    const question = allQuestions[requestedIndex];
    
    // Issue nonce for replay protection
    const nonceData = issueQuestionNonce(attempt, question._id);
    await attempt.save();

    const questionData = {
      _id: question._id,
      question: question.question,
      type: question.type,
      options: question.options || [],
      points: question.points,
      order: question.order || requestedIndex,
      nonce: nonceData.nonce // Include nonce for client
      // Intentionally exclude correctAnswer
    };

    res.json({
      success: true,
      question: questionData,
      questionIndex: requestedIndex,
      totalQuestions: allQuestions.length,
      currentQuestionIndex: attempt.currentQuestionIndex
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to get question'
    });
  }
}
