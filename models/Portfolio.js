import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    fileUrl: {
      type: String,
      required: false, // Always optional - validation handled in pre-save hook
      trim: true,
    },
    fileName: {
      type: String,
      required: false, // Always optional - validation handled in pre-save hook
      trim: true,
    },
    fileType: {
      type: String,
      required: false, // Always optional - validation handled in pre-save hook
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
  { _id: true, validateBeforeSave: true }
);

// Note: Certificate fields are optional in the schema
// Pre-save hook filters out incomplete new certificates (without _id)
// Existing certificates (with _id) are preserved even if incomplete
// Application-level validation in validation.js ensures new certificates have required fields

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
      description: String,
      image: String,
      avatar: String,
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
    // New portfolio features
    imageGallery: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    seo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    socialLinks: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    sharing: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    analytics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    customCode: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    favicon: {
      type: String,
      default: "",
    },
    background: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    fonts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    statistics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
      type: String,
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

// Pre-save hook to handle incomplete certificates during updates
portfolioSchema.pre("save", function (next) {
  // Only process if certificates array exists and has items
  if (
    this.certificates &&
    Array.isArray(this.certificates) &&
    this.certificates.length > 0
  ) {
    // Filter out incomplete certificates that don't have _id
    // This allows existing certificates (with _id) to be preserved even if incomplete
    const filtered = this.certificates.filter((cert) => {
      // Handle both plain objects and Mongoose subdocuments
      const hasId = cert._id || (cert.id && cert.id.toString) || cert.id;
      const hasAllFields = cert.fileUrl && cert.fileName && cert.fileType;

      // Keep certificates with all required fields
      if (hasAllFields) {
        return true;
      }
      // Keep existing certificates (with _id) even if incomplete
      if (hasId) {
        return true;
      }
      // Filter out new incomplete certificates
      return false;
    });

    // Only update if filtering changed the array
    if (filtered.length !== this.certificates.length) {
      this.certificates = filtered;
      this.markModified("certificates");
    }
  }
  next();
});

// Index for efficient queries
portfolioSchema.index({ studentId: 1, visibility: 1 });
portfolioSchema.index({ studentId: 1, isPublic: 1 }); // Legacy support
portfolioSchema.index({ slug: 1, visibility: 1 });
portfolioSchema.index({ slug: 1, isPublic: 1 }); // Legacy support
portfolioSchema.index({ studentId: 1, status: 1 });
portfolioSchema.index({ "layout.blocks.id": 1 }); // For block queries
portfolioSchema.index({ verificationStatus: 1, portfolioRating: -1 }); // For ratings/verification queries
portfolioSchema.index({ portfolioRating: -1 }); // For global ratings
portfolioSchema.index({ createdAt: -1 }); // For admin queries, listing by recency

const Portfolio =
  mongoose.models.Portfolio || mongoose.model("Portfolio", portfolioSchema);

export default Portfolio;
