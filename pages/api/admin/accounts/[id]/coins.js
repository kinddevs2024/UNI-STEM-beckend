import { protect, authorize } from '../../../../../lib/auth.js';
import { handleCORS } from '../../../../../lib/api-helpers.js';
import connectDB from '../../../../../lib/mongodb.js';
import User from '../../../../../models/User.js';
import { createOwnerAuditLog } from '../../../../../lib/owner-audit-logger.js';
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  const auth = await protect(req);
  if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });
  const denied = authorize('admin','owner')(auth.user);
  if (denied) return res.status(denied.status).json({ success: false, message: denied.error });
  const amount = Number(req.body?.amount);
  const requestId = String(req.body?.requestId || '');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return res.status(400).json({ success: false, message: 'Enter 1–1,000,000 whole coins and a valid request ID.' });
  try {
    await connectDB();
    const current = await User.findById(req.query.id).select('role coins coinCredits').lean();
    if (!current || current.role !== 'student') return res.status(400).json({ success: false, message: 'Coins can only be added to student accounts.' });
    const prior = current.coinCredits?.find(item => item.requestId === requestId);
    if (prior) return res.json({ success: true, coins: current.coins, alreadyCredited: true });
    const updated = await User.findOneAndUpdate({ _id: req.query.id, role: 'student', 'coinCredits.requestId': { $ne: requestId } }, [{ $set: {
      coins: { $add: [{ $ifNull: ['$coins', 0] }, amount] },
      coinCredits: { $concatArrays: [{ $ifNull: ['$coinCredits', []] }, [{ requestId, coins: amount, actorId: String(auth.user._id), createdAt: new Date() }]] },
    } }], { new: true }).lean();
    const finalUser = updated || await User.findById(req.query.id).select('coins').lean();
    if (updated) {
      try { await createOwnerAuditLog({ actorId: auth.user._id, actorRole: auth.user.role, action: 'student_coin_topup', targetType: 'user', targetId: req.query.id, message: 'Owner added student coins', metadata: { amount, requestId }, req }); }
      catch (error) { console.error('Coin top-up audit failed:', error.message); }
    }
    return res.json({ success: true, coins: finalUser.coins, added: updated ? amount : 0 });
  } catch (error) { return res.status(500).json({ success: false, message: 'Could not add coins. Retry this request.' }); }
}