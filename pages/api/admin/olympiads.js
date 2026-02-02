import { connectDB } from '../../../lib/json-db.js';
import * as olympiadHelperModule from '../../../lib/olympiad-helper.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';

import { handleCORS } from '../../../lib/api-helpers.js';

/**
 * @swagger
 * /admin/olympiads:
 *   get:
 *     summary: Get all olympiads (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all olympiads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Olympiad'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *   post:
 *     summary: Create a new olympiad (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - type
 *               - subject
 *               - startTime
 *               - endTime
 *               - duration
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [test, essay]
 *               subject:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               duration:
 *                 type: number
 *                 description: Duration in seconds
 *     responses:
 *       201:
 *         description: Olympiad created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Olympiad'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
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

    const olympiadHelper = olympiadHelperModule.getAllOlympiadsWithCreators
      ? olympiadHelperModule
      : olympiadHelperModule.default;

    if (!olympiadHelper?.getAllOlympiadsWithCreators || !olympiadHelper?.createOlympiad) {
      throw new Error('Olympiad helper exports are not available');
    }

    if (req.method === 'POST') {
      const { title, description, type, subject, startTime, endTime, duration } = req.body;

      if (!title || !description || !type || !subject || !startTime || !endTime || !duration) {
        return res.status(400).json({ 
          success: false,
          message: 'Please provide all required fields' 
        });
      }

      const olympiad = await olympiadHelper.createOlympiad({
        title,
        description,
        type,
        subject,
        startTime,
        endTime,
        duration,
        status: 'unvisible', // New olympiads start as unvisible
        createdBy: authResult.user._id,
      });

      return res.status(201).json({
        _id: olympiad._id,
        title: olympiad.title,
        description: olympiad.description,
        type: olympiad.type,
        subject: olympiad.subject,
        startTime: olympiad.startTime,
        endTime: olympiad.endTime,
        duration: olympiad.duration,
        createdAt: olympiad.createdAt,
      });
    }

    if (req.method === 'GET') {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const skip = (page - 1) * limit;

      const rawOlympiads = await olympiadHelper.getAllOlympiadsWithCreators();
      const olympiadList = Array.isArray(rawOlympiads)
        ? rawOlympiads
        : (Array.isArray(rawOlympiads?.data) ? rawOlympiads.data : []);

      const allOlympiads = [...olympiadList]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(olympiad => ({
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
        }));

      const total = allOlympiads.length;
      const olympiads = allOlympiads.slice(skip, skip + limit);

      return res.json({
        success: true,
        data: olympiads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }
  } catch (error) {
    console.error('Admin olympiads error:', error);
    res.status(500).json({ 
      success: false,
      message: "Error processing request"
    });
  }
}
