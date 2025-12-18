import { findPortfolioById, findPortfolioBySlug } from "./portfolio-helper.js";

/**
 * Verify if a user owns a portfolio
 * @param {Object} portfolio - Portfolio document
 * @param {String} userId - User ID to check
 * @returns {Boolean} - True if user owns the portfolio
 */
export function verifyPortfolioOwnership(portfolio, userId) {
  if (!portfolio || !userId) {
    return false;
  }

  // Handle both string and populated object formats
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

  // Compare as strings to handle ObjectId comparisons
  return String(userId) === String(studentIdStr);
}

/**
 * Check if user is admin or owner
 * @param {Object} user - User object
 * @returns {Boolean} - True if user is admin or owner
 */
export function isAdminOrOwner(user) {
  if (!user || !user.role) {
    return false;
  }
  return user.role === "admin" || user.role === "owner";
}

/**
 * Verify portfolio ownership and return error if not owned
 * @param {Object} portfolio - Portfolio document
 * @param {Object} user - User object
 * @returns {Object|null} - Error object if not owned, null if owned
 */
export function checkPortfolioOwnership(portfolio, user) {
  if (!portfolio) {
    return {
      error: "Portfolio not found",
      status: 404,
    };
  }

  if (!user) {
    return {
      error: "Authentication required",
      status: 401,
    };
  }

  const isOwner = verifyPortfolioOwnership(portfolio, user._id);
  const isAdmin = isAdminOrOwner(user);

  if (!isOwner && !isAdmin) {
    return {
      error: "You do not have permission to modify this portfolio",
      status: 403,
    };
  }

  return null;
}

/**
 * Check if portfolio can be edited (must be draft status)
 * @param {Object} portfolio - Portfolio document
 * @param {Object} user - User object
 * @returns {Object|null} - Error object if cannot be edited, null if can be edited
 */
export function checkPortfolioEditable(portfolio, user) {
  // First check ownership
  const ownershipError = checkPortfolioOwnership(portfolio, user);
  if (ownershipError) {
    return ownershipError;
  }

  // Check if portfolio is published (only owner can unpublish to edit)
  if (portfolio.status === "published") {
    const isOwner = verifyPortfolioOwnership(portfolio, user._id);
    if (!isOwner) {
      return {
        error: "Published portfolios can only be edited by the owner",
        status: 403,
      };
    }
    // Owner can edit published portfolios (they can unpublish first)
    // But we'll require explicit unpublish action
    return {
      error:
        "This portfolio is published. Please unpublish it first to make edits.",
      status: 403,
    };
  }

  return null;
}

/**
 * Middleware-style function to require portfolio ownership
 * Works with Next.js API routes
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function (optional, for Express-style)
 * @returns {Object|null} - Error response or null if authorized
 */
export async function requirePortfolioOwnershipMiddleware(
  req,
  res,
  next = null
) {
  const portfolioId = req.query.id || req.params.id || req.body.id;
  const slug = req.query.slug || req.params.slug || req.body.slug;

  if (!portfolioId && !slug) {
    const error = {
      success: false,
      message: "Portfolio ID or slug is required",
    };
    if (res && !res.headersSent) {
      return res.status(400).json(error);
    }
    return error;
  }

  // Find portfolio
  let portfolio;
  if (slug) {
    portfolio = await findPortfolioBySlug(slug);
  } else {
    portfolio = await findPortfolioById(portfolioId);
  }

  if (!portfolio) {
    const error = {
      success: false,
      message: "Portfolio not found",
    };
    if (res && !res.headersSent) {
      return res.status(404).json(error);
    }
    return error;
  }

  // Get user from request (should be set by protect middleware)
  const user = req.user;
  if (!user) {
    const error = {
      success: false,
      message: "Authentication required",
    };
    if (res && !res.headersSent) {
      return res.status(401).json(error);
    }
    return error;
  }

  // Check ownership
  const ownershipError = checkPortfolioOwnership(portfolio, user);
  if (ownershipError) {
    const error = {
      success: false,
      message: ownershipError.error,
    };
    if (res && !res.headersSent) {
      return res.status(ownershipError.status).json(error);
    }
    return error;
  }

  // Attach portfolio to request
  req.portfolio = portfolio;
  return null;
}

export default {
  verifyPortfolioOwnership,
  isAdminOrOwner,
  checkPortfolioOwnership,
  checkPortfolioEditable,
  requirePortfolioOwnershipMiddleware,
};

