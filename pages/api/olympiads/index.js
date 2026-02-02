import { connectDB } from '../../../lib/json-db.js';
import { findOlympiadsByStatus, getAllOlympiadsWithCreators } from '../../../lib/olympiad-helper.js';
import { protect } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/api-helpers.js';

/**
 * @swagger
 * /olympiads:
 *   get:
 *     summary: Get all olympiads
 *     tags: [Olympiads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of olympiads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Olympiad'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // Get only visible olympiads (public endpoint - students can only see visible olympiads)
    const allOlympiads = await getAllOlympiadsWithCreators();
    const filteredOlympiads = allOlympiads
      .filter(olympiad => olympiad.status === 'visible' || olympiad.status === 'published')
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const total = filteredOlympiads.length;
    const olympiads = filteredOlympiads.slice(skip, skip + limit);

    res.json({
      success: true,
      data: olympiads.map(olympiad => ({
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
        createdAt: olympiad.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get olympiads error:', error);
    res.status(500).json({ 
      success: false,
      message: "Error retrieving olympiads"
    });
  }
}
