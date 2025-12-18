import { handleCORS } from "../../../lib/api-helpers.js";
import { protect } from "../../../lib/auth.js";
import { authorize } from "../../../lib/auth.js";
import connectDB from "../../../lib/mongodb.js";
import Portfolio from "../../../models/Portfolio.js";
import { filterPersonalData } from "../../../lib/portfolio-helper.js";

/**
 * @swagger
 * /api/ratings/global:
 *   get:
 *     summary: Get global portfolio ratings (University access)
 *     tags: [Portfolio, Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *         description: Minimum portfolio rating
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [unverified, pending, verified, rejected]
 *         description: Filter by verification status
 *     responses:
 *       200:
 *         description: Global portfolio ratings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - University access required
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

    // Check role: university, checker, admin, or owner
    const authError = authorize("university", "checker", "admin", "owner")(user);
    if (authError) {
      return res.status(authError.status).json({
        success: false,
        message: authError.error,
      });
    }

    await connectDB();

    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    // Rating filter
    if (req.query.minRating) {
      filter.portfolioRating = { $gte: parseFloat(req.query.minRating) };
    }

    // Verification status filter
    if (req.query.verificationStatus) {
      filter.verificationStatus = req.query.verificationStatus;
    }

    // Query portfolios sorted by rating
    const portfolios = await Portfolio.find(filter)
      .populate("studentId", "name email")
      .select("studentId slug portfolioRating ilsLevel verificationStatus createdAt")
      .sort({ portfolioRating: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Portfolio.countDocuments(filter);

    // Process portfolios: filter personal data
    const processedPortfolios = portfolios.map((portfolio) => {
      return filterPersonalData(portfolio, false); // Not owner
    });

    res.json({
      success: true,
      data: processedPortfolios,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Global ratings error:", error);

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
      message: error.message || "Error fetching global ratings",
    });
  }
}

