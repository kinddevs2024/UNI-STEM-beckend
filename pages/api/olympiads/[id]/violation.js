import { protect } from '../../../../lib/auth.js';
import connectMongoDB from '../../../../lib/mongodb.js';
import Attempt from '../../../../models/Attempt.js';
import ProctoringSession from '../../../../models/ProctoringSession.js';
import { shouldTerminateAttempt } from '../../../../lib/anti-cheat-validator.js';
import { createAuditLog } from '../../../../lib/audit-logger.js';
import { validateViolationInput } from '../../../../lib/olympiad-input-validation.js';

import { handleCORS } from '../../../../lib/api-helpers.js';

/**
 * Report violation event
 * POST /api/olympiads/[id]/violation
 * 
 * Logs violation events (tab switch, devtools open, copy/paste, etc.)
 * May terminate attempt if violation threshold exceeded.
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        success: false,
        message: authResult.error 
      });
    }

    await connectMongoDB();

    const { id: olympiadId } = req.query;
    const userId = authResult.user._id;
    const { violationType, details } = req.body;

    const inputValidation = validateViolationInput(req.body);
    if (!inputValidation.valid) {
      return res.status(400).json({
        success: false,
        message: inputValidation.error,
      });
    }

    // Find attempt
    const attempt = await Attempt.findOne({
      userId,
      olympiadId
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false,
        message: 'Attempt not found',
        code: 'ATTEMPT_NOT_FOUND'
      });
    }

    // Don't log violations for completed/expired attempts
    if (attempt.status !== 'started') {
      return res.json({
        success: true,
        message: 'Violation logged but attempt is not active',
        attemptStatus: attempt.status
      });
    }

    // Add violation to attempt
    attempt.violations.push({
      type: violationType,
      timestamp: new Date(),
      details: details || {}
    });

    // Check if attempt should be terminated
    const highSeverityTypes = [
      'PROCTORING_VIOLATION',
      'FRONT_CAMERA_REVOKED',
      'SCREEN_SHARE_REVOKED',
      'DISPLAY_SURFACE_INVALID',
      'VM_DETECTED'
    ];

    const terminationCheck = shouldTerminateAttempt(attempt, 5, highSeverityTypes);
    
    if (terminationCheck.shouldTerminate) {
      attempt.status = 'violation_terminated';
      
      // Also update proctoring session if exists
      const proctoringSession = await ProctoringSession.findOne({ attemptId: attempt._id });
      if (proctoringSession) {
        proctoringSession.status = 'terminated';
        proctoringSession.violations.push({
          type: violationType,
          timestamp: new Date(),
          severity: highSeverityTypes.includes(violationType) ? 'high' : 'medium',
          details: details || {}
        });
        await proctoringSession.save();
      }
    }

    await attempt.save();

    // Create audit log
    await createAuditLog({
      attemptId: attempt._id,
      userId,
      olympiadId,
      eventType: 'violation',
      metadata: {
        violationType,
        details: details || {},
        violationCount: attempt.violations.length,
        terminated: terminationCheck.shouldTerminate
      },
      req
    });

    res.json({
      success: true,
      violationLogged: true,
      violationCount: attempt.violations.length,
      terminated: terminationCheck.shouldTerminate,
      attemptStatus: attempt.status,
      ...(terminationCheck.shouldTerminate && {
        message: 'Attempt terminated due to violations',
        reason: terminationCheck.reason
      })
    });
  } catch (error) {
    console.error('Report violation error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to report violation'
    });
  }
}
