import mongoose from 'mongoose';

const sessionHeartbeatSchema = new mongoose.Schema({
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    index: true
  },
  socketId: {
    type: String,
    required: true,
    index: true
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected'],
    default: 'connected',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for upsert by attemptId + socketId (heartbeat findOneAndUpdate)
sessionHeartbeatSchema.index({ attemptId: 1, socketId: 1 }, { unique: true });

// Compound index for querying heartbeats by attempt and status
sessionHeartbeatSchema.index({ attemptId: 1, status: 1, lastSeenAt: -1 });

// TTL index to auto-delete old heartbeats after 24 hours
sessionHeartbeatSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const SessionHeartbeat = mongoose.models.SessionHeartbeat || mongoose.model('SessionHeartbeat', sessionHeartbeatSchema);

export default SessionHeartbeat;
