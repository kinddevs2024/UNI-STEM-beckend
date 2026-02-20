import { connectDB } from '../../../../lib/json-db.js';
import {
  updateQuestion,
  deleteQuestion,
  findQuestionById,
} from '../../../../lib/question-helper.js';
import {
  findOlympiadById,
  updateOlympiad,
  recalculateOlympiadPoints,
} from '../../../../lib/olympiad-helper.js';
import { protect, authorize } from '../../../../lib/auth.js';
import { handleCORS } from '../../../../lib/api-helpers.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (!['PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    const roleError = authorize('admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
      });
    }

    await connectDB();

    const { id } = req.query;

    if (req.method === 'PUT') {
      const existing = await findQuestionById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Question not found',
        });
      }

      const { question, type, options, correctAnswer, correctAnswers, allowMultipleCorrect, points, order } = req.body;

      const updates = {};
      if (typeof question === 'string') updates.question = question.trim();
      if (type) updates.type = type;
      if (points !== undefined && !Number.isNaN(Number(points))) {
        updates.points = Number(points);
      }
      if (order !== undefined && !Number.isNaN(Number(order))) {
        updates.order = Number(order);
      }
      if (options !== undefined) {
        updates.options = Array.isArray(options)
          ? options
              .map((opt) => String(opt))
              .filter((opt) => opt.trim() !== '')
          : [];
      }
      if (correctAnswer !== undefined) updates.correctAnswer = correctAnswer;
      if (correctAnswers !== undefined) {
        updates.correctAnswers = Array.isArray(correctAnswers)
          ? correctAnswers
              .map((answer) => String(answer))
              .filter((answer) => answer.trim() !== '')
          : [];
      }
      if (allowMultipleCorrect !== undefined) {
        updates.allowMultipleCorrect = Boolean(allowMultipleCorrect);
      }

      const nextType = updates.type || existing.type;
      if (nextType === 'multiple-choice') {
        const nextOptions = updates.options || existing.options || [];
        const nextAllowMultipleCorrect =
          updates.allowMultipleCorrect !== undefined
            ? Boolean(updates.allowMultipleCorrect)
            : Boolean(existing.allowMultipleCorrect);
        const nextCorrectAnswer =
          updates.correctAnswer !== undefined
            ? updates.correctAnswer
            : existing.correctAnswer;
        const nextCorrectAnswers =
          updates.correctAnswers !== undefined
            ? updates.correctAnswers
            : Array.isArray(existing.correctAnswers)
              ? existing.correctAnswers
              : nextCorrectAnswer
                ? [nextCorrectAnswer]
                : [];

        const validCorrectAnswers = nextCorrectAnswers.filter((answer) => nextOptions.includes(answer));
        const effectiveCorrectAnswers = validCorrectAnswers.length > 0
          ? [...new Set(validCorrectAnswers)]
          : typeof nextCorrectAnswer === 'string' && nextOptions.includes(nextCorrectAnswer)
            ? [nextCorrectAnswer]
            : [];

        if (!Array.isArray(nextOptions) || nextOptions.length < 2 || effectiveCorrectAnswers.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Multiple choice questions require options and correctAnswer',
          });
        }

        if (!nextAllowMultipleCorrect && effectiveCorrectAnswers.length > 1) {
          return res.status(400).json({
            success: false,
            message: 'Single-answer mode allows only one correct option',
          });
        }

        updates.options = nextOptions;
        updates.allowMultipleCorrect = nextAllowMultipleCorrect;
        updates.correctAnswers = nextAllowMultipleCorrect
          ? effectiveCorrectAnswers
          : [effectiveCorrectAnswers[0]];
        updates.correctAnswer = updates.correctAnswers[0] || null;
      } else {
        updates.options = [];
        updates.correctAnswer = null;
        updates.correctAnswers = [];
        updates.allowMultipleCorrect = false;
      }

      const updated = await updateQuestion(id, updates);
      await recalculateOlympiadPoints(updated.olympiadId);

      return res.json(updated);
    }

    if (req.method === 'DELETE') {
      const existing = await findQuestionById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Question not found',
        });
      }

      await deleteQuestion(id);

      const olympiad = await findOlympiadById(existing.olympiadId);
      if (olympiad?.questions?.length) {
        const nextQuestions = olympiad.questions.filter(
          (q) => q.toString() !== id.toString()
        );
        if (nextQuestions.length !== olympiad.questions.length) {
          await updateOlympiad(olympiad._id, { questions: nextQuestions });
        }
      }

      await recalculateOlympiadPoints(existing.olympiadId);

      return res.json({
        success: true,
        message: 'Question deleted successfully',
      });
    }
  } catch (error) {
    console.error('Admin question update/delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request',
    });
  }
}
