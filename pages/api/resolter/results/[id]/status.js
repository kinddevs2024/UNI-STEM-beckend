import { connectDB } from '../../../../../lib/json-db.js';
import { findResultById, updateResult } from '../../../../../lib/result-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';

/**
 * Change result status (Resolter only)
 * PUT /api/resolter/results/:id/status
 */
export default async function handler(req, res) {
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
    const { status } = req.body;

    const validStatuses = ['active', 'blocked', 'pending', 'under-review', 'checked'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: `status must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Find result
    const result = await findResultById(resultId);
    if (!result) {
      return res.status(404).json({ 
        success: false,
        message: 'Result not found' 
      });
    }

    // Update status
    const updatedResult = await updateResult(resultId, {
      status: status,
    });

    return res.json({
      success: true,
      message: `Result status changed to ${status} successfully`,
      result: {
        _id: updatedResult._id,
        userId: updatedResult.userId,
        olympiadId: updatedResult.olympiadId,
        visible: updatedResult.visible,
        status: updatedResult.status,
        totalScore: updatedResult.totalScore,
        percentage: updatedResult.percentage,
      },
    });
  } catch (error) {
    console.error('Change result status error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

