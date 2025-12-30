import mongoose from 'mongoose';

const proctoringSessionSchema = new mongoose.Schema({
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    unique: true,
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
  frontCameraVideoPath: {
    type: String,
    trim: true
  },
  backCameraVideoPath: {
    type: String,
    trim: true
  },
  screenVideoPath: {
    type: String,
    trim: true
  },
  screenshots: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    imagePath: {
      type: String,
      required: true
    },
    questionIndex: {
      type: Number
    }
  }],
  violations: [{
    type: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'terminated'],
    default: 'active',
    required: true
  }
}, {
  timestamps: true
});

// Index for querying active sessions
proctoringSessionSchema.index({ status: 1, createdAt: -1 });

const ProctoringSession = mongoose.models.ProctoringSession || mongoose.model('ProctoringSession', proctoringSessionSchema);

export default ProctoringSession;
