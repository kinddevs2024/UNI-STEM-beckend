import { connectDB } from '../../../../lib/json-db.js';
import { findQuestionsByOlympiadId } from '../../../../lib/question-helper.js';
import { protect } from '../../../../lib/auth.js';
import connectMongoDB from '../../../../lib/mongodb.js';
import Attempt from '../../../../models/Attempt.js';
import Submission from '../../../../models/Submission.js';
import { validateAnswerSubmission } from '../../../../lib/anti-cheat-validator.js';
import { validateTimeNotExpired } from '../../../../lib/timer-service.js';
import { validateDeviceFingerprint } from '../../../../lib/device-locking.js';
import { validateAnswerNonce, checkAnswerTimeWindow, rejectReplayedAnswer } from '../../../../lib/replay-protection.js';
import { createAuditLog } from '../../../../lib/audit-logger.js';
import { createSubmission, updateSubmission } from '../../../../lib/submission-helper.js';
import { checkRateLimit } from '../../../../lib/rate-limiting.js';
import { getClientIP } from '../../../../lib/device-fingerprint.js';

import { handleCORS } from '../../../../lib/api-helpers.js';

function normalizeAnswerList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item)).filter((item) => item.trim() !== ''))];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function getCorrectAnswers(question) {
  const fromArray = normalizeAnswerList(question?.correctAnswers);
  if (fromArray.length > 0) {
    return fromArray;
  }

  if (typeof question?.correctAnswer === 'string' && question.correctAnswer.trim() !== '') {
    return [question.correctAnswer.trim()];
  }

  return [];
}

function isMultipleChoiceAnswerCorrect(question, submittedAnswer) {
  const submitted = normalizeAnswerList(submittedAnswer);
  const expected = getCorrectAnswers(question);

  if (submitted.length === 0 || expected.length === 0) {
    return false;
  }

  const submittedSet = new Set(submitted);
  const expectedSet = new Set(expected);

  if (submittedSet.size !== expectedSet.size) {
    return false;
  }

  for (const expectedAnswer of expectedSet) {
    if (!submittedSet.has(expectedAnswer)) {
      return false;
    }
  }

  return true;
}

