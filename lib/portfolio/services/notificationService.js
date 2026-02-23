import Notification from '../../../models/Notification.js';
import { trackActivity } from './activityService.js';

/**
 * @param {{ userId: string, type: string, relatedId: import("mongoose").Types.ObjectId }}
 * @param {{ portfolioNamespace?: import("socket.io").Namespace }} [opts]
 */
export async function createNotification({ userId, type, relatedId }, opts = {}) {
  const notification = await Notification.create({
    userId,
    type,
    relatedId,
    isRead: false
  });
  const po = notification.toObject ? notification.toObject() : notification;
  if (opts.portfolioNamespace) {
    opts.portfolioNamespace.to(`portfolio-user-${String(userId)}`).emit('notification:new', po);
  }
  await trackActivity({
    userId: String(userId),
    action: 'notification.created',
    relatedId,
    metadata: { type }
  });
  return notification;
}

export async function getUserNotifications(userId, { skip = 0, limit = 25 } = {}) {
  const [items, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ userId })
  ]);
  return { items, total };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) return null;
  notification.isRead = true;
  await notification.save();
  await trackActivity({
    userId: String(userId),
    action: 'notification.read',
    relatedId: notification._id
  });
  return notification;
}
