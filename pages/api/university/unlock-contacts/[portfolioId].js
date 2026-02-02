import { handleCORS } from '../../../../lib/api-helpers.js';
import { protect } from '../../../../lib/auth.js';
import connectMongoDB from '../../../../lib/mongodb.js';
import User from '../../../../models/User.js';
import { unlockContactAccess, isContactUnlocked } from '../../../../lib/contact-masking.js';
import { findPortfolioById } from '../../../../lib/portfolio-helper.js';

const COINS_PER_UNLOCK = parseInt(process.env.COINS_PER_UNLOCK || '10', 10);

/**
 * POST /api/university/unlock-contacts/[portfolioId]
 * Unlock student contacts for a portfolio. Deducts coins from university user.
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ success: false, message: authResult.error });
    }

    const user = authResult.user;
    if (user.role !== 'university') {
      return res.status(403).json({
        success: false,
        message: 'Only university users can unlock contacts',
      });
    }

    const { portfolioId } = req.query;
    if (!portfolioId) {
      return res.status(400).json({ success: false, message: 'Portfolio ID is required' });
    }

    const portfolio = await findPortfolioById(portfolioId);
    if (!portfolio) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' });
    }

    const alreadyUnlocked = await isContactUnlocked(user._id.toString(), portfolioId);
    if (alreadyUnlocked) {
      return res.json({
        success: true,
        message: 'Contacts already unlocked',
        data: { alreadyUnlocked: true, coinsDeducted: 0 },
      });
    }

    await connectMongoDB();
    let dbUser = await User.findById(user._id);
    // Legacy users without coins field get default 100
    if (typeof dbUser?.coins !== 'number') {
      await User.findByIdAndUpdate(user._id, { $set: { coins: 100 } });
      dbUser = await User.findById(user._id);
    }
    const currentCoins = typeof dbUser?.coins === 'number' ? dbUser.coins : 100;

    if (currentCoins < COINS_PER_UNLOCK) {
      return res.status(402).json({
        success: false,
        message: 'Insufficient balance. You need more coins to unlock contacts.',
        code: 'INSUFFICIENT_BALANCE',
        balance: currentCoins,
        required: COINS_PER_UNLOCK,
      });
    }

    await unlockContactAccess(user._id.toString(), portfolioId);
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { coins: -COINS_PER_UNLOCK } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Contacts unlocked successfully',
      data: {
        coinsDeducted: COINS_PER_UNLOCK,
        newBalance: typeof updatedUser?.coins === 'number' ? updatedUser.coins : currentCoins - COINS_PER_UNLOCK,
      },
    });
  } catch (error) {
    console.error('Unlock contacts error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to unlock contacts',
    });
  }
}
