import { handleCORS } from "../../../lib/api-helpers.js";
import { protect } from "../../../lib/auth.js";
import { authorize } from "../../../lib/auth.js";
import { getPendingVerificationRequests } from "../../../lib/verification-helper.js";
import Portfolio from "../../../models/Portfolio.js";
import { connectDB } from "../../../lib/mongodb.js";

/**
 * @swagger
 * /api/verification/pending:
 *   get:
 *     summary: Get pending verification requests (Admin only)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: blockType
 *         schema:
 *           type: string
 *         description: Filter by block type
 *       - in: query
 *         name: portfolioId
 *         schema:
 *           type: string
 *         description: Filter by portfolio ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date
 *     responses:
 *       200:
 *         description: List of pending verification requests
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
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

    // Check admin role
    const authError = authorize("admin", "owner")(user);
    if (authError) {
      return res.status(authError.status).json({
        success: false,
        message: authError.error,
      });
    }

    // Get filters from query
    const { blockType, portfolioId, dateFrom, dateTo } = req.query;

    const filters = {};
    if (portfolioId) filters.portfolioId = portfolioId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (blockType) filters.blockType = blockType;

    // Get pending requests
    const pendingRequests = await getPendingVerificationRequests(filters);

    // Enrich with block information
    await connectDB();
    const enrichedRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        try {
          const portfolio = await Portfolio.findById(request.portfolioId);
          if (!portfolio) {
            return { ...request, block: null, portfolio: null };
          }

          const blocks =
            portfolio.layout?.blocks ||
            (portfolio.layout &&
              typeof portfolio.layout === "object" &&
              portfolio.layout.blocks
              ? portfolio.layout.blocks
              : []);

          const block = blocks.find((b) => b.id === request.blockId);

          // Filter by block type if specified
          if (blockType && block && block.type !== blockType) {
            return null;
          }

          return {
            ...request,
            block: block || null,
            portfolio: {
              _id: portfolio._id,
              slug: portfolio.slug,
              studentId: portfolio.studentId,
            },
          };
        } catch (error) {
          console.error("Error enriching request:", error);
          return { ...request, block: null, portfolio: null };
        }
      })
    );

    // Filter out null entries (from block type filter)
    const filteredRequests = enrichedRequests.filter((r) => r !== null);

    res.json({
      success: true,
      data: filteredRequests,
      count: filteredRequests.length,
    });
  } catch (error) {
    console.error("Get pending requests error:", error);

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
      message: error.message || "Error retrieving pending requests",
    });
  }
}

