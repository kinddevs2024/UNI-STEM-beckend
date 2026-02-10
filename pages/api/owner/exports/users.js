import { protect } from '../../../../lib/auth.js';
import { authorize } from '../../../../lib/auth.js';
import { getAllUsers } from '../../../../lib/user-helper.js';
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
    const roleFilter = (req.query.role || '').toLowerCase().trim();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const users = [...await getAllUsers()]
      .filter(user => {
        if (roleFilter && user.role !== roleFilter) return false;
        if (search) {
          const name = (user.name || '').toLowerCase();
          const email = (user.email || '').toLowerCase();
          if (!name.includes(search) && !email.includes(search)) return false;
        }
        if (startDate || endDate) {
          const createdAt = user.createdAt ? new Date(user.createdAt) : null;
          if (!createdAt) return false;
          if (startDate && createdAt < startDate) return false;
          if (endDate && createdAt > endDate) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const headers = ['Id', 'Name', 'Email', 'Role', 'CreatedAt'];
    const rows = users.map(user => ([
      user._id,
      user.name || '',
      user.email || '',
      user.role || '',
      formatDate(user.createdAt),
    ]));

    const filename = `owner-users-${new Date().toISOString().slice(0, 10)}.csv`;
    return sendCsv(res, filename, headers, rows);
  } catch (error) {
    console.error('Owner users export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting users',
    });
  }
}
