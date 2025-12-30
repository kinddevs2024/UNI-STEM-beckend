/**
 * AntiCheat Trust Score Service
 * 
 * Aggregates all security signals into unified trust score (0-100)
 * and classifies attempts.
 */

import Attempt from '../models/Attempt.js';

// Violation weights (points deducted from 100)
const VIOLATION_WEIGHTS = {
  'TAB_HIDDEN': 5,
  'TAB_VISIBLE': 2,
  'WINDOW_BLUR': 5,
  'WINDOW_FOCUS': 2,
  'DEVTOOLS_OPEN': 15,
  'COPY_ATTEMPT': 10,
  'PASTE_ATTEMPT': 15,
  'CONTEXT_MENU': 5,
  'SUSPICIOUS_KEYBOARD_SHORTCUT': 10,
  'FRONT_CAMERA_REVOKED': 30,
  'SCREEN_SHARE_REVOKED': 30,
  'DISPLAY_SURFACE_INVALID': 25,
  'PROCTORING_VIOLATION': 25,
  'VM_DETECTED': 100, // Instant fail
  'HEARTBEAT_GAP': 10,
  'DEVICE_SWITCH_DETECTED': 50,
  'REPLAY_ATTEMPT': 40,
  'TIME_WINDOW_VIOLATION': 15
};

// Trust score thresholds
const TRUST_THRESHOLDS = {
  INVALID: 30,      // 0-30: invalid (auto-disqualify)
  SUSPICIOUS: 60,   // 31-60: suspicious (flag for review)
  CLEAN: 100        // 61-100: clean (normal processing)
};

/**
 * Calculate violation points from violations array
 * @param {Array} violations - Violations array
 * @returns {Object} - { totalPoints, breakdown }
 */
export function calculateViolationPoints(violations) {
  if (!violations || violations.length === 0) {
    return {
      totalPoints: 0,
      breakdown: []
    };
  }

  const breakdown = [];
  let totalPoints = 0;

  violations.forEach(violation => {
    const weight = VIOLATION_WEIGHTS[violation.type] || 5; // Default 5 points
    totalPoints += weight;
    
    breakdown.push({
      type: violation.type,
      points: weight,
      timestamp: violation.timestamp,
      details: violation.details
    });
  });

  return {
    totalPoints,
    breakdown
  };
}

/**
 * Calculate timing anomaly points
 * @param {Object} attempt - Attempt document
 * @returns {Number} - Points deducted (0 if no anomalies)
 */
export function calculateTimingAnomalyPoints(attempt) {
  let points = 0;

  // Check for missed heartbeats
  if (attempt.missedHeartbeats && attempt.missedHeartbeats > 0) {
    points += Math.min(attempt.missedHeartbeats * 5, 25); // Max 25 points
  }

  // Check verification status
  if (attempt.verificationStatus === 'failed') {
    points += 30; // Significant deduction for failed verification
  }

  return points;
}

/**
 * Calculate device drift points
 * @param {Object} attempt - Attempt document
 * @returns {Number} - Points deducted
 */
export function calculateDeviceDriftPoints(attempt) {
  if (attempt.deviceSwitchDetected) {
    return 50; // Major violation
  }
  return 0;
}

/**
 * Calculate proctoring violation points
 * @param {Object} attempt - Attempt document
 * @returns {Number} - Points deducted
 */
export function calculateProctoringPoints(attempt) {
  let points = 0;

  // Check proctoring violations
  const proctoringViolations = attempt.violations?.filter(v => 
    v.type.includes('CAMERA') || 
    v.type.includes('SCREEN') || 
    v.type === 'PROCTORING_VIOLATION' ||
    v.type === 'DISPLAY_SURFACE_INVALID'
  ) || [];

  // Sum points from proctoring violations
  proctoringViolations.forEach(v => {
    points += VIOLATION_WEIGHTS[v.type] || 25;
  });

  return points;
}

/**
 * Calculate total trust score for attempt
 * @param {Object} attempt - Attempt document
 * @returns {Object} - { trustScore, classification, breakdown }
 */
export function calculateTrustScore(attempt) {
  // Start with 100 points
  let trustScore = 100;

  // Calculate deduction components
  const violationPoints = calculateViolationPoints(attempt.violations || []);
  const timingAnomalyPoints = calculateTimingAnomalyPoints(attempt);
  const deviceDriftPoints = calculateDeviceDriftPoints(attempt);
  const proctoringPoints = calculateProctoringPoints(attempt);

  // Deduct points
  trustScore -= violationPoints.totalPoints;
  trustScore -= timingAnomalyPoints;
  trustScore -= deviceDriftPoints;
  trustScore -= proctoringPoints;

  // Ensure score is between 0 and 100
  trustScore = Math.max(0, Math.min(100, trustScore));

  // Classify attempt
  let classification;
  if (trustScore <= TRUST_THRESHOLDS.INVALID) {
    classification = 'invalid';
  } else if (trustScore <= TRUST_THRESHOLDS.SUSPICIOUS) {
    classification = 'suspicious';
  } else {
    classification = 'clean';
  }

  // Build breakdown
  const breakdown = {
    violationPoints: violationPoints.totalPoints,
    timingAnomalyPoints,
    deviceDriftPoints,
    proctoringPoints,
    totalDeducted: violationPoints.totalPoints + timingAnomalyPoints + deviceDriftPoints + proctoringPoints,
    violationBreakdown: violationPoints.breakdown
  };

  return {
    trustScore: Math.round(trustScore * 100) / 100, // Round to 2 decimals
    classification,
    breakdown
  };
}

/**
 * Calculate and store trust score on attempt
 * @param {String} attemptId - Attempt ID
 * @returns {Promise<Object>} - Trust score result
 */
export async function calculateAndStoreTrustScore(attemptId) {
  const connectMongoDB = (await import('./mongodb.js')).default;
  
  await connectMongoDB();

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  const trustScoreResult = calculateTrustScore(attempt);

  // Store on attempt
  attempt.trustScore = trustScoreResult.trustScore;
  attempt.trustClassification = trustScoreResult.classification;
  attempt.scoringBreakdown = trustScoreResult.breakdown;

  // Auto-disqualify if invalid
  if (trustScoreResult.classification === 'invalid' && attempt.status === 'started') {
    attempt.status = 'auto_disqualified';
  }

  await attempt.save();

  return trustScoreResult;
}
