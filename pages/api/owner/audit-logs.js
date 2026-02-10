import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';
import { getOwnerAuditLogs } from '../../../lib/owner-audit-logger.js';
import { handleCORS } from '../../../lib/api-helpers.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    const roleError = authorize('owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
      });
    }

    const {
      page,
      limit,
      action,
      actorId,
      targetType,
      startDate,
      endDate,
    } = req.query;

    const result = await getOwnerAuditLogs({
      page: page || 1,
      limit: limit || 20,
      action: action || null,
      actorId: actorId || null,
      targetType: targetType || null,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Owner audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving audit logs',
    });
  }
}
