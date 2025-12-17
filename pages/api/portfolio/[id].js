// Combined route handler for portfolio by ID or slug
import { handleCORS } from "../../../lib/api-helpers.js";
import { protect } from "../../../lib/auth.js";
import {
  updatePortfolio,
  deletePortfolio,
  slugExists,
  findPortfolioById,
  findPortfolioBySlug,
  filterPersonalData,
} from "../../../lib/portfolio-helper.js";
import {
  validatePortfolioData,
  validateSlug,
} from "../../../lib/validation.js";
import { createPortfolioView, hashIP } from "../../../lib/analytics-helper.js";
import { findUserByIdWithoutPassword } from "../../../lib/user-helper.js";

/**
 * @swagger
 * /api/portfolio/{id}:
 *   get:
 *     summary: Get portfolio by slug or ID
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio slug or ID
 *   put:
 *     summary: Update portfolio
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slug:
 *                 type: string
 *               layout:
 *                 type: string
 *               theme:
 *                 type: object
 *               sections:
 *                 type: array
 *               certificates:
 *                 type: array
 *               isPublic:
 *                 type: boolean
 *   delete:
 *     summary: Delete portfolio
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

  if (req.method === "GET") {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Portfolio slug or ID is required",
        });
      }

      // Handle special route "my" - should be handled by /api/portfolio/my.js
      if (id === "my" || id === "my-reservations") {
        return res.status(404).json({
          success: false,
          message:
            "Portfolio not found. Use /api/portfolio/my for your portfolios or /api/portfolio/my-reservations for reserved portfolios.",
        });
      }

      // Try to find by slug first (more user-friendly), then by ID
      let portfolio = await findPortfolioBySlug(id);
      if (!portfolio) {
        // Only try by ID if it looks like a valid MongoDB ObjectId (24 hex chars) or is a valid string
        // This prevents errors when trying invalid IDs
        if (id.length === 24 && /^[a-f0-9]{24}$/i.test(id)) {
          portfolio = await findPortfolioById(id);
        }
      }

      if (!portfolio) {
        return res.status(404).json({
          success: false,
          message: "Portfolio not found",
        });
      }

      // Check authentication
      const authResult = await protect(req);
      const user = authResult.user || null;
      const isAuthenticated = !!user;

      // Check if user is owner
      // studentId can be a string (raw) or an object (populated with user data)
      let studentIdStr;
      if (
        typeof portfolio.studentId === "object" &&
        portfolio.studentId !== null
      ) {
        // If it's an object (populated), get the _id
        studentIdStr = portfolio.studentId._id || portfolio.studentId;
      } else {
        // If it's already a string, use it directly
        studentIdStr = portfolio.studentId;
      }

      const isOwner =
        isAuthenticated &&
        user &&
        user._id &&
        studentIdStr &&
        String(user._id) === String(studentIdStr);

      // Check if user is admin
      const isAdmin =
        isAuthenticated && (user.role === "admin" || user.role === "owner");

      // Access control - check both new visibility and legacy isPublic
      const isPublic =
        portfolio.visibility === "public" || portfolio.isPublic === true;
      const isUnlisted = portfolio.visibility === "unlisted";

      // Unlisted portfolios are only accessible via direct link (slug/ID), not in public listings
      // Private portfolios require authentication and ownership
      if (!isPublic && !isUnlisted && !isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "This portfolio is private. Authentication required.",
        });
      }

      // Track view (async, don't wait)
      try {
        const viewerType =
          isAuthenticated && user.role === "university"
            ? "university"
            : "public";
        const ip =
          req.headers["x-forwarded-for"] ||
          req.connection.remoteAddress ||
          "unknown";
        const ipHash = hashIP(ip);

        createPortfolioView({
          portfolioId: portfolio._id,
          viewerType,
          ipHash,
          userAgent: req.headers["user-agent"] || null,
        }).catch((err) => console.error("Error tracking portfolio view:", err));
      } catch (trackError) {
        // Don't fail the request if tracking fails
        console.error("Error tracking view:", trackError);
      }

      // Get logo URL from user's userLogo field BEFORE converting to object
      // This must be done before toObject() because studentId might be populated as an object
      let logoUrl = null;
      if (portfolio.studentId) {
        // studentId can be an object (populated by portfolio helper) or a string
        if (typeof portfolio.studentId === "object" && portfolio.studentId !== null) {
          logoUrl = portfolio.studentId.userLogo || null;
        } else {
          // If studentId is a string, try to get user data
          const studentUser = findUserByIdWithoutPassword(portfolio.studentId);
          if (studentUser) {
            logoUrl = studentUser.userLogo || null;
          }
        }
      }

      // Filter personal data if needed
      // Owners and admins always get full data, others get filtered data
      let portfolioData;
      if (isOwner || isAdmin) {
        // Owner or admin - return full data
        portfolioData = portfolio.toObject
          ? portfolio.toObject({
              virtuals: false,
              getters: false,
              minimize: false, // Don't minimize - include all fields even if empty
            })
          : portfolio;
      } else {
        // Not owner - filter personal data
        portfolioData = filterPersonalData(portfolio, user?.role || "public");
      }

      // Ensure hero field is always included with default structure
      // Get hero from the original portfolio document (before toObject conversion)
      const heroFromPortfolio = portfolio.hero
        ? typeof portfolio.hero.toObject === "function"
          ? portfolio.hero.toObject()
          : portfolio.hero
        : null;

      // Always set hero field - use from portfolio if exists, otherwise use default
      if (
        !portfolioData.hasOwnProperty("hero") ||
        portfolioData.hero === null ||
        portfolioData.hero === undefined
      ) {
        portfolioData.hero = heroFromPortfolio || {
          title: null,
          subtitle: null,
          image: null,
          ctaText: null,
          ctaLink: null,
        };
      }

      // Ensure hero has all required fields with proper structure
      if (!portfolioData.hero || typeof portfolioData.hero !== "object") {
        portfolioData.hero = {
          title: null,
          subtitle: null,
          image: null,
          ctaText: null,
          ctaLink: null,
        };
      } else {
        // Ensure all fields exist
        portfolioData.hero = {
          title:
            portfolioData.hero.title !== undefined
              ? portfolioData.hero.title
              : null,
          subtitle:
            portfolioData.hero.subtitle !== undefined
              ? portfolioData.hero.subtitle
              : null,
          image:
            portfolioData.hero.image !== undefined
              ? portfolioData.hero.image
              : null,
          ctaText:
            portfolioData.hero.ctaText !== undefined
              ? portfolioData.hero.ctaText
              : null,
          ctaLink:
            portfolioData.hero.ctaLink !== undefined
              ? portfolioData.hero.ctaLink
              : null,
        };
      }

      // Add logo URL to portfolio data
      portfolioData.logo = logoUrl;

      res.json({
        success: true,
        data: portfolioData,
      });
    } catch (error) {
      console.error("Get portfolio error:", error);

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
        message: error.message || "Error retrieving portfolio",
      });
    }
  } else if (req.method === "PUT") {
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
      const { id } = req.query;

      // Find portfolio
      const portfolio = await findPortfolioById(id);
      if (!portfolio) {
        return res.status(404).json({
          success: false,
          message: "Portfolio not found",
        });
      }

      // Check ownership or admin
      // studentId can be a string (raw) or an object (populated with user data)
      const studentIdStr =
        typeof portfolio.studentId === "object" && portfolio.studentId?._id
          ? portfolio.studentId._id
          : portfolio.studentId;
      const isOwner =
        user._id &&
        studentIdStr &&
        user._id.toString() === studentIdStr.toString();
      const isAdmin = user.role === "admin" || user.role === "owner";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to modify this portfolio",
        });
      }

      const portfolioData = req.body;

      // Validate portfolio data
      const validation = validatePortfolioData(portfolioData, true);
      if (!validation.valid) {
        console.error("Portfolio validation errors:", validation.errors);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      // Validate slug if provided
      if (portfolioData.slug !== undefined) {
        const slugValidation = validateSlug(portfolioData.slug);
        if (!slugValidation.valid) {
          console.error("Slug validation failed:", slugValidation.error);
          return res.status(400).json({
            success: false,
            message: slugValidation.error,
          });
        }

        // Check if slug exists (excluding current portfolio)
        const slugAlreadyExists = await slugExists(slugValidation.slug, id);
        if (slugAlreadyExists) {
          console.error("Slug already exists:", slugValidation.slug);
          return res.status(400).json({
            success: false,
            message:
              "This slug is already taken. Please choose a different one.",
          });
        }
      }

      // Build update object from validated data
      const updates = {};
      if (portfolioData.slug !== undefined) {
        const slugValidation = validateSlug(portfolioData.slug);
        updates.slug = slugValidation.slug;
      }
      if (portfolioData.visibility !== undefined)
        updates.visibility = validation.portfolioData.visibility;
      if (portfolioData.layout !== undefined)
        updates.layout = validation.portfolioData.layout;
      if (portfolioData.theme !== undefined)
        updates.theme = validation.portfolioData.theme;
      if (portfolioData.hero !== undefined)
        updates.hero = validation.portfolioData.hero;
      if (portfolioData.sections !== undefined)
        updates.sections = validation.portfolioData.sections;
      if (portfolioData.certificates !== undefined)
        updates.certificates = validation.portfolioData.certificates;
      if (portfolioData.animations !== undefined)
        updates.animations = validation.portfolioData.animations;
      // Legacy support
      if (portfolioData.isPublic !== undefined)
        updates.isPublic = validation.portfolioData.isPublic;

      // Update portfolio
      const updatedPortfolio = await updatePortfolio(id, updates);

      // Convert to plain object to ensure all fields are included (including null/empty fields)
      const updatedData = updatedPortfolio.toObject
        ? updatedPortfolio.toObject({
            virtuals: false,
            getters: false,
            minimize: false, // Don't minimize - include all fields even if empty
          })
        : updatedPortfolio;

      // Ensure hero field is always included with default structure
      if (!updatedData.hasOwnProperty("hero") || updatedData.hero === null) {
        updatedData.hero = updatedPortfolio.hero || {
          title: null,
          subtitle: null,
          image: null,
          ctaText: null,
          ctaLink: null,
        };
      }

      res.json({
        success: true,
        message: "Portfolio updated successfully",
        data: updatedData,
      });
    } catch (error) {
      console.error("Update portfolio error:", error);
      if (!res.headersSent) {
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
          message: error.message || "Error updating portfolio",
        });
      }
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

      const user = authResult.user;
      const { id } = req.query;

      // Find portfolio
      const portfolio = await findPortfolioById(id);
      if (!portfolio) {
        return res.status(404).json({
          success: false,
          message: "Portfolio not found",
        });
      }

      // Check ownership or admin
      // studentId can be a string (raw) or an object (populated with user data)
      const studentIdStr =
        typeof portfolio.studentId === "object" && portfolio.studentId?._id
          ? portfolio.studentId._id
          : portfolio.studentId;
      const isOwner =
        user._id &&
        studentIdStr &&
        user._id.toString() === studentIdStr.toString();
      const isAdmin = user.role === "admin" || user.role === "owner";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete this portfolio",
        });
      }

      await deletePortfolio(id);

      res.json({
        success: true,
        message: "Portfolio deleted successfully",
      });
    } catch (error) {
      console.error("Delete portfolio error:", error);
      if (!res.headersSent) {
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
          message: error.message || "Error deleting portfolio",
        });
      }
    }
  } else {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }
}
