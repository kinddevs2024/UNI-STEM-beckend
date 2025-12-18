import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import { authorize } from "../../../../lib/auth.js";
import { findPortfolioById, updatePortfolio } from "../../../../lib/portfolio-helper.js";
import { recalculatePortfolioRating } from "../../../../lib/portfolio-rating.js";
import { createVerificationLog } from "../../../../lib/verification-helper.js";

/**
 * @swagger
 * /api/portfolio/{id}/verify:
 *   post:
 *     summary: Verify a portfolio (Checker, Admin, Owner only)
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
 *         description: Portfolio verified successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Checker/Admin/Owner access required
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

  if (req.method !== "POST") {
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

    // Check role: checker, admin, or owner
    const authError = authorize("checker", "admin", "owner")(user);
    if (authError) {
      return res.status(authError.status).json({
        success: false,
        message: authError.error,
      });
    }

    const { id } = req.query;

    // Find portfolio
    const portfolio = await findPortfolioById(id);
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check current status
    if (portfolio.verificationStatus === "verified") {
      return res.status(400).json({
        success: false,
        message: "Portfolio is already verified",
      });
    }

    // Update verification status
    const updatedPortfolio = await updatePortfolio(id, {
      verificationStatus: "verified",
      verifiedBy: user._id,
      verifiedAt: new Date(),
      rejectionReason: null,
    });

    // Recalculate rating (verification status changed)
    try {
      await recalculatePortfolioRating(id);
    } catch (ratingError) {
      console.error("Error recalculating rating:", ratingError);
      // Continue even if rating recalculation fails
    }

    // Create verification log
    try {
      await createVerificationLog(
        `portfolio-${id}`, // Use portfolio ID as blockId for portfolio-level verification
        portfolio._id,
        "approve",
        user, // Pass user object
        user.role === "checker" ? "admin" : user.role, // Checker acts as admin for logging
        { type: "portfolio", action: "verify" }
      );
    } catch (logError) {
      console.error("Error creating verification log:", logError);
      // Continue even if log creation fails
    }

    res.json({
      success: true,
      message: "Portfolio verified successfully",
      data: {
        portfolioId: id,
        verificationStatus: "verified",
        verifiedBy: user._id,
        verifiedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Verify portfolio error:", error);

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

    const statusCode = error.message?.includes("not found") ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Error verifying portfolio",
    });
  }
}

