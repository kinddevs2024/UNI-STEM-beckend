import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import { authorize } from "../../../../lib/auth.js";
import { findPortfolioById } from "../../../../lib/portfolio-helper.js";
import { recalculatePortfolioRating } from "../../../../lib/portfolio-rating.js";

/**
 * @swagger
 * /api/portfolio/{id}/recalculate-rating:
 *   post:
 *     summary: Manually recalculate portfolio rating (Admin only)
 *     tags: [Portfolio]
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
 *         description: Rating recalculated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
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

    // Check admin role
    const authError = authorize("admin", "owner")(user);
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

    // Recalculate rating
    const result = await recalculatePortfolioRating(id);

    res.json({
      success: true,
      message: "Portfolio rating recalculated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Recalculate rating error:", error);

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
      message: error.message || "Error recalculating rating",
    });
  }
}

