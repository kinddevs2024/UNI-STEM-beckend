import mongoose from "mongoose";

const universityContactAccessSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "University ID is required"],
      index: true,
    },
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: [true, "Portfolio ID is required"],
      index: true,
    },
    unlocked: {
      type: Boolean,
      default: false,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one university can have one access record per portfolio
universityContactAccessSchema.index(
  { universityId: 1, portfolioId: 1 },
  { unique: true }
);

// Index for portfolio queries
universityContactAccessSchema.index({ portfolioId: 1 });

const UniversityContactAccess =
  mongoose.models.UniversityContactAccess ||
  mongoose.model("UniversityContactAccess", universityContactAccessSchema);

export default UniversityContactAccess;

