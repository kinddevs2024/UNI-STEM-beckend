import { handleCORS } from "../../../../../../lib/api-helpers.js";
import { protect } from "../../../../../../lib/auth.js";
import {
  findPortfolioById,
  updatePortfolioBlock,
} from "../../../../../../lib/portfolio-helper.js";
import { requirePortfolioOwnershipMiddleware } from "../../../../../../lib/portfolio-ownership.js";
import {
  createVerificationLog,
  ensureBlockVerification,
} from "../../../../../../lib/verification-helper.js";
import { autoVerifyBlock, shouldAutoVerify } from "../../../../../../lib/verification-auto.js";

/**
 * @swagger
 * /api/portfolio/{id}/block/{blockId}/verify-request:
 *   post:
 *     summary: Request verification for a block
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
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema:
 *           type: string
 *         description: Block ID
 *     responses:
 *       200:
 *         description: Verification requested successfully (or auto-verified)
 *       400:
 *         description: Bad request
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
    const { blockId } = req.query;
    const portfolio = req.portfolio;

    if (!blockId) {
      return res.status(400).json({
        success: false,
        message: "Block ID is required",
      });
    }

    // Get blocks from portfolio
    const blocks =
      portfolio.layout?.blocks ||
      (portfolio.layout &&
        typeof portfolio.layout === "object" &&
        portfolio.layout.blocks
        ? portfolio.layout.blocks
        : []);

    const block = blocks.find((b) => b.id === blockId);

    if (!block) {
      return res.status(404).json({
        success: false,
        message: "Block not found",
      });
    }

    // Ensure verification structure exists
    const blockWithVerification = ensureBlockVerification(block);

    // Check current status
    const currentStatus = blockWithVerification.verification?.status;
    if (currentStatus === "pending") {
      return res.status(400).json({
        success: false,
        message: "Verification request already pending",
      });
    }

    if (currentStatus === "verified") {
      return res.status(400).json({
        success: false,
        message: "Block is already verified",
      });
    }

    // Check if block can be auto-verified
    if (shouldAutoVerify(blockWithVerification, portfolio)) {
      // Attempt auto-verification
      const autoVerifyResult = await autoVerifyBlock(
        blockWithVerification,
        portfolio
      );

      if (autoVerifyResult.verified) {
        // Update block with auto-verification
        const updatedBlock = {
          ...blockWithVerification,
          verification: autoVerifyResult.block.verification,
        };

        // Update portfolio
        await updatePortfolioBlock(id, blockId, updatedBlock, req.user);

        return res.json({
          success: true,
          message: "Block auto-verified successfully",
          data: {
            block: updatedBlock,
            autoVerified: true,
          },
        });
      }
    }

    // Manual verification request
    const verificationUpdate = {
      verification: {
        status: "pending",
        verifiedBy: null,
        verifiedAt: null,
        verifiedById: null,
        note: null,
        requestedAt: new Date(),
        rejectionReason: null,
      },
    };

    // Update block
    await updatePortfolioBlock(id, blockId, verificationUpdate, req.user);

    // Create verification log
    await createVerificationLog(
      blockId,
      portfolio._id,
      "request",
      req.user,
      "student",
      {}
    );

    res.json({
      success: true,
      message: "Verification request submitted successfully",
      data: {
        blockId,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Verification request error:", error);

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
      message: error.message || "Error submitting verification request",
    });
  }
}

