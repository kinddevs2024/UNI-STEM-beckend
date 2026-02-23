import mongoose from 'mongoose';

const accessRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UniversityProfile',
      required: true,
      index: true
    },
    requestedFields: [{ type: String, required: true }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    }
  },
  { timestamps: true }
);

accessRequestSchema.index({ student: 1, university: 1, status: 1, createdAt: -1 });

export default mongoose.models.AccessRequest || mongoose.model('AccessRequest', accessRequestSchema);
