import { handleCORS } from "../../../../lib/api-helpers.js";
import { protect } from "../../../../lib/auth.js";
import {
  findPortfolioBySlug,
  findPortfolioById,
  filterPersonalData,
} from "../../../../lib/portfolio-helper.js";
import { createPortfolioView, hashIP } from "../../../../lib/analytics-helper.js";

/**
 * @swagger
 * /api/portfolio/{id}/{sectionId}:
 *   get:
 *     summary: Get a specific section from a portfolio
 *     tags: [Portfolio]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio slug or ID
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Section slug or ID
 *     responses:
 *       200:
 *         description: Section data
 *       404:
 *         description: Portfolio or section not found
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
    const { id, sectionId } = req.query;
    const slug = id; // Use id as slug for backward compatibility

    if (!slug || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "Portfolio slug and section ID are required",
      });
    }

    // Find portfolio by slug
    let portfolio = await findPortfolioBySlug(slug);
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

    // Check ownership
    let studentIdStr;
    if (
      typeof portfolio.studentId === "object" &&
      portfolio.studentId !== null
    ) {
      studentIdStr = portfolio.studentId._id || portfolio.studentId;
    } else {
      studentIdStr = portfolio.studentId;
    }

    const isOwner =
      isAuthenticated &&
      user &&
      user._id &&
      studentIdStr &&
      String(user._id) === String(studentIdStr);
    const isAdmin =
      isAuthenticated && (user.role === "admin" || user.role === "owner");

    // Access control
    const isPublic =
      portfolio.visibility === "public" || portfolio.isPublic === true;
    const isUnlisted = portfolio.visibility === "unlisted";

    if (!isPublic && !isUnlisted && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "This portfolio is private. Authentication required.",
      });
    }

    // Find section by slug or id
    const sections = portfolio.sections || [];
    let section = sections.find(
      (s) =>
        s.slug === sectionId ||
        s.id === sectionId ||
        s.type === sectionId ||
        (s.id && s.id.split("-")[0] === sectionId)
    );

    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    // Check if section is enabled
    if (section.enabled === false && !isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
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

    // Prepare response data
    const sectionData = {
      portfolio: {
        _id: portfolio._id,
        slug: portfolio.slug,
        layout: portfolio.layout,
        theme: portfolio.theme,
        hero: portfolio.hero || {
          title: null,
          subtitle: null,
          image: null,
          ctaText: null,
          ctaLink: null,
        },
      },
      section: section,
      navigation: sections
        .filter((s) => s.enabled !== false)
        .map((s) => ({
          id: s.id,
          slug: s.slug || s.id?.split("-")[0] || s.type,
          type: s.type,
          title: s.title,
          order: s.order,
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    };

    res.json({
      success: true,
      data: sectionData,
    });
  } catch (error) {
    console.error("Get portfolio section error:", error);

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
      message: error.message || "Error retrieving portfolio section",
    });
  }
}

