import { connectDB } from '../../../lib/json-db.js';
import { getAllOlympiads } from '../../../lib/olympiad-helper.js';
import { getAllResults } from '../../../lib/result-helper.js';
import { getAllSubmissions } from '../../../lib/submission-helper.js';
import { findUserById } from '../../../lib/user-helper.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';

/**
 * Get all results across all olympiads (Resolter only)
 * GET /api/resolter/all-results
 * Optional query params:
 *   - olympiadId: Filter by specific olympiad
 *   - userId: Filter by specific user
 */
export default async function handler(req, res) {
  // Set cache-control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    // Check if user is resolter, admin, or owner
    const roleError = authorize('resolter', 'admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { olympiadId, userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // Get all results
    let allResults = getAllResults();
    
    // Filter by olympiad if specified
    if (olympiadId) {
      allResults = allResults.filter(r => r.olympiadId === olympiadId);
    }

    // Filter by user if specified
    if (userId) {
      allResults = allResults.filter(r => r.userId === userId);
    }

    // Sort by olympiad, then by score (descending)
    allResults.sort((a, b) => {
      if (a.olympiadId !== b.olympiadId) {
        return a.olympiadId.localeCompare(b.olympiadId);
      }
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return new Date(a.completedAt) - new Date(b.completedAt);
    });

    // Get all olympiads and submissions for context
    const allOlympiads = await getAllOlympiads();
    const allSubmissions = await getAllSubmissions();

    // Group results by olympiad and populate with details
    const resultsByOlympiad = {};
    
    allResults.forEach(result => {
      if (!resultsByOlympiad[result.olympiadId]) {
        const olympiad = allOlympiads.find(o => o._id === result.olympiadId);
        resultsByOlympiad[result.olympiadId] = {
          olympiad: olympiad ? {
            _id: olympiad._id,
            title: olympiad.title,
            type: olympiad.type,
            subject: olympiad.subject,
            olympiadLogo: olympiad.olympiadLogo || null,
          } : null,
          results: [],
        };
      }

      const user = await findUserById(result.userId);
      const userSubmissions = allSubmissions.filter(s => 
        s.userId === result.userId && s.olympiadId === result.olympiadId
      );

      resultsByOlympiad[result.olympiadId].results.push({
        resultId: result._id,
        userId: result.userId,
        userName: user ? user.name : 'Unknown',
        userEmail: user ? user.email : 'Unknown',
        score: result.totalScore,
        totalPoints: result.maxScore,
        percentage: Math.round(result.percentage * 100) / 100,
        completedAt: result.completedAt,
        timeSpent: result.timeSpent,
        visible: result.visible !== false, // Default to true if not set
        status: result.status || 'active',
        submissions: userSubmissions.map(sub => ({
          submissionId: sub._id,
          questionId: sub.questionId,
          answer: sub.answer,
          score: sub.score,
          isCorrect: sub.isCorrect,
          gradedBy: sub.gradedBy,
          gradedAt: sub.gradedAt,
          comment: sub.comment || null,
          isAI: sub.isAI || false,
          aiProbability: sub.aiProbability || 0,
        })),
      });
    });

    // Convert to array format
    const olympiadResults = Object.entries(resultsByOlympiad).map(([olympiadId, data]) => ({
      olympiadId,
      ...data,
      totalParticipants: data.results.length,
    }));

    const paginatedOlympiadResults = olympiadResults.slice(skip, skip + limit);

    return res.json({
      success: true,
      totalResults: allResults.length,
      totalOlympiads: Object.keys(resultsByOlympiad).length,
      olympiadResults: paginatedOlympiadResults,
      filters: {
        olympiadId: olympiadId || null,
        userId: userId || null,
      },
      pagination: {
        page,
        limit,
        total: olympiadResults.length,
        pages: Math.ceil(olympiadResults.length / limit),
      },
    });
  } catch (error) {
    console.error('Get all results error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving results'
    });
  }
}

