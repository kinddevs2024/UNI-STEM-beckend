import connectDB from "./mongodb.js";
import UniversityContactAccess from "../models/UniversityContactAccess.js";

/**
 * Check if contact access is unlocked for a university
 * @param {String} universityId - University user ID
 * @param {String} portfolioId - Portfolio ID
 * @returns {Promise<Boolean>} - True if unlocked, false otherwise
 */
export async function isContactUnlocked(universityId, portfolioId) {
  if (!universityId || !portfolioId) {
    return false;
  }

  await connectDB();

  try {
    const access = await UniversityContactAccess.findOne({
      universityId,
      portfolioId,
    });

    return access?.unlocked === true;
  } catch (error) {
    console.error("Error checking contact unlock status:", error);
    return false; // Default to locked on error
  }
}

/**
 * Mask email address
 * @param {String} email - Email address
 * @returns {String} - Masked email
 */
export function maskEmail(email) {
  if (!email || typeof email !== "string") {
    return "***@***";
  }

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "***@***";
  }

  // Mask local part: show first 2 chars, mask the rest
  const maskedLocal =
    localPart.length > 2
      ? localPart.substring(0, 2) + "***"
      : "***";

  // Mask domain: show first char, mask the rest
  const maskedDomain =
    domain.length > 1 ? domain.substring(0, 1) + "***" : "***";

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask phone number
 * @param {String} phone - Phone number
 * @returns {String} - Masked phone
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== "string") {
    return "***-***-****";
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 0) {
    return "***-***-****";
  }

  // Format: +998 ** *** ** ** (for international) or ***-***-**** (for local)
  if (digits.length >= 12) {
    // International format
    const countryCode = digits.substring(0, 3);
    const masked = "** *** ** **";
    return `+${countryCode} ${masked}`;
  } else if (digits.length >= 9) {
    // Local format: show last 4 digits
    const last4 = digits.substring(digits.length - 4);
    return `***-***-${last4}`;
  } else {
    // Short number: mask all
    return "***-***-****";
  }
}

/**
 * Mask user contact information if not unlocked
 * @param {Object} user - User object
 * @param {String} universityId - University user ID
 * @param {String} portfolioId - Portfolio ID
 * @returns {Promise<Object>} - User object with masked contacts if locked
 */
export async function maskUserContacts(user, universityId, portfolioId) {
  if (!user) {
    return user;
  }

  // If no university ID provided, mask by default
  const unlocked = universityId
    ? await isContactUnlocked(universityId, portfolioId)
    : false;

  if (unlocked) {
    return user; // Return full contacts if unlocked
  }

  // Create a copy to avoid mutating original
  const maskedUser = { ...user };

  // Mask email
  if (maskedUser.email) {
    maskedUser.email = maskEmail(maskedUser.email);
  }

  // Mask phone
  if (maskedUser.tel) {
    maskedUser.tel = maskPhone(maskedUser.tel);
  }

  return maskedUser;
}

/**
 * Unlock contact access for a university
 * @param {String} universityId - University user ID
 * @param {String} portfolioId - Portfolio ID
 * @returns {Promise<Object>} - Access record
 */
export async function unlockContactAccess(universityId, portfolioId) {
  if (!universityId || !portfolioId) {
    throw new Error("University ID and Portfolio ID are required");
  }

  await connectDB();

  try {
    const access = await UniversityContactAccess.findOneAndUpdate(
      { universityId, portfolioId },
      {
        unlocked: true,
        unlockedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );

    return access;
  } catch (error) {
    console.error("Error unlocking contact access:", error);
    throw error;
  }
}

/**
 * Lock contact access for a university
 * @param {String} universityId - University user ID
 * @param {String} portfolioId - Portfolio ID
 * @returns {Promise<Object>} - Access record
 */
export async function lockContactAccess(universityId, portfolioId) {
  if (!universityId || !portfolioId) {
    throw new Error("University ID and Portfolio ID are required");
  }

  await connectDB();

  try {
    const access = await UniversityContactAccess.findOneAndUpdate(
      { universityId, portfolioId },
      {
        unlocked: false,
        unlockedAt: null,
      },
      {
        upsert: true,
        new: true,
      }
    );

    return access;
  } catch (error) {
    console.error("Error locking contact access:", error);
    throw error;
  }
}

export default {
  isContactUnlocked,
  maskEmail,
  maskPhone,
  maskUserContacts,
  unlockContactAccess,
  lockContactAccess,
};