/**
 * Submit answer for current question
 * POST /api/olympiads/[id]/answer
 * 
 * Submits answer for the current question only (forward-only navigation).
 * Auto-advances to next question after submission.
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
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
    const { questionIndex, answer, nonce, deviceFingerprint } = req.body;

    if (questionIndex === undefined || answer === undefined) {
      return res.status(400).json({ 
        success: false,
        message: 'questionIndex and answer are required' 
      });
    }

    const questionIdx = parseInt(questionIndex, 10);
    if (isNaN(questionIdx) || questionIdx < 0) {
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

    // Rate limiting check
    const ip = getClientIP(req);
    const rateLimitResult = checkRateLimit('/answer', attempt._id.toString(), userId.toString(), ip);
    if (!rateLimitResult.allowed) {
      attempt.violations.push({
        type: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date(),
        details: {
          endpoint: '/answer',
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

    // Validate time not expired
    try {
      validateTimeNotExpired(attempt.endsAt);
    } catch (error) {
      attempt.status = 'time_expired';
      await attempt.save();
      
      return res.status(400).json({ 
        success: false,
        message: 'Time has expired',
        code: 'TIME_EXPIRED'
      });
    }

    // Validate answer submission (allows previous questions, blocks skipping ahead)
    const validation = validateAnswerSubmission(attempt, questionIdx);
    if (!validation.valid) {
      return res.status(403).json({ 
        success: false,
        message: validation.error,
        code: validation.code,
        currentQuestionIndex: validation.currentQuestionIndex,
        questionIndex: validation.questionIndex
      });
    }

    // Get questions
    const allQuestions = await findQuestionsByOlympiadId(olympiadId);
    if (!allQuestions || allQuestions.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No questions found for this olympiad' 
      });
    }

    // Validate device fingerprint
    if (deviceFingerprint) {
      const deviceValidation = validateDeviceFingerprint(attempt, deviceFingerprint);
      if (!deviceValidation.valid) {
        if (deviceValidation.driftDetected) {
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

    // Get question
    const question = allQuestions[questionIdx];
    if (!question) {
      return res.status(404).json({ 
        success: false,
        message: `Question at index ${questionIdx} not found` 
      });
    }

    // Validate nonce (replay protection)
    if (!nonce) {
      return res.status(400).json({
        success: false,
        message: 'Nonce is required for answer submission',
        code: 'NONCE_REQUIRED'
      });
    }

    const nonceValidation = validateAnswerNonce(attempt, question._id, nonce);
    if (!nonceValidation.valid) {
      await rejectReplayedAnswer(attempt._id, question._id, nonceValidation.reason, req);
      
      // Add violation
      attempt.violations.push({
        type: 'REPLAY_ATTEMPT',
        timestamp: new Date(),
        details: {
          questionId: question._id,
          reason: nonceValidation.reason
        }
      });
      await attempt.save();

      return res.status(403).json({
        success: false,
        message: nonceValidation.reason,
        code: 'REPLAY_ATTEMPT'
      });
    }

    // Check answer time window
    const timeWindowValidation = checkAnswerTimeWindow(attempt, question._id, new Date());
    if (!timeWindowValidation.valid) {
      attempt.violations.push({
        type: 'TIME_WINDOW_VIOLATION',
        timestamp: new Date(),
        details: {
          questionId: question._id,
          reason: timeWindowValidation.reason,
          timeSpent: timeWindowValidation.timeSpent
        }
      });
      await attempt.save();

      return res.status(400).json({
        success: false,
        message: timeWindowValidation.reason,
        code: 'TIME_WINDOW_VIOLATION'
      });
    }

    const hasAnswered = attempt.answeredQuestions.includes(question._id);

    // Calculate score (only for test questions, essay scoring handled separately)
    let score = 0;
    let isCorrect = false;

    if (question.type === 'multiple-choice') {
      isCorrect = isMultipleChoiceAnswerCorrect(question, answer);
      score = isCorrect ? (question.points || 0) : 0;
    } else if (question.type === 'essay') {
      // Essay questions will be scored separately, default to 0 for now
      score = 0;
      isCorrect = false;
    }

    // Create or update submission
    const submissionAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer);
    const existingSubmission = await Submission.findOne({
      userId: userId.toString(),
      olympiadId,
      questionId: question._id
    });

    const submission = existingSubmission
      ? await updateSubmission(existingSubmission._id, {
          answer: submissionAnswer,
          score,
          isCorrect
        })
      : await createSubmission({
          userId,
          olympiadId,
          questionId: question._id,
          answer: submissionAnswer,
          score,
          isCorrect
        });

    // Update attempt
    if (!hasAnswered) {
      attempt.answeredQuestions.push(question._id);
    }
    
    // Auto-advance only when answering the current question
    if (questionIdx === attempt.currentQuestionIndex && questionIdx < allQuestions.length - 1) {
      attempt.currentQuestionIndex = questionIdx + 1;
    }
    
    await attempt.save();

    // Create audit log
    await createAuditLog({
      attemptId: attempt._id,
      userId,
      olympiadId,
      eventType: existingSubmission ? 'answer_update' : 'answer',
      metadata: {
        questionIndex: questionIdx,
        questionId: question._id,
        answerLength: typeof answer === 'string' ? answer.length : JSON.stringify(answer).length,
        score,
        isCorrect
      },
      req
    });

    res.json({
      success: true,
      submission: {
        _id: submission._id,
        questionId: question._id,
        score,
        isCorrect
      },
      nextQuestionIndex: attempt.currentQuestionIndex,
      isLastQuestion: questionIdx >= allQuestions.length - 1
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to submit answer'
    });
  }
}
