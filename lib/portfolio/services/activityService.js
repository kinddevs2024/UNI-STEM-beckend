import Activity from '../../../models/Activity.js';

export async function trackActivity({ userId, action, relatedId = null, metadata = {} }) {
  if (!userId || !action) return null;
  return Activity.create({
    userId,
    action,
    relatedId,
    metadata
  });
}
