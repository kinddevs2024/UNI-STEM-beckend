import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  olympiadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Olympiad', index: true },
  eventType: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, trim: true, default: null },
  userAgent: { type: String, trim: true, default: null },
  deviceFingerprint: { type: String, trim: true, default: null }
}, { timestamps: false });

auditLogSchema.index({ attemptId: 1, timestamp: -1 });
auditLogSchema.index({ olympiadId: 1, timestamp: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
