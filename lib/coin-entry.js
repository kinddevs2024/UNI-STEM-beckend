import User from '../models/User.js';
import { randomUUID } from 'node:crypto';
import { parseEntryFee } from './coin-policy.js';

export async function chargeOlympiadEntry(userId, role, olympiad, UserModel = User) {
  if (role !== 'student') return { charged: false, coins: 0 };
  const olympiadId = String(olympiad._id);
  const fee = parseEntryFee(olympiad.entryFeeCoins);
  const chargeId = randomUUID();
  const updated = await UserModel.findOneAndUpdate({
    _id: userId, role: 'student',
    'coinEntries.olympiadId': { $ne: olympiadId },
    $expr: { $gte: [{ $ifNull: ['$coins', 0] }, fee] },
  }, [{ $set: {
    coins: { $subtract: [{ $ifNull: ['$coins', 0] }, fee] },
    coinEntries: { $concatArrays: [{ $ifNull: ['$coinEntries', []] }, [{ olympiadId, chargeId, coins: fee, chargedAt: new Date(), state: 'pending' }]] },
  } }], { new: true }).lean();
  if (updated) return { charged: true, coins: fee, balance: updated.coins, chargeId, userId, olympiadId };
  const current = await UserModel.findById(userId).select('coins coinEntries role').lean();
  const prior = current?.coinEntries?.find(entry => entry.olympiadId === olympiadId);
  if (prior) {
    if (prior.state !== 'pending') return { charged: false, coins: 0, balance: current.coins ?? 0 };
    const cutoff = new Date(Date.now() - 30000);
    if (new Date(prior.chargedAt) < cutoff) {
      const taken = await UserModel.findOneAndUpdate({ _id: userId, coinEntries: { $elemMatch: { olympiadId, chargeId: prior.chargeId, state: 'pending', chargedAt: { $lt: cutoff } } } }, {
        $set: { 'coinEntries.$.chargeId': chargeId, 'coinEntries.$.chargedAt': new Date() },
      }, { new: true }).lean();
      if (taken) return { charged: true, coins: prior.coins, balance: taken.coins, chargeId, userId, olympiadId };
    }
    const error = new Error('This olympiad is already starting. Please wait a moment and try again.');
    error.code = 'ENTRY_STARTING'; error.status = 409; throw error;
  }
  const error = new Error(`You need ${fee} coins to enter this olympiad. Top up your balance to continue.`);
  error.code = 'INSUFFICIENT_COINS'; error.status = 402; error.requiredCoins = fee; error.balance = current?.coins ?? 0;
  throw error;
}

export async function refundUnstartedEntry(charge, UserModel = User) {
  if (!charge?.charged) return;
  await UserModel.updateOne({ _id: charge.userId, 'coinEntries.chargeId': charge.chargeId }, {
    $inc: { coins: charge.coins }, $pull: { coinEntries: { chargeId: charge.chargeId } },
  });
}
export async function activateEntry(charge, UserModel = User) {
  if (!charge?.chargeId) return;
  await UserModel.updateOne({ _id: charge.userId, 'coinEntries.chargeId': charge.chargeId }, { $set: { 'coinEntries.$.state': 'active' } });
}