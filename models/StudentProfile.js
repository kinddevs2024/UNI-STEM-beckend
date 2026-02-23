import mongoose from 'mongoose';

const certificationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    issuer: { type: String, trim: true },
    issueDate: { type: Date },
    credentialId: { type: String, trim: true },
    link: { type: String, trim: true }
  },
  { _id: false }
);

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    passport: { type: String, trim: true, select: false, default: '' },
    birthDate: { type: Date },
    country: { type: String, trim: true, default: '' },
    education: [{ type: String, trim: true }],
    GPA: { type: Number, min: 0, max: 4, default: null },
    skills: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    certifications: [certificationSchema],
    internships: [{ type: String, trim: true }],
    projects: [{ type: String, trim: true }],
    awards: [{ type: String, trim: true }],
    motivationText: { type: String, trim: true, default: '' },
    videoPresentationLink: { type: String, trim: true, default: '' },
    ratingScore: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false, index: true },
    visibilitySettings: {
      passportVisible: { type: Boolean, default: false },
      GPAVisible: { type: Boolean, default: true },
      certificationsVisible: { type: Boolean, default: true },
      internshipsVisible: { type: Boolean, default: true },
      projectsVisible: { type: Boolean, default: true },
      awardsVisible: { type: Boolean, default: true },
      contactVisible: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

studentProfileSchema.index({ country: 1 });
studentProfileSchema.index({ ratingScore: -1 });
studentProfileSchema.index({ GPA: -1 });
studentProfileSchema.index({ createdAt: -1 });
studentProfileSchema.index({ skills: 1 });
studentProfileSchema.index({ languages: 1 });
studentProfileSchema.index({ firstName: 'text', lastName: 'text', country: 'text', skills: 'text' });

export default mongoose.models.StudentProfile || mongoose.model('StudentProfile', studentProfileSchema);
