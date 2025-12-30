/**
 * Device Fingerprinting Service
 * 
 * Generates and validates device fingerprints to detect:
 * - Account sharing attempts
 * - Device changes during attempt
 * - VM/Emulator environments
 */

import crypto from 'crypto';

/**
 * Generate device fingerprint hash from fingerprint data
 * @param {Object} fingerprintData - Device fingerprint data from client
 * @returns {String} - SHA-256 hash of fingerprint
 */
export function generateFingerprintHash(fingerprintData) {
  if (!fingerprintData || typeof fingerprintData !== 'object') {
    throw new Error('Fingerprint data is required');
  }
  
  // Create a stable string representation
  const fingerprintString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
  
  // Generate SHA-256 hash
  const hash = crypto.createHash('sha256');
  hash.update(fingerprintString);
  
  return hash.digest('hex');
}

/**
 * Detect if device might be a VM or emulator
 * @param {Object} fingerprintData - Device fingerprint data
 * @returns {Object} - Detection result { isVM, confidence, reasons }
 */
export function detectVM(fingerprintData) {
  const reasons = [];
  let confidence = 0;
  
  if (!fingerprintData) {
    return {
      isVM: false,
      confidence: 0,
      reasons: ['No fingerprint data provided']
    };
  }
  
  // Check hardware concurrency (VMs often have 1-2 cores)
  if (fingerprintData.hardwareConcurrency !== undefined) {
    if (fingerprintData.hardwareConcurrency <= 2) {
      reasons.push('Low hardware concurrency (possibly VM)');
      confidence += 0.2;
    }
  }
  
  // Check device memory (VMs often have limited memory)
  if (fingerprintData.deviceMemory !== undefined) {
    if (fingerprintData.deviceMemory <= 2) {
      reasons.push('Low device memory (possibly VM)');
      confidence += 0.2;
    }
  }
  
  // Check user agent for VM indicators
  const userAgent = fingerprintData.userAgent || '';
  const vmIndicators = [
    'virtualbox',
    'vmware',
    'qemu',
    'kvm',
    'xen',
    'parallels',
    'bochs',
    'emulator'
  ];
  
  const lowerUA = userAgent.toLowerCase();
  for (const indicator of vmIndicators) {
    if (lowerUA.includes(indicator)) {
      reasons.push(`User agent contains VM indicator: ${indicator}`);
      confidence += 0.5;
      break;
    }
  }
  
  // Check WebGL vendor/renderer for VM indicators
  if (fingerprintData.webglVendor) {
    const lowerVendor = fingerprintData.webglVendor.toLowerCase();
    for (const indicator of vmIndicators) {
      if (lowerVendor.includes(indicator)) {
        reasons.push(`WebGL vendor contains VM indicator: ${indicator}`);
        confidence += 0.3;
        break;
      }
    }
  }
  
  if (fingerprintData.webglRenderer) {
    const lowerRenderer = fingerprintData.webglRenderer.toLowerCase();
    for (const indicator of vmIndicators) {
      if (lowerRenderer.includes(indicator)) {
        reasons.push(`WebGL renderer contains VM indicator: ${indicator}`);
        confidence += 0.3;
        break;
      }
    }
  }
  
  // Check screen resolution (VMs often have common resolutions)
  if (fingerprintData.screenWidth && fingerprintData.screenHeight) {
    const commonVMResolutions = [
      '1024x768',
      '1280x720',
      '1280x1024',
      '1920x1080'
    ];
    const resolution = `${fingerprintData.screenWidth}x${fingerprintData.screenHeight}`;
    if (commonVMResolutions.includes(resolution)) {
      reasons.push(`Common VM resolution detected: ${resolution}`);
      confidence += 0.1;
    }
  }
  
  // Consider it a VM if confidence > 0.5
  const isVM = confidence > 0.5;
  
  return {
    isVM,
    confidence: Math.min(confidence, 1.0),
    reasons
  };
}

/**
 * Validate device fingerprint matches stored fingerprint
 * @param {String} storedFingerprint - Stored fingerprint hash
 * @param {Object} currentFingerprintData - Current fingerprint data
 * @returns {Object} - Validation result { matches, reason }
 */
export function validateFingerprint(storedFingerprint, currentFingerprintData) {
  if (!storedFingerprint) {
    return {
      matches: false,
      reason: 'No stored fingerprint found'
    };
  }
  
  if (!currentFingerprintData) {
    return {
      matches: false,
      reason: 'No current fingerprint data provided'
    };
  }
  
  const currentHash = generateFingerprintHash(currentFingerprintData);
  const matches = storedFingerprint === currentHash;
  
  return {
    matches,
    reason: matches ? 'Fingerprint matches' : 'Fingerprint does not match',
    storedFingerprint,
    currentFingerprint: currentHash
  };
}

/**
 * Extract IP address from request
 * @param {Object} req - Express request object
 * @returns {String} - IP address
 */
export function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}
