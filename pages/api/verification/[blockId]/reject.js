import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import { authorize } from "../../../../lib/auth.js";
import { updatePortfolioBlock } from "../../../../lib/portfolio-helper.js";
import Portfolio from "../../../../models/Portfolio.js";
import { connectDB } from "../../../../lib/mongodb.js";
import {
  createVerificationLog,
  ensureBlockVerification,
} from "../../../../lib/verification-helper.js";

/**
 * @swagger
 * /api/verification/{blockId}/reject:
 *   patch:
 *     summary: Reject block verification (Admin only)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema:
 *           type: string
 *         description: Block ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejection (required)
 *     responses:
 *       200:
 *         description: Block rejected successfully
 *       400:
 *         description: Bad request - rejection reason required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Block not found
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

    const user = authResult.user;

    // Check admin role
    const authError = authorize("admin", "owner")(user);
    if (authError) {
      return res.status(authError.status).json({
        success: false,
        message: authError.error,
      });
    }

    const { blockId } = req.query;
    const { rejectionReason } = req.body || {};

    if (!blockId) {
      return res.status(400).json({
        success: false,
        message: "Block ID is required",
      });
    }

    if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    // Find portfolio containing this block
    await connectDB();
    const portfolio = await findPortfolioByBlockId(blockId);
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Block not found",
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
        message: "Block not found in portfolio",
      });
    }

    // Ensure verification structure
    const blockWithVerification = ensureBlockVerification(block);

    // Update verification status
    const verificationUpdate = {
      verification: {
        status: "rejected",
        verifiedBy: "admin",
        verifiedAt: new Date(),
        verifiedById: user._id,
        note: blockWithVerification.verification?.note || null,
        requestedAt: blockWithVerification.verification?.requestedAt || null,
        rejectionReason: rejectionReason.trim(),
      },
    };

    // Update block
    await updatePortfolioBlock(
      portfolio._id.toString(),
      blockId,
      verificationUpdate,
      user
    );

    // Create verification log
    await createVerificationLog(
      blockId,
      portfolio._id,
      "reject",
      user,
      "admin",
      { rejectionReason: rejectionReason.trim() }
    );

    res.json({
      success: true,
      message: "Block rejected successfully",
      data: {
        blockId,
        status: "rejected",
        rejectionReason: rejectionReason.trim(),
      },
    });
  } catch (error) {
    console.error("Reject verification error:", error);

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
      message: error.message || "Error rejecting verification",
    });
  }
}

// Helper function to find portfolio by block ID
async function findPortfolioByBlockId(blockId) {
  // Search for portfolio containing this block
  const portfolios = await Portfolio.find({
    "layout.blocks.id": blockId,
  }).limit(1);

  return portfolios.length > 0 ? portfolios[0] : null;
}

