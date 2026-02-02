import { protect } from '../../../../../lib/auth.js';
import connectMongoDB from '../../../../../lib/mongodb.js';
import { forceSubmitAttempt } from '../../../../../lib/emergency-controls.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Admin endpoint to force submit an attempt
 * POST /api/admin/attempts/[attemptId]/force-submit
 * 
 * Requires admin role.
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

    // Check admin role
    if (authResult.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
    }

    await connectMongoDB();

    const { attemptId } = req.query;

    const result = await forceSubmitAttempt(attemptId, authResult.user._id);

    res.json({
      success: result.success,
      message: result.success ? 'Attempt force-submitted successfully' : result.reason,
      ...result
    });
  } catch (error) {
    console.error('Force submit attempt error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to force submit attempt'
    });
  }
}
