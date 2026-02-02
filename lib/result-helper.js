import connectMongoDB from './mongodb.js';
import Result from '../models/Result.js';

export async function getAllResults() {
  await connectMongoDB();
  const results = await Result.find({}).lean();
  return results.map((r) => ({ ...r, _id: r._id.toString() }));
}

export async function findResultById(id) {
  await connectMongoDB();
  const result = await Result.findById(id).lean();
  if (!result) return null;
  return { ...result, _id: result._id.toString() };
}

export async function findResultByUserAndOlympiad(userId, olympiadId) {
  await connectMongoDB();
  const result = await Result.findOne({ userId, olympiadId }).lean();
  if (!result) return null;
  return { ...result, _id: result._id.toString() };
}

export async function findResultsByOlympiadId(olympiadId) {
  await connectMongoDB();
  const results = await Result.find({ olympiadId }).lean();
  return results.map((r) => ({ ...r, _id: r._id.toString() }));
}

export async function findResultsByUserId(userId) {
  await connectMongoDB();
  const results = await Result.find({ userId }).lean();
  return results.map((r) => ({ ...r, _id: r._id.toString() }));
}

export async function hasSubmittedThisMonth(userId, olympiadId) {
  await connectMongoDB();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await Result.findOne({
    userId,
    olympiadId,
    completedAt: { $gte: startOfMonth },
  });
  return !!result;
}

export async function createResult(resultData) {
  await connectMongoDB();
  const existing = await Result.findOne({ userId: resultData.userId, olympiadId: resultData.olympiadId });
  if (existing) throw new Error('Result already exists for this user and olympiad');

  const result = await Result.create({
    userId: resultData.userId,
    olympiadId: resultData.olympiadId,
    totalScore: resultData.totalScore || 0,
    maxScore: resultData.maxScore || 0,
    percentage: resultData.percentage || 0,
    completedAt: resultData.completedAt || new Date(),
    timeSpent: resultData.timeSpent || 0,
    visible: resultData.visible !== undefined ? resultData.visible : true,
    status: resultData.status || 'active',
  });

  const doc = result.toObject();
  return { ...doc, _id: doc._id.toString() };
}

export async function updateResult(id, updates) {
  await connectMongoDB();
  const result = await Result.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!result) throw new Error('Result not found');
  return { ...result, _id: result._id.toString() };
}

export default {
  getAllResults,
  findResultById,
  findResultByUserAndOlympiad,
  findResultsByOlympiadId,
  findResultsByUserId,
  createResult,
  updateResult,
  hasSubmittedThisMonth,
};
