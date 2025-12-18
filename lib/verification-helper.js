import connectDB from "./mongodb.js";
import VerificationLog from "../models/VerificationLog.js";
import { ensureVerificationStructure } from "./portfolio-migration.js";

/**
 * Required block types that must be verified
 * Configurable - can be updated based on business requirements
 */
export const REQUIRED_VERIFICATION_TYPES = ["certificates", "achievements"];

/**
 * Get required block types
 * @returns {Array<String>} - Array of block types that require verification
 */
export function getRequiredBlockTypes() {
  return [...REQUIRED_VERIFICATION_TYPES];
}

/**
 * Calculate portfolio-level verification status
 * @param {Object} portfolio - Portfolio document
 * @returns {String} - "verified" | "partially-verified" | "unverified" | "pending"
 */
export function calculatePortfolioVerificationStatus(portfolio) {
  if (!portfolio) {
    return "unverified";
  }

  // Get blocks from portfolio
  const blocks =
    portfolio.layout?.blocks ||
    (portfolio.layout &&
      typeof portfolio.layout === "object" &&
      portfolio.layout.blocks
      ? portfolio.layout.blocks
      : []);

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "unverified";
  }

  // Filter required blocks
  const requiredBlocks = blocks.filter((block) =>
    REQUIRED_VERIFICATION_TYPES.includes(block.type)
  );

  if (requiredBlocks.length === 0) {
    return "unverified";
  }

  // Count verification statuses
  let verifiedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  requiredBlocks.forEach((block) => {
    // Ensure verification structure exists
    const blockWithVerification = ensureVerificationStructure(block);
    const status = blockWithVerification.verification?.status || "unverified";

    if (status === "verified") {
      verifiedCount++;
    } else if (status === "pending") {
      pendingCount++;
    } else if (status === "rejected") {
      rejectedCount++;
    }
  });

  // Calculate status
  if (verifiedCount === requiredBlocks.length) {
    return "verified";
  } else if (verifiedCount > 0) {
    return "partially-verified";
  } else if (pendingCount > 0) {
    return "pending";
  } else {
    return "unverified";
  }
}

/**
 * Check if block qualifies for auto-verification
 * @param {Object} block - Block object
 * @returns {Boolean} - True if block can be auto-verified
 */
export function canAutoVerify(block) {
  if (!block || !block.type) {
    return false;
  }

  // Check if block has content that can be auto-verified
  const content = block.content || {};

  // Check for olympiad result references
  if (content.olympiadId || content.resultId) {
    return true;
  }

  // Check for platform certificate
  if (block.type === "certificates" && content.issuedBy === "platform") {
    return true;
  }

  // Check for internal test scores
  if (content.testId || content.assessmentId) {
    return true;
  }

  return false;
}

/**
 * Create verification log entry
 * @param {String} blockId - Block ID
 * @param {String} portfolioId - Portfolio ID
 * @param {String} action - "request" | "approve" | "reject" | "auto-verify"
 * @param {Object} actor - User object or null for system
 * @param {String} actorType - "student" | "admin" | "system" | "external"
 * @param {Object} metadata - Additional metadata (rejection reason, notes, etc.)
 * @returns {Object} - Created verification log entry
 */
export async function createVerificationLog(
  blockId,
  portfolioId,
  action,
  actor = null,
  actorType = "system",
  metadata = {}
) {
  await connectDB();

  const logEntry = await VerificationLog.create({
    blockId,
    portfolioId,
    action,
    actorId: actor?._id || null,
    actorType,
    timestamp: new Date(),
    metadata,
  });

  return logEntry;
}

/**
 * Get verification history for a block
 * @param {String} blockId - Block ID
 * @returns {Array<Object>} - Array of verification log entries
 */
export async function getVerificationHistory(blockId) {
  await connectDB();

  const history = await VerificationLog.find({ blockId })
    .sort({ timestamp: -1 })
    .populate("actorId", "name email role")
    .lean();

  return history;
}

/**
 * Get verification history for a portfolio
 * @param {String} portfolioId - Portfolio ID
 * @returns {Array<Object>} - Array of verification log entries
 */
export async function getPortfolioVerificationHistory(portfolioId) {
  await connectDB();

  const history = await VerificationLog.find({ portfolioId })
    .sort({ timestamp: -1 })
    .populate("actorId", "name email role")
    .lean();

  return history;
}

/**
 * Get pending verification requests
 * @param {Object} filters - Optional filters (blockType, portfolioId, dateRange)
 * @returns {Array<Object>} - Array of pending verification requests with block info
 */
export async function getPendingVerificationRequests(filters = {}) {
  await connectDB();

  const query = {
    action: "request",
  };

  if (filters.portfolioId) {
    query.portfolioId = filters.portfolioId;
  }

  if (filters.dateFrom || filters.dateTo) {
    query.timestamp = {};
    if (filters.dateFrom) {
      query.timestamp.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      query.timestamp.$lte = new Date(filters.dateTo);
    }
  }

  const pendingRequests = await VerificationLog.find(query)
    .sort({ timestamp: -1 })
    .populate("portfolioId", "slug studentId")
    .populate("actorId", "name email")
    .lean();

  // Filter by block type if specified (requires fetching portfolio)
  if (filters.blockType) {
    // This would require additional logic to check block types
    // For now, return all and filter in application layer if needed
  }

  return pendingRequests;
}

/**
 * Ensure block has verification structure
 * @param {Object} block - Block object
 * @returns {Object} - Block with verification structure
 */
export function ensureBlockVerification(block) {
  return ensureVerificationStructure(block);
}

export default {
  getRequiredBlockTypes,
  calculatePortfolioVerificationStatus,
  canAutoVerify,
  createVerificationLog,
  getVerificationHistory,
  getPortfolioVerificationHistory,
  getPendingVerificationRequests,
  ensureBlockVerification,
  REQUIRED_VERIFICATION_TYPES,
};

