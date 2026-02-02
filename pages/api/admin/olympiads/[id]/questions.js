import { connectDB } from '../../../../../lib/json-db.js';
import { createQuestion, findQuestionsByOlympiadId } from '../../../../../lib/question-helper.js';
import { findOlympiadById, updateOlympiad } from '../../../../../lib/olympiad-helper.js';
import { protect } from '../../../../../lib/auth.js';
import { authorize } from '../../../../../lib/auth.js';

import { handleCORS } from '../../../../../lib/api-helpers.js';

/**
 * Add questions/tasks to an olympiad
 * POST /api/admin/olympiads/:id/questions
 * 
 * Request body can be:
 * - Single question: { question, type, options?, correctAnswer?, points, order? }
 * - Multiple questions: { questions: [{ question, type, ... }, ...] }
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        success: false,
        message: authResult.error 
      });
    }

    const roleError = authorize('admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { id: olympiadId } = req.query;
    const olympiad = await findOlympiadById(olympiadId);

    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Check if olympiad type matches question type
    const { questions, question, type, options, correctAnswer, points, order } = req.body;

    // Handle multiple questions at once
    if (questions && Array.isArray(questions)) {
      const createdQuestions = [];
      const errors = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        try {
          // Validate question type matches olympiad type
          if (olympiad.type === 'test' && q.type !== 'multiple-choice') {
            errors.push({ index: i, error: 'Test olympiads only accept multiple-choice questions' });
            continue;
          }
          if (olympiad.type === 'essay' && q.type !== 'essay') {
            errors.push({ index: i, error: 'Essay olympiads only accept essay questions' });
            continue;
          }

          const questionDoc = await createQuestion({
            olympiadId,
            question: q.question,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            order: q.order !== undefined ? q.order : i,
          });

          createdQuestions.push(questionDoc);
        } catch (error) {
          errors.push({ index: i, error: error.message });
        }
      }

      // Recalculate total points
      const allQuestions = await findQuestionsByOlympiadId(olympiadId);
      const totalPoints = allQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
      updateOlympiad(olympiadId, { totalPoints });

      return res.status(201).json({
        success: true,
        created: createdQuestions.length,
        questions: createdQuestions,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Handle single question
    if (!question || !type || !points) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide question, type, and points' 
      });
    }

    // Validate question type matches olympiad type
    if (olympiad.type === 'test' && type !== 'multiple-choice') {
      return res.status(400).json({ 
        success: false,
        message: 'Test olympiads only accept multiple-choice questions' 
      });
    }
    if (olympiad.type === 'essay' && type !== 'essay') {
      return res.status(400).json({ 
        success: false,
        message: 'Essay olympiads only accept essay questions' 
      });
    }

    if (type === 'multiple-choice' && (!options || !correctAnswer)) {
      return res.status(400).json({ 
        success: false,
        message: 'Multiple choice questions require options and correctAnswer' 
      });
    }

    // Get current question count for ordering
    const existingQuestions = await findQuestionsByOlympiadId(olympiadId);
    const questionOrder = order !== undefined ? order : existingQuestions.length;

    const questionDoc = await createQuestion({
      olympiadId,
      question,
      type,
      options,
      correctAnswer,
      points,
      order: questionOrder,
    });

    // Recalculate total points
    const allQuestions = await findQuestionsByOlympiadId(olympiadId);
    const totalPoints = allQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
    updateOlympiad(olympiadId, { totalPoints });

    return res.status(201).json({
      success: true,
      question: {
        _id: questionDoc._id,
        olympiadId: questionDoc.olympiadId,
        question: questionDoc.question,
        type: questionDoc.type,
        options: questionDoc.options || [],
        correctAnswer: questionDoc.correctAnswer || null,
        points: questionDoc.points,
        order: questionDoc.order,
        createdAt: questionDoc.createdAt,
      },
      totalPoints,
    });
  } catch (error) {
    console.error('Add questions error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

