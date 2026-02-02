import { connectDB } from '../../../../lib/json-db.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { findResultsByOlympiadId } from '../../../../lib/result-helper.js';
import { findUserById } from '../../../../lib/user-helper.js';
import { protect } from '../../../../lib/auth.js';

import { handleCORS } from '../../../../lib/api-helpers.js';

/**
 * Get leaderboard for an olympiad
 * GET /api/olympiads/:id/leaderboard
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
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

    await connectDB();

    const { id: olympiadId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    
    const olympiad = await findOlympiadById(olympiadId);

    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Get all results for this olympiad
    // Show results that are: (checked + visible) OR (just visible)
    // checked + visible = publicly viewable by anyone
    const allResultsRaw = await findResultsByOlympiadId(olympiadId);
    const allResults = allResultsRaw
      .filter(r => {
        // Publicly viewable: checked status + visible
        if (r.status === 'checked' && r.visible === true) return true;
        // Regular visible results
        if (r.visible !== false) return true;
        return false;
      })
      .sort((a, b) => {
        // Sort by score (descending), then by completion time (ascending - faster is better)
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return new Date(a.completedAt) - new Date(b.completedAt);
      });

    const total = allResults.length;
    const paginatedResults = allResults.slice(skip, skip + limit);

    // Populate user information
    const leaderboard = await Promise.all(paginatedResults.map(async (result, index) => {
      const user = await findUserById(result.userId);
      
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
        timeSpent: result.timeSpent || 0,
      };
    }));

    res.json({
      success: true,
      olympiadId: olympiad._id,
      olympiadTitle: olympiad.title,
      olympiadType: olympiad.type,
      totalParticipants: total,
      leaderboard,
      topThree: await Promise.all(allResults.slice(0, 3).map(async (result, index) => {
        const user = await findUserById(result.userId);
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
          timeSpent: result.timeSpent || 0,
        };
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving leaderboard'
    });
  }
}

