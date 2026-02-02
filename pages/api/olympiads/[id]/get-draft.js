import { connectDB } from '../../../../lib/json-db.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { findDraftByUserAndOlympiad } from '../../../../lib/draft-helper.js';
import { protect } from '../../../../lib/auth.js';

import { handleCORS } from '../../../../lib/api-helpers.js';

/**
 * @swagger
 * /olympiads/{id}/get-draft:
 *   get:
 *     summary: Get saved draft answers for an olympiad
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
 *         description: Draft retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Olympiad not found
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'GET') {
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

    const { id: olympiadId } = req.query;
    const userId = authResult.user._id;

    // Check if olympiad exists
    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Get draft
    const draft = await findDraftByUserAndOlympiad(userId, olympiadId);

    if (!draft) {
      return res.json({
        success: true,
        draft: null,
        message: 'No draft found',
      });
    }

    res.json({
      success: true,
      draft: {
        _id: draft._id,
        answers: draft.answers,
        updatedAt: draft.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}

