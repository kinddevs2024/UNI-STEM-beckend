import connectMongoDB from '../../../../lib/mongodb.js';
import { findOlympiadById } from '../../../../lib/olympiad-helper.js';
import { protect } from '../../../../lib/auth.js';
import Attempt from '../../../../models/Attempt.js';
import ProctoringSession from '../../../../models/ProctoringSession.js';
import { validateCanStart } from '../../../../lib/anti-cheat-validator.js';
import { calculateEndTime } from '../../../../lib/timer-service.js';
import { generateFingerprintHash, getClientIP, detectVM } from '../../../../lib/device-fingerprint.js';
import { bindDeviceToAttempt, validateDeviceFingerprint } from '../../../../lib/device-locking.js';
import { createAuditLog } from '../../../../lib/audit-logger.js';
import { getSystemControlsSync } from '../../../../lib/system-controls.js';
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
    const controls = getSystemControlsSync();
    const { proctoringStatus, deviceFingerprint } = req.body;

    const isStudent = authResult.user?.role === 'student';
    if (controls.requireProfileCompletion && isStudent) {
      const profileFields = [
        'firstName',
        'secondName',
        'tel',
        'address',
        'schoolName',
        'dateBorn',
        'gender'
      ];

      const missingFields = profileFields.filter((field) => {
        const value = authResult.user?.[field];
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        return false;
      });

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          code: 'PROFILE_INCOMPLETE',
          message: 'Please complete your profile before starting olympiad.',
          missingFields,
        });
      }
    }

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

    // Restart existing attempt if eligible (empty attempt that failed verification)
    if (validation.restart && validation.attempt) {
      const existingAttempt = await Attempt.findById(validation.attempt._id);
      if (!existingAttempt) {
        return res.status(404).json({
          success: false,
          message: 'Attempt not found',
          code: 'ATTEMPT_NOT_FOUND'
        });
      }

      const fingerprintHash = generateFingerprintHash(deviceFingerprint);
      const ipAddress = getClientIP(req);
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const startedAt = new Date();
      const durationSeconds = olympiad.duration || 3600; // Default 1 hour
      const endsAt = calculateEndTime(startedAt, durationSeconds);

      existingAttempt.status = 'started';
      existingAttempt.startedAt = startedAt;
      existingAttempt.endsAt = endsAt;
      existingAttempt.currentQuestionIndex = 0;
      existingAttempt.answeredQuestions = [];
      existingAttempt.skippedQuestions = [];
      existingAttempt.deviceFingerprint = fingerprintHash;
      existingAttempt.ipAddress = ipAddress;
      existingAttempt.sessionToken = sessionToken;
      existingAttempt.violations = [];
      existingAttempt.deviceSwitchDetected = false;
      existingAttempt.deviceSwitchTimestamp = null;
      existingAttempt.missedHeartbeats = 0;
      existingAttempt.lastHeartbeatAt = null;
      existingAttempt.trustScore = null;
      existingAttempt.trustClassification = null;
      existingAttempt.scoringBreakdown = null;
      existingAttempt.verificationStatus = 'pending';
      existingAttempt.verificationResults = null;
      existingAttempt.submittedAt = null;
      existingAttempt.completedAt = null;
      existingAttempt.questionNonces = {};
      existingAttempt.invalidatedAt = null;
      existingAttempt.invalidatedBy = null;
      existingAttempt.invalidationReason = null;
      existingAttempt.adminSubmitted = false;
      existingAttempt.proctoringStatus = {
        frontCameraActive: proctoringStatus.frontCameraActive || false,
        backCameraActive: proctoringStatus.backCameraActive || false,
        screenShareActive: proctoringStatus.screenShareActive || false,
        displaySurface: proctoringStatus.displaySurface || null,
        lastValidated: new Date()
      };

      bindDeviceToAttempt(existingAttempt, deviceFingerprint);
      await existingAttempt.save();

      const proctoringSession = await ProctoringSession.findOne({ attemptId: existingAttempt._id });
      if (proctoringSession) {
        proctoringSession.status = 'active';
        proctoringSession.screenshots = [];
        proctoringSession.violations = [];
        await proctoringSession.save();
      } else {
        const newSession = new ProctoringSession({
          attemptId: existingAttempt._id,
          userId,
          olympiadId,
          status: 'active',
          screenshots: [],
          violations: []
        });
        await newSession.save();
      }

      await createAuditLog({
        attemptId: existingAttempt._id,
        userId,
        olympiadId,
        eventType: 'restart',
        metadata: {
          deviceFingerprint: fingerprintHash,
          proctoringStatus: existingAttempt.proctoringStatus
        },
        req
      });

      return res.json({
        success: true,
        restart: true,
        attempt: {
          _id: existingAttempt._id,
          status: existingAttempt.status,
          startedAt: existingAttempt.startedAt.toISOString(),
          endsAt: existingAttempt.endsAt.toISOString(),
          currentQuestionIndex: existingAttempt.currentQuestionIndex,
          sessionToken: existingAttempt.sessionToken,
          durationSeconds
        }
      });
    }

    // Resume existing attempt if still active
    if (validation.resume && validation.attempt) {
      const existingAttempt = await Attempt.findById(validation.attempt._id);
      if (!existingAttempt) {
        return res.status(404).json({
          success: false,
          message: 'Attempt not found',
          code: 'ATTEMPT_NOT_FOUND'
        });
      }
      const deviceCheck = validateDeviceFingerprint(existingAttempt, deviceFingerprint);
      if (!deviceCheck.valid) {
        const answeredCount = existingAttempt.answeredQuestions?.length || 0;
        const skippedCount = existingAttempt.skippedQuestions?.length || 0;
        const canRebindFingerprint = answeredCount === 0 && skippedCount === 0;

        if (canRebindFingerprint) {
          const previousLockedFingerprint = existingAttempt.lockedDeviceFingerprint;
          const newFingerprintHash = generateFingerprintHash(deviceFingerprint);
          existingAttempt.deviceFingerprint = newFingerprintHash;
          bindDeviceToAttempt(existingAttempt, deviceFingerprint);
          await existingAttempt.save();

          await createAuditLog({
            attemptId: existingAttempt._id,
            userId,
            olympiadId,
            eventType: 'device_rebind',
            metadata: {
              previousFingerprint: previousLockedFingerprint,
              newFingerprint: newFingerprintHash
            },
            req
          });
        } else {
          return res.status(403).json({
            success: false,
            message: deviceCheck.reason || 'Device fingerprint mismatch detected',
            code: 'DEVICE_FINGERPRINT_MISMATCH'
          });
        }
      }

      const startedAt = new Date(existingAttempt.startedAt);
      const endsAt = new Date(existingAttempt.endsAt);
      const durationSeconds = Math.max(0, Math.floor((endsAt - startedAt) / 1000));

      return res.json({
        success: true,
        resume: true,
        attempt: {
          _id: existingAttempt._id,
          status: existingAttempt.status,
          startedAt: startedAt.toISOString(),
          endsAt: endsAt.toISOString(),
          currentQuestionIndex: existingAttempt.currentQuestionIndex || 0,
          sessionToken: existingAttempt.sessionToken,
          durationSeconds
        }
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
