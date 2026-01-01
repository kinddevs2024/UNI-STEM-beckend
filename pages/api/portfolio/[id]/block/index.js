import { handleCORS } from "../../../../../lib/api-helpers.js";
import { protect } from "../../../../../lib/auth.js";
import { addBlockToPortfolio } from "../../../../../lib/portfolio-helper.js";
import { requirePortfolioOwnershipMiddleware } from "../../../../../lib/portfolio-ownership.js";
import { validateBlock } from "../../../../../lib/validation.js";

/**
 * @swagger
 * /api/portfolio/{id}/block:
 *   post:
 *     summary: Add a new block to a portfolio
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
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [text, projects, skills, certificates, custom]
 *               content:
 *                 type: object
 *               styleConfig:
 *                 type: object
 *               visibility:
 *                 type: string
 *                 enum: [public, private]
 *               position:
 *                 type: number
 *                 description: Position to insert block (optional, defaults to end)
 *               order:
 *                 type: number
 *                 description: Order value (optional, auto-calculated if not provided)
 *     responses:
 *       201:
 *         description: Block added successfully
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

    req.user = authResult.user;

    // Check portfolio ownership
    const ownershipError = await requirePortfolioOwnershipMiddleware(req, res);
    if (ownershipError) {
      return; // Error already sent
    }

    const { id } = req.query;
    const blockData = req.body;

    // Validate block data
    if (!blockData.type) {
      return res.status(400).json({
        success: false,
        message: "Block type is required",
      });
    }

    // Create a full block object for validation
    const fullBlock = {
      id: blockData.id || `temp-${Date.now()}`,
      type: blockData.type,
      content: blockData.content || {},
      styleConfig: blockData.styleConfig || {
        colors: {},
        spacing: {},
        typography: {},
      },
      visibility: blockData.visibility || "public",
      order: blockData.order || 0,
    };

    const blockValidation = validateBlock(fullBlock);
    if (!blockValidation.valid) {
      return res.status(400).json({
        success: false,
        message: blockValidation.error,
      });
    }

    // Add block
    const updatedPortfolio = await addBlockToPortfolio(
      id,
      blockData,
      req.user
    );

    // Find the newly added block
    const blocks =
      updatedPortfolio.layout?.blocks ||
      (updatedPortfolio.layout &&
        typeof updatedPortfolio.layout === "object" &&
        updatedPortfolio.layout.blocks
        ? updatedPortfolio.layout.blocks
        : []);
    const newBlock = blocks[blocks.length - 1]; // Last block is the newly added one

    res.status(201).json({
      success: true,
      message: "Block added successfully",
      data: {
        block: newBlock,
        portfolio: updatedPortfolio,
      },
    });
  } catch (error) {
    console.error("Add block error:", error);

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

    const statusCode =
      error.message?.includes("not found") || error.message?.includes("already exists")
        ? 400
        : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Error adding block",
    });
  }
}

