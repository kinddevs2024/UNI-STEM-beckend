import connectDB from "./mongodb.js";
import Result from "../models/Result.js";
import { canAutoVerify, createVerificationLog } from "./verification-helper.js";
import { ensureVerificationStructure } from "./portfolio-migration.js";

/**
 * Auto-verify a block based on platform data
 * @param {Object} block - Block object
 * @param {Object} portfolio - Portfolio document
 * @returns {Object} - { verified: boolean, reason: string, block: Object }
 */
export async function autoVerifyBlock(block, portfolio) {
  if (!block || !portfolio) {
    return { verified: false, reason: "Missing block or portfolio" };
  }

  // Check if block qualifies for auto-verification
  if (!canAutoVerify(block)) {
    return { verified: false, reason: "Block does not qualify for auto-verification" };
  }

  // Ensure verification structure exists
  const blockWithVerification = ensureVerificationStructure(block);

  // Check current status - don't override if already verified/rejected
  const currentStatus = blockWithVerification.verification?.status;
  if (currentStatus === "verified" || currentStatus === "rejected") {
    return {
      verified: currentStatus === "verified",
      reason: `Block already ${currentStatus}`,
      block: blockWithVerification,
    };
  }

  // Try different auto-verification methods
  let verificationResult = null;

  // 1. Try olympiad result verification
  verificationResult = await verifyOlympiadResult(block, portfolio);
  if (verificationResult.verified) {
    return await applyAutoVerification(block, portfolio, verificationResult);
  }

  // 2. Try platform certificate verification
  verificationResult = await verifyPlatformCertificate(block, portfolio);
  if (verificationResult.verified) {
    return await applyAutoVerification(block, portfolio, verificationResult);
  }

  // 3. Try internal test score verification
  verificationResult = await verifyInternalTestScore(block, portfolio);
  if (verificationResult.verified) {
    return await applyAutoVerification(block, portfolio, verificationResult);
  }

  return { verified: false, reason: "No matching platform data found", block: blockWithVerification };
}

/**
 * Verify block against olympiad results
 * @param {Object} block - Block object
 * @param {Object} portfolio - Portfolio document
 * @returns {Object} - { verified: boolean, metadata: object }
 */
async function verifyOlympiadResult(block, portfolio) {
  const content = block.content || {};
  const olympiadId = content.olympiadId || content.olympiad_id;
  const resultId = content.resultId || content.result_id;

  // Check if block references olympiad result
  if (!olympiadId && !resultId) {
    return { verified: false };
  }

  await connectDB();

  try {
    // Find result in database
    let result = null;
    if (resultId) {
      result = await Result.findById(resultId);
    } else if (olympiadId) {
      // Find result by olympiad and user
      const studentId = portfolio.studentId?._id || portfolio.studentId;
      result = await Result.findOne({
        olympiadId: olympiadId,
        userId: studentId,
      });
    }

    if (!result) {
      return { verified: false, reason: "Olympiad result not found" };
    }

    // Verify the result exists and matches
    // Additional validation can be added here (score matching, date matching, etc.)
    return {
      verified: true,
      metadata: {
        resultId: result._id,
        olympiadId: result.olympiadId,
        score: result.totalScore,
        verifiedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error verifying olympiad result:", error);
    return { verified: false, reason: "Error checking olympiad result" };
  }
}

/**
 * Verify platform-issued certificate
 * @param {Object} block - Block object
 * @param {Object} portfolio - Portfolio document
 * @returns {Object} - { verified: boolean, metadata: object }
 */
async function verifyPlatformCertificate(block, portfolio) {
  if (block.type !== "certificates") {
    return { verified: false };
  }

  const content = block.content || {};

  // Check if certificate was issued by platform
  if (content.issuedBy === "platform" || content.issuedBy === "olympiad-platform") {
    // Additional checks: certificate URL, certificate ID, etc.
    if (content.certificateId || content.certificateUrl) {
      return {
        verified: true,
        metadata: {
          certificateId: content.certificateId,
          issuedBy: content.issuedBy,
          verifiedAt: new Date(),
        },
      };
    }
  }

  return { verified: false };
}

/**
 * Verify internal test score
 * @param {Object} block - Block object
 * @param {Object} portfolio - Portfolio document
 * @returns {Object} - { verified: boolean, metadata: object }
 */
async function verifyInternalTestScore(block, portfolio) {
  const content = block.content || {};
  const testId = content.testId || content.test_id;
  const assessmentId = content.assessmentId || content.assessment_id;

  if (!testId && !assessmentId) {
    return { verified: false };
  }

  // Future: Check against internal test/assessment database
  // For now, if testId/assessmentId exists, we can auto-verify
  // This can be extended to check actual test records

  if (testId || assessmentId) {
    return {
      verified: true,
      metadata: {
        testId: testId || assessmentId,
        verifiedAt: new Date(),
      },
    };
  }

  return { verified: false };
}

/**
 * Apply auto-verification to block
 * @param {Object} block - Block object
 * @param {Object} portfolio - Portfolio document
 * @param {Object} verificationResult - Verification result from auto-verify function
 * @returns {Object} - Updated block with verification
 */
async function applyAutoVerification(block, portfolio, verificationResult) {
  // Ensure verification structure
  const blockWithVerification = ensureVerificationStructure(block);

  // Update verification status
  blockWithVerification.verification = {
    status: "verified",
    verifiedBy: "system",
    verifiedAt: new Date(),
    verifiedById: null,
    note: verificationResult.metadata?.note || "Auto-verified by system",
    requestedAt: blockWithVerification.verification?.requestedAt || null,
    rejectionReason: null,
  };

  // Create verification log
  try {
    await createVerificationLog(
      block.id || block._id,
      portfolio._id,
      "auto-verify",
      null, // system action
      "system",
      verificationResult.metadata || {}
    );
  } catch (error) {
    console.error("Error creating verification log:", error);
    // Continue even if log creation fails
  }

  return {
    verified: true,
    reason: "Auto-verified by system",
    block: blockWithVerification,
    metadata: verificationResult.metadata,
  };
}

/**
 * Check if block should be auto-verified on creation/update
 * @param {Object} block - Block object
 * @param {Object} portfolio - Portfolio document
 * @returns {Boolean} - True if should attempt auto-verification
 */
export function shouldAutoVerify(block, portfolio) {
  // Only auto-verify if block is unverified
  const verification = block.verification || {};
  if (verification.status && verification.status !== "unverified") {
    return false;
  }

  return canAutoVerify(block);
}

export default {
  autoVerifyBlock,
  verifyOlympiadResult,
  verifyPlatformCertificate,
  verifyInternalTestScore,
  shouldAutoVerify,
};

