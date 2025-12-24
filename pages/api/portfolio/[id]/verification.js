import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import { findPortfolioById } from "../../../../lib/portfolio-helper.js";
import { calculatePortfolioVerificationStatus, getPortfolioVerificationHistory } from "../../../../lib/verification-helper.js";

/**
 * @swagger
 * /api/portfolio/{id}/verification:
 *   get:
 *     summary: Get portfolio verification status and history
 *     tags: [Portfolio, Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Verification status and history
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Portfolio not found
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  // Set cache-control headers
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Check authentication
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    const user = authResult.user;
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Portfolio ID is required",
      });
    }

    // Find portfolio
    const portfolio = await findPortfolioById(id);
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check ownership or admin
    const studentIdStr =
      typeof portfolio.studentId === "object" && portfolio.studentId?._id
        ? portfolio.studentId._id
        : portfolio.studentId;

    const isOwner =
      user._id &&
      studentIdStr &&
      user._id.toString() === studentIdStr.toString();
    const isAdmin = user.role === "admin" || user.role === "owner";
    const isChecker = user.role === "checker";

    // Access control - only owner, admin, or checker can view verification details
    if (!isOwner && !isAdmin && !isChecker) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view verification details",
      });
    }

    // Calculate verification status
    const verificationStatus = calculatePortfolioVerificationStatus(portfolio);

    // Get verification history
    let verificationHistory = [];
    try {
      verificationHistory = await getPortfolioVerificationHistory(id);
    } catch (historyError) {
      console.error("Error fetching verification history:", historyError);
      // Continue without history if there's an error
    }

    // Return verification data
    res.json({
      success: true,
      data: {
        verificationStatus: portfolio.verificationStatus || "unverified",
        calculatedStatus: verificationStatus,
        verifiedBy: portfolio.verifiedBy || null,
        verifiedAt: portfolio.verifiedAt || null,
        rejectionReason: portfolio.rejectionReason || null,
        ilsLevel: portfolio.ilsLevel || 1,
        portfolioRating: portfolio.portfolioRating || 0,
        history: verificationHistory,
      },
    });
  } catch (error) {
    console.error("Get verification status error:", error);

    // Handle MongoDB connection errors
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
      message: error.message || "Error retrieving verification status",
    });
  }
}

