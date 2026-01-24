import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  olympiadId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'started', 'completed', 'time_expired', 'violation_terminated', 'auto_disqualified', 'device_switch_detected', 'verification_failed', 'paused', 'admin_invalidated'],
    default: 'pending',
    required: true
  },
  startedAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true,
    index: true // Index for efficient timer queries
  },
  currentQuestionIndex: {
    type: Number,
    default: 0,
    min: 0
  },
  answeredQuestions: [{
    type: String
  }],
  skippedQuestions: [{
    type: String
  }],
  deviceFingerprint: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  violations: [{
    type: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  proctoringStatus: {
    frontCameraActive: {
      type: Boolean,
      default: false
    },
    backCameraActive: {
      type: Boolean,
      default: false
    },
    screenShareActive: {
      type: Boolean,
      default: false
    },
    displaySurface: {
      type: String,
      enum: ['monitor', 'browser', 'window', null],
      default: null
    },
    lastValidated: {
      type: Date,
      default: Date.now
    }
  },
  submittedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  // Device locking
  lockedDeviceFingerprint: {
    type: String,
    required: false // Will be set on start
  },
  deviceSwitchDetected: {
    type: Boolean,
    default: false
  },
  deviceSwitchTimestamp: {
    type: Date
  },
  // Heartbeat enforcement
  missedHeartbeats: {
    type: Number,
    default: 0
  },
  lastHeartbeatAt: {
    type: Date
  },
  // Trust scoring
  trustScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  trustClassification: {
    type: String,
    enum: ['clean', 'suspicious', 'invalid', null],
    default: null
  },
  scoringBreakdown: {
    type: mongoose.Schema.Types.Mixed
  },
  // Post-attempt verification
  verificationStatus: {
    type: String,
    enum: ['pending', 'passed', 'failed'],
    default: 'pending'
  },
  verificationResults: {
    type: mongoose.Schema.Types.Mixed
  },
  // Replay protection - question nonces (stored as Object, not Map for MongoDB compatibility)
  questionNonces: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Emergency controls
  pausedAt: {
    type: Date
  },
  pausedBy: {
    type: String
  },
  pauseReason: {
    type: String
  },
  adminSubmitted: {
    type: Boolean,
    default: false
  },
  invalidatedAt: {
    type: Date
  },
  invalidatedBy: {
    type: String
  },
  invalidationReason: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index to enforce one attempt per user per olympiad
attemptSchema.index({ userId: 1, olympiadId: 1 }, { unique: true });

// Index for querying active attempts
attemptSchema.index({ status: 1, endsAt: 1 });

// Force recompilation in dev
if (process.env.NODE_ENV === 'development') {
  delete mongoose.models.Attempt;
}

const Attempt = mongoose.models.Attempt || mongoose.model('Attempt', attemptSchema);

export default Attempt;
