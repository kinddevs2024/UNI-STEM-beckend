import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  olympiadId: {
    type: String,
    required: true
  },
  questionId: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  gradedBy: {
    type: String
  },
  gradedAt: {
    type: Date
  },
  comment: {
    type: String,
    trim: true
  },
  isAI: {
    type: Boolean,
    default: false
  },
  aiProbability: {
    type: Number,
    default: 0
  },
  aiCheckedBy: {
    type: String
  },
  aiCheckedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
submissionSchema.index({ userId: 1, olympiadId: 1, questionId: 1 });

const Submission = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);

export default Submission;

