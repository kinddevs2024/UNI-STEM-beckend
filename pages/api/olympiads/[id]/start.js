import connectMongoDB from '../../../../lib/mongodb.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { protect } from '../../../../lib/auth.js';
import Attempt from '../../../../models/Attempt.js';
import ProctoringSession from '../../../../models/ProctoringSession.js';
import { validateCanStart } from '../../../../lib/anti-cheat-validator.js';
import { calculateEndTime } from '../../../../lib/timer-service.js';
import { generateFingerprintHash, getClientIP, detectVM } from '../../../../lib/device-fingerprint.js';
import { bindDeviceToAttempt } from '../../../../lib/device-locking.js';
import { createAuditLog } from '../../../../lib/audit-logger.js';
import crypto from 'crypto';

import { handleCORS } from '../../../../lib/api-helpers.js';

/**
 * Start an olympiad attempt
 * POST /api/olympiads/[id]/start
 * 
 * Creates a new attempt record with server-authoritative timer.
 * Requires proctoring to be set up (camera + screen share with displaySurface === "monitor").
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
    const { proctoringStatus, deviceFingerprint } = req.body;

    // Validate olympiad exists
    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Validate olympiad is published and active
    if (olympiad.status !== 'published' && olympiad.status !== 'active') {
      return res.status(400).json({ 
        success: false,
        message: `Olympiad is not available. Status: ${olympiad.status}` 
      });
    }

    // Validate olympiad has questions
    if (!olympiad.questions || olympiad.questions.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Olympiad has no questions' 
      });
    }

    // Check if olympiad is within time window
    const now = new Date();
    const startTime = new Date(olympiad.startTime);
    const endTime = new Date(olympiad.endTime);

    if (now < startTime) {
      return res.status(400).json({ 
        success: false,
        message: `Olympiad has not started yet. Start time: ${startTime.toISOString()}` 
      });
    }

    if (now > endTime) {
      return res.status(400).json({ 
        success: false,
        message: `Olympiad has ended. End time: ${endTime.toISOString()}` 
      });
    }

    // Validate device fingerprint
    if (!deviceFingerprint || typeof deviceFingerprint !== 'object') {
      return res.status(400).json({ 
        success: false,
        message: 'Device fingerprint is required' 
      });
    }

    // Detect VM/emulator (warning only, don't block)
    const vmDetection = detectVM(deviceFingerprint);
    if (vmDetection.isVM && vmDetection.confidence > 0.7) {
      // Log but don't block (could be legitimate)
      console.warn(`VM detected for user ${userId}:`, vmDetection.reasons);
    }

    // Validate proctoring status
    if (!proctoringStatus || typeof proctoringStatus !== 'object') {
      return res.status(400).json({ 
        success: false,
        message: 'Proctoring status is required' 
      });
    }

    // Validate can start (checks one-attempt rule and proctoring)
    const validation = await validateCanStart(userId, olympiadId, proctoringStatus);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false,
        message: validation.error,
        code: validation.code,
        ...(validation.attempt && { attempt: validation.attempt }),
        ...(validation.proctoringErrors && { proctoringErrors: validation.proctoringErrors })
      });
    }

    // Generate device fingerprint hash
    const fingerprintHash = generateFingerprintHash(deviceFingerprint);

    // Get client IP
    const ipAddress = getClientIP(req);

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Calculate end time (server-authoritative)
    const startedAt = new Date();
    const durationSeconds = olympiad.duration || 3600; // Default 1 hour
    const endsAt = calculateEndTime(startedAt, durationSeconds);

    // Create attempt
    const attempt = new Attempt({
      userId,
      olympiadId,
      status: 'started',
      startedAt,
      endsAt,
      currentQuestionIndex: 0,
      answeredQuestions: [],
      skippedQuestions: [],
      deviceFingerprint: fingerprintHash,
      ipAddress,
      sessionToken,
      violations: [],
      proctoringStatus: {
        frontCameraActive: proctoringStatus.frontCameraActive || false,
        backCameraActive: proctoringStatus.backCameraActive || false,
        screenShareActive: proctoringStatus.screenShareActive || false,
        displaySurface: proctoringStatus.displaySurface || null,
        lastValidated: new Date()
      },
      questionNonces: {}
    });

    // Bind device to attempt (device locking)
    bindDeviceToAttempt(attempt, deviceFingerprint);

    await attempt.save();

    // Create proctoring session
    const proctoringSession = new ProctoringSession({
      attemptId: attempt._id,
      userId,
      olympiadId,
      status: 'active',
      screenshots: [],
      violations: []
    });

    await proctoringSession.save();

    // Create audit log
    await createAuditLog({
      attemptId: attempt._id,
      userId,
      olympiadId,
      eventType: 'start',
      metadata: {
        deviceFingerprint: fingerprintHash,
        proctoringStatus: attempt.proctoringStatus,
        vmDetection: vmDetection.isVM ? vmDetection : null
      },
      req
    });

    res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        endsAt: attempt.endsAt.toISOString(),
        currentQuestionIndex: attempt.currentQuestionIndex,
        sessionToken: attempt.sessionToken,
        durationSeconds
      }
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    
    // Handle unique constraint violation (one attempt rule)
    if (error.code === 11000 || error.name === 'MongoServerError') {
      return res.status(400).json({ 
        success: false,
        message: 'You have already attempted this olympiad',
        code: 'ALREADY_ATTEMPTED'
      });
    }

    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to start attempt'
    });
  }
}
