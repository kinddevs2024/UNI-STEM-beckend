import { connectDB } from '../../../lib/json-db.js';
import { getOlympiadWithCreator } from '../../../lib/olympiad-helper.js';
import { getAllQuestions, findQuestionsByOlympiadId } from '../../../lib/question-helper.js';
import { protect } from '../../../lib/auth.js';

import { handleCORS } from '../../../lib/api-helpers.js';

/**
 * @swagger
 * /olympiads/{id}:
 *   get:
 *     summary: Get a specific olympiad by ID with questions
 *     tags: [Olympiads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Olympiad ID
 *     responses:
 *       200:
 *         description: Olympiad details with questions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Olympiad'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Olympiad not found
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  // Set cache-control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        message: authResult.error 
      });
    }

    await connectDB();

    const { id } = req.query;

    try {
      const olympiad = await getOlympiadWithCreator(id);

      if (!olympiad) {
        return res.status(404).json({ 
          success: false,
          message: 'Olympiad not found' 
        });
      }

      // Populate questions - try from questions array first, then fallback to finding by olympiadId
      let questions = [];
      
      // First, try to get questions from the olympiad's questions array
      if (olympiad.questions && Array.isArray(olympiad.questions) && olympiad.questions.length > 0) {
        const allQuestions = await getAllQuestions();
        questions = olympiad.questions
          .map(qId => {
            if (typeof qId === 'string') {
              return allQuestions.find(q => q._id === qId);
            }
            return null;
          })
          .filter(q => q !== null && q !== undefined);
      }
      
      // If no questions found from array, try finding by olympiadId (fallback)
      if (questions.length === 0) {
        questions = await findQuestionsByOlympiadId(olympiad._id);
      }
      
      // Sort and format questions
      if (questions.length > 0) {
        questions = questions
          .sort((a, b) => {
            // Sort by order field, then by createdAt
            if (a.order !== b.order) {
              return (a.order || 0) - (b.order || 0);
            }
            return new Date(a.createdAt) - new Date(b.createdAt);
          })
          .map(q => ({
            _id: q._id,
            question: q.question,
            type: q.type,
            options: q.options || [],
            allowMultipleCorrect: Boolean(q.allowMultipleCorrect),
            points: q.points,
            order: q.order || 0,
          }));
      }

      res.json({
        _id: olympiad._id,
        title: olympiad.title,
        description: olympiad.description,
        type: olympiad.type,
        subject: olympiad.subject,
        startTime: olympiad.startTime,
        endTime: olympiad.endTime,
        duration: olympiad.duration,
        status: olympiad.status,
        olympiadLogo: olympiad.olympiadLogo || null,
        questions,
        createdAt: olympiad.createdAt,
      });
    } catch (err) {
      console.error('Error in getOlympiadWithCreator:', err);
      throw err;
    }
  } catch (error) {
    console.error('Get olympiad error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}
