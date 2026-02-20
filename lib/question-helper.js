import connectMongoDB from './mongodb.js';
import Question from '../models/Question.js';
import { findOlympiadById, addQuestionToOlympiad } from './olympiad-helper.js';

export async function getAllQuestions() {
  await connectMongoDB();
  const questions = await Question.find({}).lean();
  return questions.map((q) => ({ ...q, _id: q._id.toString() }));
}

export async function findQuestionById(id) {
  await connectMongoDB();
  const question = await Question.findById(id).lean();
  if (!question) return null;
  return { ...question, _id: question._id.toString() };
}

export async function findQuestionsByOlympiadId(olympiadId) {
  await connectMongoDB();
  const questions = await Question.find({ olympiadId }).lean();
  return questions.map((q) => ({ ...q, _id: q._id.toString() }));
}

export async function createQuestion(questionData) {
  await connectMongoDB();
  const olympiad = await findOlympiadById(questionData.olympiadId);
  if (!olympiad) throw new Error('Olympiad not found');

  const normalizedOptions = Array.isArray(questionData.options)
    ? questionData.options
        .map((opt) => String(opt))
        .filter((opt) => opt.trim() !== '')
    : [];

  const normalizedCorrectAnswers = Array.isArray(questionData.correctAnswers)
    ? questionData.correctAnswers
        .map((answer) => String(answer))
        .filter((answer) => answer.trim() !== '')
    : [];

  const fallbackCorrectAnswer =
    typeof questionData.correctAnswer === 'string' && questionData.correctAnswer.trim() !== ''
      ? questionData.correctAnswer
      : null;

  const allowMultipleCorrect = Boolean(questionData.allowMultipleCorrect);

  if (questionData.type === 'multiple-choice') {
    if (!normalizedOptions || normalizedOptions.length < 2) {
      throw new Error('Multiple choice questions require options');
    }

    const effectiveCorrectAnswers = normalizedCorrectAnswers.length > 0
      ? normalizedCorrectAnswers
      : fallbackCorrectAnswer
        ? [fallbackCorrectAnswer]
        : [];

    const validCorrectAnswers = effectiveCorrectAnswers.filter((answer) =>
      normalizedOptions.includes(answer)
    );

    if (validCorrectAnswers.length === 0) {
      throw new Error('Multiple choice questions require correctAnswer');
    }

    if (!allowMultipleCorrect && validCorrectAnswers.length > 1) {
      throw new Error('Single-answer mode allows only one correct option');
    }

    questionData.options = normalizedOptions;
    questionData.correctAnswers = allowMultipleCorrect
      ? [...new Set(validCorrectAnswers)]
      : [validCorrectAnswers[0]];
    questionData.correctAnswer = questionData.correctAnswers[0] || null;
    questionData.allowMultipleCorrect = allowMultipleCorrect;
  } else {
    questionData.options = [];
    questionData.correctAnswers = [];
    questionData.correctAnswer = null;
    questionData.allowMultipleCorrect = false;
  }

  const question = await Question.create({
    olympiadId: questionData.olympiadId,
    question: questionData.question.trim(),
    type: questionData.type,
    options: questionData.options || [],
    correctAnswer: questionData.correctAnswer || null,
    correctAnswers: questionData.correctAnswers || [],
    allowMultipleCorrect: Boolean(questionData.allowMultipleCorrect),
    points: questionData.points || 1,
    order: questionData.order || 0,
  });

  await addQuestionToOlympiad(questionData.olympiadId, question._id);

  const doc = question.toObject();
  return { ...doc, _id: doc._id.toString() };
}

export async function updateQuestion(id, updates) {
  await connectMongoDB();
  const question = await Question.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!question) throw new Error('Question not found');
  return { ...question, _id: question._id.toString() };
}

export async function deleteQuestion(id) {
  await connectMongoDB();
  const result = await Question.findByIdAndDelete(id);
  if (!result) throw new Error('Question not found');
  return true;
}

export async function getQuestionsWithOlympiad(olympiadId = null) {
  const questions = olympiadId ? await findQuestionsByOlympiadId(olympiadId) : await getAllQuestions();
  const result = [];
  for (const question of questions) {
    const olympiad = await findOlympiadById(question.olympiadId);
    result.push({
      ...question,
      olympiad: olympiad ? { _id: olympiad._id, title: olympiad.title, olympiadLogo: olympiad.olympiadLogo || null } : null,
    });
  }
  return result;
}

export default {
  getAllQuestions,
  findQuestionById,
  findQuestionsByOlympiadId,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionsWithOlympiad,
};
