import Result from '../../../../models/Result.js';
import Submission from '../../../../models/Submission.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { getAllQuestions, findQuestionsByOlympiadId } from '../../../../lib/question-helper.js';
import { createSubmission, findSubmissionsByUserAndOlympiad, findSubmissionsByOlympiadId } from '../../../../lib/submission-helper.js';
import { createResult, findResultByUserAndOlympiad, hasSubmittedThisMonth } from '../../../../lib/result-helper.js';
import { deleteDraft } from '../../../../lib/draft-helper.js';
import { protect } from '../../../../lib/auth.js';
import { scoreEssay } from '../../../../lib/text-analysis.js';
import connectDB from '../../../../lib/mongodb.js';
import Attempt from '../../../../models/Attempt.js';
import ProctoringSession from '../../../../models/ProctoringSession.js';
import { validateAttemptActive } from '../../../../lib/anti-cheat-validator.js';
import { validateTimeNotExpired, isTimeExpired } from '../../../../lib/timer-service.js';
import { runPostAttemptVerification } from '../../../../lib/post-attempt-verification.js';
import { calculateAndStoreTrustScore } from '../../../../lib/anti-cheat-scoring.js';
import { createAuditLog } from '../../../../lib/audit-logger.js';

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
 * @swagger
 * /olympiads/{id}/submit:
 *   post:
 *     summary: Submit olympiad answers
 *     tags: [Olympiads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Olympiad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               answers:
     *                 type: object
     *                 description: Answers object. For test type: questionId: selectedOption. For essay type: questionId: essayContent. For mixed type: questionId: answer (can be option or essay content depending on question type)
     *                 example:
     *                   question_id_1: "option_a"
     *                   question_id_2: "option_b"
     *                   question_id_3: "Essay content here..."
     *               essay:
     *                 type: string
     *                 description: Essay content for essay type olympiad (alternative format)
 *     responses:
 *       200:
 *         description: Submission successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Submission successful
 *                 submissionId:
 *                   type: string
 *       400:
 *         description: Bad request or already submitted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Olympiad not found
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

    const { answers, essay, content, answer } = req.body || {};
    const { id: olympiadId } = req.query;
    const userId = authResult.user._id;

    // Find attempt (for anti-cheat validation)
    const attempt = await Attempt.findOne({
      userId,
      olympiadId
    });

    if (attempt) {
      // Check if time expired
      if (isTimeExpired(attempt.endsAt)) {
        console.log(`[Submit] Time expired for attempt ${attempt._id}. EndsAt: ${attempt.endsAt}, Now: ${new Date()}`);
        attempt.status = 'time_expired';
        await attempt.save();
        return res.status(400).json({ 
          success: false,
          message: 'Time has expired. Submission not allowed.',
          code: 'TIME_EXPIRED'
        });
      }

      // Validate attempt is active
      const validation = validateAttemptActive(attempt);
      if (!validation.valid) {
        console.log(`[Submit] Attempt validation failed for ${attempt._id}: ${validation.error}`);
        return res.status(400).json({ 
          success: false,
          message: validation.error,
          code: validation.code
        });
      }

      // Validate time not expired
      try {
        validateTimeNotExpired(attempt.endsAt);
      } catch (error) {
        console.log(`[Submit] validateTimeNotExpired failed for ${attempt._id}: ${error.message}`);
        attempt.status = 'time_expired';
        await attempt.save();
        return res.status(400).json({ 
          success: false,
          message: 'Time has expired',
          code: 'TIME_EXPIRED'
        });
      }
    }

    // Validate request body
    if (!req.body || (typeof req.body !== 'object')) {
      console.log('[Submit] Invalid request body');
      return res.status(400).json({ 
        success: false,
        message: 'Request body is required and must be JSON' 
      });
    }

    // Check if olympiad exists
    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      console.log(`[Submit] Olympiad not found: ${olympiadId}`);
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Check if olympiad is in a valid status for submission
    const validSubmissionStatuses = ['active', 'published'];
    if (!validSubmissionStatuses.includes(olympiad.status)) {
      console.log(`[Submit] Invalid olympiad status: ${olympiad.status}`);
      return res.status(400).json({ 
        success: false,
        message: `Cannot submit. Olympiad status is: ${olympiad.status}. It must be 'active' or 'published' to submit.` 
      });
    }

    // Check if olympiad is within the time window
    const now = new Date();
    const startTime = new Date(olympiad.startTime);
    const endTime = new Date(olympiad.endTime);

    if (now < startTime) {
      console.log(`[Submit] Olympiad not started. Start: ${startTime}, Now: ${now}`);
      return res.status(400).json({ 
        success: false,
        message: `Cannot submit. Olympiad has not started yet. Start time: ${startTime.toISOString()}` 
      });
    }

    if (now > endTime) {
      console.log(`[Submit] Olympiad ended. End: ${endTime}, Now: ${now}`);
      return res.status(400).json({ 
        success: false,
        message: `Cannot submit. Olympiad has ended. End time: ${endTime.toISOString()}` 
      });
    }

    // Check if attempt exists (anti-cheat validation takes precedence)
    if (attempt && attempt.status === 'completed') {
      console.log(`[Submit] Attempt already completed: ${attempt._id}`);
      return res.status(400).json({ 
        success: false,
        message: 'You have already completed this attempt',
        code: 'ATTEMPT_ALREADY_COMPLETED'
      });
    }

    // Check if user has already submitted this olympiad this month (legacy check)
    // Note: With anti-cheat system, this should be checked via attempt instead
    // Only check if no active attempt exists, or if attempt is not completed
    if (!attempt && (await hasSubmittedThisMonth(userId.toString(), olympiadId))) {
      console.log(`[Submit] Monthly limit reached for user ${userId}`);
      const existingResult = await findResultByUserAndOlympiad(userId, olympiadId);
      const completedDate = existingResult ? new Date(existingResult.completedAt) : new Date();
      const nextMonth = new Date(completedDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1); // First day of next month
      
      return res.status(400).json({ 
        success: false,
        message: 'You have already taken this olympiad this month. You can take it again next month.',
        submittedAt: existingResult?.completedAt,
        nextAvailableDate: nextMonth.toISOString(),
        canResubmit: false,
        reason: 'Monthly limit reached'
      });
    }

    // Check if already submitted (for resubmission logic)
    const existingResult = await findResultByUserAndOlympiad(userId.toString(), olympiadId);
    if (existingResult && !attempt) { // Only block if not part of an active attempt
      // Allow resubmission if olympiad is still active and within time window
      const allowResubmission = validSubmissionStatuses.includes(olympiad.status) && 
                                now >= startTime && 
                                now <= endTime;
      
      if (allowResubmission) {
        await Result.findByIdAndDelete(existingResult._id);
        await Submission.deleteMany({ userId: userId.toString(), olympiadId });
        // Continue with submission process
      } else {
        console.log(`[Submit] Already submitted and resubmission not allowed`);
        return res.status(400).json({ 
          success: false,
          message: 'Already submitted',
          submittedAt: existingResult.completedAt,
          score: existingResult.totalScore,
          maxScore: existingResult.maxScore,
          percentage: existingResult.percentage,
          canResubmit: false,
          reason: olympiad.status !== 'active' && olympiad.status !== 'published' 
            ? 'Olympiad is no longer active' 
            : now > endTime 
            ? 'Olympiad has ended' 
            : 'Resubmission not allowed'
        });
      }
    }

    // Get all questions for this olympiad
    const allQuestions = await findQuestionsByOlympiadId(olympiadId);
    
    if (!allQuestions || allQuestions.length === 0) {
      console.log(`[Submit] No questions found for olympiad ${olympiadId}`);
      return res.status(400).json({ 
        success: false,
        message: 'No questions found for this olympiad' 
      });
    }

    // Validate required data based on olympiad type
    let essayContent = null;
    
    if (olympiad.type === 'test') {
      if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
        console.log(`[Submit] Answers required for test type`);
        return res.status(400).json({ 
          success: false,
          message: 'Answers are required for test type olympiad. Please provide answers object with questionId: answer pairs.' 
        });
      }
    } else if (olympiad.type === 'mixed') {
      // Mixed type - must have answers object with both test and essay questions
      if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
        console.log(`[Submit] Answers required for mixed type`);
        return res.status(400).json({ 
          success: false,
          message: 'Answers are required for mixed type olympiad. Please provide answers object with questionId: answer pairs (for test questions) or questionId: essayContent (for essay questions).' 
        });
      }
      
      // Validate that all questions have answers
      const answeredQuestionIds = Object.keys(answers);
      const questionIds = allQuestions.map(q => q._id);
      const missingAnswers = questionIds.filter(qId => !answeredQuestionIds.includes(qId));
      
      if (missingAnswers.length > 0) {
        console.log(`[Submit] Missing answers for mixed type: ${missingAnswers.join(', ')}`);
        return res.status(400).json({ 
          success: false,
          message: `Missing answers for questions: ${missingAnswers.join(', ')}. Please provide answers for all questions.`,
          missingQuestions: missingAnswers
        });
      }
    } else if (olympiad.type === 'essay') {
      // Support multiple field names for essay content
      // Also check if answers is a string (some frontends send essay in answers field)
      if (typeof answers === 'string' && answers.trim().length > 0) {
        essayContent = answers;
      } else if (typeof essay === 'string' && essay.trim().length > 0) {
        essayContent = essay;
      } else if (typeof content === 'string' && content.trim().length > 0) {
        essayContent = content;
      } else if (typeof answer === 'string' && answer.trim().length > 0) {
        essayContent = answer;
      } else if (answers && typeof answers === 'object' && answers !== null) {
        // Check if answers object contains essay content
        // Try common keys first
        if (answers.essay && typeof answers.essay === 'string' && answers.essay.trim().length > 0) {
          essayContent = answers.essay;
        } else if (answers.content && typeof answers.content === 'string' && answers.content.trim().length > 0) {
          essayContent = answers.content;
        } else if (answers.answer && typeof answers.answer === 'string' && answers.answer.trim().length > 0) {
          essayContent = answers.answer;
        } else {
          // Check all values in the object for a non-empty string
          const values = Object.values(answers);
          for (const value of values) {
            if (typeof value === 'string' && value.trim().length > 0) {
              essayContent = value;
              break;
            }
          }
        }
      }
      
      if (!essayContent || essayContent.trim().length === 0) {
        console.log(`[Submit] Essay content required`);
        return res.status(400).json({ 
          success: false,
          message: 'Essay content is required for essay type olympiad. Please provide the essay content in the "essay", "content", "answer", or "answers" field (as a string).',
          receivedFields: Object.keys(req.body || {}),
          bodyType: typeof req.body,
          answersType: typeof answers,
          answersValue: answers,
          hint: 'For essay type olympiads, send: { "essay": "your content" } or { "answers": "your content" } or { "answers": { "essay": "your content" } }'
        });
      }
    } else {
      console.log(`[Submit] Unknown olympiad type: ${olympiad.type}`);
      return res.status(400).json({ 
        success: false,
        message: `Unknown olympiad type: ${olympiad.type}` 
      });
    }
    
    // Process submissions
    const submissions = [];
    let totalScore = 0;

    if (olympiad.type === 'test' && answers) {
      // Test type - process answers
      for (const [questionId, answer] of Object.entries(answers)) {
        const question = allQuestions.find((q) => q._id === questionId);
        if (!question) {
          continue;
        }

        let score = 0;
        let isCorrect = false;

        if (question.type === 'multiple-choice') {
          isCorrect = isMultipleChoiceAnswerCorrect(question, answer);
          score = isCorrect ? question.points : 0;
        }

        totalScore += score;
        const submissionAnswer =
          typeof answer === 'string' ? answer : JSON.stringify(answer ?? '');

        const submission = await createSubmission({
          userId: userId.toString(),
          olympiadId,
          questionId,
          answer: submissionAnswer,
          score,
          isCorrect,
        });

        submissions.push(submission);
      }

      if (submissions.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'No valid answers provided. Please check that your question IDs match the olympiad questions.' 
        });
      }
    } else if (olympiad.type === 'mixed' && answers) {
      // Mixed type - process both test and essay questions
      // Get other submissions for essay originality comparison
      const otherSubs = await findSubmissionsByOlympiadId(olympiadId);
      const otherSubmissions = otherSubs.filter((s) => s.userId !== userId.toString());
      
      for (const [questionId, answerValue] of Object.entries(answers)) {
        const question = allQuestions.find((q) => q._id === questionId);
        if (!question) {
          continue;
        }

        let score = 0;
        let isCorrect = false;
        let submissionAnswer = answerValue;

        if (question.type === 'multiple-choice') {
          // Test question - compare with correct answer
          isCorrect = isMultipleChoiceAnswerCorrect(question, answerValue);
          score = isCorrect ? question.points : 0;
          submissionAnswer =
            typeof answerValue === 'string'
              ? answerValue
              : JSON.stringify(answerValue ?? '');
        } else if (question.type === 'essay') {
          // Essay question - analyze and score text
          if (typeof answerValue !== 'string' || answerValue.trim().length === 0) {
            console.warn(`Empty essay answer for question ${questionId}, scoring 0`);
            score = 0;
            isCorrect = false;
            submissionAnswer = answerValue || '';
          } else {
            // Score the essay using text analysis
            const essayScoring = scoreEssay(
              answerValue.trim(),
              question.points || 10,
              otherSubmissions.filter(s => s.questionId === questionId)
            );
            
            score = essayScoring.score;
            isCorrect = essayScoring.score > 0;
            submissionAnswer = answerValue.trim();

          }
        }

        totalScore += score;

        const submission = await createSubmission({
          userId: userId.toString(),
          olympiadId,
          questionId,
          answer: submissionAnswer,
          score,
          isCorrect,
        });

        submissions.push(submission);
      }

      if (submissions.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'No valid answers provided. Please check that your question IDs match the olympiad questions.' 
        });
      }
    } else if (olympiad.type === 'essay' && essayContent) {
      // Essay type - analyze and score text automatically
      const question = allQuestions[0]; // Essay olympiads typically have one question
      if (question) {
        // Get other submissions for this olympiad to compare originality
        const otherSubs = await findSubmissionsByOlympiadId(olympiadId);
        const otherSubmissions = otherSubs.filter((s) => s.userId !== userId.toString());
        
        // Score the essay using text analysis
        const essayScoring = scoreEssay(
          essayContent.trim(),
          question.points || 10,
          otherSubmissions
        );

        const submission = await createSubmission({
          userId: userId.toString(),
          olympiadId,
          questionId: question._id,
          answer: essayContent.trim(),
          score: essayScoring.score,
          isCorrect: essayScoring.score > 0, // Consider correct if score > 0
        });
        
        submissions.push(submission);
        totalScore = essayScoring.score; // Set total score for essay

      } else {
        return res.status(400).json({ 
          success: false,
          message: 'No question found for essay submission' 
        });
      }
    }

    // Calculate percentage
    const percentage = olympiad.totalPoints > 0 
      ? (totalScore / olympiad.totalPoints) * 100 
      : 0;

    const shouldAutoPublish = olympiad.type === "test";
    const initialStatus = shouldAutoPublish ? "checked" : "pending";

    // Create result
    const result = await createResult({
      userId: userId.toString(),
      olympiadId,
      totalScore,
      maxScore: olympiad.totalPoints,
      percentage: Math.round(percentage * 100) / 100,
      completedAt: new Date().toISOString(),
      status: initialStatus,
      visible: shouldAutoPublish,
    });

    // Delete draft after successful submission
    try {
      await deleteDraft(userId.toString(), olympiadId);
    } catch (error) {
      console.warn('Failed to delete draft after submission:', error);
      // Don't fail the submission if draft deletion fails
    }

    // Update attempt status if exists
    if (attempt) {
      attempt.submittedAt = new Date();
      attempt.completedAt = new Date();

      // Run post-attempt verification
      const verificationResult = await runPostAttemptVerification(attempt._id, olympiad.duration);
      
      // Calculate and store trust score
      const trustScoreResult = await calculateAndStoreTrustScore(attempt._id);
      
      // Reload attempt to get updated trust score and verification results
      const updatedAttempt = await Attempt.findById(attempt._id);
      
      // Set status based on verification and trust score
      if (verificationResult.passed && updatedAttempt.trustClassification !== 'invalid') {
        attempt.status = 'completed';
      } else if (!verificationResult.passed) {
        attempt.status = 'verification_failed';
      } else if (updatedAttempt.trustClassification === 'invalid') {
        attempt.status = 'auto_disqualified';
      } else {
        attempt.status = 'completed'; // Default to completed even if suspicious
      }
      
      // Copy trust score and verification fields from updated attempt
      attempt.trustScore = updatedAttempt.trustScore;
      attempt.trustClassification = updatedAttempt.trustClassification;
      attempt.scoringBreakdown = updatedAttempt.scoringBreakdown;
      attempt.verificationStatus = updatedAttempt.verificationStatus;
      attempt.verificationResults = updatedAttempt.verificationResults;

      await attempt.save();

      // Update proctoring session
      const ProctoringSession = (await import('../../../../models/ProctoringSession.js')).default;
      const proctoringSession = await ProctoringSession.findOne({ attemptId: attempt._id });
      if (proctoringSession) {
        proctoringSession.status = 'completed';
        await proctoringSession.save();
      }

      // Create audit log
      await createAuditLog({
        attemptId: attempt._id,
        userId,
        olympiadId,
        eventType: 'submit',
        metadata: {
          totalScore,
          maxScore: olympiad.totalPoints,
          percentage: result.percentage,
          submissionCount: submissions.length,
          trustScore: updatedAttempt.trustScore,
          trustClassification: updatedAttempt.trustClassification,
          verificationPassed: verificationResult.passed
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Submission successful',
      submissionId: result._id,
      score: totalScore,
      totalPoints: olympiad.totalPoints,
      percentage: result.percentage,
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to submit olympiad. Please try again."
    });
  }
}
