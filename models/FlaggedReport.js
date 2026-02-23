import mongoose from 'mongoose';

const flaggedReportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    targetType: {
      type: String,
      required: true,
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    reason: {
      type: String,
      trim: true,
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'dismissed'],
      default: 'open',
      index: true
    }
  },
  { timestamps: true }
);

flaggedReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.FlaggedReport || mongoose.model('FlaggedReport', flaggedReportSchema);
