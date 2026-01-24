import mongoose from "mongoose";

const verificationLogSchema = new mongoose.Schema(
  {
    blockId: {
      type: String,
      required: [true, "Block ID is required"],
      index: true,
      trim: true,
    },
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: [true, "Portfolio ID is required"],
      index: true,
    },
    action: {
      type: String,
      enum: ["request", "approve", "reject", "auto-verify"],
      required: [true, "Action is required"],
      index: true,
    },
    actorId: {
      type: String,
      default: null, // null for system actions
    },
    actorType: {
      type: String,
      enum: ["student", "admin", "system", "external"],
      required: [true, "Actor type is required"],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
verificationLogSchema.index({ blockId: 1, timestamp: -1 });
verificationLogSchema.index({ portfolioId: 1, timestamp: -1 });
verificationLogSchema.index({ action: 1, timestamp: -1 });
verificationLogSchema.index({ actorType: 1, timestamp: -1 });

const VerificationLog =
  mongoose.models.VerificationLog ||
  mongoose.model("VerificationLog", verificationLogSchema);

export default VerificationLog;

