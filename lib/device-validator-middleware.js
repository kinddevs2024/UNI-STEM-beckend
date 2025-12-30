/**
 * Device Validation Middleware
 * 
 * Validates device fingerprint on all attempt-related endpoints.
 */

import { validateDeviceFingerprint, handleDeviceSwitch } from './device-locking.js';

/**
 * Middleware to validate device fingerprint for attempt requests
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 * @returns {Promise<void>}
 */
export async function validateDeviceForAttempt(req, res, next) {
  try {
    const attempt = req.attempt; // Should be set by endpoint handler
    const deviceFingerprint = req.body?.deviceFingerprint;

    if (!attempt) {
      return next(); // Let endpoint handle attempt fetching
    }

    // Validate device fingerprint
    if (deviceFingerprint) {
      const validation = validateDeviceFingerprint(attempt, deviceFingerprint);

      if (!validation.valid) {
        // Handle device switch
        if (validation.driftDetected) {
          await handleDeviceSwitch(attempt, deviceFingerprint, req);

          return res.status(403).json({
            success: false,
            message: 'Device switch detected. Attempt cannot continue on different device.',
            code: 'DEVICE_SWITCH_DETECTED',
            attemptStatus: attempt.status
          });
        }

        return res.status(400).json({
          success: false,
          message: validation.reason,
          code: 'DEVICE_VALIDATION_FAILED'
        });
      }
    }

    // Check if attempt already has device switch detected
    if (attempt.deviceSwitchDetected && attempt.status === 'device_switch_detected') {
      return res.status(403).json({
        success: false,
        message: 'Device switch detected. Attempt cannot continue.',
        code: 'DEVICE_SWITCH_DETECTED',
        attemptStatus: attempt.status
      });
    }

    next();
  } catch (error) {
    console.error('Device validation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Device validation error'
    });
  }
}
