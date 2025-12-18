import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    issuedBy: {
      type: String,
      trim: true,
    },
    issuedDate: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

const portfolioSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      index: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function (v) {
          // Alphanumeric and hyphens only, 3-50 characters
          return /^[a-z0-9-]{3,50}$/.test(v);
        },
        message:
          "Slug must be 3-50 characters and contain only lowercase letters, numbers, and hyphens",
      },
    },
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "private",
      index: true,
    },
    layout: {
      // Support both legacy string format and new object format
      // Legacy: "single-page" or "multi-page" (string)
      // New: { type: "single-page"|"multi-page", blocks: [...] }
      type: mongoose.Schema.Types.Mixed,
      default: "single-page",
      // New block-based structure (when layout is an object)
      // Access via layout.blocks when layout is an object
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    theme: {
      name: {
        type: String,
        trim: true,
      },
      colors: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      typography: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      spacing: {
        type: String,
        enum: ["compact", "comfortable", "spacious"],
        default: "comfortable",
      },
      // Legacy support
      fonts: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      styles: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    hero: {
      title: String,
      subtitle: String,
      image: String,
      ctaText: String,
      ctaLink: String,
    },
    sections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    certificates: {
      type: [certificateSchema],
      default: [],
    },
    animations: {
      enabled: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: ["fade", "slide", "none"],
        default: "fade",
      },
    },
    // Legacy field - kept for backward compatibility
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Portfolio-level verification
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    // ILS Level (1-9)
    ilsLevel: {
      type: Number,
      min: 1,
      max: 9,
      default: 1,
    },
    // Portfolio Rating (calculated)
    portfolioRating: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
portfolioSchema.index({ studentId: 1, visibility: 1 });
portfolioSchema.index({ studentId: 1, isPublic: 1 }); // Legacy support
portfolioSchema.index({ slug: 1, visibility: 1 });
portfolioSchema.index({ slug: 1, isPublic: 1 }); // Legacy support
portfolioSchema.index({ studentId: 1, status: 1 });
portfolioSchema.index({ "layout.blocks.id": 1 }); // For block queries
portfolioSchema.index({ verificationStatus: 1, portfolioRating: -1 }); // For ratings/verification queries
portfolioSchema.index({ portfolioRating: -1 }); // For global ratings

const Portfolio =
  mongoose.models.Portfolio || mongoose.model("Portfolio", portfolioSchema);

export default Portfolio;
