import connectMongoDB from './mongodb.js';
import Olympiad from '../models/Olympiad.js';
import { findUserById } from './user-helper.js';

export async function getAllOlympiads() {
  await connectMongoDB();
  const olympiads = await Olympiad.find({}).lean();
  return olympiads.map((o) => ({ ...o, _id: o._id.toString(), createdBy: o.createdBy?.toString?.() || o.createdBy }));
}

export async function findOlympiadById(id) {
  await connectMongoDB();
  const olympiad = await Olympiad.findById(id).lean();
  if (!olympiad) return null;
  return { ...olympiad, _id: olympiad._id.toString(), createdBy: olympiad.createdBy?.toString?.() || olympiad.createdBy, questions: (olympiad.questions || []).map((q) => q?.toString?.() || q) };
}

export async function findOlympiadsByStatus(status) {
  await connectMongoDB();
  const query = Array.isArray(status) ? { status: { $in: status } } : { status };
  const olympiads = await Olympiad.find(query).lean();
  return olympiads.map((o) => ({ ...o, _id: o._id.toString(), createdBy: o.createdBy?.toString?.() || o.createdBy }));
}

export async function findOlympiadsByCreator(userId) {
  await connectMongoDB();
  const olympiads = await Olympiad.find({ createdBy: userId }).lean();
  return olympiads.map((o) => ({ ...o, _id: o._id.toString(), createdBy: o.createdBy?.toString?.() || o.createdBy }));
}

export async function createOlympiad(olympiadData) {
  await connectMongoDB();
  const creator = await findUserById(olympiadData.createdBy);
  if (!creator) {
    throw new Error('Creator user not found');
  }

  const status = olympiadData.status === 'unvisible' ? 'draft' : (olympiadData.status || 'draft');
  const olympiad = await Olympiad.create({
    title: olympiadData.title.trim(),
    description: olympiadData.description.trim(),
    type: olympiadData.type || 'test',
    subject: olympiadData.subject.trim(),
    startTime: new Date(olympiadData.startTime),
    endTime: new Date(olympiadData.endTime),
    duration: olympiadData.duration,
    questions: olympiadData.questions || [],
    totalPoints: olympiadData.totalPoints || 0,
    status,
    createdBy: olympiadData.createdBy,
    olympiadLogo: olympiadData.olympiadLogo?.trim() || null,
  });

  const doc = olympiad.toObject();
  return { ...doc, _id: doc._id.toString(), createdBy: doc.createdBy?.toString?.() || doc.createdBy };
}

export async function updateOlympiad(id, updates) {
  await connectMongoDB();
  const sanitized = { ...updates };
  if (updates.startTime) sanitized.startTime = new Date(updates.startTime);
  if (updates.endTime) sanitized.endTime = new Date(updates.endTime);
  const olympiad = await Olympiad.findByIdAndUpdate(id, sanitized, { new: true }).lean();
  if (!olympiad) throw new Error('Olympiad not found');
  return { ...olympiad, _id: olympiad._id.toString(), createdBy: olympiad.createdBy?.toString?.() || olympiad.createdBy };
}

export async function deleteOlympiad(id) {
  await connectMongoDB();
  const result = await Olympiad.findByIdAndDelete(id);
  if (!result) throw new Error('Olympiad not found');
  return true;
}

export async function addQuestionToOlympiad(olympiadId, questionId) {
  await connectMongoDB();
  const olympiad = await Olympiad.findById(olympiadId);
  if (!olympiad) throw new Error('Olympiad not found');
  if (!olympiad.questions.some((q) => q.toString() === questionId.toString())) {
    olympiad.questions.push(questionId);
    await olympiad.save();
  }
  const doc = olympiad.toObject();
  return { ...doc, _id: doc._id.toString(), createdBy: doc.createdBy?.toString?.() || doc.createdBy };
}

export async function recalculateOlympiadPoints(olympiadId) {
  const { getAllQuestions } = await import('./question-helper.js');
  const olympiad = await findOlympiadById(olympiadId);
  if (!olympiad) throw new Error('Olympiad not found');
  const allQuestions = await getAllQuestions();
  const olympiadQuestions = allQuestions.filter((q) => olympiad.questions.includes(q._id));
  const totalPoints = olympiadQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
  await updateOlympiad(olympiadId, { totalPoints });
  return totalPoints;
}

export async function getOlympiadWithCreator(id) {
  const olympiad = await findOlympiadById(id);
  if (!olympiad) return null;
  const creator = await findUserById(olympiad.createdBy);
  return {
    ...olympiad,
    createdBy: creator ? { _id: creator._id, name: creator.name, email: creator.email } : null,
  };
}

export async function getAllOlympiadsWithCreators() {
  const olympiads = await getAllOlympiads();
  const result = [];
  for (const olympiad of olympiads) {
    const creator = await findUserById(olympiad.createdBy);
    result.push({
      ...olympiad,
      createdBy: creator ? { _id: creator._id, name: creator.name, email: creator.email } : null,
    });
  }
  return result;
}

export default {
  getAllOlympiads,
  findOlympiadById,
  findOlympiadsByStatus,
  findOlympiadsByCreator,
  createOlympiad,
  updateOlympiad,
  deleteOlympiad,
  addQuestionToOlympiad,
  getOlympiadWithCreator,
  getAllOlympiadsWithCreators,
};
