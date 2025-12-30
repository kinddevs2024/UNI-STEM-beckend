import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  olympiadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Olympiad',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
    // Examples: 'start', 'answer', 'skip', 'tab_switch', 'disconnect', 
    // 'devtools_open', 'copy', 'paste', 'window_blur', 'time_expired', etc.
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
    // Flexible object to store event-specific data
  },
  ipAddress: {
    type: String,
    index: true
  },
  userAgent: {
    type: String
  },
  deviceFingerprint: {
    type: String,
    index: true
  }
}, {
  timestamps: false // Don't use mongoose timestamps, use explicit timestamp field for audit integrity
});

// Compound index for efficient querying by attempt and time
auditLogSchema.index({ attemptId: 1, timestamp: -1 });

// Index for querying by event type and time
auditLogSchema.index({ eventType: 1, timestamp: -1 });

// Index for querying all logs for an olympiad
auditLogSchema.index({ olympiadId: 1, timestamp: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
