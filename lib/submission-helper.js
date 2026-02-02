import connectMongoDB from './mongodb.js';
import Submission from '../models/Submission.js';

export async function getAllSubmissions() {
  await connectMongoDB();
  const submissions = await Submission.find({}).lean();
  return submissions.map((s) => ({ ...s, _id: s._id.toString() }));
}

export async function findSubmissionById(id) {
  await connectMongoDB();
  const submission = await Submission.findById(id).lean();
  if (!submission) return null;
  return { ...submission, _id: submission._id.toString() };
}

export async function findSubmissionsByUserAndOlympiad(userId, olympiadId) {
  await connectMongoDB();
  const submissions = await Submission.find({ userId, olympiadId }).lean();
  return submissions.map((s) => ({ ...s, _id: s._id.toString() }));
}

export async function findSubmissionsByOlympiadId(olympiadId) {
  await connectMongoDB();
  const submissions = await Submission.find({ olympiadId }).lean();
  return submissions.map((s) => ({ ...s, _id: s._id.toString() }));
}

export async function findSubmissionsByUserId(userId) {
  await connectMongoDB();
  const submissions = await Submission.find({ userId }).lean();
  return submissions.map((s) => ({ ...s, _id: s._id.toString() }));
}

export async function createSubmission(submissionData) {
  await connectMongoDB();
  const submission = await Submission.create({
    userId: submissionData.userId,
    olympiadId: submissionData.olympiadId,
    questionId: submissionData.questionId,
    answer: submissionData.answer,
    score: submissionData.score || 0,
    isCorrect: submissionData.isCorrect || false,
    gradedBy: submissionData.gradedBy || null,
    gradedAt: submissionData.gradedAt || null,
    comment: submissionData.comment || null,
    isAI: submissionData.isAI || false,
    aiProbability: submissionData.aiProbability || 0,
    aiCheckedBy: submissionData.aiCheckedBy || null,
    aiCheckedAt: submissionData.aiCheckedAt || null,
  });

  const doc = submission.toObject();
  return { ...doc, _id: doc._id.toString() };
}

export async function updateSubmission(id, updates) {
  await connectMongoDB();
  const submission = await Submission.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!submission) throw new Error('Submission not found');
  return { ...submission, _id: submission._id.toString() };
}

export default {
  getAllSubmissions,
  findSubmissionById,
  findSubmissionsByUserAndOlympiad,
  findSubmissionsByOlympiadId,
  findSubmissionsByUserId,
  createSubmission,
  updateSubmission,
};
