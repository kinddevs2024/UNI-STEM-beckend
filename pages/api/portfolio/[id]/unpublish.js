import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import { findPortfolioById, updatePortfolio } from "../../../../lib/portfolio-helper.js";
import { requirePortfolioOwnershipMiddleware } from "../../../../lib/portfolio-ownership.js";

/**
 * @swagger
 * /api/portfolio/{id}/unpublish:
 *   patch:
 *     summary: Unpublish a portfolio (change status from published to draft)
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
 *         description: Portfolio unpublished successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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

  if (req.method !== "PATCH") {
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

    req.user = authResult.user;

    // Check portfolio ownership
    const ownershipError = await requirePortfolioOwnershipMiddleware(req, res);
    if (ownershipError) {
      return; // Error already sent
    }

    const { id } = req.query;
    const portfolio = req.portfolio;

    // Check if already draft
    if (portfolio.status === "draft") {
      return res.json({
        success: true,
        message: "Portfolio is already in draft status",
        data: portfolio,
      });
    }

    // Unpublish portfolio
    const updatedPortfolio = await updatePortfolio(id, {
      status: "draft",
    });

    res.json({
      success: true,
      message: "Portfolio unpublished successfully",
      data: updatedPortfolio,
    });
  } catch (error) {
    console.error("Unpublish portfolio error:", error);

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
      message: error.message || "Error unpublishing portfolio",
    });
  }
}

