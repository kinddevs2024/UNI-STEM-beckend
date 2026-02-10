import { getOwnerMetrics } from '../../../lib/owner-metrics.js';
import { getCache, setCache } from '../../../lib/cache.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';
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

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const cacheKey = `owner:metrics:${startDate}:${endDate}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const data = await getOwnerMetrics(startDate, endDate);
    await setCache(cacheKey, data, 300);

    res.json({
      success: true,
      data: {
        ...data,
      },
    });
  } catch (error) {
    console.error('Owner metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating metrics',
    });
  }
}
