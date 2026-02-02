/**
 * Input validation for olympiad attempt endpoints (start, answer, submit, violation)
 * Manual validation - no zod/yup dependency
 */

const MONGO_OBJECTID_REGEX = /^[a-fA-F0-9]{24}$/;
const MAX_ANSWER_LENGTH = 50000; // 50KB
const MAX_VIOLATION_DETAILS_KEYS = 20;

export function isValidObjectId(id) {
  return typeof id === "string" && MONGO_OBJECTID_REGEX.test(id);
}

export function validateStartInput(body) {
  const { deviceFingerprint, proctoringStatus } = body || {};
  if (!deviceFingerprint || typeof deviceFingerprint !== "string") {
    return { valid: false, error: "deviceFingerprint is required and must be a string" };
  }
  if (deviceFingerprint.length > 500) {
    return { valid: false, error: "deviceFingerprint too long" };
  }
  if (proctoringStatus && typeof proctoringStatus !== "object") {
    return { valid: false, error: "proctoringStatus must be an object" };
  }
  return { valid: true };
}

export function validateAnswerInput(body) {
  const { questionId, answer, nonce } = body || {};
  if (!isValidObjectId(questionId)) {
    return { valid: false, error: "questionId must be a valid 24-char hex ID" };
  }
  if (typeof answer !== "string") {
    return { valid: false, error: "answer is required and must be a string" };
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    return { valid: false, error: `answer exceeds max length (${MAX_ANSWER_LENGTH} chars)` };
  }
  if (nonce !== undefined && (typeof nonce !== "string" || nonce.length > 100)) {
    return { valid: false, error: "nonce must be a string up to 100 chars" };
  }
  return { valid: true };
}

export function validateViolationInput(body) {
  const { violationType, details } = body || {};
  if (!violationType || typeof violationType !== "string") {
    return { valid: false, error: "violationType is required and must be a string" };
  }
  if (violationType.length > 100) {
    return { valid: false, error: "violationType too long" };
  }
  if (details !== undefined) {
    if (typeof details !== "object" || details === null || Array.isArray(details)) {
      return { valid: false, error: "details must be a plain object" };
    }
    if (Object.keys(details).length > MAX_VIOLATION_DETAILS_KEYS) {
      return { valid: false, error: "details has too many keys" };
    }
  }
  return { valid: true };
}
