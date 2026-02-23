import { getUserNotifications, markNotificationRead } from '../services/notificationService.js';
import connectDB from '../../mongodb.js';

export async function listNotifications(req, res, next) {
  try {
    await connectDB();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const notifications = await getUserNotifications(req.user.userId, { skip, limit });
    return res.status(200).json({
      items: notifications.items,
      pagination: {
        page,
        limit,
        total: notifications.total,
        totalPages: Math.max(Math.ceil(notifications.total / limit), 1)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function readNotification(req, res, next) {
  try {
    await connectDB();
    const notification = await markNotificationRead(req.user.userId, req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    return res.status(200).json(notification);
  } catch (error) {
    next(error);
  }
}
