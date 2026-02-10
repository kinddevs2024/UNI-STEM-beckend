import OwnerAuditLog from '../models/OwnerAuditLog.js';
import connectDB from './mongodb.js';
import { getClientIP } from './device-fingerprint.js';

export async function createOwnerAuditLog({
  actorId,
  actorRole,
  action,
  targetType,
  targetId = null,
  message = '',
  metadata = {},
  req = null,
}) {
  try {
    await connectDB();

    const auditLog = new OwnerAuditLog({
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      message,
      metadata,
      ipAddress: req ? getClientIP(req) : null,
      userAgent: req?.headers?.['user-agent'] || null,
      timestamp: new Date(),
    });

    await auditLog.save();
    return auditLog.toObject();
  } catch (error) {
    console.error('Error creating owner audit log:', error);
    return null;
  }
}

export async function getOwnerAuditLogs(options = {}) {
  try {
    await connectDB();

    const {
      page = 1,
      limit = 20,
      action = null,
      actorId = null,
      targetType = null,
      startDate = null,
      endDate = null,
    } = options;

    const query = {};
    if (action) query.action = action;
    if (actorId) query.actorId = actorId;
    if (targetType) query.targetType = targetType;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, logs] = await Promise.all([
      OwnerAuditLog.countDocuments(query),
      OwnerAuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(Number(limit))
        .skip(skip)
        .lean(),
    ]);

    return {
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  } catch (error) {
    console.error('Error getting owner audit logs:', error);
    throw error;
  }
}

export default {
  createOwnerAuditLog,
  getOwnerAuditLogs,
};
