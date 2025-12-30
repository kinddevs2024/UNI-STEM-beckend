/**
 * Proctoring Service - Validates and manages proctoring requirements
 * 
 * This service validates that all proctoring requirements are met:
 * - Front camera must be active
 * - Screen share must be active with displaySurface === "monitor"
 * - Back camera optional but logged if available
 * - Permission revocation detection
 */

/**
 * Validate proctoring status
 * @param {Object} proctoringStatus - Proctoring status object
 * @returns {Object} - Validation result { valid, errors }
 */
export function validateProctoringStatus(proctoringStatus) {
  const errors = [];
  
  if (!proctoringStatus) {
    return {
      valid: false,
      errors: ['Proctoring status not provided']
    };
  }
  
  // Front camera is mandatory
  if (!proctoringStatus.frontCameraActive) {
    errors.push('Front camera is not active');
  }
  
  // Screen share is mandatory
  if (!proctoringStatus.screenShareActive) {
    errors.push('Screen share is not active');
  }
  
  // Display surface must be monitor (not browser or window)
  if (proctoringStatus.displaySurface !== 'monitor') {
    errors.push('Screen share must be full screen (monitor), not browser or window');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if proctoring is ready to start attempt
 * @param {Object} proctoringStatus - Proctoring status object
 * @returns {Boolean} - True if ready
 */
export function isProctoringReady(proctoringStatus) {
  const validation = validateProctoringStatus(proctoringStatus);
  return validation.valid;
}

/**
 * Update proctoring status with validation
 * @param {Object} currentStatus - Current proctoring status
 * @param {Object} updates - Updates to apply
 * @returns {Object} - Updated status with validation
 */
export function updateProctoringStatus(currentStatus, updates) {
  const updated = {
    ...currentStatus,
    ...updates,
    lastValidated: new Date()
  };
  
  const validation = validateProctoringStatus(updated);
  
  return {
    status: updated,
    validation
  };
}

/**
 * Check if proctoring violation occurred (permission revoked or invalid display surface)
 * @param {Object} previousStatus - Previous proctoring status
 * @param {Object} currentStatus - Current proctoring status
 * @returns {Object|null} - Violation object if detected, null otherwise
 */
export function detectProctoringViolation(previousStatus, currentStatus) {
  if (!previousStatus || !currentStatus) {
    return null;
  }
  
  const violations = [];
  
  // Check if front camera was active and now inactive
  if (previousStatus.frontCameraActive && !currentStatus.frontCameraActive) {
    violations.push({
      type: 'FRONT_CAMERA_REVOKED',
      severity: 'high',
      message: 'Front camera permission was revoked'
    });
  }
  
  // Check if screen share was active and now inactive
  if (previousStatus.screenShareActive && !currentStatus.screenShareActive) {
    violations.push({
      type: 'SCREEN_SHARE_REVOKED',
      severity: 'high',
      message: 'Screen share permission was revoked'
    });
  }
  
  // Check if display surface changed from monitor to something else
  if (
    previousStatus.displaySurface === 'monitor' &&
    currentStatus.displaySurface !== 'monitor' &&
    currentStatus.screenShareActive
  ) {
    violations.push({
      type: 'DISPLAY_SURFACE_INVALID',
      severity: 'high',
      message: 'Screen share changed from full screen (monitor) to invalid surface'
    });
  }
  
  if (violations.length > 0) {
    return {
      violations,
      timestamp: new Date()
    };
  }
  
  return null;
}

/**
 * Get proctoring requirements description
 * @returns {Object} - Requirements object
 */
export function getProctoringRequirements() {
  return {
    required: {
      frontCamera: true,
      screenShare: true,
      displaySurface: 'monitor'
    },
    optional: {
      backCamera: true
    },
    description: 'You must share your front camera and full screen (monitor) for proctoring. Back camera is optional but recommended.'
  };
}
