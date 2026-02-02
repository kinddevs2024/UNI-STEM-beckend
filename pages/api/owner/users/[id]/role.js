import { connectDB } from '../../../../../lib/json-db.js';
import { findUserById, updateUser } from '../../../../../lib/user-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        message: authResult.error 
      });
    }

    const roleError = authorize('owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        message: roleError.error 
      });
    }

    await connectDB();

    const { id } = req.query;
    const { role } = req.body;

    if (!role || !['student', 'admin', 'owner', 'resolter', 'school-admin', 'school-teacher', 'university', 'checker'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid role (student, admin, owner, resolter, school-admin, school-teacher, university, checker)' 
      });
    }

    // Check if user exists
    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update user role (only owner can do this)
    const updatedUser = updateUser(id, { role });

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Owner update user role error:', error);
    res.status(500).json({ 
      message: error.message 
    });
  }
}
