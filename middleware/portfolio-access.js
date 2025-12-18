import { protect } from "../lib/auth.js";
import {
  findPortfolioById,
  findPortfolioBySlug,
} from "../lib/portfolio-helper.js";
import {
  verifyPortfolioOwnership,
  isAdminOrOwner,
  checkPortfolioOwnership,
  checkPortfolioEditable,
} from "../lib/portfolio-ownership.js";

/**
 * Middleware to check portfolio access
 * - Students: can access their own portfolios
 * - Universities: can access public portfolios only (no personal data)
 * - Admins: can access all portfolios
 * - Public: can access public portfolios only (no personal data)
 */
export async function checkPortfolioAccess(req, res, next) {
  try {
    const portfolioId =
      req.query.id ||
      req.body.id ||
      req.query.portfolioId ||
      req.body.portfolioId;
    const slug = req.query.slug || req.params.slug;

    if (!portfolioId && !slug) {
      return res.status(400).json({
        success: false,
        message: "Portfolio ID or slug is required",
      });
    }

    // Find portfolio
    let portfolio;
    if (slug) {
      portfolio = await findPortfolioBySlug(slug);
    } else {
      portfolio = await findPortfolioById(portfolioId);
    }

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check if portfolio is public
    const isPublic = portfolio.isPublic;

    // Try to get authenticated user
    const authResult = await protect(req);
    const user = authResult.user || null;
    const isAuthenticated = !!user;

    // Check if user is owner (using centralized function)
    const isOwner =
      isAuthenticated && verifyPortfolioOwnership(portfolio, user._id);

    // Check if user is admin (using centralized function)
    const isAdmin = isAuthenticated && isAdminOrOwner(user);

    // Access control logic
    if (isPublic) {
      // Public portfolio - allow access
      // Filter personal data for non-owners
      if (!isOwner && !isAdmin) {
        req.portfolioAccess = {
          portfolio,
          canEdit: false,
          canView: true,
          filterPersonalData: true,
        };
      } else {
        req.portfolioAccess = {
          portfolio,
          canEdit: isOwner || isAdmin,
          canView: true,
          filterPersonalData: false,
        };
      }
    } else {
      // Private portfolio
      if (!isAuthenticated) {
        return res.status(403).json({
          success: false,
          message: "This portfolio is private. Authentication required.",
        });
      }

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this portfolio",
        });
      }

      req.portfolioAccess = {
        portfolio,
        canEdit: isOwner || isAdmin,
        canView: true,
        filterPersonalData: false,
      };
    }

    // Store user info for later use
    req.user = user;
    next();
  } catch (error) {
    console.error("Portfolio access check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking portfolio access",
    });
  }
}

/**
 * Middleware to ensure user owns the portfolio or is admin
 */
export async function requirePortfolioOwnership(req, res, next) {
  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    const user = authResult.user;
    const portfolioId = req.query.id || req.params.id || req.body.id;
    const slug = req.query.slug || req.params.slug;

    if (!portfolioId && !slug) {
      return res.status(400).json({
        success: false,
        message: "Portfolio ID or slug is required",
      });
    }

    // Find portfolio
    let portfolio;
    if (slug) {
      portfolio = await findPortfolioBySlug(slug);
    } else {
      portfolio = await findPortfolioById(portfolioId);
    }

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check ownership or admin (using centralized function)
    const ownershipError = checkPortfolioOwnership(portfolio, user);
    if (ownershipError) {
      return res.status(ownershipError.status).json({
        success: false,
        message: ownershipError.error,
      });
    }

    req.portfolio = portfolio;
    req.user = user;
    next();
  } catch (error) {
    console.error("Portfolio ownership check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking portfolio ownership",
    });
  }
}

/**
 * Middleware to check if user can view public portfolios (for universities)
 */
export function allowPublicPortfolioAccess(req, res, next) {
  // This middleware allows access to public portfolios
  // Personal data filtering will be handled in the route handler
  next();
}

/**
 * Middleware to restrict access to students only
 */
export function requireStudentRole(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "This endpoint is only available to students",
    });
  }

  next();
}

/**
 * Middleware to allow university or admin access
 */
export function requireUniversityOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const allowedRoles = ["university", "admin", "owner"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "This endpoint requires university or admin role",
    });
  }

  next();
}

export default {
  checkPortfolioAccess,
  requirePortfolioOwnership,
  allowPublicPortfolioAccess,
  requireStudentRole,
  requireUniversityOrAdmin,
};
