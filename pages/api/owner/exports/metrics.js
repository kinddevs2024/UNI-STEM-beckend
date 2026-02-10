import { protect } from '../../../../lib/auth.js';
import { authorize } from '../../../../lib/auth.js';
import { handleCORS } from '../../../../lib/api-helpers.js';
import { sendCsv } from '../../../../lib/csv-helpers.js';
import { getOwnerMetrics } from '../../../../lib/owner-metrics.js';

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

    const metrics = await getOwnerMetrics(startDate, endDate);
    const days = metrics.users.map((item) => item.date);

    const rows = days.map((date) => {
      const users = metrics.users.find((item) => item.date === date)?.value || 0;
      const olympiads = metrics.olympiads.find((item) => item.date === date)?.value || 0;
      const submissions = metrics.submissions.find((item) => item.date === date)?.value || 0;
      const results = metrics.results.find((item) => item.date === date)?.value || 0;
      const averageScore = metrics.averageScore.find((item) => item.date === date)?.value || 0;

      return [
        date,
        users,
        olympiads,
        submissions,
        results,
        Math.round(Number(averageScore) * 100) / 100,
      ];
    });

    const headers = ['Date', 'Users', 'Olympiads', 'Submissions', 'Results', 'AverageScore'];
    const filename = `owner-metrics-${startDate}-to-${endDate}.csv`;
    return sendCsv(res, filename, headers, rows);
  } catch (error) {
    console.error('Owner metrics export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting metrics',
    });
  }
}
