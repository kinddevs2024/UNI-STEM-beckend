import mongoose from 'mongoose';

const ownerAuditLogSchema = new mongoose.Schema({
  actorId: {
    type: String,
    required: true,
    index: true,
  },
  actorRole: {
    type: String,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    required: true,
    index: true,
  },
  targetId: {
    type: String,
    required: false,
    index: true,
  },
  message: {
    type: String,
    required: false,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
    index: true,
  },
  userAgent: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
}, {
  timestamps: false,
});

ownerAuditLogSchema.index({ action: 1, timestamp: -1 });
ownerAuditLogSchema.index({ targetType: 1, targetId: 1, timestamp: -1 });

if (process.env.NODE_ENV === 'development') {
  delete mongoose.models.OwnerAuditLog;
}

const OwnerAuditLog = mongoose.models.OwnerAuditLog || mongoose.model('OwnerAuditLog', ownerAuditLogSchema);

export default OwnerAuditLog;
