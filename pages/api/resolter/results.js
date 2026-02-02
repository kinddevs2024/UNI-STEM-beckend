import { connectDB } from "../../../lib/json-db.js";
import { findOlympiadById } from "../../../lib/olympiad-helper.js";
import {
  findResultsByOlympiadId,
  updateResult,
} from "../../../lib/result-helper.js";
import {
  findSubmissionsByOlympiadId,
  updateSubmission,
} from "../../../lib/submission-helper.js";
import { findUserById } from "../../../lib/user-helper.js";
import { protect } from "../../../lib/auth.js";
import { authorize } from "../../../lib/auth.js";

import { handleCORS } from '../../../lib/api-helpers.js';

/**
 * Get all results for an olympiad (Resolter only)
 * GET /api/resolter/results?olympiadId=:id
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  // Set cache-control headers to prevent caching
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    // Check if user is resolter, admin, or owner
    const roleError = authorize("resolter", "admin", "owner")(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
      });
    }

    await connectDB();

    const { olympiadId } = req.query;
    if (!olympiadId) {
      return res.status(400).json({
        success: false,
        message: "olympiadId query parameter is required",
      });
    }

    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({
        success: false,
        message: "Olympiad not found",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // Get all results for this olympiad
    const allResults = (await findResultsByOlympiadId(olympiadId)).sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return new Date(a.completedAt) - new Date(b.completedAt);
    });
    
    const total = allResults.length;
    const paginatedResults = allResults.slice(skip, skip + limit);

    // Get all submissions for this olympiad
    const allSubmissions = await findSubmissionsByOlympiadId(olympiadId);

    // Populate results with user info and submissions
    const resultsWithDetails = await Promise.all(paginatedResults.map(async (result, index) => {
      const user = await findUserById(result.userId);
      const userSubmissions = allSubmissions.filter(
        (s) => s.userId === result.userId
      );

      let position = "";
      if (index === 0) position = "🥇 1st Place";
      else if (index === 1) position = "🥈 2nd Place";
      else if (index === 2) position = "🥉 3rd Place";
      else position = `${index + 1}th Place`;

      return {
        resultId: result._id,
        rank: index + 1,
        position,
        userId: result.userId,
        userName: user ? user.name : "Unknown",
        userEmail: user ? user.email : "Unknown",
        score: result.totalScore,
        totalPoints: result.maxScore,
        percentage: Math.round(result.percentage * 100) / 100,
        completedAt: result.completedAt,
        timeSpent: result.timeSpent,
        visible: result.visible !== false, // Default to true if not set
        status: result.status || "active",
        submissions: userSubmissions.map((sub) => ({
          submissionId: sub._id,
          questionId: sub.questionId,
          answer: sub.answer,
          score: sub.score,
          isCorrect: sub.isCorrect,
          gradedBy: sub.gradedBy,
          gradedAt: sub.gradedAt,
          comment: sub.comment || null,
          isAI: sub.isAI || false,
          aiProbability: sub.aiProbability || 0,
        })),
      };
    }));

    return res.json({
      success: true,
      olympiadId: olympiad._id,
      olympiadTitle: olympiad.title,
      olympiadType: olympiad.type,
      olympiadLogo: olympiad.olympiadLogo || null,
      results: resultsWithDetails,
      totalParticipants: total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all results error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving results",
    });
  }
}
