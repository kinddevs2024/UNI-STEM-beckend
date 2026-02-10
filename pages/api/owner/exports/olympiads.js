import { protect } from '../../../../lib/auth.js';
import { authorize } from '../../../../lib/auth.js';
import { getAllOlympiadsWithCreators } from '../../../../lib/olympiad-helper.js';
import { handleCORS } from '../../../../lib/api-helpers.js';
import { sendCsv } from '../../../../lib/csv-helpers.js';

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

    const search = (req.query.search || '').toLowerCase().trim();
    const statusFilter = (req.query.status || '').toLowerCase().trim();
    const subjectFilter = (req.query.subject || '').toLowerCase().trim();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const olympiadsRaw = await getAllOlympiadsWithCreators();
    const olympiads = [...(Array.isArray(olympiadsRaw) ? olympiadsRaw : [])]
      .filter(olympiad => {
        if (statusFilter && olympiad.status !== statusFilter) return false;
        if (subjectFilter && (olympiad.subject || '').toLowerCase() !== subjectFilter) return false;
        if (search) {
          const title = (olympiad.title || '').toLowerCase();
          const subject = (olympiad.subject || '').toLowerCase();
          if (!title.includes(search) && !subject.includes(search)) return false;
        }
        if (startDate || endDate) {
          const createdAt = olympiad.createdAt ? new Date(olympiad.createdAt) : null;
          if (!createdAt) return false;
          if (startDate && createdAt < startDate) return false;
          if (endDate && createdAt > endDate) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const headers = ['Id', 'Title', 'Subject', 'Type', 'Status', 'StartTime', 'EndTime', 'CreatedAt', 'CreatedBy'];
    const rows = olympiads.map(olympiad => ([
      olympiad._id,
      olympiad.title || '',
      olympiad.subject || '',
      olympiad.type || '',
      olympiad.status || '',
      formatDate(olympiad.startTime),
      formatDate(olympiad.endTime),
      formatDate(olympiad.createdAt),
      olympiad.createdBy?.name || olympiad.createdBy?.email || olympiad.createdBy || '',
    ]));

    const filename = `owner-olympiads-${new Date().toISOString().slice(0, 10)}.csv`;
    return sendCsv(res, filename, headers, rows);
  } catch (error) {
    console.error('Owner olympiads export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting olympiads',
    });
  }
}
