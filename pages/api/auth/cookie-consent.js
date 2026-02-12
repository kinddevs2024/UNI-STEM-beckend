import { connectDB } from '../../../lib/json-db.js';
import { findUserById, updateUser } from '../../../lib/user-helper.js';
import { protect } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/middleware/cors.js';

/**
 * Update user cookie consent
 * POST /api/auth/cookie-consent
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST' && req.method !== 'PUT') {
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

    const { consent } = req.body;

    // Validate consent value
    if (!consent) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide consent value' 
      });
    }

    // Update cookies directly (moved out of profile)
    const updates = {
      cookies: consent,
    };

    // Update user
    const updatedUser = updateUser(userId, updates);

    res.json({
      success: true,
      message: 'Cookie consent updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update cookie consent error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Failed to update cookie consent' 
    });
  }
}

