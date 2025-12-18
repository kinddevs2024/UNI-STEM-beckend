import { connectDB } from '../../../../lib/json-db.js';
import connectMongoDB from '../../../../lib/mongodb.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { findQuestionsByOlympiadId } from '../../../../lib/question-helper.js';
import { findResultByUserAndOlympiad, findResultsByOlympiadId } from '../../../../lib/result-helper.js';
import { findSubmissionsByUserAndOlympiad, findSubmissionsByOlympiadId } from '../../../../lib/submission-helper.js';
import { findUserById } from '../../../../lib/user-helper.js';
import { protect, authorize } from '../../../../lib/auth.js';
import { analyzeText } from '../../../../lib/text-analysis.js';
import Olympiad from '../../../../models/Olympiad.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        message: authResult.error 
      });
    }

    await connectDB();

    const { id: olympiadId } = req.query;
    const userId = authResult.user._id;
    const userRole = authResult.user.role;
    const isAdminOrOwner = userRole === 'admin' || userRole === 'owner' || userRole === 'resolter';
    const isUniversity = userRole === 'university';

    const olympiad = findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Check university ownership for university users
    let isOlympiadOwner = false;
    if (isUniversity) {
      try {
        await connectMongoDB();
        const olympiadDoc = await Olympiad.findById(olympiadId).lean();
        if (olympiadDoc && olympiadDoc.ownerUniversityId) {
          isOlympiadOwner = String(olympiadDoc.ownerUniversityId) === String(userId);
        }
      } catch (error) {
        console.error('Error checking olympiad ownership:', error);
        // Default to not owner on error
      }
    }

    // If admin/owner, return all results
    if (isAdminOrOwner) {
      const allResults = findResultsByOlympiadId(olympiadId)
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return new Date(a.completedAt) - new Date(b.completedAt);
        });

      const allResultsWithUsers = allResults.map((result, index) => {
        const user = findUserById(result.userId);
        let position = '';
        if (index === 0) position = '🥇 1st Place';
        else if (index === 1) position = '🥈 2nd Place';
        else if (index === 2) position = '🥉 3rd Place';
        else position = `${index + 1}th Place`;

        return {
          rank: index + 1,
          position,
          userId: result.userId,
          userName: user ? user.name : 'Unknown',
          userEmail: user ? user.email : 'Unknown',
          score: result.totalScore,
          totalPoints: result.maxScore,
          percentage: Math.round(result.percentage * 100) / 100,
          completedAt: result.completedAt,
          timeSpent: result.timeSpent,
          visible: result.visible !== false, // Default to true if not set
          status: result.status || 'active', // Default to 'active' if not set
          _id: result._id,
        };
      });

      return res.json({
        success: true,
        olympiadId: olympiad._id,
        olympiadTitle: olympiad.title,
        olympiadType: olympiad.type,
        olympiadLogo: olympiad.olympiadLogo || null,
        allResults: allResultsWithUsers,
        totalParticipants: allResults.length,
        isAdminView: true,
      });
    }

    // For students, return only their own result
    const userResult = findResultByUserAndOlympiad(userId, olympiadId);
    if (!userResult) {
      return res.status(404).json({ 
        success: false,
        message: 'No submission found for this olympiad' 
      });
    }

    // Get all results to calculate rank
    // For rank calculation, include all results (to get accurate position)
    const allResultsRaw = findResultsByOlympiadId(olympiadId);
    const allResults = allResultsRaw
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return new Date(a.completedAt) - new Date(b.completedAt);
      });
    
    const rank = allResults.findIndex(r => r.userId === userId) + 1;

    // Get top 5 users for leaderboard (only checked+visible or visible results - publicly viewable)
    const publiclyViewableResults = allResults.filter(r => 
      (r.status === 'checked' && r.visible === true) || r.visible !== false
    );
    const topFive = publiclyViewableResults.slice(0, 5).map((result, index) => {
      const user = findUserById(result.userId);
      
      // Determine position label
      let position = '';
      if (index === 0) position = '🥇 1st Place';
      else if (index === 1) position = '🥈 2nd Place';
      else if (index === 2) position = '🥉 3rd Place';
      else position = `${index + 1}th Place`;
      
      return {
        rank: index + 1,
        position,
        userId: result.userId,
        userName: user ? user.name : 'Unknown',
        userEmail: user ? user.email : 'Unknown',
        score: result.totalScore,
        totalPoints: result.maxScore,
        percentage: Math.round(result.percentage * 100) / 100,
        completedAt: result.completedAt,
      };
    });

    // Get user's submissions
    const userSubmissions = findSubmissionsByUserAndOlympiad(userId, olympiadId);
    
    // Get questions
    const questions = findQuestionsByOlympiadId(olympiadId);
    
    // Build answers object
    const answers = {};
    const correctAnswers = {};
    const submissionDetails = {};
    let essayAnalysis = null;
    
    userSubmissions.forEach(sub => {
      answers[sub.questionId] = sub.answer;
      submissionDetails[sub.questionId] = {
        answer: sub.answer,
        score: sub.score,
        isCorrect: sub.isCorrect,
      };
    });

    questions.forEach(q => {
      if (q.type === 'multiple-choice' && q.correctAnswer) {
        correctAnswers[q._id] = q.correctAnswer;
      }
    });

    // For essay-type and mixed-type Olympiads, include text analysis for essay questions
    const essayAnalyses = {};
    if ((olympiad.type === 'essay' || olympiad.type === 'mixed') && userSubmissions.length > 0) {
      // Get other submissions for comparison
      const otherSubmissions = findSubmissionsByOlympiadId(olympiadId)
        .filter(s => s.userId !== userId);
      
      // For essay type, analyze the single essay
      if (olympiad.type === 'essay') {
        const essaySubmission = userSubmissions[0];
        if (essaySubmission && essaySubmission.answer) {
          essayAnalysis = analyzeText(essaySubmission.answer, otherSubmissions);
        }
      } else if (olympiad.type === 'mixed') {
        // For mixed type, analyze all essay questions
        userSubmissions.forEach(submission => {
          const question = questions.find(q => q._id === submission.questionId);
          if (question && question.type === 'essay' && submission.answer) {
            const questionOtherSubmissions = otherSubmissions.filter(
              s => s.questionId === submission.questionId
            );
            essayAnalyses[submission.questionId] = analyzeText(
              submission.answer,
              questionOtherSubmissions
            );
          }
        });
      }
    }

    // Determine user's position label
    let userPosition = '';
    if (rank === 1) userPosition = '🥇 1st Place';
    else if (rank === 2) userPosition = '🥈 2nd Place';
    else if (rank === 3) userPosition = '🥉 3rd Place';
    else userPosition = `${rank}th Place`;

    res.json({
      success: true,
      olympiadId: olympiad._id,
      olympiadTitle: olympiad.title,
      olympiadType: olympiad.type,
      olympiadLogo: olympiad.olympiadLogo || null,
      // User's specific results
      userResult: {
        rank,
        position: userPosition,
        score: userResult.totalScore,
        totalPoints: userResult.maxScore,
        percentage: Math.round(userResult.percentage * 100) / 100,
        submittedAt: userResult.completedAt,
        answers,
        correctAnswers,
        submissionDetails,
        ...(essayAnalysis && { essayAnalysis }),
        ...(Object.keys(essayAnalyses).length > 0 && { essayAnalyses }),
      },
      // Top 5 leaderboard (publicly viewable: checked+visible or visible)
      topFive,
      totalParticipants: publiclyViewableResults.length,
      totalParticipantsAll: allResults.length,
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ 
      message: error.message 
    });
  }
}
