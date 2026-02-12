import crypto from "crypto";
import connectMongoDB from "../../../lib/mongodb.js";
import { handleCORS } from "../../../lib/middleware/cors.js";
import User from "../../../models/User.js";

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, token } = req.body || {};

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: "Email and token are required",
      });
    }

    await connectMongoDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.json({
        success: true,
        message: "Email is already verified",
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
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Email verification token has expired",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    if (tokenHash !== user.emailVerificationTokenHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid email verification token",
      });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({
      success: true,
      message: "Email has been verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
}
