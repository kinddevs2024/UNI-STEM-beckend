import { connectDB } from '../../../../lib/json-db.js';
import { protect } from '../../../../lib/auth.js';
import connectMongoDB from '../../../../lib/mongodb.js';
import Attempt from '../../../../models/Attempt.js';
import { validateAttemptActive } from '../../../../lib/anti-cheat-validator.js';
import { getTimerStatus, isTimeExpired } from '../../../../lib/timer-service.js';
import { checkHeartbeatCompliance } from '../../../../lib/heartbeat-enforcement.js';

/**
 * Get current attempt status
 * GET /api/olympiads/[id]/attempt
 * 
 * Returns current attempt status, timer information, and question progress.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // Find attempt
    const attempt = await Attempt.findOne({
      userId,
      olympiadId
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false,
        message: 'No attempt found for this olympiad',
        code: 'ATTEMPT_NOT_FOUND'
      });
    }

    // Check if time expired and update status if needed
    if (attempt.status === 'started' && isTimeExpired(attempt.endsAt)) {
      attempt.status = 'time_expired';
      await attempt.save();
    }

    // Check heartbeat compliance
    const heartbeatCompliance = await checkHeartbeatCompliance(attempt._id);
    if (!heartbeatCompliance.compliant && attempt.status === 'started') {
      // Update missed heartbeats count
      attempt.missedHeartbeats = heartbeatCompliance.missedHeartbeats;
      attempt.lastHeartbeatAt = heartbeatCompliance.lastSeenAt;
      await attempt.save();
    }

    // Get timer status
    const timerStatus = getTimerStatus(attempt.endsAt);

    // Validate attempt is active (but still return data even if not active)
    const validation = validateAttemptActive(attempt);

    res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        endsAt: attempt.endsAt.toISOString(),
        currentQuestionIndex: attempt.currentQuestionIndex,
        answeredQuestions: attempt.answeredQuestions,
        skippedQuestions: attempt.skippedQuestions,
        violations: attempt.violations.length,
        proctoringStatus: attempt.proctoringStatus,
        submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
        completedAt: attempt.completedAt ? attempt.completedAt.toISOString() : null
      },
      timer: timerStatus,
      valid: validation.valid,
      heartbeatCompliance,
      ...(validation.error && { error: validation.error, code: validation.code })
    });
  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to get attempt status'
    });
  }
}
