import { connectDB } from '../../../../../lib/json-db.js';
import { findOlympiadById } from '../../../../../lib/olympiad-helper.js';
import { findQuestionsByOlympiadId } from '../../../../../lib/question-helper.js';
import { findSubmissionById, updateSubmission, findSubmissionsByOlympiadId } from '../../../../../lib/submission-helper.js';
import { findResultByUserAndOlympiad, updateResult } from '../../../../../lib/result-helper.js';
import { findSubmissionsByUserAndOlympiad } from '../../../../../lib/submission-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';
import { analyzeText } from '../../../../../lib/text-analysis.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Grade/Edit essay submission (Resolter only)
 * PUT /api/resolter/submissions/:id/grade
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'PUT') {
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

    // Check if user is resolter, admin, or owner
    const roleError = authorize('resolter', 'admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { id: submissionId } = req.query;
    const { score, comment } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ 
        success: false,
        message: 'Score is required' 
      });
    }

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Score must be a non-negative number' 
      });
    }

    // Find submission
    const submission = findSubmissionById(submissionId);
    if (!submission) {
      return res.status(404).json({ 
        success: false,
        message: 'Submission not found' 
      });
    }

    // Verify olympiad exists
    const olympiad = await findOlympiadById(submission.olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Check if essay is written by AI (for essay-type questions)
    let isAI = false;
    let aiProbability = 0;
    let aiDetected = false;

    // Check if this is an essay submission
    if (submission.answer && submission.answer.length > 50) {
      // Get other submissions for comparison
      const otherSubmissions = findSubmissionsByOlympiadId(submission.olympiadId)
        .filter(s => s._id !== submissionId && s.userId !== submission.userId);
      
      // Analyze text for AI detection
      const analysis = analyzeText(submission.answer, otherSubmissions);
      aiProbability = analysis.aiProbability || 0;
      
      // Consider AI if probability > 0.5 (50%)
      isAI = aiProbability > 0.5;
      aiDetected = isAI;
    }

    // Update submission with new score, grader info, and AI detection
    const updatedSubmission = await updateSubmission(submissionId, {
      score: score,
      isCorrect: score > 0,
      gradedBy: authResult.user._id,
      gradedAt: new Date().toISOString(),
      comment: comment || null,
      isAI: isAI,
      aiProbability: aiProbability,
      aiCheckedBy: authResult.user._id,
      aiCheckedAt: new Date().toISOString(),
    });

    // Recalculate total result score for this user
    const userSubmissions = await findSubmissionsByUserAndOlympiad(submission.userId, submission.olympiadId);
    const totalScore = userSubmissions.reduce((sum, sub) => {
      // Use updated score for current submission, existing score for others
      return sum + (sub._id === submissionId ? score : sub.score);
    }, 0);

    // Update result
    const result = await findResultByUserAndOlympiad(submission.userId, submission.olympiadId);
    let resultStatus = 'checked';
    let shouldPublish = true;

    if (aiDetected) {
      resultStatus = 'blocked';
      shouldPublish = false;
    } else {
      const questions = await findQuestionsByOlympiadId(submission.olympiadId);
      const essayQuestionIds = new Set(
        questions.filter((q) => q.type === 'essay').map((q) => q._id)
      );

      const essaySubmissions = userSubmissions.filter((sub) =>
        essayQuestionIds.has(sub.questionId)
      );

      const hasUngradedEssay = essaySubmissions.some((sub) => !sub.gradedAt);
      if (hasUngradedEssay) {
        resultStatus = 'pending';
        shouldPublish = false;
      }
    }

    if (result) {
      const percentage = olympiad.totalPoints > 0 
        ? (totalScore / olympiad.totalPoints) * 100 
        : 0;

      await updateResult(result._id, {
        totalScore: totalScore,
        percentage: Math.round(percentage * 100) / 100,
        status: resultStatus,
        visible: shouldPublish,
      });
    }

    return res.json({
      success: true,
      message: aiDetected 
        ? 'Submission graded successfully. AI content detected - result status set to blocked.' 
        : 'Submission graded successfully',
      submission: {
        _id: updatedSubmission._id,
        questionId: updatedSubmission.questionId,
        score: updatedSubmission.score,
        isCorrect: updatedSubmission.isCorrect,
        gradedBy: updatedSubmission.gradedBy,
        gradedAt: updatedSubmission.gradedAt,
        comment: updatedSubmission.comment,
        isAI: updatedSubmission.isAI,
        aiProbability: updatedSubmission.aiProbability,
      },
      aiDetected: aiDetected,
      updatedResult: result ? {
        totalScore: totalScore,
        percentage: Math.round((olympiad.totalPoints > 0 ? (totalScore / olympiad.totalPoints) * 100 : 0) * 100) / 100,
        status: resultStatus,
        visible: shouldPublish,
      } : null,
    });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

