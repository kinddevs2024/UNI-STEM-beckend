/**
 * Batch flush presence data to MongoDB
 * Called every 15-30 seconds to persist in-memory presence without per-heartbeat DB writes
 */

import * as presenceStore from './presence-store.js';
import SessionHeartbeat from '../models/SessionHeartbeat.js';
import connectMongoDB from './mongodb.js';

/**
 * Flush all dirty presence entries to SessionHeartbeat collection
 */
export async function flushPresenceToMongo() {
  // Clean up stale sessions first (no heartbeat for 60+ seconds)
  const removed = presenceStore.removeStaleSessions();
  if (removed > 0 && process.env.NODE_ENV === 'development') {
    console.log(`[Presence] Removed ${removed} stale session(s)`);
  }

  const dirtyEntries = presenceStore.getDirtyEntries();
  if (dirtyEntries.length === 0) return;

  try {
    await connectMongoDB();

    const bulkOps = dirtyEntries.map((e) => ({
      updateOne: {
        filter: { attemptId: e.attemptId, socketId: e.socketId },
        update: {
          $set: {
            attemptId: e.attemptId,
            socketId: e.socketId,
            lastSeenAt: e.lastSeenAt,
            status: e.status,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await SessionHeartbeat.bulkWrite(bulkOps);
      presenceStore.markAllClean(dirtyEntries);
      if (process.env.NODE_ENV === 'development' && dirtyEntries.length > 0) {
        console.log(`[Presence] Flushed ${dirtyEntries.length} heartbeat(s) to Mongo`);
      }
    }
  } catch (error) {
    console.error('Presence flush error:', error);
    // Don't mark clean on error - entries stay dirty for next flush
  }
}
