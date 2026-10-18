import connectDB from './mongodb.js';
import Olympiad from '../models/Olympiad.js';
import Result from '../models/Result.js';
import User from '../models/User.js';
import { FIRST_PLACE_REWARD, COIN_PROGRAM_STARTED_AT } from './coin-policy.js';
let running = false;

export async function settleCoinRewards({ OlympiadModel = Olympiad, ResultModel = Result, UserModel = User, activeSince = new Date(COIN_PROGRAM_STARTED_AT) } = {}) {
  const olympiads = await OlympiadModel.find({ coinRewardsEnabled: { $ne: false }, endTime: { $lte: new Date(), $gte: activeSince }, status: { $in: ['published', 'active', 'completed', 'visible'] }, 'coinReward.awardedAt': { $exists: false } }).lean();
  for (const olympiad of olympiads) {
    let reservation = olympiad.coinReward;
    if (!reservation?.userId) {
      const results = await ResultModel.find({ olympiadId: String(olympiad._id) }).sort({ totalScore: -1, completedAt: 1, _id: 1 }).lean();
      if (!results.length || results.some(result => !['checked', 'blocked'].includes(result.status))) continue;
      const firstResult = results.find(result => result.status === 'checked' && result.visible !== false);
      if (!firstResult) continue;
      const winner = await UserModel.findOne({ _id: firstResult.userId, role: 'student' }).select('_id').lean();
      if (!winner) continue;
      const locked = await OlympiadModel.findOneAndUpdate({ _id: olympiad._id, 'coinReward.userId': { $exists: false } }, { $set: { coinReward: { userId: String(winner._id), coins: FIRST_PLACE_REWARD } } }, { new: true }).lean();
      reservation = locked?.coinReward;
      if (!reservation) continue;
    }
    const olympiadId = String(olympiad._id);
    const awardedAt = new Date();
    await UserModel.findOneAndUpdate({ _id: reservation.userId, role: 'student', 'coinRewards.olympiadId': { $ne: olympiadId } }, [{ $set: {
      coins: { $add: [{ $ifNull: ['$coins', 0] }, reservation.coins] },
      coinRewards: { $concatArrays: [{ $ifNull: ['$coinRewards', []] }, [{ olympiadId, coins: reservation.coins, awardedAt }]] },
    } }], { new: true });
    const credited = await UserModel.findOne({ _id: reservation.userId, 'coinRewards.olympiadId': olympiadId }).select('_id').lean();
    if (credited) await OlympiadModel.updateOne({ _id: olympiad._id, 'coinReward.userId': reservation.userId }, { $set: { 'coinReward.awardedAt': awardedAt } });
  }
}
export function startCoinRewardWorker() {
  const tick = async () => {
    if (running) return;
    running = true;
    try { await connectDB(); await settleCoinRewards(); }
    catch (error) { console.error('Coin reward settlement failed:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 60000);
  timer.unref?.();
  const first = setTimeout(tick, 30000);
  first.unref?.();
}