import { protect } from '../../../../lib/auth.js';
import { authorize } from '../../../../lib/auth.js';
import { handleCORS } from '../../../../lib/api-helpers.js';
import { sendCsv } from '../../../../lib/csv-helpers.js';
import OwnerAuditLog from '../../../../models/OwnerAuditLog.js';
import connectMongoDB from '../../../../lib/mongodb.js';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

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

    await connectMongoDB();

    const action = req.query.action || null;
    const actorId = req.query.actorId || null;
    const targetType = req.query.targetType || null;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const limit = Math.min(parseInt(req.query.limit || '5000', 10), 20000);

    const query = {};
    if (action) query.action = action;
    if (actorId) query.actorId = actorId;
    if (targetType) query.targetType = targetType;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    const logs = await OwnerAuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const headers = ['Time', 'Action', 'TargetType', 'TargetId', 'Message', 'ActorId', 'ActorRole', 'IP'];
    const rows = logs.map(log => ([
      formatDate(log.timestamp),
      log.action || '',
      log.targetType || '',
      log.targetId || '',
      log.message || '',
      log.actorId || '',
      log.actorRole || '',
      log.ipAddress || '',
    ]));

    const filename = `owner-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    return sendCsv(res, filename, headers, rows);
  } catch (error) {
    console.error('Owner audit logs export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting audit logs',
    });
  }
}
