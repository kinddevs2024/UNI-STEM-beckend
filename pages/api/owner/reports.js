import connectDB from '../../../lib/mongodb.js';
import Olympiad from '../../../models/Olympiad.js';
import Result from '../../../models/Result.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';

import { handleCORS } from '../../../lib/api-helpers.js';

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

    const roleError = authorize('owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { olympiadId } = req.query;

    if (olympiadId) {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const skip = (page - 1) * limit;

      // Detailed report for specific olympiad
      const olympiad = await Olympiad.findById(olympiadId).select('_id title description type subject startTime endTime duration status olympiadLogo createdAt').lean();
      const total = await Result.countDocuments({ olympiadId });
      const results = await Result.find({ olympiadId })
        .populate('userId', 'name email')
        .select('_id userId olympiadId totalScore maxScore percentage completedAt timeSpent')
        .sort({ totalScore: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const allResultsForSummary = await Result.find({ olympiadId })
        .select('percentage')
        .lean();

      return res.json({
        success: true,
        data: {
          olympiad,
          results,
          summary: {
            totalParticipants: total,
            averageScore: allResultsForSummary.length > 0
              ? allResultsForSummary.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / allResultsForSummary.length
              : 0,
            highestScore: allResultsForSummary.length > 0 
              ? Math.max(...allResultsForSummary.map(r => Number(r.percentage) || 0))
              : 0,
          },
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    }

    // General reports for all olympiads
    const olympiads = await Olympiad.find().populate('createdBy', 'name').select('_id title status olympiadLogo').lean();
    const reports = await Promise.all(
      olympiads.map(async (olympiad) => {
        const results = await Result.find({ olympiadId: olympiad._id }).select('_id percentage').lean();
        return {
          olympiad: {
            _id: olympiad._id,
            title: olympiad.title,
            status: olympiad.status,
            olympiadLogo: olympiad.olympiadLogo || null,
          },
          participants: results.length,
          averageScore: results.length > 0
            ? results.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / results.length
            : 0,
        };
      })
    );

    res.json({
      reports: reports.map(r => ({
        type: 'performance',
        data: r,
      })),
    });
  } catch (error) {
    console.error('Owner reports error:', error);

    const isMongoConnectionError =
      error.name === "MongooseServerSelectionError" ||
      error.name === "MongoServerSelectionError" ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect ECONNREFUSED") ||
      error.message?.includes("connection skipped");

    if (isMongoConnectionError) {
      return res.status(503).json({
        success: false,
        message:
          "Database service is currently unavailable. Please ensure MongoDB is running and try again.",
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Error generating reports"
    });
  }
}
