/**
 * Device Locking Service
 * 
 * Binds attempt to device fingerprint, detects device switching,
 * prevents continuation on different device.
 */

import { generateFingerprintHash, validateFingerprint } from './device-fingerprint.js';
import { createAuditLog } from './audit-logger.js';

/**
 * Bind device fingerprint to attempt (called on start)
 * @param {Object} attempt - Attempt document
 * @param {Object} deviceFingerprintData - Device fingerprint data from client
 * @returns {String} - Locked fingerprint hash
 */
export function bindDeviceToAttempt(attempt, deviceFingerprintData) {
  if (!deviceFingerprintData || typeof deviceFingerprintData !== 'object') {
    throw new Error('Device fingerprint data is required');
  }

  const fingerprintHash = generateFingerprintHash(deviceFingerprintData);
  
  // Lock the fingerprint (immutable after start)
  attempt.lockedDeviceFingerprint = fingerprintHash;
  
  return fingerprintHash;
}

/**
 * Detect fingerprint drift between original and current
 * @param {String} originalFingerprint - Original locked fingerprint hash
 * @param {Object} currentFingerprintData - Current fingerprint data
 * @returns {Object} - { hasDrift, driftReason, currentHash }
 */
export function detectFingerprintDrift(originalFingerprint, currentFingerprintData) {
  if (!originalFingerprint) {
    return {
      hasDrift: false,
      driftReason: 'No original fingerprint to compare'
    };
  }

  if (!currentFingerprintData || typeof currentFingerprintData !== 'object') {
    return {
      hasDrift: true,
      driftReason: 'Current fingerprint data missing'
    };
  }

  const currentHash = generateFingerprintHash(currentFingerprintData);
  const hasDrift = originalFingerprint !== currentHash;

  return {
    hasDrift,
    driftReason: hasDrift ? 'Device fingerprint mismatch detected' : 'Fingerprint matches',
    currentHash,
    originalFingerprint
  };
}

/**
 * Validate device fingerprint for attempt
 * @param {Object} attempt - Attempt document
 * @param {Object} currentFingerprintData - Current fingerprint data from client
 * @returns {Object} - { valid, reason, driftDetected }
 */
export function validateDeviceFingerprint(attempt, currentFingerprintData) {
  if (!attempt.lockedDeviceFingerprint) {
    // Attempt started before device locking was implemented
    return {
      valid: true,
      reason: 'No locked fingerprint (legacy attempt)',
      driftDetected: false
    };
  }

  const drift = detectFingerprintDrift(attempt.lockedDeviceFingerprint, currentFingerprintData);

  if (drift.hasDrift) {
    return {
      valid: false,
      reason: drift.driftReason,
      driftDetected: true,
      originalFingerprint: attempt.lockedDeviceFingerprint,
      currentFingerprint: drift.currentHash
    };
  }

  return {
    valid: true,
    reason: 'Device fingerprint matches',
    driftDetected: false
  };
}

/**
 * Handle device switch detection
 * @param {Object} attempt - Attempt document
 * @param {Object} newFingerprintData - New fingerprint data
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} - { handled, violationCreated }
 */
export async function handleDeviceSwitch(attempt, newFingerprintData, req) {
  if (!attempt || attempt.status !== 'started') {
    return {
      handled: false,
      violationCreated: false,
      reason: 'Attempt is not active'
    };
  }

  // Mark device switch
  attempt.deviceSwitchDetected = true;
  attempt.deviceSwitchTimestamp = new Date();
  attempt.status = 'device_switch_detected';

  // Add violation
  const drift = detectFingerprintDrift(attempt.lockedDeviceFingerprint, newFingerprintData);
  attempt.violations.push({
    type: 'DEVICE_SWITCH_DETECTED',
    timestamp: new Date(),
    details: {
      originalFingerprint: attempt.lockedDeviceFingerprint,
      newFingerprint: drift.currentHash,
      reason: drift.driftReason
    }
  });

  await attempt.save();

  // Log to audit
  await createAuditLog({
    attemptId: attempt._id,
    userId: attempt.userId,
    olympiadId: attempt.olympiadId,
    eventType: 'device_switch',
    metadata: {
      originalFingerprint: attempt.lockedDeviceFingerprint,
      newFingerprint: drift.currentHash,
      reason: 'Device fingerprint mismatch detected'
    },
    req
  });

  return {
    handled: true,
    violationCreated: true,
    attemptStatus: attempt.status
  };
}
