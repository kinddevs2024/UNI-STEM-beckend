import PortfolioAuditLog from '../../../models/PortfolioAuditLog.js';

export async function logAudit({ userId, action, targetType, targetId, metadata = {} }) {
  if (!userId || !action || !targetType || !targetId) return null;
  const doc = await PortfolioAuditLog.create({
    userId,
    action,
    targetType,
    targetId,
    metadata
  });
  return doc;
}
