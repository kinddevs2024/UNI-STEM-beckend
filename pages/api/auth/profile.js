import { connectDB } from '../../../lib/json-db.js';
import { findUserById, updateUser, findUserByEmail } from '../../../lib/user-helper.js';
import { protect } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/middleware/cors.js';

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  if (req.method !== 'PUT') {
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

    await connectDB();

    const userId = authResult.user._id;
    const currentUser = await findUserById(userId);
    
    if (!currentUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const {
      name,
      firstName,
      secondName,
      email,
      tel,
      address,
      schoolName,
      schoolId,
      dateBorn,
      gender,
      userLogo,
    } = req.body;

    // Prepare updates object
    const updates = {};

    // Allow updating basic info
    if (name !== undefined) updates.name = name.trim();
    if (firstName !== undefined) updates.firstName = firstName?.trim() || null;
    if (secondName !== undefined) updates.secondName = secondName?.trim() || null;
    
    // Email update - check if it's taken by another user
    if (email !== undefined && email !== currentUser.email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false,
          message: 'Please provide a valid email' 
        });
      }
      const existingUser = findUserByEmail(email);
      if (existingUser && existingUser._id !== userId) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already taken by another user' 
        });
      }
      updates.email = email.toLowerCase().trim();
    }

    if (tel !== undefined) updates.tel = tel?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (dateBorn !== undefined) {
      updates.dateBorn = dateBorn ? new Date(dateBorn).toISOString() : null;
    }
    if (gender !== undefined) {
      if (gender && !['male', 'female', 'other'].includes(gender)) {
        return res.status(400).json({ 
          success: false,
          message: 'Gender must be one of: male, female, other' 
        });
      }
      updates.gender = gender || null;
    }
    if (userLogo !== undefined) updates.userLogo = userLogo?.trim() || null;
    // Handle cookies separately
    if (req.body.cookies !== undefined) updates.cookies = req.body.cookies;

    // School information - only for students and school-teacher
    if (currentUser.role === 'student' || currentUser.role === 'school-teacher') {
      if (schoolName !== undefined) updates.schoolName = schoolName?.trim() || null;
      if (schoolId !== undefined) updates.schoolId = schoolId?.trim() || null;
    } else if (schoolName !== undefined || schoolId !== undefined) {
      return res.status(400).json({ 
        success: false,
        message: 'School information can only be updated for students or school-teacher' 
      });
    }

    // Don't allow users to change their own role through this endpoint
    if (req.body.role !== undefined && req.body.role !== currentUser.role) {
      return res.status(403).json({ 
        success: false,
        message: 'You cannot change your own role. Contact an administrator.' 
      });
    }

    // Don't allow users to change their ban status
    if (req.body.userBan !== undefined) {
      return res.status(403).json({ 
        success: false,
        message: 'You cannot change your ban status' 
      });
    }

    // Update user
    const updatedUser = updateUser(userId, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Failed to update profile' 
    });
  }
}

