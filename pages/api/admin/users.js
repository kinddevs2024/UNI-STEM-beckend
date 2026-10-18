import { connectDB } from '../../../lib/json-db.js';
import { getAllUsers } from '../../../lib/user-helper.js';
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
        message: authResult.error 
      });
    }

    const roleError = authorize('admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const search = (req.query.search || '').toLowerCase().trim();
    const roleFilter = (req.query.role || '').toLowerCase().trim();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const skip = (page - 1) * limit;

    let allUsers = [...await getAllUsers()]
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
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(user => ({
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        coins: user.role === 'student' ? (user.coins ?? 0) : null,
        createdAt: user.createdAt,
      }));

    const total = allUsers.length;
    const users = allUsers.slice(skip, skip + limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ 
      success: false,
      message: "Error retrieving users"
    });
  }
}
