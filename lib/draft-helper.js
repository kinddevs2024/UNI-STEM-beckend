import connectMongoDB from './mongodb.js';
import Draft from '../models/Draft.js';

export async function getAllDrafts() {
  await connectMongoDB();
  const drafts = await Draft.find({}).lean();
  return drafts.map((d) => ({ ...d, _id: d._id.toString() }));
}

export async function findDraftByUserAndOlympiad(userId, olympiadId) {
  await connectMongoDB();
  const draft = await Draft.findOne({ userId, olympiadId }).lean();
  if (!draft) return null;
  return { ...draft, _id: draft._id.toString() };
}

export async function saveDraft(draftData) {
  await connectMongoDB();
  const draft = await Draft.findOneAndUpdate(
    { userId: draftData.userId, olympiadId: draftData.olympiadId },
    { answers: draftData.answers || {}, updatedAt: new Date() },
    { new: true, upsert: true }
  ).lean();
  return { ...draft, _id: draft._id.toString() };
}

export async function deleteDraft(userId, olympiadId) {
  await connectMongoDB();
  await Draft.deleteOne({ userId, olympiadId });
  return true;
}

export default {
  getAllDrafts,
  findDraftByUserAndOlympiad,
  saveDraft,
  deleteDraft,
};
