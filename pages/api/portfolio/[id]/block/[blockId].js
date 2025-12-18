import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import {
  updatePortfolioBlock,
  deletePortfolioBlock,
} from "../../../../lib/portfolio-helper.js";
import { requirePortfolioOwnershipMiddleware } from "../../../../lib/portfolio-ownership.js";
import { validateBlock } from "../../../../lib/validation.js";

/**
 * @swagger
 * /api/portfolio/{id}/block/{blockId}:
 *   patch:
 *     summary: Update a single block in a portfolio
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
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema:
 *           type: string
 *         description: Block ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: object
 *               styleConfig:
 *                 type: object
 *               visibility:
 *                 type: string
 *                 enum: [public, private]
 *               order:
 *                 type: number
 *     responses:
 *       200:
 *         description: Block updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Portfolio or block not found
 *   delete:
 *     summary: Delete a block from a portfolio
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
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema:
 *           type: string
 *         description: Block ID
 *     responses:
 *       200:
 *         description: Block deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Portfolio or block not found
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

  if (req.method === "PATCH") {
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
      const ownershipError = await requirePortfolioOwnershipMiddleware(
        req,
        res
      );
      if (ownershipError) {
        return; // Error already sent
      }

      const { id } = req.query;
      const { blockId } = req.query;

      if (!blockId) {
        return res.status(400).json({
          success: false,
          message: "Block ID is required",
        });
      }

      const updates = req.body;

      // Validate block updates if full block is provided
      if (updates.type || updates.id) {
        // If updating type or id, validate as full block
        const blockValidation = validateBlock({
          id: updates.id || blockId,
          type: updates.type || "text",
          content: updates.content || {},
          styleConfig: updates.styleConfig || {},
          visibility: updates.visibility || "public",
          order: updates.order || 0,
        });

        if (!blockValidation.valid) {
          return res.status(400).json({
            success: false,
            message: blockValidation.error,
          });
        }
      }

      // Update block
      const updatedPortfolio = await updatePortfolioBlock(
        id,
        blockId,
        updates,
        req.user
      );

      // Find the updated block
      const blocks =
        updatedPortfolio.layout?.blocks ||
        (updatedPortfolio.layout &&
          typeof updatedPortfolio.layout === "object" &&
          updatedPortfolio.layout.blocks
          ? updatedPortfolio.layout.blocks
          : []);
      const updatedBlock = blocks.find((b) => b.id === blockId);

      res.json({
        success: true,
        message: "Block updated successfully",
        data: {
          block: updatedBlock,
          portfolio: updatedPortfolio,
        },
      });
    } catch (error) {
      console.error("Update block error:", error);

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
        message: error.message || "Error updating block",
      });
    }
  } else if (req.method === "DELETE") {
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
      const ownershipError = await requirePortfolioOwnershipMiddleware(
        req,
        res
      );
      if (ownershipError) {
        return; // Error already sent
      }

      const { id } = req.query;
      const { blockId } = req.query;

      if (!blockId) {
        return res.status(400).json({
          success: false,
          message: "Block ID is required",
        });
      }

      // Delete block
      const updatedPortfolio = await deletePortfolioBlock(
        id,
        blockId,
        req.user
      );

      res.json({
        success: true,
        message: "Block deleted successfully",
        data: updatedPortfolio,
      });
    } catch (error) {
      console.error("Delete block error:", error);

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
        message: error.message || "Error deleting block",
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }
}

