import { handleCORS } from "../../lib/api-helpers.js";
import { protect } from "../../lib/auth.js";
import { authorize } from "../../lib/auth.js";
import connectDB from "../../lib/mongodb.js";
import Portfolio from "../../models/Portfolio.js";
import User from "../../models/User.js";
import { maskUserContacts } from "../../lib/contact-masking.js";
import { filterPersonalData } from "../../lib/portfolio-helper.js";

/**
 * @swagger
 * /api/portfolios:
 *   get:
 *     summary: List all portfolios (University access)
 *     tags: [Portfolio]
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
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [unverified, pending, verified, rejected]
 *         description: Filter by verification status
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *         description: Minimum portfolio rating
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: number
 *         description: Maximum portfolio rating
 *       - in: query
 *         name: minILSLevel
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 9
 *         description: Minimum ILS level
 *       - in: query
 *         name: maxILSLevel
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 9
 *         description: Maximum ILS level
 *     responses:
 *       200:
 *         description: List of portfolios
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

    // Verification status filter
    if (req.query.verificationStatus) {
      filter.verificationStatus = req.query.verificationStatus;
    }

    // Rating filters
    if (req.query.minRating || req.query.maxRating) {
      filter.portfolioRating = {};
      if (req.query.minRating) {
        filter.portfolioRating.$gte = parseFloat(req.query.minRating);
      }
      if (req.query.maxRating) {
        filter.portfolioRating.$lte = parseFloat(req.query.maxRating);
      }
    }

    // ILS level filters
    if (req.query.minILSLevel || req.query.maxILSLevel) {
      filter.ilsLevel = {};
      if (req.query.minILSLevel) {
        filter.ilsLevel.$gte = parseInt(req.query.minILSLevel);
      }
      if (req.query.maxILSLevel) {
        filter.ilsLevel.$lte = parseInt(req.query.maxILSLevel);
      }
    }

    // Query portfolios
    const portfolios = await Portfolio.find(filter)
      .populate("studentId", "name email gmail tel profile")
      .sort({ portfolioRating: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Portfolio.countDocuments(filter);

    // Process portfolios: mask contacts for university users
    const isUniversity = user.role === "university";
    const processedPortfolios = await Promise.all(
      portfolios.map(async (portfolio) => {
        // Filter personal data (blocks visibility)
        const filteredPortfolio = filterPersonalData(portfolio, false); // Not owner

        // Mask student contacts if university user
        if (isUniversity && portfolio.studentId) {
          const studentUser = portfolio.studentId;
          const maskedStudent = await maskUserContacts(
            studentUser,
            user._id.toString(),
            portfolio._id.toString()
          );
          filteredPortfolio.studentId = maskedStudent;
        }

        return filteredPortfolio;
      })
    );

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
    console.error("List portfolios error:", error);

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
      message: error.message || "Error listing portfolios",
    });
  }
}

