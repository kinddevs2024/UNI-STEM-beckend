import { connectDB } from '../../../../../lib/json-db.js';
import { findResultById, updateResult } from '../../../../../lib/result-helper.js';
import { findOlympiadById } from '../../../../../lib/olympiad-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Edit/Update result directly (Resolter only)
 * PUT /api/resolter/results/:id/edit
 * 
 * Allows resolter to directly update result scores and percentages
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

    const { id: resultId } = req.query;
    const { totalScore, percentage, maxScore } = req.body;

    // Find result
    const result = await findResultById(resultId);
    if (!result) {
      return res.status(404).json({ 
        success: false,
        message: 'Result not found' 
      });
    }

    // Verify olympiad exists
    const olympiad = await findOlympiadById(result.olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Prepare updates
    const updates = {};

    // Update total score if provided
    if (totalScore !== undefined) {
      if (typeof totalScore !== 'number' || totalScore < 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Total score must be a non-negative number' 
        });
      }
      updates.totalScore = totalScore;
    }

    // Update max score if provided
    if (maxScore !== undefined) {
      if (typeof maxScore !== 'number' || maxScore < 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Max score must be a non-negative number' 
        });
      }
      updates.maxScore = maxScore;
    }

    // Update percentage if provided, otherwise recalculate
    if (percentage !== undefined) {
      if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        return res.status(400).json({ 
          success: false,
          message: 'Percentage must be a number between 0 and 100' 
        });
      }
      updates.percentage = Math.round(percentage * 100) / 100;
    } else if (totalScore !== undefined || maxScore !== undefined) {
      // Recalculate percentage if score changed but percentage not provided
      const finalMaxScore = maxScore !== undefined ? maxScore : (result.maxScore || olympiad.totalPoints);
      const finalTotalScore = totalScore !== undefined ? totalScore : result.totalScore;
      if (finalMaxScore > 0) {
        updates.percentage = Math.round((finalTotalScore / finalMaxScore) * 100 * 100) / 100;
      } else {
        updates.percentage = 0;
      }
    }

    // Update result
    const updatedResult = await updateResult(resultId, updates);

    return res.json({
      success: true,
      message: 'Result updated successfully',
      result: {
        _id: updatedResult._id,
        userId: updatedResult.userId,
        olympiadId: updatedResult.olympiadId,
        totalScore: updatedResult.totalScore,
        maxScore: updatedResult.maxScore,
        percentage: updatedResult.percentage,
        completedAt: updatedResult.completedAt,
        updatedAt: updatedResult.updatedAt,
      },
    });
  } catch (error) {
    console.error('Edit result error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

