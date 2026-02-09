import { connectDB } from '../../../lib/json-db.js';
import { createQuestion, findQuestionsByOlympiadId, getAllQuestions } from '../../../lib/question-helper.js';
import { findOlympiadById } from '../../../lib/olympiad-helper.js';
import { protect, authorize } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/api-helpers.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') {
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

    const roleError = authorize('university', 'owner', 'admin')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
      });
    }

    await connectDB();

    if (req.method === 'POST') {
      const { olympiadId, question, type, options, correctAnswer, points, order } = req.body;

      if (!olympiadId || !question || !type || !points) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required fields',
        });
      }

      if (type === 'multiple-choice' && (!options || !correctAnswer)) {
        return res.status(400).json({
          success: false,
          message: 'Multiple choice questions require options and correctAnswer',
        });
      }

      const questionDoc = await createQuestion({
        olympiadId,
        question,
        type,
        options,
        correctAnswer,
        points,
        order: order || 0,
      });

      return res.status(201).json({
        _id: questionDoc._id,
        olympiadId: questionDoc.olympiadId,
        question: questionDoc.question,
        type: questionDoc.type,
        options: questionDoc.options || [],
        correctAnswer: questionDoc.correctAnswer || null,
        points: questionDoc.points,
        order: questionDoc.order,
        createdAt: questionDoc.createdAt,
      });
    }

    if (req.method === 'GET') {
      const { olympiadId } = req.query;

      let questions;
      if (olympiadId) {
        questions = await findQuestionsByOlympiadId(olympiadId);
      } else {
        questions = await getAllQuestions();
      }

      questions = questions.sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      const result = await Promise.all(questions.map(async (q) => {
        const olympiad = await findOlympiadById(q.olympiadId);
        return {
          _id: q._id,
          olympiadId: q.olympiadId,
          question: q.question,
          type: q.type,
          options: q.options || [],
          correctAnswer: q.correctAnswer || null,
          points: q.points,
          order: q.order,
          olympiadLogo: olympiad ? (olympiad.olympiadLogo || null) : null,
          createdAt: q.createdAt,
        };
      }));

      return res.json(result);
    }
  } catch (error) {
    console.error('University questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request',
    });
  }
}
