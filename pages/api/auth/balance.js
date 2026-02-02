import { protect } from '../../../lib/auth.js';
import connectMongoDB from '../../../lib/mongodb.js';
import User from '../../../models/User.js';

/**
 * GET /api/auth/balance
 * Returns current user's coin balance. Lightweight endpoint for refresh.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ success: false, message: authResult.error });
    }

    await connectMongoDB();
    const user = await User.findById(authResult.user._id).select('coins').lean();
    const coins = typeof user?.coins === 'number' ? user.coins : 100; // Default for legacy users

    res.json({ success: true, coins });
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch balance' });
  }
}
