import { connectDB } from '../../../../../lib/json-db.js';
import { findOlympiadById, updateOlympiad } from '../../../../../lib/olympiad-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';
import { createOwnerAuditLog } from '../../../../../lib/owner-audit-logger.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Update olympiad status (visible/unvisible)
 * Only admin and owner can control status
 * PUT /api/admin/olympiads/:id/status
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

    // Only admin and owner can change status
    const roleError = authorize('admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { id: olympiadId } = req.query;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['visible', 'unvisible', 'draft', 'published', 'upcoming', 'active', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Update status
    const updatedOlympiad = await updateOlympiad(olympiadId, { status });

    if (authResult.user?.role === 'owner') {
      await createOwnerAuditLog({
        actorId: authResult.user._id,
        actorRole: authResult.user.role,
        action: 'olympiad_status_change',
        targetType: 'olympiad',
        targetId: olympiadId,
        message: `Owner changed olympiad status to ${status}`,
        metadata: {
          title: olympiad.title,
          previousStatus: olympiad.status,
          newStatus: status,
        },
        req,
      });
    }

    return res.json({
      success: true,
      message: `Olympiad status updated to ${status}`,
      olympiad: {
        _id: updatedOlympiad._id,
        title: updatedOlympiad.title,
        status: updatedOlympiad.status,
        olympiadLogo: updatedOlympiad.olympiadLogo || null,
        updatedAt: updatedOlympiad.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update olympiad status error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

