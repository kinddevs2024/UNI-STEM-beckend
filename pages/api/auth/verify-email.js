import crypto from "crypto";
import connectMongoDB from "../../../lib/mongodb.js";
import { handleCORS } from "../../../lib/middleware/cors.js";
import User from "../../../models/User.js";
import { generateToken } from "../../../lib/auth.js";
import { findUserByIdWithoutPassword } from "../../../lib/user-helper.js";
import { MAX_CODE_VERIFY_ATTEMPTS } from "../../../lib/email-constants.js";

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, token: verifyToken, code } = req.body || {};
    const verificationInput = String(verifyToken || code || "").trim();
    const normalizedEmail = String(email || "").toLowerCase().trim();

    if (!normalizedEmail || !verificationInput) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required",
      });
    }

    if (!/^\d{6}$/.test(verificationInput)) {
      return res.status(400).json({
        success: false,
        message: "Verification code must be 6 digits",
      });
    }

    await connectMongoDB();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      const authToken = generateToken(user._id.toString());
      const safeUser = await findUserByIdWithoutPassword(user._id.toString());
      return res.json({
        success: true,
        message: "Email is already verified",
        token: authToken,
        user: safeUser,
      });
    }

    if (!user.emailVerificationTokenHash || !user.emailVerificationExpires) {
      return res.status(400).json({
        success: false,
        message: "Email verification is not available for this account",
      });
    }

    if (user.emailVerificationExpires.getTime() < Date.now()) {
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpires = null;
      user.emailVerificationFailedAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(verificationInput)
      .digest("hex");

    if (tokenHash !== user.emailVerificationTokenHash) {
      user.emailVerificationFailedAttempts = (user.emailVerificationFailedAttempts || 0) + 1;

      if (user.emailVerificationFailedAttempts >= MAX_CODE_VERIFY_ATTEMPTS) {
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpires = null;
        user.emailVerificationFailedAttempts = 0;
        await user.save();
        return res.status(400).json({
          success: false,
          message: "Too many invalid attempts. Request a new verification code.",
        });
      }

      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid email verification code",
      });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    user.emailVerificationFailedAttempts = 0;
    await user.save();

    const authToken = generateToken(user._id.toString());
    const safeUser = await findUserByIdWithoutPassword(user._id.toString());

    res.json({
      success: true,
      message: "Email has been verified successfully",
      token: authToken,
      user: safeUser,
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
}
