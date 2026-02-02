import { connectDB } from '../../../../../lib/json-db.js';
import { findOlympiadById, updateOlympiad } from '../../../../../lib/olympiad-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Start an olympiad (admin/owner only)
 * POST /api/admin/olympiads/:id/start
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

    // Only admin and owner can start olympiads
    const roleError = authorize('admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { id: olympiadId } = req.query;
    const olympiad = await findOlympiadById(olympiadId);

    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Check if olympiad has questions
    if (!olympiad.questions || olympiad.questions.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot start olympiad without questions' 
      });
    }

    // Update status to active
    const updatedOlympiad = updateOlympiad(olympiadId, { 
      status: 'active',
      startTime: new Date().toISOString(), // Update actual start time
    });

    return res.json({
      success: true,
      message: 'Olympiad started successfully',
      olympiad: {
        _id: updatedOlympiad._id,
        title: updatedOlympiad.title,
        status: updatedOlympiad.status,
        startTime: updatedOlympiad.startTime,
        olympiadLogo: updatedOlympiad.olympiadLogo || null,
        updatedAt: updatedOlympiad.updatedAt,
      },
    });
  } catch (error) {
    console.error('Start olympiad error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

