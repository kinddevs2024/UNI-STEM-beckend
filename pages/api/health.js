import connectDB from '../../lib/mongodb.js';
import mongoose from 'mongoose';
import { getDiskSpaceInfo } from '../../lib/disk-space.js';

/**
 * Health check endpoint - for monitoring and load balancers
 * GET /api/health
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const checks = {
    server: 'ok',
    db: 'unknown',
    disk: 'unknown',
  };

  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB().catch((e) => {
        checks.db = 'error';
        throw e;
      });
    }
    checks.db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    checks.db = 'error';
  }

  try {
    const diskInfo = getDiskSpaceInfo('./uploads');
    if (diskInfo) {
      checks.disk = diskInfo.freePercent >= 10 ? 'ok' : 'low';
      checks.diskFreePercent = Math.round(diskInfo.freePercent * 10) / 10;
      checks.diskFreeGb = (diskInfo.freeBytes / (1024 ** 3)).toFixed(2);
    } else {
      checks.disk = 'ok';
    }
  } catch {
    checks.disk = 'error';
  }

  const ok = checks.db === 'connected';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    checks,
  });
}
