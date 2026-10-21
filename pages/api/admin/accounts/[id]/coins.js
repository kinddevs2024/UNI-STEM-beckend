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
  const operation = req.body?.operation ?? 'add';
  if (!['add','subtract'].includes(operation)) return res.status(400).json({ success:false, message:'Choose add or subtract.' });
  const requestId = String(req.body?.requestId || '');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return res.status(400).json({ success: false, message: 'Enter 1–1,000,000 whole coins and a valid request ID.' });
  try {
    await connectDB();
    const current = await User.findById(req.query.id).select('role coins coinCredits').lean();
    if (!current || current.role !== 'student') return res.status(400).json({ success: false, message: 'Coin balances can only be changed for student accounts.' });
    const delta = operation === 'subtract' ? -amount : amount;
    const replay = (entry, coins) => {
      if (entry.coins !== delta || (entry.actorId && entry.actorId !== String(auth.user._id))) return res.status(409).json({success:false,message:'Request ID was already used for a different balance change.'});
      return res.json({success:true,coins,alreadyApplied:true,alreadyCredited:operation==='add'});
    };
    const prior = current.coinCredits?.find(item => item.requestId === requestId);
    if (prior) return replay(prior,current.coins);
    const filter = { _id:req.query.id, role:'student', 'coinCredits.requestId':{$ne:requestId} };
    if (operation === 'subtract') filter.$expr = {$gte:[{$ifNull:['$coins',0]},amount]};
    const updated = await User.findOneAndUpdate(filter, [{ $set: {
      coins: { $add: [{ $ifNull: ['$coins', 0] }, delta] },
      coinCredits: { $concatArrays: [{ $ifNull: ['$coinCredits', []] }, [{ requestId, coins: delta, actorId: String(auth.user._id), createdAt: new Date() }]] },
    } }], { new: true }).lean();
    const finalUser = updated || await User.findById(req.query.id).select('coins coinCredits').lean();
    if (!updated) {
      const applied=finalUser?.coinCredits?.find(item=>item.requestId===requestId);
      if (applied) return replay(applied,finalUser.coins);
      return res.status(409).json({success:false,message:operation==='subtract'?'Insufficient coin balance.':'Balance changed. Retry this request.'});
    }
    if (updated) {
      try { await createOwnerAuditLog({ actorId: auth.user._id, actorRole: auth.user.role, action: operation==='subtract'?'student_coin_deduction':'student_coin_topup', targetType: 'user', targetId: req.query.id, message: operation==='subtract'?'Administrator removed student coins':'Administrator added student coins', metadata: { amount, delta, operation, requestId }, req }); }
      catch (error) { console.error('Coin adjustment audit failed:', error.message); }
    }
    return res.json({ success: true, coins: finalUser.coins, added: operation==='add'?amount:0, removed:operation==='subtract'?amount:0 });
  } catch (error) { return res.status(500).json({ success: false, message: 'Could not change coin balance. Retry this request.' }); }
}