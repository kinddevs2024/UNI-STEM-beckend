import { connectDB } from '../../../../../lib/json-db.js';
import { findOlympiadById, updateOlympiad } from '../../../../../lib/olympiad-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Finish an olympiad (admin/owner only)
 * POST /api/admin/olympiads/:id/finish
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

    // Only admin and owner can finish olympiads
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

    // Update status to completed
    const updatedOlympiad = updateOlympiad(olympiadId, { 
      status: 'completed',
      endTime: new Date().toISOString(), // Update actual end time
    });

    return res.json({
      success: true,
      message: 'Olympiad finished successfully. Results are now available.',
      olympiad: {
        _id: updatedOlympiad._id,
        title: updatedOlympiad.title,
        status: updatedOlympiad.status,
        endTime: updatedOlympiad.endTime,
        olympiadLogo: updatedOlympiad.olympiadLogo || null,
        updatedAt: updatedOlympiad.updatedAt,
      },
    });
  } catch (error) {
    console.error('Finish olympiad error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

