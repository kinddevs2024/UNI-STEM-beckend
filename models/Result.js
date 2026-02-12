import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  olympiadId: {
    type: String,
    required: true
  },
  totalScore: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number, // Time in minutes
    default: 0
  },
  visible: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'pending', 'under-review', 'checked'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for faster queries
resultSchema.index({ userId: 1, olympiadId: 1 });
resultSchema.index({ olympiadId: 1, totalScore: -1 });

const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);

export default Result;

