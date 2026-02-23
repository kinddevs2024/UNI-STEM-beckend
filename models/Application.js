import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    fromStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true
    },
    toUniversity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UniversityProfile',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending'
    },
    initiatedBy: {
      type: String,
      enum: ['student', 'university'],
      required: true
    },
    message: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

applicationSchema.index({ fromStudent: 1, toUniversity: 1, createdAt: -1 });
applicationSchema.index({ toUniversity: 1, status: 1, createdAt: -1 });
applicationSchema.index({ fromStudent: 1, status: 1, createdAt: -1 });

export default mongoose.models.Application || mongoose.model('Application', applicationSchema);
