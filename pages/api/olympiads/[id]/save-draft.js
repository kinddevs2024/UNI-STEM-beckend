import { connectDB } from '../../../../lib/json-db.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { saveDraft, findDraftByUserAndOlympiad } from '../../../../lib/draft-helper.js';
import { protect } from '../../../../lib/auth.js';

/**
 * @swagger
 * /olympiads/{id}/save-draft:
 *   post:
 *     summary: Save draft answers for an olympiad
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: object
 *                 description: Answers object with questionId: answer pairs
 *     responses:
 *       200:
 *         description: Draft saved successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Olympiad not found
 */
export default async function handler(req, res) {
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

    await connectDB();

    const { answers } = req.body || {};
    const { id: olympiadId } = req.query;
    const userId = authResult.user._id;

    // Validate request body
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ 
        success: false,
        message: 'Answers object is required' 
      });
    }

    // Check if olympiad exists
    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Save draft
    const draft = await saveDraft({
      userId,
      olympiadId,
      answers,
    });

    res.json({
      success: true,
      message: 'Draft saved successfully',
      draft: {
        _id: draft._id,
        updatedAt: draft.updatedAt,
      },
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

