import { handleCORS } from "../../../lib/api-helpers.js";
import { protect } from "../../../lib/auth.js";
import { requireStudentRole } from "../../../middleware/portfolio-access.js";
import { createPortfolio, slugExists } from "../../../lib/portfolio-helper.js";
import {
  validatePortfolioData,
  validateSlug,
} from "../../../lib/validation.js";

/**
 * @swagger
 * /api/portfolio:
 *   post:
 *     summary: Create a new portfolio
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slug
 *             properties:
 *               slug:
 *                 type: string
 *               layout:
 *                 type: string
 *                 enum: [single-page, multi-page]
 *               theme:
 *                 type: object
 *               sections:
 *                 type: array
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Portfolio created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
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

    // Check if user is a student
    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can create portfolios",
      });
    }

    const portfolioData = req.body;

    // Validate portfolio data
    const validation = validatePortfolioData(portfolioData, false);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Check if slug already exists
    const slugValidation = validateSlug(portfolioData.slug);
    if (!slugValidation.valid) {
      return res.status(400).json({
        success: false,
        message: slugValidation.error,
      });
    }

    const slugAlreadyExists = await slugExists(slugValidation.slug);
    if (slugAlreadyExists) {
      return res.status(400).json({
        success: false,
        message: "This slug is already taken. Please choose a different one.",
      });
    }

    // Create portfolio
    const portfolio = await createPortfolio({
      studentId: user._id,
      slug: slugValidation.slug,
      visibility: validation.portfolioData.visibility || "private",
      layout: validation.portfolioData.layout || "single-page",
      status: validation.portfolioData.status || "draft", // Default to draft
      theme: validation.portfolioData.theme || {
        name: "modern",
        colors: {},
        typography: {},
        spacing: "comfortable",
      },
      hero: validation.portfolioData.hero || {
        title: null,
        subtitle: null,
        image: null,
        ctaText: null,
        ctaLink: null,
      },
      sections: validation.portfolioData.sections || [],
      certificates: validation.portfolioData.certificates || [],
      animations: validation.portfolioData.animations || {
        enabled: false,
        type: "fade",
      },
      // Legacy support
      isPublic:
        validation.portfolioData.isPublic !== undefined
          ? validation.portfolioData.isPublic
          : validation.portfolioData.visibility === "public",
    });

    res.status(201).json({
      success: true,
      message: "Portfolio created successfully",
      data: portfolio,
    });
  } catch (error) {
    console.error("Create portfolio error:", error);

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

    // Handle duplicate key error (slug)
    if (error.code === 11000 || error.message.includes("duplicate")) {
      return res.status(400).json({
        success: false,
        message: "This slug is already taken. Please choose a different one.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Error creating portfolio",
    });
  }
}
