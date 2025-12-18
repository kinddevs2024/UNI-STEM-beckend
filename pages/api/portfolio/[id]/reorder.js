import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import { reorderPortfolioBlocks } from "../../../../lib/portfolio-helper.js";
import { requirePortfolioOwnershipMiddleware } from "../../../../lib/portfolio-ownership.js";
import { validateBlocks } from "../../../../lib/validation.js";

/**
 * @swagger
 * /api/portfolio/{id}/reorder:
 *   patch:
 *     summary: Reorder blocks in a portfolio
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blocks
 *             properties:
 *               blocks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - blockId
 *                     - order
 *                   properties:
 *                     blockId:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: Blocks reordered successfully
 *       400:
 *         description: Bad request
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
    const { blocks: blockOrders } = req.body;

    // Validate request body
    if (!blockOrders || !Array.isArray(blockOrders)) {
      return res.status(400).json({
        success: false,
        message: "blocks array is required",
      });
    }

    if (blockOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "blocks array cannot be empty",
      });
    }

    // Validate each block order item
    for (let i = 0; i < blockOrders.length; i++) {
      const item = blockOrders[i];
      if (!item.blockId || typeof item.blockId !== "string") {
        return res.status(400).json({
          success: false,
          message: `Block order item ${i}: blockId is required and must be a string`,
        });
      }
      if (item.order === undefined || typeof item.order !== "number") {
        return res.status(400).json({
          success: false,
          message: `Block order item ${i}: order is required and must be a number`,
        });
      }
      if (item.order < 0) {
        return res.status(400).json({
          success: false,
          message: `Block order item ${i}: order must be non-negative`,
        });
      }
    }

    // Reorder blocks
    const updatedPortfolio = await reorderPortfolioBlocks(
      id,
      blockOrders,
      req.user
    );

    res.json({
      success: true,
      message: "Blocks reordered successfully",
      data: updatedPortfolio,
    });
  } catch (error) {
    console.error("Reorder blocks error:", error);

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
      message: error.message || "Error reordering blocks",
    });
  }
}

