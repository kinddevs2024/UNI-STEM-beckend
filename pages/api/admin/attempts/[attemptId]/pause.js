import { protect } from '../../../../../lib/auth.js';
import connectMongoDB from '../../../../../lib/mongodb.js';
import { pauseAttempt } from '../../../../../lib/emergency-controls.js';

/**
 * Admin endpoint to pause an attempt
 * POST /api/admin/attempts/[attemptId]/pause
 * 
 * Requires admin role.
 */
export default async function handler(req, res) {
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
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Reason is required for pausing attempt' 
      });
    }

    const result = await pauseAttempt(attemptId, reason.trim(), authResult.user._id);

    res.json({
      success: result.success,
      message: result.success ? 'Attempt paused successfully' : result.reason,
      ...result
    });
  } catch (error) {
    console.error('Pause attempt error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to pause attempt'
    });
  }
}
